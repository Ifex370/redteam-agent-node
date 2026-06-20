# MobSF Mobile Scan Integration Handoff

## Purpose

This note defines the SynapDome server contract for Mobile Security Framework (MobSF) static analysis.

MobSF runs inside the Red Team Agent Node as an internal API-only service. SynapDome uploads a mobile application to its own artifact storage, creates a time-limited signed download URL, and submits that URL to the Agent Node. MobSF is not exposed to the internet.

## Agent Node

```text
Base URL: http://34.205.79.22:4400
Template: mobile-scan
Tool ID: mobsf
Target kind: mobile_app
Authentication header: X-Internal-Secret
```

The shared secret is the same `REDTEAM_AGENT_SECRET` already used for the other Agent Node integrations.

## Supported Artifact Contract

The initial verified path is Android APK static analysis.

Accepted MobSF filename extensions:

```text
.apk
.aab
.apks
.xapk
.ipa
```

The `fileName` field is important because signed artifact URLs may not contain a file extension. If omitted, the Agent Node assumes `application.apk`.

Maximum artifact size is 500 MiB by default.

## Submit A Run

```http
POST http://34.205.79.22:4400/runs
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_mobile_001",
  "template": "mobile-scan",
  "targets": [
    {
      "kind": "mobile_app",
      "fetchUrl": "https://synapdome.example.com/redteam/artifacts/signed-download-url",
      "fileName": "customer-application.apk"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": [],
    "maxDurationMinutes": 60,
    "network": "restricted",
    "tools": ["mobsf"]
  },
  "callback": {
    "url": "https://synapdome.example.com/redteam/agents/callback/runs/client-run-id/events",
    "runId": "client-run-id",
    "tenantId": "tenant_demo"
  }
}
```

Expected response:

```json
{
  "runId": "run_xxx",
  "jobId": "run_xxx",
  "status": "queued",
  "streamUrl": "/runs/run_xxx/stream"
}
```

## Processing Flow

```text
SynapDome stores mobile artifact
  -> SynapDome creates signed fetchUrl
  -> POST /runs
  -> Agent Node downloads artifact with a 500 MiB limit
  -> MobSF static analysis
  -> Agent Node saves raw JSON and PDF reports
  -> Agent Node normalizes findings
  -> callback results sent to SynapDome
  -> MobSF internal scan record is deleted
```

## Results

Monitor the run using:

```http
GET /runs/:runId
GET /runs/:runId/stream
```

The results callback follows the existing Agent Node callback contract. It contains:

```text
status
summary.findingCount
summary.bySeverity
findings[]
artifacts[]
synapdomeExportKey
```

Normalized MobSF finding categories include:

```text
Mobile Manifest
Mobile Code Analysis
Mobile Binary Analysis
Mobile File Analysis
Mobile Certificate
Mobile Permission
```

## Artifacts

```http
GET /runs/:runId/artifacts/exports/synapdome-export.json
GET /runs/:runId/artifacts/exports/findings.json
GET /runs/:runId/artifacts/tool-outputs/mobsf/mobsf-report.json
GET /runs/:runId/artifacts/tool-outputs/mobsf/mobsf-report.pdf
GET /runs/:runId/artifacts/tool-outputs/mobsf/scan.log
```

The input mobile package is retained in the run artifact folder for traceability. Production retention rules should remove expired run artifacts according to the engagement data-retention policy.

## Error And Input Handling

The run can return `awaiting_input` when:

```text
the mobile_app target is missing
fetchUrl is missing
fileName has an unsupported extension
```

The run fails when:

```text
the signed URL cannot be downloaded
the artifact exceeds the configured size limit
MobSF is unavailable
MobSF rejects or cannot analyze the package
```

Use the existing `POST /runs/:runId/input` flow to supply missing information.

## Deployment Notes

MobSF uses the pinned image:

```text
opensecurity/mobile-security-framework-mobsf:v4.4.6
```

It is bound only to:

```text
127.0.0.1:18000
```

Required Agent Node environment:

```env
MOBSF_BASE_URL=http://127.0.0.1:18000
MOBSF_API_KEY=<random-internal-secret>
MOBSF_MAX_UPLOAD_BYTES=524288000
```

`MOBSF_API_KEY` is internal to the Red Team Agent Node and must not be sent by the SynapDome client. The Ubuntu deployment script generates and preserves it automatically.

MobSF's first startup can take several minutes while it initializes analysis dependencies. The persistent Docker volume avoids repeating this work on every scan.

## Current Scope

Included:

```text
static mobile application analysis
signed URL ingestion
raw JSON report
PDF report
normalized findings
callbacks and SSE status
```

Not included yet:

```text
Android emulator dynamic analysis
iOS Corellium dynamic analysis
runtime traffic interception
Frida instrumentation
malware detonation
```
