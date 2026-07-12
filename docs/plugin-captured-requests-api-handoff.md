# SynapDome Plugin Captured Requests API Handoff

This handoff is for the SynapDome server/frontend team implementing ingestion for the packaged SynapDome browser and Burp extensions.

The plugin authentication model selected for this integration is:

```text
Dedicated plugin API key
```

The plugins send captured traffic artifacts to SynapDome. SynapDome stores the evidence, maps it to the correct tenant/engagement, and may queue Red Team Agent Node DAST scans.

## Plugin Packages

GitHub release:

```text
https://github.com/Ifex370/redteam-agent-node/releases/tag/legacy-plugins-v0.1.0
```

Assets:

```text
synapdome-burp-extension-v0.1.0.jar
synapdome-browser-extension-v0.1.0.zip
```

Install guide:

```text
docs/legacy-plugin-installation.md
```

## Auth

Both plugins send:

```http
Authorization: Bearer <plugin-api-key>
Content-Type: application/json
```

The SynapDome server should validate the plugin API key and resolve it to the user/workspace/tenant permissions allowed to upload artifacts.

Recommended checks:

- API key exists and is active.
- API key is allowed to upload plugin artifacts.
- `tenantId` belongs to the key's allowed tenant/workspace.
- `engagementId` belongs to the submitted tenant.
- Submitted `targetUrl` is inside the engagement's authorized scope.
- Submitted `allowedDomains` are inside the engagement's authorized scope.

## Browser Extension Endpoint

Expected endpoint:

```http
POST /api/redteam/artifacts/browser
Authorization: Bearer <plugin-api-key>
Content-Type: application/json
```

## Browser Extension Payload

Sample:

```json
{
  "source": "browser-extension",
  "tenantId": "tenant_demo",
  "engagementId": "engagement_demo",
  "targetUrl": "https://www.example.com",
  "allowedDomains": ["example.com", "api.example.com"],
  "capturedAt": "2026-07-12T16:30:00.000Z",
  "requests": [
    {
      "id": "12345.1",
      "method": "GET",
      "url": "https://www.example.com/login",
      "statusCode": 200,
      "type": "xmlhttprequest",
      "initiator": "https://www.example.com",
      "tabId": 123,
      "timeStamp": 1783873800000
    }
  ]
}
```

Browser top-level fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `source` | string | yes | Always `browser-extension` |
| `tenantId` | string | yes | SynapDome tenant/workspace ID |
| `engagementId` | string | yes | SynapDome engagement ID |
| `targetUrl` | string URL | yes | User-selected target URL |
| `allowedDomains` | string[] | yes | Authorized domains confirmed in plugin UI |
| `capturedAt` | ISO datetime string | yes | Client-side capture timestamp |
| `requests` | array | yes | Captured browser request metadata |

Browser request fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `id` | string | yes | Browser request ID |
| `method` | string | yes | HTTP method |
| `url` | string URL | yes | Full request URL |
| `statusCode` | number | no | Response status code from browser webRequest API |
| `type` | string | no | Browser resource type, e.g. `main_frame`, `script`, `xmlhttprequest`, `fetch` |
| `initiator` | string/null | no | Origin that initiated the request |
| `tabId` | number | no | Browser tab ID |
| `timeStamp` | number | no | Browser timestamp in milliseconds |

Browser MVP limitations:

- Does not capture request bodies.
- Does not capture response bodies.
- Does not capture request/response headers.
- Best used for endpoint discovery, flow evidence, and URL inventory.

## Burp Extension Endpoint

Expected endpoint:

```http
POST /api/redteam/artifacts/burp
Authorization: Bearer <plugin-api-key>
Content-Type: application/json
```

## Burp Extension Payload

Sample:

```json
{
  "source": "burp-suite",
  "tenantId": "tenant_demo",
  "engagementId": "engagement_demo",
  "targetUrl": "https://www.example.com",
  "allowedDomains": ["example.com"],
  "capturedAt": "2026-07-12T16:30:00.000Z",
  "messages": [
    {
      "requestLine": "GET /login HTTP/1.1",
      "responseLine": "HTTP/1.1 200 OK",
      "requestPreview": "GET /login HTTP/1.1\nHost: www.example.com\nAuthorization: <redacted>\nCookie: <redacted>",
      "responsePreview": "HTTP/1.1 200 OK\nContent-Type: text/html\nSet-Cookie: <redacted>"
    }
  ]
}
```

Burp top-level fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `source` | string | yes | Always `burp-suite` |
| `tenantId` | string | yes | SynapDome tenant/workspace ID |
| `engagementId` | string | yes | SynapDome engagement ID |
| `targetUrl` | string URL | yes | User-selected target URL |
| `allowedDomains` | string[] | yes | Authorized domains confirmed in plugin UI |
| `capturedAt` | ISO datetime string | yes | Client-side capture timestamp |
| `messages` | array | yes | Selected Burp messages |

Burp message fields:

| Field | Type | Required | Notes |
|---|---:|---:|---|
| `requestLine` | string | yes | First line of the HTTP request |
| `responseLine` | string | no | First line of the HTTP response |
| `requestPreview` | string | yes | Redacted request preview, capped by plugin |
| `responsePreview` | string | no | Redacted response preview, capped by plugin |

Burp redaction behavior:

- `Authorization` header is redacted.
- `Cookie` header is redacted.
- `Set-Cookie` header is redacted.
- Preview text is capped by the plugin.

Burp MVP limitations:

- Uploads selected message previews, not full unlimited proxy history.
- Does not currently upload binary bodies.
- Does not currently upload full HAR.
- Intended as evidence/context capture and scan trigger support.

## Recommended Backend Artifact Model

The SynapDome server should persist a normalized artifact record.

Example:

```json
{
  "id": "artifact_...",
  "tenantId": "tenant_demo",
  "engagementId": "engagement_demo",
  "source": "browser-extension",
  "evidenceType": "http-traffic",
  "targetUrl": "https://www.example.com",
  "allowedDomains": ["example.com"],
  "capturedAt": "2026-07-12T16:30:00.000Z",
  "receivedAt": "2026-07-12T16:31:02.000Z",
  "requestCount": 1,
  "messageCount": 0,
  "rawStorageKey": "tenants/tenant_demo/engagements/engagement_demo/artifacts/artifact_....json",
  "createdBy": {
    "authType": "plugin-api-key",
    "plugin": "browser-extension"
  }
}
```

For Burp:

```json
{
  "id": "artifact_...",
  "tenantId": "tenant_demo",
  "engagementId": "engagement_demo",
  "source": "burp-suite",
  "evidenceType": "http-traffic",
  "targetUrl": "https://www.example.com",
  "allowedDomains": ["example.com"],
  "capturedAt": "2026-07-12T16:30:00.000Z",
  "receivedAt": "2026-07-12T16:31:02.000Z",
  "requestCount": 0,
  "messageCount": 1,
  "rawStorageKey": "tenants/tenant_demo/engagements/engagement_demo/artifacts/artifact_....json",
  "createdBy": {
    "authType": "plugin-api-key",
    "plugin": "burp-suite"
  }
}
```

## Mapping Captured Requests Into Evidence

For browser uploads:

```js
const evidenceItems = payload.requests.map((request) => ({
  type: "http-request-metadata",
  source: "browser-extension",
  method: request.method,
  url: request.url,
  statusCode: request.statusCode,
  resourceType: request.type,
  initiator: request.initiator,
  observedAt: new Date(request.timeStamp).toISOString()
}));
```

For Burp uploads:

```js
const evidenceItems = payload.messages.map((message) => ({
  type: "http-message-preview",
  source: "burp-suite",
  requestLine: message.requestLine,
  responseLine: message.responseLine,
  requestPreview: message.requestPreview,
  responsePreview: message.responsePreview
}));
```

## Queueing A DAST Run After Upload

After storing the artifact, SynapDome can queue a Red Team Agent Node DAST run.

Recommended payload:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_demo",
  "template": "web-dast",
  "targets": [
    {
      "kind": "url",
      "url": "https://www.example.com"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["example.com"],
    "maxDurationMinutes": 20,
    "network": "restricted",
    "tools": ["zap"]
  },
  "callback": {
    "url": "https://app.synapdome.com/api/redteam/agents/callback/runs/tenant_demo/run_id/events",
    "runId": "synapdome-run-id",
    "tenantId": "tenant_demo"
  },
  "providedInputs": {
    "sourceArtifactId": "artifact_..."
  }
}
```

Notes:

- `template: "web-dast"` is preferred.
- `template: "web-scan"` remains accepted as a legacy alias.
- `allowedDomains` should be sent. If empty, the Red Team Agent Node falls back to the exact hostname of `targetUrl` only.
- For now, captured plugin artifacts are not required by the Red Team Agent Node to run ZAP/Nuclei. They are primarily evidence/context for SynapDome and future API/authenticated scan flows.

## DAST Result HTML

Every successful DAST run now returns:

```text
exports/dast-report.html
```

Fetch:

```http
GET /runs/:runId/artifacts/exports/dast-report.html
x-internal-secret: <REDTEAM_AGENT_SECRET>
```

Parsing guide:

```text
docs/dast-html-report-handoff.md
```

Recommended extraction:

```js
const dom = new DOMParser().parseFromString(html, "text/html");
const payload = JSON.parse(
  dom.querySelector("#synapdome-findings-json").textContent
);

const findings = payload.findings;
```

## Validation Rules

Reject upload if:

- Plugin API key is missing or invalid.
- `source` is not `browser-extension` or `burp-suite`.
- `tenantId` or `engagementId` is missing.
- `targetUrl` is missing or invalid.
- `targetUrl` is outside the engagement's authorized scope.
- Any `allowedDomains` value is outside the engagement's authorized scope.
- Payload exceeds server-side size limit.
- Payload contains obvious unredacted secrets in known sensitive headers.

Recommended soft warnings:

- `allowedDomains` is empty.
- Browser upload has zero requests.
- Burp upload has zero messages.
- Request URLs include domains outside `allowedDomains`.

## Current Version

Plugin package version:

```text
0.1.0
```

Release:

```text
https://github.com/Ifex370/redteam-agent-node/releases/tag/legacy-plugins-v0.1.0
```
