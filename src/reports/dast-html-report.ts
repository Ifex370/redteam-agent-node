import { EngagementRunInput, NormalizedFinding, RunSummary } from "../domain/schemas.js";
import { writeTextArtifact } from "../artifacts/artifact-store.js";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripHtml(value: unknown) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeScriptJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function riskClass(severity: string) {
  return severity === "critical" || severity === "high"
    ? "high"
    : severity === "medium"
      ? "medium"
      : severity === "low"
        ? "low"
        : "info";
}

function rawRecord(finding: NormalizedFinding) {
  return finding.raw && typeof finding.raw === "object" && !Array.isArray(finding.raw)
    ? finding.raw as Record<string, unknown>
    : {};
}

function rawString(finding: NormalizedFinding, key: string) {
  const value = rawRecord(finding)[key];
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : "";
}

function rawInstances(finding: NormalizedFinding) {
  const instances = rawRecord(finding).instances;
  return Array.isArray(instances) ? instances as Array<Record<string, unknown>> : [];
}

function refs(finding: NormalizedFinding) {
  return stripHtml(rawString(finding, "reference"))
    .split(/\s+/)
    .filter((item) => item.startsWith("http"));
}

function countBySeverity(findings: NormalizedFinding[]) {
  return findings.reduce<Record<string, number>>((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] ?? 0) + 1;
    return acc;
  }, {});
}

function findingArticle(finding: NormalizedFinding, index: number) {
  const raw = rawRecord(finding);
  const instances = rawInstances(finding);
  const referenceLinks = refs(finding);
  const severity = riskClass(finding.severity);
  const rawCount = rawString(finding, "count");

  return `
    <article
      class="synapdome-finding finding ${severity}"
      data-finding-index="${index}"
      data-finding-id="${escapeHtml(finding.id)}"
      data-tool="${escapeHtml(finding.tool)}"
      data-source="${escapeHtml(finding.source)}"
      data-severity="${escapeHtml(finding.severity)}"
      data-title="${escapeHtml(finding.title)}"
      data-category="${escapeHtml(finding.category)}"
      data-asset="${escapeHtml(finding.asset)}"
      data-location="${escapeHtml(finding.location ?? "")}"
      data-plugin-id="${escapeHtml(rawString(finding, "pluginid"))}"
      data-alert-ref="${escapeHtml(rawString(finding, "alertRef"))}"
      data-cwe-id="${escapeHtml(rawString(finding, "cweid"))}"
      data-wasc-id="${escapeHtml(rawString(finding, "wascid"))}"
      data-confidence="${escapeHtml(rawString(finding, "confidence"))}"
      data-instance-count="${escapeHtml(rawCount || instances.length)}">
      <div class="finding-head">
        <div>
          <p class="eyebrow">Finding ${index + 1} · ${escapeHtml(finding.tool)} · ${escapeHtml(rawString(finding, "pluginid") || "no plugin id")}</p>
          <h2>${escapeHtml(finding.title)}</h2>
        </div>
        <div class="risk ${severity}">${escapeHtml(finding.severity)}</div>
      </div>

      <dl class="meta-grid">
        <div><dt>Category</dt><dd>${escapeHtml(finding.category)}</dd></div>
        <div><dt>Confidence</dt><dd>${escapeHtml(rawString(finding, "confidence") || "N/A")}</dd></div>
        <div><dt>CWE</dt><dd>${escapeHtml(rawString(finding, "cweid") || "N/A")}</dd></div>
        <div><dt>WASC</dt><dd>${escapeHtml(rawString(finding, "wascid") || "N/A")}</dd></div>
        <div><dt>Instances</dt><dd>${escapeHtml(rawCount || instances.length)}</dd></div>
        <div><dt>Systemic</dt><dd>${raw.systemic === true ? "Yes" : raw.systemic === false ? "No" : "N/A"}</dd></div>
      </dl>

      <section class="field" data-field="asset"><h3>Asset</h3><p>${escapeHtml(finding.asset)}</p></section>
      <section class="field" data-field="location"><h3>Primary Location</h3><p>${escapeHtml(finding.location ?? "")}</p></section>
      <section class="field" data-field="description"><h3>Description / Evidence</h3><p>${escapeHtml(stripHtml(finding.evidence))}</p></section>
      <section class="field" data-field="remediation"><h3>Remediation</h3><p>${escapeHtml(stripHtml(finding.remediation ?? rawString(finding, "solution")))}</p></section>

      ${stripHtml(rawString(finding, "otherinfo")) ? `<section class="field" data-field="otherinfo"><h3>Additional Information</h3><p>${escapeHtml(stripHtml(rawString(finding, "otherinfo")))}</p></section>` : ""}

      <section class="field" data-field="instances">
        <h3>Affected Instances</h3>
        <table>
          <thead>
            <tr>
              <th>Method</th>
              <th>URI</th>
              <th>Parameter</th>
              <th>Attack</th>
              <th>Evidence</th>
              <th>Other Info</th>
            </tr>
          </thead>
          <tbody>
            ${instances.map((instance) => `
              <tr class="synapdome-finding-instance"
                data-uri="${escapeHtml(instance.uri)}"
                data-method="${escapeHtml(instance.method)}"
                data-param="${escapeHtml(instance.param)}"
                data-evidence="${escapeHtml(instance.evidence)}">
                <td>${escapeHtml(instance.method)}</td>
                <td class="uri">${escapeHtml(instance.uri)}</td>
                <td>${escapeHtml(instance.param)}</td>
                <td>${escapeHtml(instance.attack)}</td>
                <td><code>${escapeHtml(instance.evidence)}</code></td>
                <td>${escapeHtml(instance.otherinfo)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </section>

      ${referenceLinks.length ? `
        <section class="field" data-field="references">
          <h3>References</h3>
          <ul>${referenceLinks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </section>
      ` : ""}
    </article>
  `;
}

export async function writeDastHtmlReport(summary: RunSummary, input: EngagementRunInput) {
  const findings = summary.findings.filter((finding) => finding.tool === "zap" || finding.tool === "nuclei");
  if (findings.length === 0) return undefined;

  const bySeverity = countBySeverity(findings);
  const highCount = (bySeverity.critical ?? 0) + (bySeverity.high ?? 0);
  const target = input.targets.find((item) => item.kind === "url")?.url ?? "";
  const totalInstances = findings.reduce((sum, finding) => {
    const rawCount = Number(rawString(finding, "count"));
    return sum + (Number.isFinite(rawCount) && rawCount > 0 ? rawCount : rawInstances(finding).length);
  }, 0);

  const payload = {
    schema: "synapdome.dast.html.v1",
    run: {
      runId: summary.runId,
      tenantId: summary.tenantId,
      engagementId: summary.engagementId,
      template: summary.template,
      status: summary.status,
      startedAt: summary.startedAt,
      completedAt: summary.completedAt,
      durationMs: summary.durationMs,
      target,
      toolsRun: summary.toolsRun.map((tool) => tool.name)
    },
    summary: {
      findingCount: findings.length,
      bySeverity,
      totalInstances
    },
    findings
  };

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>SynapDome DAST HTML Report - ${escapeHtml(summary.runId)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #101828; font: 14px/1.5 Arial, Helvetica, sans-serif; background: #fff; }
    main { max-width: 1180px; margin: 0 auto; padding: 32px 24px 56px; }
    h1, h2, h3 { margin: 0; color: #101828; }
    h1 { font-size: 30px; }
    h2 { font-size: 20px; line-height: 1.25; }
    h3 { margin-top: 18px; font-size: 13px; color: #344054; text-transform: uppercase; letter-spacing: .04em; }
    p { margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
    th, td { border: 1px solid #d0d5dd; padding: 7px; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #f2f4f7; color: #344054; text-align: left; }
    code { white-space: pre-wrap; font-family: Consolas, monospace; font-size: 12px; }
    .brand { color: #175cd3; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: .08em; }
    .subtitle { color: #475467; font-size: 15px; margin-top: 8px; }
    .summary-grid, .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 18px 0; }
    .summary-card, .meta-grid div { border: 1px solid #d0d5dd; border-radius: 6px; padding: 10px; background: #fcfcfd; }
    dt, .label { color: #667085; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    dd { margin: 4px 0 0; font-weight: 700; }
    .finding { border-top: 5px solid #d0d5dd; margin-top: 28px; padding-top: 16px; }
    .finding.high { border-color: #d92d20; }
    .finding.medium { border-color: #dc6803; }
    .finding.low { border-color: #175cd3; }
    .finding.info { border-color: #667085; }
    .finding-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .eyebrow { margin: 0 0 4px; color: #667085; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .risk { min-width: 92px; text-align: center; border-radius: 999px; padding: 6px 10px; color: white; font-weight: 700; text-transform: capitalize; }
    .risk.high { background: #d92d20; }
    .risk.medium { background: #dc6803; }
    .risk.low { background: #175cd3; }
    .risk.info { background: #667085; }
    .uri { font-size: 12px; }
    .machine-note { border-left: 4px solid #175cd3; padding: 10px 12px; background: #eff8ff; color: #1849a9; }
  </style>
</head>
<body>
  <main id="synapdome-dast-report"
    data-report-schema="synapdome.dast.html.v1"
    data-run-id="${escapeHtml(summary.runId)}"
    data-tenant-id="${escapeHtml(summary.tenantId)}"
    data-engagement-id="${escapeHtml(summary.engagementId)}"
    data-template="${escapeHtml(summary.template)}"
    data-target="${escapeHtml(target)}"
    data-finding-count="${findings.length}"
    data-total-instances="${totalInstances}">
    <header>
      <div class="brand">SynapDome Red Team Agent Node</div>
      <h1>Detailed DAST HTML Report</h1>
      <p class="subtitle">Run ${escapeHtml(summary.runId)} · ${escapeHtml(target)}</p>
    </header>

    <section>
      <div class="summary-grid">
        <div class="summary-card"><div class="label">Status</div><strong>${escapeHtml(summary.status)}</strong></div>
        <div class="summary-card"><div class="label">Tools</div><strong>${escapeHtml(summary.toolsRun.map((tool) => tool.name).join(", "))}</strong></div>
        <div class="summary-card"><div class="label">Findings</div><strong>${findings.length}</strong></div>
        <div class="summary-card"><div class="label">Affected Instances</div><strong>${totalInstances}</strong></div>
        <div class="summary-card"><div class="label">High</div><strong>${highCount}</strong></div>
        <div class="summary-card"><div class="label">Medium</div><strong>${bySeverity.medium ?? 0}</strong></div>
      </div>
      <dl class="meta-grid">
        <div><dt>Tenant ID</dt><dd>${escapeHtml(summary.tenantId)}</dd></div>
        <div><dt>Engagement ID</dt><dd>${escapeHtml(summary.engagementId)}</dd></div>
        <div><dt>Template</dt><dd>${escapeHtml(summary.template)}</dd></div>
        <div><dt>Started</dt><dd>${escapeHtml(summary.startedAt)}</dd></div>
        <div><dt>Completed</dt><dd>${escapeHtml(summary.completedAt)}</dd></div>
        <div><dt>Duration</dt><dd>${Math.round((summary.durationMs ?? 0) / 1000)} seconds</dd></div>
      </dl>
      <p class="machine-note">Frontend extraction: parse <code>script#synapdome-findings-json</code> for the complete structured payload, or iterate <code>article.synapdome-finding</code> and read its <code>data-*</code> fields plus child <code>tr.synapdome-finding-instance</code> rows.</p>
    </section>

    <section>
      <h2>Findings Index</h2>
      <table>
        <thead><tr><th>#</th><th>Severity</th><th>Tool</th><th>Title</th><th>Instances</th><th>CWE</th></tr></thead>
        <tbody>
          ${findings.map((finding, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(finding.severity)}</td><td>${escapeHtml(finding.tool)}</td><td>${escapeHtml(finding.title)}</td><td>${escapeHtml(rawString(finding, "count") || rawInstances(finding).length)}</td><td>${escapeHtml(rawString(finding, "cweid") || "N/A")}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>

    ${findings.map(findingArticle).join("\n")}
  </main>
  <script id="synapdome-findings-json" type="application/json">${escapeScriptJson(payload)}</script>
</body>
</html>`;

  await writeTextArtifact(summary.runId, "exports/dast-report.html", html);
  return "exports/dast-report.html";
}
