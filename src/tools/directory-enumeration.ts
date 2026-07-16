import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { nanoid } from "nanoid";
import { writeFile } from "node:fs/promises";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeJsonArtifact, writeTextArtifact } from "../artifacts/artifact-store.js";
import { deduplicateDirectoryEntries } from "../directory/directory-result.deduplicator.js";
import { DirectoryScanContext, DirectoryScanEntry, DirectoryScanError, DirectoryScanResponse } from "../directory/directory-result.schema.js";
import { feroxbusterAdapter } from "../directory/adapters/feroxbuster.adapter.js";
import { ffufAdapter } from "../directory/adapters/ffuf.adapter.js";
import { runDockerTool } from "./docker-runner.js";

const feroxbusterImage = "epi052/feroxbuster:latest";
const ffufImage = "ghcr.io/ffuf/ffuf:latest";
const defaultWordlist = [
  "admin",
  "api",
  "assets",
  "backup",
  "config",
  "css",
  "dashboard",
  "docs",
  "images",
  "js",
  "login",
  "logout",
  "robots.txt",
  "sitemap.xml",
  "static",
  "uploads"
].join("\n");

type DirectoryToolResult = {
  name: string;
  meta?: {
    name: string;
    image: string;
    exitCode: number | null;
    startedAt: string;
    completedAt: string;
  };
  entries: DirectoryScanEntry[];
  artifacts: string[];
  error?: DirectoryScanError;
};

function directorySummary(results: DirectoryScanEntry[], errors: DirectoryScanError[]) {
  return {
    totalDiscovered: results.length,
    directories: results.filter((item) => item.resourceType === "directory").length,
    files: results.filter((item) => item.resourceType === "file").length,
    endpoints: results.filter((item) => item.resourceType === "endpoint").length,
    redirects: results.filter((item) => item.resourceType === "redirect").length,
    errors: errors.length
  };
}

function buildFfufUrl(target: string) {
  const parsed = new URL(target);
  parsed.hash = "";
  parsed.search = "";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.toString().replace(/\/$/, "")}/FUZZ`;
}

async function ensureWordlist(runId: string) {
  const wordlistDir = join(runArtifactDir(runId), "wordlists", "directory-enumeration");
  await mkdir(wordlistDir, { recursive: true });
  const wordlistPath = join(wordlistDir, "common.txt");
  await writeFile(wordlistPath, `${defaultWordlist}\n`, "utf8");
  return wordlistPath;
}

async function runFeroxbuster(params: { runId: string; url: string; context: DirectoryScanContext; wordlistPath: string }): Promise<DirectoryToolResult> {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "feroxbuster");
  const artifacts = [
    "tool-outputs/feroxbuster/feroxbuster.jsonl",
    "tool-outputs/feroxbuster/stdout.log",
    "tool-outputs/feroxbuster/stderr.log"
  ];
  try {
    const result = await runDockerTool({
      runId: params.runId,
      image: feroxbusterImage,
      name: "feroxbuster",
      network: "bridge",
      mounts: [
        { hostPath: outputDir, containerPath: "/out" },
        { hostPath: params.wordlistPath, containerPath: "/wordlists/common.txt", readonly: true }
      ],
      args: [
        "-u", params.url,
        "-w", "/wordlists/common.txt",
        "--json",
        "-o", "/out/feroxbuster.jsonl",
        "--depth", "1",
        "--threads", "10",
        "--rate-limit", "50",
        "-k"
      ]
    });
    await writeTextArtifact(params.runId, "tool-outputs/feroxbuster/stdout.log", result.stdout);
    await writeTextArtifact(params.runId, "tool-outputs/feroxbuster/stderr.log", result.stderr);
    const raw = await readFile(join(outputDir, "feroxbuster.jsonl"), "utf8").catch(() => result.stdout);
    return {
      name: "feroxbuster",
      meta: result.meta,
      entries: result.meta.exitCode === 0 ? feroxbusterAdapter.normalize(raw, params.context) : [],
      artifacts,
      error: result.meta.exitCode === 0 ? undefined : {
        tool: "feroxbuster",
        code: "TOOL_EXIT_NONZERO",
        message: `Feroxbuster exited with code ${result.meta.exitCode}. See tool-outputs/feroxbuster/stderr.log.`
      }
    };
  } catch (error) {
    return {
      name: "feroxbuster",
      entries: [],
      artifacts,
      error: {
        tool: "feroxbuster",
        code: "TOOL_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

async function runFfuf(params: { runId: string; url: string; context: DirectoryScanContext; wordlistPath: string }): Promise<DirectoryToolResult> {
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "ffuf");
  const artifacts = [
    "tool-outputs/ffuf/ffuf.json",
    "tool-outputs/ffuf/stdout.log",
    "tool-outputs/ffuf/stderr.log"
  ];
  try {
    const result = await runDockerTool({
      runId: params.runId,
      image: ffufImage,
      name: "ffuf",
      network: "bridge",
      mounts: [
        { hostPath: outputDir, containerPath: "/out" },
        { hostPath: params.wordlistPath, containerPath: "/wordlists/common.txt", readonly: true }
      ],
      args: [
        "-u", buildFfufUrl(params.url),
        "-w", "/wordlists/common.txt",
        "-of", "json",
        "-o", "/out/ffuf.json",
        "-mc", "200,204,301,302,307,308,401,403,405",
        "-t", "10",
        "-rate", "50",
        "-noninteractive"
      ]
    });
    await writeTextArtifact(params.runId, "tool-outputs/ffuf/stdout.log", result.stdout);
    await writeTextArtifact(params.runId, "tool-outputs/ffuf/stderr.log", result.stderr);
    const raw = JSON.parse(await readFile(join(outputDir, "ffuf.json"), "utf8").catch(() => "{\"results\":[]}"));
    return {
      name: "ffuf",
      meta: result.meta,
      entries: result.meta.exitCode === 0 ? ffufAdapter.normalize(raw, params.context) : [],
      artifacts,
      error: result.meta.exitCode === 0 ? undefined : {
        tool: "ffuf",
        code: "TOOL_EXIT_NONZERO",
        message: `ffuf exited with code ${result.meta.exitCode}. See tool-outputs/ffuf/stderr.log.`
      }
    };
  } catch (error) {
    return {
      name: "ffuf",
      entries: [],
      artifacts,
      error: {
        tool: "ffuf",
        code: "TOOL_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function findingsFromDirectoryResponse(response: DirectoryScanResponse): NormalizedFinding[] {
  return response.results.map((entry) => ({
    id: `finding_${nanoid(12)}`,
    source: "agent:directory-enumeration",
    tool: entry.firstDiscoveredBy,
    title: `Discovered ${entry.resourceType}: ${entry.path}`,
    severity: "info",
    category: "Directory Enumeration",
    asset: response.target,
    location: entry.url,
    evidence: [
      entry.statusCode ? `Status: ${entry.statusCode}` : undefined,
      entry.contentLength !== undefined ? `Content length: ${entry.contentLength}` : undefined,
      entry.contentType ? `Content type: ${entry.contentType}` : undefined,
      entry.redirectLocation ? `Redirects to: ${entry.redirectLocation}` : undefined,
      `Sources: ${entry.sources.join(", ")}`,
      `Confidence: ${entry.confidence}`
    ].filter(Boolean).join("\n"),
    raw: entry
  }));
}

export async function runDirectoryEnumeration(params: {
  runId: string;
  url: string;
  requestedTools?: string[];
}) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const requested = params.requestedTools?.length ? params.requestedTools : ["feroxbuster", "ffuf"];
  const selectedTools = requested.filter((tool) => tool === "feroxbuster" || tool === "ffuf");
  if (selectedTools.length === 0) {
    throw new Error("No supported directory-enumeration tools requested. Supported tools: feroxbuster, ffuf.");
  }

  const context: DirectoryScanContext = {
    scanId: params.runId,
    target: params.url,
    startedAt
  };
  const wordlistPath = await ensureWordlist(params.runId);
  const toolResults: DirectoryToolResult[] = [];

  if (selectedTools.includes("feroxbuster")) {
    toolResults.push(await runFeroxbuster({ ...params, context, wordlistPath }));
  }
  if (selectedTools.includes("ffuf")) {
    toolResults.push(await runFfuf({ ...params, context, wordlistPath }));
  }

  const errors = toolResults.flatMap((result) => result.error ? [result.error] : []);
  const results = deduplicateDirectoryEntries(toolResults.flatMap((result) => result.entries));
  const succeededTools = toolResults.filter((result) => !result.error).map((result) => result.name);
  const completedAt = new Date().toISOString();
  const status = succeededTools.length === 0 && results.length === 0
    ? "failed"
    : errors.length > 0
      ? "partial"
      : "completed";

  const response: DirectoryScanResponse = {
    scanId: params.runId,
    scanType: "directory-enumeration",
    target: params.url,
    status,
    startedAt,
    completedAt,
    durationMs: Date.now() - started,
    toolsRun: succeededTools,
    summary: directorySummary(results, errors),
    results,
    errors
  };

  await writeJsonArtifact(params.runId, "exports/directory-results.json", response);

  return {
    tool: {
      name: "directory-enumeration",
      image: selectedTools.join(","),
      exitCode: status === "failed" ? 1 : 0,
      startedAt,
      completedAt
    },
    tools: toolResults.flatMap((result) => result.meta ? [result.meta] : []),
    findings: findingsFromDirectoryResponse(response),
    artifacts: [
      "exports/directory-results.json",
      "wordlists/directory-enumeration/common.txt",
      ...toolResults.flatMap((result) => result.artifacts)
    ]
  };
}
