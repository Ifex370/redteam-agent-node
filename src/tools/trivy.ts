import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const trivyImage = "aquasec/trivy:0.58.1";

type TrivyVulnerability = {
  VulnerabilityID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Severity?: string;
  Title?: string;
  Description?: string;
  References?: string[];
};

type TrivyReport = {
  Results?: Array<{
    Target?: string;
    Class?: string;
    Type?: string;
    Vulnerabilities?: TrivyVulnerability[];
  }>;
};

function severityFromTrivy(severity?: string): NormalizedFinding["severity"] {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "info";
  }
}

export async function runTrivyImageTar(params: {
  runId: string;
  imageTarPath: string;
  asset: string;
}) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "trivy");
  const cacheDir = join(runArtifactDir(params.runId), "tool-cache", "trivy");

  const result = await runDockerTool({
    runId: params.runId,
    image: trivyImage,
    name: "trivy",
    network: "bridge",
    mounts: [
      { hostPath: join(outputDir, "input"), containerPath: "/input" },
      { hostPath: cacheDir, containerPath: "/root/.cache/trivy" },
      { hostPath: outputDir, containerPath: "/out" }
    ],
    args: [
      "image",
      "--input",
      "/input/image.tar",
      "--format",
      "json",
      "--output",
      "/out/trivy.json",
      "--exit-code",
      "0"
    ]
  });

  await writeTextArtifact(params.runId, "tool-outputs/trivy/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/trivy/stderr.log", result.stderr);

  if (result.meta.exitCode !== 0) {
    throw new Error(`Trivy failed with exit code ${result.meta.exitCode}. See tool-outputs/trivy/stderr.log.`);
  }

  const report = JSON.parse(await readFile(join(outputDir, "trivy.json"), "utf8")) as TrivyReport;
  return {
    tool: result.meta,
    findings: normalizeTrivyReport(report, params.asset),
    artifacts: ["tool-outputs/trivy/trivy.json", "tool-outputs/trivy/stdout.log", "tool-outputs/trivy/stderr.log"]
  };
}

export function normalizeTrivyReport(report: TrivyReport, asset: string): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];
  for (const result of report.Results ?? []) {
    for (const vuln of result.Vulnerabilities ?? []) {
      const pkg = vuln.PkgName ?? "unknown package";
      findings.push({
        id: `finding_${nanoid(12)}`,
        source: "agent:container-scan",
        tool: "trivy",
        title: vuln.Title ?? `${vuln.VulnerabilityID ?? "Vulnerability"} in ${pkg}`,
        severity: severityFromTrivy(vuln.Severity),
        category: "Vulnerability",
        asset,
        location: `${result.Target ?? "image"}:${pkg}`,
        evidence: [
          vuln.Description,
          vuln.InstalledVersion ? `Installed: ${vuln.InstalledVersion}` : undefined,
          vuln.FixedVersion ? `Fixed: ${vuln.FixedVersion}` : undefined
        ].filter(Boolean).join("\n"),
        remediation: vuln.FixedVersion ? `Upgrade ${pkg} to ${vuln.FixedVersion} or later.` : undefined,
        raw: vuln
      });
    }
  }
  return findings;
}
