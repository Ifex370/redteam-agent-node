import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { EngagementRunInput, RunSummary } from "../domain/schemas.js";
import { appConfig } from "../config.js";
import { ensureRunDirs, listArtifacts, runArtifactDir, writeFindingsExport, writeJsonArtifact } from "../artifacts/artifact-store.js";
import { publishRunEvent } from "../events/run-events.js";
import { sendErrorCallback, sendInputRequestCallback, sendResultsCallback, sendStatusCallback } from "../events/callback-events.js";
import { assertRunIsAllowed } from "../security/safety-gate.js";
import { writeDastHtmlReport } from "../reports/dast-html-report.js";
import { downloadArtifact } from "../tools/fetch-artifact.js";
import { runCodeQl } from "../tools/codeql.js";
import { runCheckov } from "../tools/checkov.js";
import { runDirectoryEnumeration } from "../tools/directory-enumeration.js";
import { cloneGitRepo } from "../tools/git-runner.js";
import { runGrypeFilesystem } from "../tools/grype.js";
import { runMobSf } from "../tools/mobsf.js";
import { runNuclei } from "../tools/nuclei.js";
import { runSemgrep } from "../tools/semgrep.js";
import { runTerrascan } from "../tools/terrascan.js";
import { runTfsec } from "../tools/tfsec.js";
import { runTruffleHog } from "../tools/trufflehog.js";
import { runTrivyFilesystem, runTrivyImageTar } from "../tools/trivy.js";
import { runZapBaseline } from "../tools/zap.js";
import { InputRequiredError, isInputRequiredError } from "./input-required.js";
import { planRun } from "./planner.js";
import { writeSynapDomeExport } from "./synapdome-exporter.js";

function createBaseSummary(input: EngagementRunInput, startedAt: string): RunSummary {
  if (!input.runId) {
    throw new Error("Job is missing runId.");
  }

  return {
    runId: input.runId,
    tenantId: input.tenantId,
    engagementId: input.engagementId,
    template: input.template,
    status: "validating",
    startedAt,
    steps: [],
    inputRequests: [],
    toolsRun: [],
    findingCount: 0,
    findings: [],
    artifacts: []
  };
}

function callbackPhase(status: RunSummary["status"]) {
  if (status === "running_tool") return "executing";
  if (status === "analyzing_results" || status === "normalizing") return "analyzing";
  return status;
}

function toolMetas(toolResult: {
  tool: RunSummary["toolsRun"][number];
  tools?: RunSummary["toolsRun"];
}) {
  return toolResult.tools ?? [toolResult.tool];
}

async function writeStatus(input: EngagementRunInput, summary: RunSummary, status: RunSummary["status"], data?: unknown) {
  summary.status = status;
  await publishRunEvent({
    runId: summary.runId,
    type: "status",
    message: status,
    data: data ?? { status }
  });
  await sendStatusCallback(input, callbackPhase(status), `Run status changed to ${status}`);
}

export async function processRun(input: EngagementRunInput) {
  const runId = input.runId;
  if (!runId) {
    throw new Error("Job is missing runId.");
  }

  const startedAt = new Date().toISOString();
  const started = performance.now();
  await ensureRunDirs(runId);
  await writeJsonArtifact(runId, "input.engagement.json", input);

  const summary = createBaseSummary(input, startedAt);

  try {
    await writeStatus(input, summary, "validating");
    assertRunIsAllowed(input);

    await writeStatus(input, summary, "planning");
    const plan = planRun(input);
    summary.steps = plan.steps;
    await writeJsonArtifact(runId, "plan.json", plan);

    let targetPath = plan.targetPath;
    if (plan.repoTarget) {
      const checkout = await cloneGitRepo({
        runId,
        url: plan.repoTarget.url,
        branch: plan.repoTarget.branch,
        destination: join(runArtifactDir(runId), "workspace", "repo"),
        depth: plan.repoTarget.fullHistory ? undefined : 1
      });
      targetPath = checkout.path;
      await writeJsonArtifact(runId, "workspace/repo-source.json", checkout);
    }

    let imageTarPath: string | undefined;
    let imageAsset = plan.containerTarget?.image ?? "container_image";
    if (plan.containerTarget?.fetchUrl) {
      imageTarPath = join(runArtifactDir(runId), "tool-outputs", "trivy", "input", "image.tar");
      await downloadArtifact({
        runId,
        url: plan.containerTarget.fetchUrl,
        destination: imageTarPath
      });
      imageAsset = plan.containerTarget.fetchUrl;
      await writeJsonArtifact(runId, "workspace/container-source.json", {
        fetchUrlHost: new URL(plan.containerTarget.fetchUrl).hostname,
        downloadedTo: "tool-outputs/trivy/input/image.tar"
      });
    }

    let mobileAppPath: string | undefined;
    let mobileAsset = "mobile_app";
    if (plan.mobileTarget) {
      const safeFileName = plan.mobileTarget.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      mobileAppPath = join(runArtifactDir(runId), "tool-outputs", "mobsf", "input", safeFileName);
      await downloadArtifact({
        runId,
        url: plan.mobileTarget.fetchUrl,
        destination: mobileAppPath,
        maxBytes: appConfig.mobsf.maxUploadBytes
      });
      mobileAsset = plan.mobileTarget.fetchUrl;
      await writeJsonArtifact(runId, "workspace/mobile-source.json", {
        fetchUrlHost: new URL(plan.mobileTarget.fetchUrl).hostname,
        fileName: plan.mobileTarget.fileName,
        downloadedTo: `tool-outputs/mobsf/input/${safeFileName}`
      });
    }

    if (!targetPath && !imageTarPath && !mobileAppPath && !plan.urlTarget) {
      throw new InputRequiredError({
        id: `input_missing_target_${Date.now()}`,
        status: "open",
        question: "The planner could not resolve a source path to scan.",
        requiredFields: [{ key: "targets[0]", label: "Scan target" }],
        resumeAction: "provide_missing_target",
        createdAt: new Date().toISOString()
      });
    }

    for (const step of summary.steps) {
      if (!["semgrep", "trufflehog", "codeql", "trivy", "grype", "checkov", "tfsec", "terrascan", "mobsf", "trivy-image", "nuclei", "zap", "directory-enumeration"].includes(step.tool)) {
        step.status = "skipped";
        step.error = `No adapter implemented for ${step.tool}`;
        continue;
      }

      await writeStatus(input, summary, "running_tool", { status: "running_tool", step });
      step.status = "running";
      step.startedAt = new Date().toISOString();

      const toolResult = step.tool === "semgrep"
        ? await runSemgrep({ runId, targetPath: targetPath! })
        : step.tool === "trufflehog"
          ? await runTruffleHog({
            runId,
            targetPath: targetPath!,
            scanMode: input.template === "secrets-scan" && Boolean(plan.repoTarget) ? "git" : "filesystem",
            source: `agent:${input.template}`
          })
          : step.tool === "codeql"
            ? await runCodeQl({ runId, targetPath: targetPath! })
            : step.tool === "trivy"
              ? await runTrivyFilesystem({
                runId,
                targetPath: targetPath!,
                asset: plan.repoTarget?.url ?? targetPath!
              })
              : step.tool === "grype"
                ? await runGrypeFilesystem({
                  runId,
                  targetPath: targetPath!,
                  asset: plan.repoTarget?.url ?? targetPath!
                })
                : step.tool === "checkov"
                  ? await runCheckov({ runId, targetPath: targetPath!, asset: plan.repoTarget?.url ?? targetPath! })
                  : step.tool === "tfsec"
                    ? await runTfsec({ runId, targetPath: targetPath!, asset: plan.repoTarget?.url ?? targetPath! })
                    : step.tool === "terrascan"
                      ? await runTerrascan({ runId, targetPath: targetPath!, asset: plan.repoTarget?.url ?? targetPath! })
                      : step.tool === "mobsf"
                        ? await runMobSf({
                          runId,
                          appPath: mobileAppPath!,
                          fileName: plan.mobileTarget!.fileName,
                          asset: mobileAsset
                        })
                        : step.tool === "nuclei"
                          ? await runNuclei({ runId, url: plan.urlTarget!.url })
                          : step.tool === "zap"
                            ? await runZapBaseline({ runId, url: plan.urlTarget!.url })
                            : step.tool === "directory-enumeration"
                              ? await runDirectoryEnumeration({
                                runId,
                                url: plan.urlTarget!.url,
                                requestedTools: input.policy.tools
                              })
                              : await runTrivyImageTar({ runId, imageTarPath: imageTarPath!, asset: imageAsset });
      step.status = "succeeded";
      step.completedAt = new Date().toISOString();
      step.findingCount = toolResult.findings.length;
      step.artifacts = toolResult.artifacts;
      summary.toolsRun.push(...toolMetas(toolResult));
      summary.findings.push(...toolResult.findings);

      await writeStatus(input, summary, "analyzing_results", { status: "analyzing_results", step });
      for (const finding of toolResult.findings) {
        await publishRunEvent({
          runId,
          type: "finding",
          message: finding.title,
          data: finding
        });
      }
    }

    await writeStatus(input, summary, "normalizing");
    summary.status = "succeeded";
    summary.completedAt = new Date().toISOString();
    summary.durationMs = Math.round(performance.now() - started);
    summary.findingCount = summary.findings.length;
    await writeFindingsExport(runId, summary.findings);
    if (input.template === "web-dast" || input.template === "web-scan") {
      await writeDastHtmlReport(summary, input);
    }
    summary.artifacts = await listArtifacts(runId);
    summary.synapdomeExportKey = await writeSynapDomeExport(summary);
    summary.artifacts = await listArtifacts(runId);
    await writeJsonArtifact(runId, "run-summary.json", summary);
    await publishRunEvent({
      runId,
      type: "complete",
      message: "Run completed",
      data: { status: summary.status, findingCount: summary.findingCount, exportKey: summary.synapdomeExportKey }
    });
    await sendResultsCallback(input, summary);
    return summary;
  } catch (error) {
    summary.completedAt = new Date().toISOString();
    summary.durationMs = Math.round(performance.now() - started);
    summary.findingCount = summary.findings.length;

    if (isInputRequiredError(error)) {
      summary.status = "awaiting_input";
      summary.inputRequests.push(error.request);
      summary.artifacts = await listArtifacts(runId);
      await writeJsonArtifact(runId, "run-summary.json", summary);
      await publishRunEvent({
        runId,
        type: "status",
        message: "awaiting_input",
        data: { status: "awaiting_input", inputRequest: error.request }
      });
      await sendInputRequestCallback(input, error.request);
      return summary;
    }

    summary.status = "failed";
    summary.error = error instanceof Error ? error.message : String(error);
    const runningStep = summary.steps.find((step) => step.status === "running");
    if (runningStep) {
      runningStep.status = "failed";
      runningStep.completedAt = new Date().toISOString();
      runningStep.error = summary.error;
    }
    summary.artifacts = await listArtifacts(runId);
    await writeJsonArtifact(runId, "run-summary.json", summary);
    await publishRunEvent({ runId, type: "error", message: summary.error });
    await sendErrorCallback(input, summary.error);
    throw error;
  }
}
