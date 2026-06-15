import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { appConfig } from "../config.js";
import { publishRunEvent } from "../events/run-events.js";

export async function runHostTool(params: {
  runId: string;
  name: string;
  command: string;
  args: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  logFileHint?: string;
}) {
  const startedAt = new Date().toISOString();

  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `Starting ${params.name}`
  });

  if (params.logFileHint) {
    await mkdir(dirname(params.logFileHint), { recursive: true });
  }

  const child = spawn(params.command, params.args, {
    cwd: params.cwd,
    env: {
      ...process.env,
      ...(params.env ?? {})
    },
    windowsHide: true
  });

  let stdout = "";
  let stderr = "";
  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
  }, params.timeoutMs ?? appConfig.runTimeoutMs);

  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    const trimmed = text.trimEnd();
    if (trimmed) {
      void publishRunEvent({ runId: params.runId, type: "log", message: trimmed });
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    const trimmed = text.trimEnd();
    if (trimmed) {
      void publishRunEvent({ runId: params.runId, type: "log", message: trimmed });
    }
  });

  const exitCode = await new Promise<number | null>((resolveCode, reject) => {
    child.on("error", reject);
    child.on("close", resolveCode);
  });
  clearTimeout(timeout);

  const completedAt = new Date().toISOString();
  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `${params.name} completed with exit code ${exitCode}`
  });

  return {
    stdout,
    stderr,
    meta: {
      name: params.name,
      image: params.command,
      exitCode,
      startedAt,
      completedAt
    }
  };
}
