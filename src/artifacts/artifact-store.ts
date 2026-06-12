import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { appConfig } from "../config.js";
import { NormalizedFinding, RunSummary } from "../domain/schemas.js";

export function runArtifactDir(runId: string) {
  return join(appConfig.artifactRoot, runId);
}

export async function ensureRunDirs(runId: string) {
  const root = runArtifactDir(runId);
  await mkdir(join(root, "tool-outputs"), { recursive: true });
  await mkdir(join(root, "workspace"), { recursive: true });
  await mkdir(join(root, "exports"), { recursive: true });
  return root;
}

export async function writeJsonArtifact(runId: string, relPath: string, data: unknown) {
  const path = join(runArtifactDir(runId), relPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return path;
}

export async function writeTextArtifact(runId: string, relPath: string, data: string) {
  const path = join(runArtifactDir(runId), relPath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data, "utf8");
  return path;
}

export async function readRunSummary(runId: string) {
  const path = join(runArtifactDir(runId), "run-summary.json");
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as RunSummary;
}

export async function writeFindingsExport(runId: string, findings: NormalizedFinding[]) {
  return writeJsonArtifact(runId, "exports/findings.json", { runId, findings });
}

export async function listArtifacts(runId: string) {
  const root = runArtifactDir(runId);
  const out: string[] = [];

  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      const rel = relative(root, path).replaceAll("\\", "/");
      if (rel === "workspace/repo" || rel.startsWith("workspace/repo/")) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(path);
      } else {
        out.push(rel);
      }
    }
  }

  await walk(root);
  return out.sort();
}
