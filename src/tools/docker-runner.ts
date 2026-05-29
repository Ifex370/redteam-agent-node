import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { appConfig } from "../config.js";
import { publishRunEvent } from "../events/run-events.js";

export type DockerRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export async function runDockerTool(params: {
  runId: string;
  image: string;
  name: string;
  mounts: Array<{ hostPath: string; containerPath: string; readonly?: boolean }>;
  args: string[];
  timeoutMs?: number;
}) {
  const startedAt = new Date().toISOString();
  const dockerArgs = [
    "run",
    "--rm",
    "--name",
    `${params.runId}-${params.name}`.replace(/[^a-zA-Z0-9_.-]/g, "-"),
    "--network",
    appConfig.dockerNetwork
  ];

  for (const mount of params.mounts) {
    if (!mount.readonly) {
      await mkdir(resolve(mount.hostPath), { recursive: true });
    }
    const suffix = mount.readonly ? ":ro" : "";
    dockerArgs.push("-v", `${resolve(mount.hostPath)}:${mount.containerPath}${suffix}`);
  }

  dockerArgs.push(params.image, ...params.args);

  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `Starting ${params.name} with image ${params.image}`
  });

  const child = spawn("docker", dockerArgs, {
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
  await publishRunEvent({
    runId: params.runId,
    type: "log",
    message: `${params.name} completed with exit code ${exitCode}`
  });

  return {
    exitCode,
    stdout,
    stderr,
    meta: {
      name: params.name,
      image: params.image,
      exitCode,
      startedAt,
      completedAt
    }
  };
}
