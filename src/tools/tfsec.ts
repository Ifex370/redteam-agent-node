import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const tfsecImage = "aquasec/tfsec:v1.28.14";
type TfsecResult = {
  rule_id?: string; rule_description?: string; description?: string; severity?: string;
  resolution?: string; resource?: string; location?: { filename?: string; start_line?: number };
};
type TfsecReport = { results?: TfsecResult[] };

function severity(value?: string): NormalizedFinding["severity"] {
  switch (value?.toLowerCase()) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    default: return "info";
  }
}

export async function runTfsec(params: { runId: string; targetPath: string; asset: string }) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "tfsec");
  const result = await runDockerTool({
    runId: params.runId, image: tfsecImage, name: "tfsec", network: "none",
    mounts: [{ hostPath: params.targetPath, containerPath: "/src", readonly: true }, { hostPath: outputDir, containerPath: "/out" }],
    args: ["/src", "--format", "json", "--out", "/out/tfsec.json", "--no-color"]
  });
  await writeTextArtifact(params.runId, "tool-outputs/tfsec/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/tfsec/stderr.log", result.stderr);
  if (result.meta.exitCode !== 0 && result.meta.exitCode !== 1) throw new Error(`tfsec failed with exit code ${result.meta.exitCode}.`);
  const report = JSON.parse(await readFile(join(outputDir, "tfsec.json"), "utf8")) as TfsecReport;
  const findings = (report.results ?? []).map((item) => ({
    id: `finding_${nanoid(12)}`, source: "agent:iac-scan", tool: "tfsec",
    title: item.rule_description ?? item.rule_id ?? "tfsec policy violation",
    severity: severity(item.severity), category: "Infrastructure as Code", asset: params.asset,
    location: `${item.location?.filename ?? "unknown"}${item.location?.start_line ? `:${item.location.start_line}` : ""}`,
    evidence: [item.description, item.resource ? `Resource: ${item.resource}` : undefined, item.rule_id ? `Policy: ${item.rule_id}` : undefined].filter(Boolean).join("\n"),
    remediation: item.resolution ?? "Update the Terraform definition to satisfy the failed tfsec policy.", raw: item
  } satisfies NormalizedFinding));
  return { tool: { ...result.meta, name: "tfsec" }, findings, artifacts: ["tool-outputs/tfsec/tfsec.json", "tool-outputs/tfsec/stdout.log", "tool-outputs/tfsec/stderr.log"] };
}
