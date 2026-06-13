import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runDockerTool } from "./docker-runner.js";

const truffleHogImage = "trufflesecurity/trufflehog:latest";

type TruffleHogResult = {
  SourceName?: string;
  SourceType?: number;
  SourceID?: number;
  DetectorName?: string;
  DetectorType?: number;
  DecoderName?: string;
  Verified?: boolean;
  Redacted?: string;
  Raw?: string;
  RawV2?: string;
  ExtraData?: Record<string, unknown>;
  StructuredData?: Record<string, unknown>;
  SourceMetadata?: {
    Data?: {
      Filesystem?: {
        file?: string;
        line?: number;
      };
      Git?: {
        file?: string;
        line?: number;
        commit?: string;
        email?: string;
        repository?: string;
        timestamp?: string;
      };
    };
  };
};

function locationFromResult(result: TruffleHogResult) {
  const filesystem = result.SourceMetadata?.Data?.Filesystem;
  const git = result.SourceMetadata?.Data?.Git;
  const file = filesystem?.file ?? git?.file ?? result.SourceName ?? "unknown";
  const line = filesystem?.line ?? git?.line;
  return line ? `${file}:${line}` : file;
}

function sanitizeResult(result: TruffleHogResult) {
  const { Raw: _raw, RawV2: _rawV2, ...safe } = result;
  return safe;
}

function parseJsonLines(stdout: string) {
  const findings: TruffleHogResult[] = [];
  const errors: string[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      findings.push(JSON.parse(trimmed) as TruffleHogResult);
    } catch {
      errors.push(trimmed);
    }
  }

  return { findings, errors };
}

export async function runTruffleHog(params: {
  runId: string;
  targetPath: string;
}) {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "trufflehog");
  const sourcePath = resolve(params.targetPath);

  const result = await runDockerTool({
    runId: params.runId,
    image: truffleHogImage,
    name: "trufflehog",
    network: "none",
    mounts: [
      { hostPath: sourcePath, containerPath: "/src", readonly: true },
      { hostPath: outputDir, containerPath: "/out" }
    ],
    args: ["filesystem", "/src", "--json", "--no-update"]
  });

  await writeTextArtifact(params.runId, "tool-outputs/trufflehog/trufflehog.jsonl", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/trufflehog/stdout.log", result.stdout);
  await writeTextArtifact(params.runId, "tool-outputs/trufflehog/stderr.log", result.stderr);

  if (result.meta.exitCode !== 0) {
    throw new Error(`TruffleHog failed with exit code ${result.meta.exitCode}. See tool-outputs/trufflehog/stderr.log.`);
  }

  const parsed = parseJsonLines(result.stdout);
  if (parsed.errors.length > 0) {
    await writeTextArtifact(params.runId, "tool-outputs/trufflehog/parse-warnings.log", parsed.errors.join("\n"));
  }

  return {
    tool: result.meta,
    findings: normalizeTruffleHogResults(parsed.findings, sourcePath),
    artifacts: [
      "tool-outputs/trufflehog/trufflehog.jsonl",
      "tool-outputs/trufflehog/stdout.log",
      "tool-outputs/trufflehog/stderr.log"
    ]
  };
}

export function normalizeTruffleHogResults(results: TruffleHogResult[], asset: string): NormalizedFinding[] {
  return results.map((result) => {
    const detector = result.DetectorName ?? "Secret";
    const verifiedLabel = result.Verified ? "verified" : "unverified";
    const redacted = result.Redacted ? `Redacted secret: ${result.Redacted}` : "A potential secret was detected.";

    return {
      id: `finding_${nanoid(12)}`,
      source: "agent:web-sast",
      tool: "trufflehog",
      title: `TruffleHog ${verifiedLabel} secret: ${detector}`,
      severity: result.Verified ? "high" : "medium",
      category: "Secret Exposure",
      asset,
      location: locationFromResult(result),
      evidence: redacted,
      remediation: "Rotate the exposed secret if valid, remove it from source history, and move secret material into an approved secret store.",
      raw: sanitizeResult(result)
    };
  });
}
