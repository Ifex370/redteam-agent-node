import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { appConfig } from "../config.js";
import { publishRunEvent } from "../events/run-events.js";

export type GitCloneResult = {
  path: string;
  url: string;
  branch?: string;
  startedAt: string;
  completedAt: string;
  exitCode: number | null;
};

function assertHttpsGitUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS Git URLs are supported for repo targets.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credentials in Git URLs are not allowed. Add credential handling as a separate secret flow.");
  }

  if (!parsed.hostname.toLowerCase().endsWith("github.com")) {
    throw new Error(`Only github.com repo targets are enabled for this MVP (${parsed.hostname}).`);
  }
}

function assertSafeBranch(branch?: string) {
  if (!branch) return;
  if (!/^[A-Za-z0-9._/-]{1,120}$/.test(branch) || branch.includes("..") || branch.startsWith("-")) {
    throw new Error("Invalid branch name.");
  }
}

export async function cloneGitRepo(params: {
  runId: string;
  url: string;
  branch?: string;
  destination: string;
}) {
  assertHttpsGitUrl(params.url);
  assertSafeBranch(params.branch);

  await mkdir(dirname(params.destination), { recursive: true });
  const startedAt = new Date().toISOString();
  const args = ["clone", "--depth", "1"];
  if (params.branch) {
    args.push("--branch", params.branch);
  }
  args.push("--", params.url, params.destination);

  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `Cloning repository ${params.url}${params.branch ? ` (${params.branch})` : ""}`
  });

  const child = spawn("git", args, {
    windowsHide: true,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0"
    }
  });

  let stdout = "";
  let stderr = "";
  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
  }, Math.min(appConfig.runTimeoutMs, 10 * 60 * 1000));

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    void publishRunEvent({ runId: params.runId, type: "log", message: text.trimEnd() });
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    void publishRunEvent({ runId: params.runId, type: "log", message: text.trimEnd() });
  });

  const exitCode = await new Promise<number | null>((resolveCode, reject) => {
    child.on("error", reject);
    child.on("close", resolveCode);
  });
  clearTimeout(timeout);

  const completedAt = new Date().toISOString();
  await writeFile(join(dirname(params.destination), "git-clone.log"), `${stdout}\n${stderr}`, "utf8");

  if (exitCode !== 0) {
    throw new Error(`Git clone failed with exit code ${exitCode}: ${stderr.trim() || "no stderr"}`);
  }

  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `Repository clone completed`
  });

  return {
    path: params.destination,
    url: params.url,
    branch: params.branch,
    startedAt,
    completedAt,
    exitCode
  } satisfies GitCloneResult;
}
