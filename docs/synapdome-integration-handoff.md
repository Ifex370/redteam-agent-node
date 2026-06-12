# SynapDome Red Team Agent Node Integration Handoff

## Purpose

This document is for the SynapDome server-side implementation team or an AI coding agent that will integrate SynapDome with the Red Team Agent Node.

The Red Team Agent Node is a separate execution service that receives red-team engagement artifacts from SynapDome, queues an agent run, executes scanner containers, streams progress, and returns a SynapDome-ready export.

The only missing deployment-specific information needed to complete the first integration is:

```text
AGENT_NODE_BASE_URL=https://<UBUNTU_INSTANCE_IP_OR_DOMAIN>:4400
```

Replace `<UBUNTU_INSTANCE_IP_OR_DOMAIN>` with the Ubuntu cloud instance IP address or domain.

## System Relationship

```text
SynapDome client / agentic prompt
  -> SynapDome backend
  -> Red Team Agent Node API
  -> Redis queue
  -> Agent worker / orchestrator
  -> Docker scan containers
  -> Artifacts and SynapDome export
  -> SynapDome backend ingests results
```

SynapDome should treat the Red Team Agent Node as a backend execution service, not as a public user-facing API.

## Base URL

Production or cloud:

```text
https://<UBUNTU_INSTANCE_IP_OR_DOMAIN>:4400
```

Local development:

```text
http://127.0.0.1:4400
```

## Current Capabilities

Currently supported:

```text
template: web-sast
template: container-scan
target kind: repo
target kind: local_path
target kind: container_image with fetchUrl
tool: semgrep
tool: trivy-image
```

For cloud integration, use `repo` targets.

GitHub repository targets must be HTTPS URLs.

Do not send credentials inside Git URLs.

Supported example:

```text
https://github.com/digininja/DVWA.git
```

Unsupported examples:

```text
git@github.com:org/repo.git
https://token@github.com/org/repo.git
```

## Required Integration Flow

The SynapDome backend should implement this flow:

```text
1. Submit run:
   POST /runs

2. Store returned runId.

3. Monitor run:
   GET /runs/:runId/stream
   or poll GET /runs/:runId

4. If status is awaiting_input:
   show inputRequests to SynapDome's agentic prompt/user flow
   then send missing data:
   POST /runs/:runId/input

5. When status is succeeded:
   download:
   GET /runs/:runId/artifacts/exports/synapdome-export.json

6. Ingest export.findings into SynapDome's findings/engagement model.
```

## API Endpoints

### Health Check

```http
GET /health
```

Expected response:

```json
{
  "ok": true
}
```

### Submit Agent Run

```http
POST /runs
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

Example request:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_123",
  "template": "web-sast",
  "targets": [
    {
      "kind": "repo",
      "url": "https://github.com/digininja/DVWA.git",
      "branch": "master"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["github.com"],
    "maxDurationMinutes": 15,
    "network": "none",
    "tools": ["semgrep"]
  },
  "callback": {
    "url": "https://app.example.com/redteam/agents/callback/runs/3b1f/events",
    "runId": "3b1f",
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

Container image tarball request:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_456",
  "template": "container-scan",
  "targets": [
    {
      "kind": "container_image",
      "fetchUrl": "https://app.example.com/redteam/agent-artifacts/tenant/upload-id?exp=1760000000000&sig=replace"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": [],
    "maxDurationMinutes": 30,
    "network": "none",
    "tools": ["trivy-image"]
  },
  "callback": {
    "url": "https://app.example.com/redteam/agents/callback/runs/3b1f/events",
    "runId": "3b1f",
    "tenantId": "tenant_demo"
  }
}
```

For `container-scan`, the node downloads the signed `fetchUrl` without an auth header and scans the tarball with Trivy.

### Get Run Status And Summary

```http
GET /runs/:runId
```

Example response:

```json
{
  "runId": "run_xxx",
  "tenantId": "tenant_demo",
  "engagementId": "engagement_123",
  "template": "web-sast",
  "status": "succeeded",
  "steps": [],
  "inputRequests": [],
  "findingCount": 264,
  "findings": [],
  "synapdomeExportKey": "exports/synapdome-export.json"
}
```

Possible statuses:

```text
queued
validating
planning
awaiting_input
running_tool
analyzing_results
normalizing
succeeded
failed
cancelled
```

### Stream Live Run Events

```http
GET /runs/:runId/stream
Accept: text/event-stream
```

Event example:

```json
{
  "runId": "run_xxx",
  "type": "status",
  "message": "running_tool",
  "data": {
    "status": "running_tool"
  },
  "ts": "2026-05-29T07:47:21.000Z"
}
```

Event types:

```text
status
log
finding
artifact
error
complete
```

### Provide Missing Input

If a run returns `awaiting_input`, SynapDome should surface the request to the user or client-side agentic prompt.

Example paused run:

```json
{
  "status": "awaiting_input",
  "inputRequests": [
    {
      "id": "input_abc",
      "question": "The repo target is missing its GitHub URL.",
      "requiredFields": [
        {
          "key": "targets[0].url",
          "label": "GitHub repository URL"
        }
      ],
      "resumeAction": "provide_missing_repo_url"
    }
  ]
}
```

Resume request:

```http
POST /runs/:runId/input
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

Example body:

```json
{
  "targets": [
    {
      "kind": "repo",
      "url": "https://github.com/client/app.git",
      "branch": "main"
    }
  ]
}
```

Expected response:

```json
{
  "runId": "run_xxx",
  "jobId": "run_xxx:resume:abc123",
  "status": "queued",
  "streamUrl": "/runs/run_xxx/stream"
}
```

### Cancel A Run

```http
POST /runs/:runId/cancel
X-Internal-Secret: <shared-secret>
```

This is best effort. Queued jobs are removed from the queue. Active container termination is not fully implemented yet.

## Callback Events Sent By The Node

When the submitted job contains `callback.url`, the node pushes lifecycle events to that URL.

Every callback includes:

```text
X-Agent-Secret: <shared-secret>
```

Status callback:

```json
{
  "tenantId": "tenant_demo",
  "kind": "status",
  "externalRunId": "3b1f",
  "stepTemplateSlug": "web-sast",
  "phase": "executing",
  "message": "Run status changed to running_tool"
}
```

Input request callback:

```json
{
  "tenantId": "tenant_demo",
  "kind": "input_request",
  "externalRunId": "3b1f",
  "stepTemplateSlug": "container-scan",
  "inputRequest": {
    "id": "input_abc",
    "status": "open",
    "question": "The container_image target is missing its signed fetchUrl.",
    "requiredFields": [
      {
        "key": "targets[0].fetchUrl",
        "label": "Signed image tarball URL"
      }
    ],
    "resumeAction": "provide_container_image_source"
  }
}
```

Results callback:

```json
{
  "tenantId": "tenant_demo",
  "kind": "results",
  "externalRunId": "3b1f",
  "stepTemplateSlug": "web-sast",
  "status": "succeeded",
  "summary": {
    "tool": "semgrep",
    "durationMs": 84210,
    "findingCount": 2,
    "toolsRun": ["semgrep"]
  },
  "findings": []
}
```

Error callback:

```json
{
  "tenantId": "tenant_demo",
  "kind": "error",
  "externalRunId": "3b1f",
  "stepTemplateSlug": "web-dast",
  "error": "Target unreachable after retries."
}
```

### Download SynapDome Export

This is the main artifact SynapDome should ingest.

```http
GET /runs/:runId/artifacts/exports/synapdome-export.json
```

Example response shape:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_123",
  "runId": "run_xxx",
  "status": "succeeded",
  "summary": {
    "title": "Agent web-sast run completed",
    "toolsRun": ["semgrep"],
    "findingCount": 264,
    "bySeverity": {
      "high": 47,
      "medium": 24,
      "low": 193
    },
    "durationMs": 112386
  },
  "steps": [],
  "findings": [
    {
      "title": "SQL injection from request parameter",
      "severity": "high",
      "category": "Vulnerability",
      "asset": "https://github.com/client/app.git",
      "location": "/src/file.php:42",
      "evidence": "User-controlled request data reaches a SQL execution sink.",
      "source": "agent:web-sast",
      "tool": "semgrep",
      "confidence": "high",
      "rawArtifactKey": "tool-outputs/semgrep"
    }
  ],
  "artifacts": []
}
```

### Other Useful Artifacts

Raw normalized findings:

```http
GET /runs/:runId/artifacts/exports/findings.json
```

Raw Semgrep SARIF:

```http
GET /runs/:runId/artifacts/tool-outputs/semgrep/semgrep.sarif
```

Run plan:

```http
GET /runs/:runId/artifacts/plan.json
```

Original submitted engagement:

```http
GET /runs/:runId/artifacts/input.engagement.json
```

## Suggested Backend Pseudocode

```pseudo
AGENT_NODE_BASE_URL = "https://<UBUNTU_INSTANCE_IP_OR_DOMAIN>:4400"

submitResponse = POST AGENT_NODE_BASE_URL + "/runs" with engagementPayload
runId = submitResponse.runId

while true:
  summary = GET AGENT_NODE_BASE_URL + "/runs/" + runId

  if summary.status == "awaiting_input":
    inputRequest = summary.inputRequests[0]
    answer = ask_client_agent_or_user(inputRequest.question, inputRequest.requiredFields)
    POST AGENT_NODE_BASE_URL + "/runs/" + runId + "/input" with answer

  if summary.status == "succeeded":
    export = GET AGENT_NODE_BASE_URL + "/runs/" + runId + "/artifacts/exports/synapdome-export.json"
    ingest_findings_into_synapdome(export.findings)
    break

  if summary.status in ["failed", "cancelled"]:
    record_failure(summary)
    break

  sleep(3 seconds)
```

## Recommended SynapDome Payload Mapping

Map these fields from `synapdome-export.json` into SynapDome:

```text
tenantId -> tenant identifier
engagementId -> Red Team engagement identifier
runId -> external agent run identifier
summary.findingCount -> run summary count
summary.bySeverity -> severity distribution
findings[].title -> finding title
findings[].severity -> finding severity
findings[].category -> finding category
findings[].asset -> affected asset
findings[].location -> file/line or target location
findings[].evidence -> evidence / explanation
findings[].source -> finding source
findings[].tool -> scanner/tool name
findings[].confidence -> confidence
findings[].rawArtifactKey -> raw evidence artifact path
```

## Deployment Assumptions

The Ubuntu instance should run:

```text
Node.js 20+
Docker
Docker Compose plugin
Git
Redis container from docker-compose.yml
Agent API process
Agent worker process
```

Recommended `.env` on Ubuntu:

```env
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
API_HOST=0.0.0.0
API_PORT=4400
REDTEAM_AGENT_SECRET=<shared-secret>
ARTIFACT_ROOT=/var/lib/synapdome-redteam/artifacts
WORKER_CONCURRENCY=1
RUN_TIMEOUT_MS=900000
DOCKER_NETWORK=none
AGENT_LLM_ENABLED=false
AGENT_LLM_MODEL=gpt-5-mini
OPENAI_API_KEY=
```

## Security Requirements Before Production Use

The Agent Node can clone repositories and run scanner containers. Do not expose it publicly without access control.

Minimum recommended protection:

```text
Firewall allowlist only SynapDome backend IPs
or
Private VPC/VPN connection
or
API key middleware
```

If using API key middleware later, the SynapDome backend should send:

```http
X-Agent-Api-Key: <shared-secret>
```

## AI Implementation Notes

An AI coding agent implementing the SynapDome side should:

1. Add a configuration variable for the Agent Node base URL.
2. Add a service/client wrapper for the Agent Node API.
3. Submit engagement payloads to `POST /runs`.
4. Store `runId` on the SynapDome engagement or agent-run record.
5. Poll `GET /runs/:runId` or consume `GET /runs/:runId/stream`.
6. If `awaiting_input`, route `inputRequests` back to the client-side agentic prompt.
7. When `succeeded`, download `exports/synapdome-export.json`.
8. Map `findings` into the existing SynapDome findings model.
9. Store raw artifact links/keys for evidence traceability.
10. Handle `failed` and `cancelled` statuses as terminal states.

The missing information required from the operator is:

```text
Ubuntu instance IP/domain
Whether the Agent Node will be HTTP or HTTPS
Whether access is private-network-only or protected by an API key
```
