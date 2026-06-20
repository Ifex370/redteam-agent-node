import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { nanoid } from "nanoid";
import { runArtifactDir, writeTextArtifact } from "../artifacts/artifact-store.js";
import { appConfig } from "../config.js";
import { NormalizedFinding } from "../domain/schemas.js";
import { publishRunEvent } from "../events/run-events.js";

const mobsfImage = "opensecurity/mobile-security-framework-mobsf:v4.4.6";

type JsonObject = Record<string, unknown>;
type UploadResponse = {
  hash: string;
  file_name?: string;
  scan_type?: string;
};

function object(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function severity(value: unknown): NormalizedFinding["severity"] {
  switch (text(value)?.toLowerCase()) {
    case "critical": return "critical";
    case "high":
    case "dangerous": return "high";
    case "medium":
    case "warning": return "medium";
    case "low": return "low";
    default: return "info";
  }
}

function finding(params: {
  title: string;
  severity?: unknown;
  category: string;
  asset: string;
  location?: string;
  evidence?: string;
  remediation?: string;
  raw: unknown;
}): NormalizedFinding {
  return {
    id: `finding_${nanoid(12)}`,
    source: "agent:mobile-scan",
    tool: "mobsf",
    title: params.title,
    severity: severity(params.severity),
    category: params.category,
    asset: params.asset,
    location: params.location,
    evidence: params.evidence || params.title,
    remediation: params.remediation,
    raw: params.raw
  };
}

export function normalizeMobSfReport(report: JsonObject, asset: string): NormalizedFinding[] {
  const findings: NormalizedFinding[] = [];

  const manifest = object(report.manifest_analysis);
  const manifestFindings = manifest?.manifest_findings;
  if (Array.isArray(manifestFindings)) {
    for (const raw of manifestFindings) {
      const item = object(raw);
      if (!item) continue;
      findings.push(finding({
        title: text(item.title) ?? text(item.rule) ?? "Mobile manifest security issue",
        severity: item.severity,
        category: "Mobile Manifest",
        asset,
        location: text(item.component) ?? text(item.name),
        evidence: text(item.description),
        remediation: text(item.remediation),
        raw
      }));
    }
  }

  const code = object(report.code_analysis);
  const codeFindings = object(code?.findings);
  for (const [ruleId, raw] of Object.entries(codeFindings ?? {})) {
    const item = object(raw);
    const metadata = object(item?.metadata);
    const files = object(item?.files);
    const locations = Object.entries(files ?? {}).flatMap(([file, lines]) =>
      Array.isArray(lines) ? lines.map((line) => `${file}:${String(line)}`) : [file]);
    findings.push(finding({
      title: text(metadata?.description) ?? ruleId,
      severity: metadata?.severity,
      category: "Mobile Code Analysis",
      asset,
      location: locations[0],
      evidence: [
        `Rule: ${ruleId}`,
        locations.length ? `Locations: ${locations.slice(0, 20).join(", ")}` : undefined,
        text(metadata?.ref)
      ].filter(Boolean).join("\n"),
      remediation: text(metadata?.remediation),
      raw
    }));
  }

  const listSections: Array<[unknown, string]> = [
    [report.binary_analysis, "Mobile Binary Analysis"],
    [report.file_analysis, "Mobile File Analysis"]
  ];
  for (const [section, category] of listSections) {
    if (!Array.isArray(section)) continue;
    for (const raw of section) {
      const item = object(raw);
      if (!item) continue;
      findings.push(finding({
        title: text(item.name) ?? text(item.issue) ?? `${category} finding`,
        severity: item.severity,
        category,
        asset,
        location: text(item.file) ?? (Array.isArray(item.files) ? item.files.map(String).slice(0, 5).join(", ") : undefined),
        evidence: text(item.description) ?? text(item.detailed_desc),
        remediation: text(item.remediation),
        raw
      }));
    }
  }

  const certificate = object(report.certificate_analysis);
  const certificateFindings = certificate?.certificate_findings;
  if (Array.isArray(certificateFindings)) {
    for (const raw of certificateFindings) {
      if (Array.isArray(raw)) {
        findings.push(finding({
          title: text(raw[1]) ?? "Certificate security issue",
          severity: raw[0],
          category: "Mobile Certificate",
          asset,
          evidence: raw.map(String).join("\n"),
          raw
        }));
        continue;
      }
      const item = object(raw);
      if (!item) continue;
      findings.push(finding({
        title: text(item.description) ?? text(item.title) ?? "Certificate security issue",
        severity: item.severity,
        category: "Mobile Certificate",
        asset,
        evidence: text(item.description),
        raw
      }));
    }
  }

  const permissions = object(report.permissions);
  for (const [permission, raw] of Object.entries(permissions ?? {})) {
    const item = object(raw);
    const status = text(item?.status);
    if (!item || !["dangerous", "signatureOrSystem"].includes(status ?? "")) continue;
    findings.push(finding({
      title: `Sensitive Android permission: ${permission}`,
      severity: status,
      category: "Mobile Permission",
      asset,
      location: permission,
      evidence: text(item.description) ?? text(item.info),
      remediation: "Confirm the permission is required and apply least privilege.",
      raw
    }));
  }

  return findings;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${appConfig.mobsf.baseUrl}${path}`, {
    ...init,
    headers: {
      "X-Mobsf-Api-Key": appConfig.mobsf.apiKey,
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`MobSF ${path} failed with ${response.status}: ${body.slice(0, 500)}`);
  }
  return response;
}

async function waitUntilReady(runId: string) {
  const deadline = Date.now() + 10 * 60_000;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      await request("/api/v1/scans");
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  await publishRunEvent({ runId, type: "log", message: `MobSF readiness failed: ${lastError}` });
  throw new Error("MobSF did not become ready within 10 minutes.");
}

function form(values: Record<string, string>) {
  const body = new FormData();
  for (const [key, value] of Object.entries(values)) body.set(key, value);
  return body;
}

export async function runMobSf(params: {
  runId: string;
  appPath: string;
  fileName: string;
  asset: string;
}) {
  if (!appConfig.mobsf.apiKey) {
    throw new Error("MOBSF_API_KEY is not configured.");
  }

  const startedAt = new Date().toISOString();
  const outputDir = join(runArtifactDir(params.runId), "tool-outputs", "mobsf");
  await mkdir(outputDir, { recursive: true });
  await waitUntilReady(params.runId);
  await publishRunEvent({ runId: params.runId, type: "log", message: `Uploading ${params.fileName} to MobSF` });

  const uploadBody = new FormData();
  uploadBody.set("file", new Blob([await readFile(params.appPath)]), basename(params.fileName));
  const uploaded = await (await request("/api/v1/upload", { method: "POST", body: uploadBody })).json() as UploadResponse;
  if (!uploaded.hash) throw new Error("MobSF upload response did not include a hash.");

  try {
    await publishRunEvent({ runId: params.runId, type: "log", message: `Running MobSF static analysis for ${params.fileName}` });
    await request("/api/v1/scan", { method: "POST", body: form({ hash: uploaded.hash }) });

    const reportResponse = await request("/api/v1/report_json", {
      method: "POST",
      body: form({ hash: uploaded.hash })
    });
    const report = await reportResponse.json() as JsonObject;
    await writeFile(join(outputDir, "mobsf-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

    const pdfResponse = await request("/api/v1/download_pdf", {
      method: "POST",
      body: form({ hash: uploaded.hash })
    });
    await writeFile(join(outputDir, "mobsf-report.pdf"), Buffer.from(await pdfResponse.arrayBuffer()));
    await writeTextArtifact(params.runId, "tool-outputs/mobsf/scan.log", `MobSF hash: ${uploaded.hash}\nFile: ${params.fileName}\n`);

    return {
      tool: {
        name: "mobsf",
        image: mobsfImage,
        exitCode: 0,
        startedAt,
        completedAt: new Date().toISOString()
      },
      findings: normalizeMobSfReport(report, params.asset),
      artifacts: [
        "tool-outputs/mobsf/mobsf-report.json",
        "tool-outputs/mobsf/mobsf-report.pdf",
        "tool-outputs/mobsf/scan.log"
      ]
    };
  } finally {
    await request("/api/v1/delete_scan", {
      method: "POST",
      body: form({ hash: uploaded.hash })
    }).catch(() => undefined);
  }
}
