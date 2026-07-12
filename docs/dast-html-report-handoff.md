# SynapDome DAST HTML Report Handoff

This note explains how SynapDome frontend/server should consume the detailed HTML report now returned for web DAST engagements.

## What Changed

For every successful `web-dast` run, and for the legacy `web-scan` alias, the Red Team Agent Node now writes:

```text
exports/dast-report.html
```

This report is generated from the normalized findings and each tool's raw finding payload. For ZAP, that means the HTML includes the deeper fields from `tool-outputs/zap/zap-report.json`, including:

- ZAP plugin ID
- Alert reference
- Severity/risk
- Confidence
- CWE ID
- WASC ID
- Systemic flag
- Description/evidence
- Remediation
- Additional information
- References
- Every affected instance/URI

The report is both human-readable and machine-readable.

## Fetch The HTML Report

After a run succeeds, fetch:

```http
GET /runs/:runId/artifacts/exports/dast-report.html
x-internal-secret: <REDTEAM_AGENT_SECRET>
```

Example:

```bash
curl -sS http://34.205.79.22:4400/runs/<runId>/artifacts/exports/dast-report.html \
  -H "x-internal-secret: <REDTEAM_AGENT_SECRET>"
```

The artifact also appears in:

```http
GET /runs/:runId
GET /runs/:runId/artifacts/exports/synapdome-export.json
```

under:

```json
"artifacts": [
  "exports/dast-report.html"
]
```

## Recommended Extraction Method

The easiest extraction path is the embedded JSON block:

```html
<script id="synapdome-findings-json" type="application/json">
  ...
</script>
```

Frontend/server parsing logic:

```js
const dom = new DOMParser().parseFromString(html, "text/html");
const payload = JSON.parse(
  dom.querySelector("#synapdome-findings-json").textContent
);

const findings = payload.findings;
```

Payload shape:

```json
{
  "schema": "synapdome.dast.html.v1",
  "run": {
    "runId": "run_...",
    "tenantId": "...",
    "engagementId": "...",
    "template": "web-dast",
    "status": "succeeded",
    "target": "https://example.com",
    "toolsRun": ["zap"]
  },
  "summary": {
    "findingCount": 15,
    "bySeverity": {
      "high": 2,
      "medium": 8,
      "low": 3,
      "info": 2
    },
    "totalInstances": 58
  },
  "findings": [
    {
      "id": "finding_...",
      "source": "agent:web-scan",
      "tool": "zap",
      "title": "Content Security Policy (CSP) Header Not Set",
      "severity": "high",
      "category": "Web Vulnerability",
      "asset": "https://example.com",
      "location": "https://example.com",
      "evidence": "...",
      "remediation": "...",
      "raw": {
        "pluginid": "10038",
        "alertRef": "10038-1",
        "riskdesc": "Medium (High)",
        "confidence": "3",
        "cweid": "693",
        "wascid": "15",
        "instances": []
      }
    }
  ]
}
```

## Alternative DOM Extraction Method

Each finding is also rendered as:

```html
<article class="synapdome-finding" ...>
```

Important attributes:

```text
data-finding-id
data-tool
data-source
data-severity
data-title
data-category
data-asset
data-location
data-plugin-id
data-alert-ref
data-cwe-id
data-wasc-id
data-confidence
data-instance-count
```

Example:

```js
const dom = new DOMParser().parseFromString(html, "text/html");

const findings = [...dom.querySelectorAll("article.synapdome-finding")]
  .map((node) => ({
    id: node.dataset.findingId,
    tool: node.dataset.tool,
    severity: node.dataset.severity,
    title: node.dataset.title,
    category: node.dataset.category,
    asset: node.dataset.asset,
    location: node.dataset.location,
    pluginId: node.dataset.pluginId,
    alertRef: node.dataset.alertRef,
    cweId: node.dataset.cweId,
    wascId: node.dataset.wascId,
    confidence: node.dataset.confidence,
    instanceCount: Number(node.dataset.instanceCount || 0),
    instances: [...node.querySelectorAll("tr.synapdome-finding-instance")]
      .map((row) => ({
        uri: row.dataset.uri,
        method: row.dataset.method,
        param: row.dataset.param,
        evidence: row.dataset.evidence
      }))
  }));
```

## Report-Level Attributes

The root report element is:

```html
<main id="synapdome-dast-report" ...>
```

Attributes:

```text
data-report-schema="synapdome.dast.html.v1"
data-run-id
data-tenant-id
data-engagement-id
data-template
data-target
data-finding-count
data-total-instances
```

## Submission Template

Use this for new DAST runs:

```json
{
  "template": "web-dast",
  "targets": [
    {
      "kind": "url",
      "url": "https://www.example.com/"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["example.com"],
    "maxDurationMinutes": 20,
    "network": "restricted",
    "tools": ["zap"]
  }
}
```

`allowedDomains` should be populated by the frontend. If it is empty, the agent node falls back to exact target hostname scope only.

## Frontend Display Recommendation

For best depth:

1. Use `exports/synapdome-export.json` for summary cards and compatibility with the current findings UI.
2. Use `exports/dast-report.html` for the detailed DAST tab or downloadable evidence view.
3. Parse `#synapdome-findings-json` when creating richer finding drawers, because it includes raw tool metadata and all affected instances.

## Current Tool Coverage

The HTML report currently covers findings produced by:

```text
zap
nuclei
```

If a run includes both tools, the report includes both tools' findings in one HTML document.
