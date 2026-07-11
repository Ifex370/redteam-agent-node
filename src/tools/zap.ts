import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const zapImage = "ghcr.io/zaproxy/zaproxy:stable";

type ZapAlert = {
  pluginid?: string;
  alert?: string;
  name?: string;
  riskcode?: string;
  riskdesc?: string;
  confidence?: string;
  desc?: string;
  solution?: string;
  reference?: string;
  instances?: Array<{
    uri?: string;
    method?: string;
    param?: string;
    evidence?: string;
  }>;
};

type ZapReport = {
  site?: Array<{
    "@name"?: string;
    alerts?: ZapAlert[];
  }>;
};

function severityFromZap(alert: ZapAlert): NormalizedFinding["severity"] {
  const risk = (alert.riskdesc ?? alert.riskcode ?? "").toLowerCase();
  if (risk.includes("critical")) return "critical";
  if (risk.includes("high") || alert.riskcode === "3") return "high";
  if (risk.includes("medium") || alert.riskcode === "2") return "medium";
  if (risk.includes("low") || alert.riskcode === "1") return "low";
  return "info";
}

export async function runZapBaseline(params: {
  runId: string;
  url: string;
}) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "zap");
  const result = await runDockerTool({
    runId: params.runId,
    image: zapImage,
    name: "zap",
    network: "bridge",
    mounts: [{ hostPath: outputDir, containerPath: "/zap/wrk" }],
    args: [
      "zap-baseline.py",
      "-t",
      params.url,
      "-J",
      "zap-report.json",
      "-r",
      "zap-report.html",
      "-I"
    ]
  });

  await writeTextArtifact(params.runId, "tool-outputs/zap/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/zap/stderr.log", result.stderr);

  if (result.meta.exitCode !== 0) {
    throw new Error(`ZAP baseline failed with exit code ${result.meta.exitCode}. See tool-outputs/zap/stderr.log.`);
  }

  let report: ZapReport = {};
  try {
    report = JSON.parse(await readFile(join(outputDir, "zap-report.json"), "utf8")) as ZapReport;
  } catch {
    report = {};
  }

  return {
    tool: result.meta,
    findings: normalizeZapReport(report, params.url),
    artifacts: [
      "tool-outputs/zap/zap-report.json",
      "tool-outputs/zap/zap-report.html",
      "tool-outputs/zap/stdout.log",
      "tool-outputs/zap/stderr.log"
    ]
  };
}

export function normalizeZapReport(report: ZapReport, asset: string): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];
  for (const site of report.site ?? []) {
    for (const alert of site.alerts ?? []) {
      const title = alert.alert ?? alert.name ?? "ZAP finding";
      const firstInstance = alert.instances?.[0];
      findings.push({
        id: `finding_${nanoid(12)}`,
        source: "agent:web-scan",
        tool: "zap",
        title,
        severity: severityFromZap(alert),
        category: "Web Vulnerability",
        asset,
        location: firstInstance?.uri ?? site["@name"] ?? asset,
        evidence: [
          alert.desc,
          firstInstance?.param ? `Parameter: ${firstInstance.param}` : undefined,
          firstInstance?.evidence ? `Evidence: ${firstInstance.evidence}` : undefined
        ].filter(Boolean).join("\n") || title,
        remediation: alert.solution,
        raw: alert
      });
    }
  }
  return findings;
}
