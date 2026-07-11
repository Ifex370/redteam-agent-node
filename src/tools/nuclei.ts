import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const nucleiImage = "projectdiscovery/nuclei:v3.3.8";

type NucleiJsonLine = {
  "template-id"?: string;
  "template-url"?: string;
  info?: {
    name?: string;
    severity?: string;
    description?: string;
    remediation?: string;
    classification?: {
      "cve-id"?: string | string[];
      "cwe-id"?: string | string[];
    };
  };
  host?: string;
  matched?: string;
  "matched-at"?: string;
  "extracted-results"?: string[];
  "curl-command"?: string;
  timestamp?: string;
};

function severityFromNuclei(severity?: string): NormalizedFinding["severity"] {
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

export async function runNuclei(params: {
  runId: string;
  url: string;
}) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "nuclei");
  const result = await runDockerTool({
    runId: params.runId,
    image: nucleiImage,
    name: "nuclei",
    network: "bridge",
    mounts: [{ hostPath: outputDir, containerPath: "/out" }],
    args: [
      "-u",
      params.url,
      "-jsonl",
      "-o",
      "/out/nuclei.jsonl",
      "-severity",
      "critical,high,medium,low,info",
      "-stats",
      "-silent"
    ]
  });

  await writeTextArtifact(params.runId, "tool-outputs/nuclei/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/nuclei/stderr.log", result.stderr);

  if (result.meta.exitCode !== 0) {
    throw new Error(`Nuclei failed with exit code ${result.meta.exitCode}. See tool-outputs/nuclei/stderr.log.`);
  }

  let raw = "";
  try {
    raw = await readFile(join(outputDir, "nuclei.jsonl"), "utf8");
  } catch {
    raw = "";
  }

  return {
    tool: result.meta,
    findings: normalizeNucleiJsonl(raw, params.url),
    artifacts: ["tool-outputs/nuclei/nuclei.jsonl", "tool-outputs/nuclei/stdout.log", "tool-outputs/nuclei/stderr.log"]
  };
}

export function normalizeNucleiJsonl(raw: string, asset: string): NormalizedFinding[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as NucleiJsonLine)
    .map((item) => {
      const title = item.info?.name ?? item["template-id"] ?? "Nuclei finding";
      const location = item["matched-at"] ?? item.matched ?? item.host ?? asset;
      return {
        id: `finding_${nanoid(12)}`,
        source: "agent:web-scan",
        tool: "nuclei",
        title,
        severity: severityFromNuclei(item.info?.severity),
        category: "Web Vulnerability",
        asset,
        location,
        evidence: [
          item.info?.description,
          item["template-id"] ? `Template: ${item["template-id"]}` : undefined,
          item["extracted-results"]?.length ? `Extracted: ${item["extracted-results"].join(", ")}` : undefined
        ].filter(Boolean).join("\n") || title,
        remediation: item.info?.remediation,
        raw: item
      } satisfies NormalizedFinding;
    });
}
