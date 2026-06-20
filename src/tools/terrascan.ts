import { join } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const terrascanImage = "tenable/terrascan:1.19.9";
type Violation = { rule_name?: string; description?: string; rule_id?: string; severity?: string; category?: string; resource_name?: string; resource_type?: string; file?: string; line?: number };
type Report = { results?: { violations?: Violation[] } };
function severity(value?: string): NormalizedFinding["severity"] {
  switch (value?.toLowerCase()) { case "critical": return "critical"; case "high": return "high"; case "medium": return "medium"; case "low": return "low"; default: return "info"; }
}

export async function runTerrascan(params: { runId: string; targetPath: string; asset: string }) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "terrascan");
  const result = await runDockerTool({
    runId: params.runId, image: terrascanImage, name: "terrascan", network: "bridge",
    mounts: [{ hostPath: params.targetPath, containerPath: "/src", readonly: true }, { hostPath: outputDir, containerPath: "/out" }],
    args: ["scan", "-i", "terraform", "-d", "/src", "-o", "json"]
  });
  await writeTextArtifact(params.runId, "tool-outputs/terrascan/terrascan.json", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/terrascan/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/terrascan/stderr.log", result.stderr);
  if (result.meta.exitCode !== 0 && result.meta.exitCode !== 3) throw new Error(`Terrascan failed with exit code ${result.meta.exitCode}.`);
  const report = JSON.parse(result.stdout) as Report;
  const findings = (report.results?.violations ?? []).map((item) => ({
    id: `finding_${nanoid(12)}`, source: "agent:iac-scan", tool: "terrascan",
    title: item.description ?? item.rule_name ?? item.rule_id ?? "Terrascan policy violation",
    severity: severity(item.severity), category: item.category ?? "Infrastructure as Code", asset: params.asset,
    location: `${item.file ?? "unknown"}${item.line ? `:${item.line}` : ""}`,
    evidence: [item.description, item.resource_type && item.resource_name ? `Resource: ${item.resource_type}.${item.resource_name}` : undefined, item.rule_id ? `Policy: ${item.rule_id}` : undefined].filter(Boolean).join("\n"),
    remediation: "Update the infrastructure definition to satisfy the failed Terrascan policy.", raw: item
  } satisfies NormalizedFinding));
  return { tool: { ...result.meta, name: "terrascan" }, findings, artifacts: ["tool-outputs/terrascan/terrascan.json", "tool-outputs/terrascan/stdout.log", "tool-outputs/terrascan/stderr.log"] };
}
