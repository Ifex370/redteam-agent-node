import { NormalizedFinding, RunSummary } from "../domain/schemas.js";
import { writeJsonArtifact } from "../artifacts/artifact-store.js";

function countBySeverity(findings: NormalizedFinding[]) {
  return findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});
}

export async function writeSynapDomeExport(summary: RunSummary) {
  const payload = {
    tenantId: summary.tenantId,
    engagementId: summary.engagementId,
    runId: summary.runId,
    status: summary.status,
    summary: {
      title: `Agent ${summary.template} run completed`,
      toolsRun: summary.toolsRun.map((tool) => tool.name),
      findingCount: summary.findingCount,
      bySeverity: countBySeverity(summary.findings),
      durationMs: summary.durationMs
    },
    steps: summary.steps,
    findings: summary.findings.map((finding) => ({
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      asset: finding.asset,
      location: finding.location,
      evidence: finding.evidence,
      remediation: finding.remediation,
      source: finding.source,
      tool: finding.tool,
      confidence: finding.severity === "info" || finding.severity === "low" ? "medium" : "high",
      rawArtifactKey: `tool-outputs/${finding.tool}`
    })),
    artifacts: summary.artifacts
  };

  await writeJsonArtifact(summary.runId, "exports/synapdome-export.json", payload);
  return "exports/synapdome-export.json";
}
