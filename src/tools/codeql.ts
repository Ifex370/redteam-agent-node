import { mkdir, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { nanoid } from "nanoid";
import { appConfig } from "../config.js";
import { NormalizedFinding } from "../domain/schemas.js";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { runHostTool } from "./process-runner.js";

type CodeQlLanguage = {
  id: "javascript-typescript" | "python";
  sarifCategory: string;
  suite: string;
  extensions: string[];
};

const supportedLanguages: CodeQlLanguage[] = [
  {
    id: "javascript-typescript",
    sarifCategory: "javascript-typescript",
    suite: "codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls",
    extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]
  },
  {
    id: "python",
    sarifCategory: "python",
    suite: "codeql/python-queries:codeql-suites/python-security-and-quality.qls",
    extensions: [".py"]
  }
];

type SarifResult = {
  ruleId?: string;
  level?: string;
  message?: { text?: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri?: string };
      region?: {
        startLine?: number;
        startColumn?: number;
      };
    };
  }>;
};

type SarifRule = {
  id?: string;
  name?: string;
  shortDescription?: { text?: string };
  fullDescription?: { text?: string };
  defaultConfiguration?: { level?: string };
  properties?: {
    precision?: string;
    tags?: string[];
    "security-severity"?: string;
  };
};

type SarifReport = {
  runs?: Array<{
    tool?: {
      driver?: {
        name?: string;
        rules?: SarifRule[];
      };
    };
    results?: SarifResult[];
  }>;
};

async function hasSupportedExtension(dir: string, extensions: Set<string>): Promise<boolean> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "vendor" || entry.name === "dist") {
      continue;
    }

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await hasSupportedExtension(path, extensions)) return true;
    } else {
      const lower = entry.name.toLowerCase();
      if ([...extensions].some((extension) => lower.endsWith(extension))) {
        return true;
      }
    }
  }

  return false;
}

async function detectLanguages(sourcePath: string) {
  const detected: CodeQlLanguage[] = [];
  for (const language of supportedLanguages) {
    if (await hasSupportedExtension(sourcePath, new Set(language.extensions))) {
      detected.push(language);
    }
  }
  return detected;
}

function severityFromCodeQl(result: SarifResult, rule?: SarifRule): NormalizedFinding["severity"] {
  const securitySeverity = Number(rule?.properties?.["security-severity"]);
  if (Number.isFinite(securitySeverity)) {
    if (securitySeverity >= 9) return "critical";
    if (securitySeverity >= 7) return "high";
    if (securitySeverity >= 4) return "medium";
    if (securitySeverity > 0) return "low";
  }

  const level = result.level ?? rule?.defaultConfiguration?.level;
  if (level === "error") return "high";
  if (level === "warning") return "medium";
  if (level === "note") return "low";
  return "info";
}

function normalizeSarif(sarif: SarifReport, asset: string): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];

  for (const run of sarif.runs ?? []) {
    const rules = new Map((run.tool?.driver?.rules ?? []).map((rule) => [rule.id, rule]));

    for (const result of run.results ?? []) {
      const rule = rules.get(result.ruleId);
      const location = result.locations?.[0]?.physicalLocation;
      const file = location?.artifactLocation?.uri ?? "unknown";
      const line = location?.region?.startLine;
      const title = rule?.shortDescription?.text ?? rule?.name ?? result.ruleId ?? "CodeQL finding";

      findings.push({
        id: `finding_${nanoid(12)}`,
        source: "agent:web-sast",
        tool: "codeql",
        title,
        severity: severityFromCodeQl(result, rule),
        category: "Vulnerability",
        asset,
        location: line ? `${file}:${line}` : file,
        evidence: result.message?.text ?? rule?.fullDescription?.text ?? title,
        raw: result
      });
    }
  }

  return findings;
}

export async function runCodeQl(params: {
  runId: string;
  targetPath: string;
}) {
  const sourcePath = resolve(params.targetPath);
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "codeql");
  const dbRoot = join(runArtifactDir(params.runId), "tool-cache", "codeql-dbs");
  const languages = await detectLanguages(sourcePath);
  const artifacts = ["tool-outputs/codeql/languages.json"];
  const allFindings: NormalizedFinding[] = [];
  let lastMeta;

  await writeTextArtifact(params.runId, "tool-outputs/codeql/languages.json", `${JSON.stringify({
    detected: languages.map((language) => language.id),
    supported: supportedLanguages.map((language) => language.id)
  }, null, 2)}\n`);
  await mkdir(outputDir, { recursive: true });
  await mkdir(dbRoot, { recursive: true });

  if (languages.length === 0) {
    return {
      tool: {
        name: "codeql",
        image: appConfig.codeql.cliPath,
        exitCode: 0,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      },
      findings: [],
      artifacts
    };
  }

  for (const language of languages) {
    const databasePath = join(dbRoot, language.id);
    const sarifRel = `tool-outputs/codeql/${language.id}.sarif`;
    const sarifPath = join(outputDir, `${language.id}.sarif`);

    const createResult = await runHostTool({
      runId: params.runId,
      name: `codeql-create-${language.id}`,
      command: appConfig.codeql.cliPath,
      args: [
        "database",
        "create",
        databasePath,
        "--language",
        language.id,
        "--source-root",
        sourcePath,
        "--overwrite",
        "--threads",
        "0"
      ]
    });
    await writeTextArtifact(params.runId, `tool-outputs/codeql/${language.id}-database-create.stdout.log`, createResult.stdout);
    await writeTextArtifact(params.runId, `tool-outputs/codeql/${language.id}-database-create.stderr.log`, createResult.stderr);
    artifacts.push(
      `tool-outputs/codeql/${language.id}-database-create.stdout.log`,
      `tool-outputs/codeql/${language.id}-database-create.stderr.log`
    );

    if (createResult.meta.exitCode !== 0) {
      throw new Error(`CodeQL database create failed for ${language.id} with exit code ${createResult.meta.exitCode}.`);
    }

    const analyzeResult = await runHostTool({
      runId: params.runId,
      name: `codeql-analyze-${language.id}`,
      command: appConfig.codeql.cliPath,
      args: [
        "database",
        "analyze",
        databasePath,
        language.suite,
        "--format",
        "sarif-latest",
        "--sarif-category",
        language.sarifCategory,
        "--output",
        sarifPath,
        "--threads",
        "0"
      ]
    });
    lastMeta = analyzeResult.meta;
    await writeTextArtifact(params.runId, `tool-outputs/codeql/${language.id}-database-analyze.stdout.log`, analyzeResult.stdout);
    await writeTextArtifact(params.runId, `tool-outputs/codeql/${language.id}-database-analyze.stderr.log`, analyzeResult.stderr);
    artifacts.push(
      sarifRel,
      `tool-outputs/codeql/${language.id}-database-analyze.stdout.log`,
      `tool-outputs/codeql/${language.id}-database-analyze.stderr.log`
    );

    if (analyzeResult.meta.exitCode !== 0) {
      throw new Error(`CodeQL database analyze failed for ${language.id} with exit code ${analyzeResult.meta.exitCode}.`);
    }

    const sarif = JSON.parse(await readFile(sarifPath, "utf8")) as SarifReport;
    allFindings.push(...normalizeSarif(sarif, sourcePath));
  }

  return {
    tool: lastMeta ?? {
      name: "codeql",
      image: appConfig.codeql.cliPath,
      exitCode: 0,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    },
    findings: allFindings,
    artifacts
  };
}
