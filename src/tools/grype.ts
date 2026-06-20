import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { appConfig } from "../config.js";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const grypeImage = "anchore/grype:v0.114.0";

type GrypeMatch = {
  vulnerability?: {
    id?: string;
    severity?: string;
    description?: string;
    urls?: string[];
    fix?: {
      versions?: string[];
      state?: string;
    };
    risk?: number;
  };
  artifact?: {
    name?: string;
    version?: string;
    type?: string;
    language?: string;
    purl?: string;
    locations?: Array<{
      path?: string;
      accessPath?: string;
    }>;
  };
  matchDetails?: Array<{
    type?: string;
    fix?: {
      suggestedVersion?: string;
    };
  }>;
};

type GrypeReport = {
  matches?: GrypeMatch[];
  descriptor?: {
    name?: string;
    version?: string;
  };
};

function severityFromGrype(severity?: string): NormalizedFinding["severity"] {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
    case "negligible":
      return "low";
    default:
      return "info";
  }
}

export async function runGrypeFilesystem(params: {
  runId: string;
  targetPath: string;
  asset: string;
}) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "grype");

  const result = await runDockerTool({
    runId: params.runId,
    image: grypeImage,
    name: "grype",
    network: "bridge",
    mounts: [
      { hostPath: params.targetPath, containerPath: "/src", readonly: true },
      { hostPath: appConfig.grype.cacheRoot, containerPath: "/.cache/grype" },
      { hostPath: outputDir, containerPath: "/out" }
    ],
    args: [
      "dir:/src",
      "--output",
      "json",
      "--file",
      "/out/grype.json"
    ]
  });

  await writeTextArtifact(params.runId, "tool-outputs/grype/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/grype/stderr.log", result.stderr);

  if (result.meta.exitCode !== 0) {
    throw new Error(`Grype dependency scan failed with exit code ${result.meta.exitCode}. See tool-outputs/grype/stderr.log.`);
  }

  const report = JSON.parse(await readFile(join(outputDir, "grype.json"), "utf8")) as GrypeReport;
  return {
    tool: result.meta,
    findings: normalizeGrypeReport(report, params.asset),
    artifacts: ["tool-outputs/grype/grype.json", "tool-outputs/grype/stdout.log", "tool-outputs/grype/stderr.log"]
  };
}

export function normalizeGrypeReport(report: GrypeReport, asset: string): NormalizedFinding[] {
  return (report.matches ?? []).map((match) => {
    const vulnerability = match.vulnerability ?? {};
    const artifact = match.artifact ?? {};
    const packageName = artifact.name ?? "unknown package";
    const installedVersion = artifact.version;
    const fixedVersions = vulnerability.fix?.versions ?? [];
    const suggestedVersion = match.matchDetails?.find((detail) => detail.fix?.suggestedVersion)?.fix?.suggestedVersion;
    const fixedVersion = suggestedVersion ?? fixedVersions[0];
    const location = artifact.locations?.[0]?.path ?? artifact.locations?.[0]?.accessPath ?? "dependency manifest";

    return {
      id: `finding_${nanoid(12)}`,
      source: "agent:dependency-scan",
      tool: "grype",
      title: `${vulnerability.id ?? "Vulnerability"} in ${packageName}`,
      severity: severityFromGrype(vulnerability.severity),
      category: "Vulnerability",
      asset,
      location: `${location}:${packageName}`,
      evidence: [
        vulnerability.description,
        installedVersion ? `Installed: ${installedVersion}` : undefined,
        fixedVersion ? `Fixed: ${fixedVersion}` : undefined
      ].filter(Boolean).join("\n"),
      remediation: fixedVersion
        ? `Upgrade ${packageName} to ${fixedVersion} or later.`
        : `Review ${packageName} and apply the vendor-recommended remediation.`,
      raw: match
    };
  });
}
