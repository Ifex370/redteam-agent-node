import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const semgrepImage = "semgrep/semgrep:1.99.0";
const rulesPath = resolve("rules/semgrep");

type SarifResult = {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri?: string };
      region?: { startLine?: number };
    };
  }>;
};

type SarifRule = {
  id?: string;
  name?: string;
  defaultConfiguration?: { level?: string };
  shortDescription?: { text?: string };
  fullDescription?: { text?: string };
  properties?: { precision?: string; "security-severity"?: string };
};

type SarifReport = {
  runs?: Array<{
    tool?: {
      driver?: {
        rules?: SarifRule[];
      };
    };
    results?: SarifResult[];
  }>;
};

function severityFromSarif(result: SarifResult, rule?: SarifRule): NormalizedFinding["severity"] {
  const level = result.level ?? rule?.defaultConfiguration?.level;
  if (level === "error") return "high";
  if (level === "warning") return "medium";
  if (level === "note") return "low";
  return "info";
}

export async function runSemgrep(params: {
  runId: string;
  targetPath: string;
}) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "semgrep");
  const sourcePath = resolve(params.targetPath);

  const result = await runDockerTool({
    runId: params.runId,
    image: semgrepImage,
    name: "semgrep",
    network: "none",
    mounts: [
      { hostPath: sourcePath, containerPath: "/src", readonly: true },
      { hostPath: rulesPath, containerPath: "/rules", readonly: true },
      { hostPath: outputDir, containerPath: "/out" }
    ],
    args: ["semgrep", "scan", "--metrics=off", "--config", "/rules", "--sarif", "--output", "/out/semgrep.sarif", "/src"]
  });

  await writeTextArtifact(params.runId, "tool-outputs/semgrep/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/semgrep/stderr.log", result.stderr);

  if (result.meta.exitCode !== 0) {
    throw new Error(`Semgrep failed with exit code ${result.meta.exitCode}. See tool-outputs/semgrep/stderr.log.`);
  }

  const sarifPath = join(outputDir, "semgrep.sarif");
  const sarif = JSON.parse(await readFile(sarifPath, "utf8")) as SarifReport;
  const findings = normalizeSemgrepSarif(sarif, sourcePath);

  return {
    tool: result.meta,
    findings,
    artifacts: ["tool-outputs/semgrep/semgrep.sarif", "tool-outputs/semgrep/stdout.log", "tool-outputs/semgrep/stderr.log"]
  };
}

export function normalizeSemgrepSarif(sarif: SarifReport, asset: string): NormalizedFinding[] {
  const run = sarif.runs?.[0];
  const rules = new Map((run?.tool?.driver?.rules ?? []).map((rule) => [rule.id, rule]));

  return (run?.results ?? []).map((result) => {
    const rule = rules.get(result.ruleId);
    const location = result.locations?.[0]?.physicalLocation;
    const file = location?.artifactLocation?.uri ?? "unknown";
    const line = location?.region?.startLine;
    const title = rule?.shortDescription?.text ?? rule?.name ?? result.ruleId ?? "Semgrep finding";

    return {
      id: `finding_${nanoid(12)}`,
      source: "agent:web-sast",
      tool: "semgrep",
      title,
      severity: severityFromSarif(result, rule),
      category: "Vulnerability",
      asset,
      location: line ? `${file}:${line}` : file,
      evidence: result.message?.text ?? rule?.fullDescription?.text ?? title,
      raw: result
    };
  });
}
