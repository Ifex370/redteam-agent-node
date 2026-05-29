import { performance } from "node:perf_hooks";
import { join } from "node:path";
import { EngagementRunInput, RunSummary } from "../domain/schemas.js";
import { ensureRunDirs, listArtifacts, runArtifactDir, writeFindingsExport, writeJsonArtifact } from "../artifacts/artifact-store.js";
import { publishRunEvent } from "../events/run-events.js";
import { assertRunIsAllowed } from "../security/safety-gate.js";
import { cloneGitRepo } from "../tools/git-runner.js";
import { runSemgrep } from "../tools/semgrep.js";
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

async function writeStatus(summary: RunSummary, status: RunSummary["status"], data?: unknown) {
  summary.status = status;
  await publishRunEvent({
    runId: summary.runId,
    type: "status",
    message: status,
    data: data ?? { status }
  });
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
    await writeStatus(summary, "validating");
    assertRunIsAllowed(input);

    await writeStatus(summary, "planning");
    const plan = planRun(input);
    summary.steps = plan.steps;
    await writeJsonArtifact(runId, "plan.json", plan);

    let targetPath = plan.targetPath;
    if (plan.repoTarget) {
      const checkout = await cloneGitRepo({
        runId,
        url: plan.repoTarget.url,
        branch: plan.repoTarget.branch,
        destination: join(runArtifactDir(runId), "workspace", "repo")
      });
      targetPath = checkout.path;
      await writeJsonArtifact(runId, "workspace/repo-source.json", checkout);
    }

    if (!targetPath) {
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
      if (step.tool !== "semgrep") {
        step.status = "skipped";
        step.error = `No adapter implemented for ${step.tool}`;
        continue;
      }

      await writeStatus(summary, "running_tool", { status: "running_tool", step });
      step.status = "running";
      step.startedAt = new Date().toISOString();

      const semgrepResult = await runSemgrep({ runId, targetPath });
      step.status = "succeeded";
      step.completedAt = new Date().toISOString();
      step.findingCount = semgrepResult.findings.length;
      step.artifacts = semgrepResult.artifacts;
      summary.toolsRun.push(semgrepResult.tool);
      summary.findings.push(...semgrepResult.findings);

      await writeStatus(summary, "analyzing_results", { status: "analyzing_results", step });
      for (const finding of semgrepResult.findings) {
        await publishRunEvent({
          runId,
          type: "finding",
          message: finding.title,
          data: finding
        });
      }
    }

    await writeStatus(summary, "normalizing");
    summary.status = "succeeded";
    summary.completedAt = new Date().toISOString();
    summary.durationMs = Math.round(performance.now() - started);
    summary.findingCount = summary.findings.length;
    await writeFindingsExport(runId, summary.findings);
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
    throw error;
  }
}
