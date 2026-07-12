# SynapDome Red Team Agent: Applications Web + Legacy Plugins Handoff

This handoff describes the CyberStrikeAI-inspired integration added to the SynapDome Red Team Agent Node.

CyberStrikeAI was used as a concept reference for:

- Plugin/extension surfaces that capture browser or Burp evidence.
- YAML-style tool catalogues that expose scanner capabilities.
- Agentic tool selection with audit-friendly artifacts.
- Human-approved engagement scoping before scans run.

We did not embed CyberStrikeAI's Go server. SynapDome keeps its own Node worker, queue, callback, and normalized export model.

## Server Base

Production Agent Node:

```text
http://34.205.79.22:4400
```

All protected endpoints require:

```http
x-internal-secret: <REDTEAM_AGENT_SECRET>
```

## New Capabilities

### Applications / Web / Nuclei

Status: closed

Run template:

```text
web-dast
```

Tool value:

```text
nuclei
```

Target kind:

```text
url
```

Artifacts:

```text
tool-outputs/nuclei/nuclei.jsonl
tool-outputs/nuclei/stdout.log
tool-outputs/nuclei/stderr.log
exports/synapdome-export.json
```

### Applications / Web / ZAP

Status: closed

Run template:

```text
web-dast
```

Tool value:

```text
zap
```

Target kind:

```text
url
```

Artifacts:

```text
tool-outputs/zap/zap-report.json
tool-outputs/zap/zap-report.html
tool-outputs/zap/stdout.log
tool-outputs/zap/stderr.log
exports/synapdome-export.json
```

### Applications / Web / Burp Legacy Plugin

Status: packaged MVP available

Repo manifest:

```text
plugins/legacy/burp-suite/plugin-manifest.json
```

Installable package:

```text
release-packages/synapdome-burp-extension-v0.1.0.jar
```

Installation guide:

```text
docs/legacy-plugin-installation.md
```

This is a client-side plugin. It captures selected authorized Burp messages, uploads the evidence to SynapDome storage, and lets SynapDome queue supported Red Team Agent runs.

The current server does not run Burp Suite headlessly.

### Browser Traffic Legacy Plugin

Status: packaged MVP available

Repo manifest:

```text
plugins/legacy/browser-extension/plugin-manifest.json
```

Installable package:

```text
release-packages/synapdome-browser-extension-v0.1.0.zip
```

Installation guide:

```text
docs/legacy-plugin-installation.md
```

This is a client-side browser extension for capturing authorized browser traffic metadata, uploading it to SynapDome storage, and using the captured context to queue web/API scans.

## Plugin Discovery API

The frontend AI can call this endpoint to discover available scanner plugins, required inputs, and roadmap status:

```http
GET /plugins
```

Example:

```bash
curl -sS http://34.205.79.22:4400/plugins \
  -H "x-internal-secret: <REDTEAM_AGENT_SECRET>"
```

Single plugin:

```http
GET /plugins/:pluginId
```

Examples:

```text
GET /plugins/applications.web.nuclei
GET /plugins/applications.web.zap
GET /plugins/applications.web.burp-legacy
GET /plugins/applications.browser-legacy
```

Roadmap-only status:

```http
GET /roadmap
```

## Submit A Web Scan

Endpoint:

```http
POST /runs
```

Sample body:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_web_app_demo",
  "template": "web-dast",
  "targets": [
    {
      "kind": "url",
      "url": "https://example.com"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["example.com"],
    "maxDurationMinutes": 15,
    "network": "restricted",
    "tools": ["nuclei", "zap"]
  },
  "callback": {
    "url": "https://synapdome.example.com/redteam/callback",
    "runId": "synapdome-run-id",
    "tenantId": "tenant_demo"
  }
}
```

Important:

- `policy.authorized` must be `true`.
- `targets[0].url` must be an HTTP or HTTPS URL.
- `policy.allowedDomains` should include the target hostname or parent domain. Accepted examples: `example.com`, `www.example.com`, `*.example.com`, or `https://www.example.com`.
- If `policy.allowedDomains` is empty for `web-dast`, the server treats the exact target hostname as the only allowed scope.
- Use `tools: ["nuclei"]` for Nuclei only.
- Use `tools: ["zap"]` for ZAP only.
- Use `tools: ["nuclei", "zap"]` for both.

## Poll Results

```http
GET /runs/:runId
```

```bash
curl -sS http://34.205.79.22:4400/runs/<runId> \
  -H "x-internal-secret: <REDTEAM_AGENT_SECRET>"
```

## Stream Events

```http
GET /runs/:runId/stream
```

The stream emits logs, status transitions, findings, and completion events.

## Fetch SynapDome Export

```http
GET /runs/:runId/artifacts/exports/synapdome-export.json
```

```bash
curl -sS http://34.205.79.22:4400/runs/<runId>/artifacts/exports/synapdome-export.json \
  -H "x-internal-secret: <REDTEAM_AGENT_SECRET>"
```

## Frontend AI Integration Logic

The SynapDome frontend agent should:

1. Ask the user for the engagement and target URL.
2. Ask for confirmation that the user is authorized to test the target.
3. Derive `allowedDomains` from the target hostname, then ask the user to confirm it.
4. Let the user choose Nuclei, ZAP, or both.
5. Submit `POST /runs` with `template: "web-dast"`. The older `web-scan` template remains accepted as a compatibility alias.
6. Subscribe to `/runs/:runId/stream` or poll `/runs/:runId`.
7. Ingest `exports/synapdome-export.json` into SynapDome findings.

## Roadmap Status Closed By This Integration

```text
Red Team Agents

├── Supply Chain ✅
├── Applications
│   ├── Web
│   │   ├── ZAP ✅
│   │   ├── Nuclei ✅
│   │   └── Burp packaged MVP ✅
│   └── Mobile
│       ├── Android / MobSF ✅
│       └── iOS / MobSF ✅
├── Cloud
├── Identity
└── Infrastructure
```

Previously closed:

```text
Supply Chain / Source Code Analysis / Semgrep ✅
Supply Chain / Source Code Analysis / TruffleHog ✅
Supply Chain / Source Code Analysis / CodeQL ✅
Supply Chain / Dependency Analysis / Trivy ✅
Supply Chain / Dependency Analysis / Grype ✅
Supply Chain / Infrastructure as Code / Checkov ✅
Supply Chain / Infrastructure as Code / tfsec ✅
Supply Chain / Infrastructure as Code / Terrascan ✅
Applications / Mobile / Android / MobSF ✅
Applications / Mobile / iOS / MobSF ✅
```

Still open:

```text
Applications / API / ZAP API
Applications / API / Nuclei API
Applications / GraphQL
Applications / Mobile / Frida
Applications / Mobile / Drozer
Applications / Mobile / Objection
Cloud / AWS / Prowler
Cloud / Azure
Cloud / GCP
Cloud / Kubernetes
Identity / Active Directory
Identity / Entra ID
Identity / Okta
Infrastructure / External Recon / Nmap
Infrastructure / External Recon / Naabu
Infrastructure / External Recon / Httpx
Infrastructure / Containers / Dockle
Infrastructure / Internal Network
```
