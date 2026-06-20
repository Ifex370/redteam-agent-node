import { join } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const checkovImage = "bridgecrew/checkov:3.3.0";

type CheckovFailure = {
  check_id?: string;
  check_name?: string;
  file_path?: string;
  file_line_range?: number[];
  resource?: string;
  severity?: string;
  description?: string;
  guideline?: string;
};

type CheckovReport = {
  check_type?: string;
  results?: { failed_checks?: CheckovFailure[] };
};

function severity(value?: string): NormalizedFinding["severity"] {
  switch (value?.toLowerCase()) {
    case "critical": return "critical";
    case "high": return "high";
    case "low": return "low";
    case "info": return "info";
    default: return "medium";
  }
}

export async function runCheckov(params: { runId: string; targetPath: string; asset: string }) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "checkov");
  const result = await runDockerTool({
    runId: params.runId,
    image: checkovImage,
    name: "checkov",
    network: "bridge",
    mounts: [
      { hostPath: params.targetPath, containerPath: "/src", readonly: true },
      { hostPath: outputDir, containerPath: "/out" }
    ],
    args: ["-d", "/src", "-o", "json", "--compact", "--quiet"]
  });

  await writeTextArtifact(params.runId, "tool-outputs/checkov/checkov.json", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/checkov/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/checkov/stderr.log", result.stderr);
  if (result.meta.exitCode !== 0 && result.meta.exitCode !== 1) {
    throw new Error(`Checkov failed with exit code ${result.meta.exitCode}. See tool-outputs/checkov/stderr.log.`);
  }

  const parsed = JSON.parse(result.stdout) as CheckovReport | CheckovReport[];
  const reports = Array.isArray(parsed) ? parsed : [parsed];
  const findings = reports.flatMap((report) => (report.results?.failed_checks ?? []).map((failure) => ({
    id: `finding_${nanoid(12)}`,
    source: "agent:iac-scan",
    tool: "checkov",
    title: failure.check_name ?? failure.check_id ?? "Checkov policy violation",
    severity: severity(failure.severity),
    category: "Infrastructure as Code",
    asset: params.asset,
    location: `${failure.file_path ?? "unknown"}${failure.file_line_range?.[0] ? `:${failure.file_line_range[0]}` : ""}`,
    evidence: [failure.description, failure.resource ? `Resource: ${failure.resource}` : undefined, failure.check_id ? `Policy: ${failure.check_id}` : undefined].filter(Boolean).join("\n"),
    remediation: failure.guideline ?? "Update the infrastructure definition to satisfy the failed Checkov policy.",
    raw: failure
  } satisfies NormalizedFinding)));

  return { tool: { ...result.meta, name: "checkov" }, findings, artifacts: ["tool-outputs/checkov/checkov.json", "tool-outputs/checkov/stdout.log", "tool-outputs/checkov/stderr.log"] };
}
