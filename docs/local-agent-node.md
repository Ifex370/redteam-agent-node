# Local Red Team Agent Node

This repository starts as a local execution node for the Red Team Agents architecture. It implements the local pieces first:

- Redis/BullMQ queue (`agent-queue`)
- Dedicated worker process
- Bounded deterministic agent orchestrator
- Per-run artifact folders
- Dockerized Semgrep execution
- Normalized findings export
- SynapDome export payload
- Optional callback events to SynapDome/CyberNexus
- Shared-secret API auth when `REDTEAM_AGENT_SECRET` is configured
- SSE stream for live status/log/finding events

The cloud customer backend can later submit the same engagement JSON shape to the local API and ingest the generated export bundle.

## MVP Flow

```text
engagement JSON
  -> POST /runs
  -> BullMQ job
  -> agent worker / orchestrator
  -> validate + plan
  -> Docker tool container
  -> artifacts/<runId>/
  -> exports/findings.json + exports/synapdome-export.json + run-summary.json
```

## Requirements

- Node.js 20+
- Docker Desktop
- Redis, via the included `docker-compose.yml`

## Setup

```powershell
cp .env.example .env
npm install
docker compose up -d redis
```

In one terminal:

```powershell
npm run dev:worker
```

In another terminal:

```powershell
npm run dev:api
```

Submit the sample run:

```powershell
npm run submit:sample
```

Submit the DVWA SAST run after cloning DVWA into `targets/DVWA`:

```powershell
npx tsx src/cli/submit-sample.ts samples/dvwa-sast.engagement.json
```

Submit DVWA directly from GitHub:

```powershell
npx tsx src/cli/submit-sample.ts samples/dvwa-github-sast.engagement.json
```

Submit a container tarball scan using a signed fetch URL:

```powershell
npx tsx src/cli/submit-sample.ts samples/container-scan-fetchurl.engagement.json
```

Or submit through the API:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4400/runs -ContentType 'application/json' -Body (Get-Content .\samples\web-sast.engagement.json -Raw)
```

Stream run events:

```powershell
curl http://127.0.0.1:4400/runs/<runId>/stream
```

Fetch the final summary:

```powershell
Invoke-RestMethod http://127.0.0.1:4400/runs/<runId>
```

Provide missing input to a paused run:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4400/runs/<runId>/input -ContentType 'application/json' -Body '{"auth.sessionCookie":"..."}'
```

## Engagement Contract

The first supported templates are `web-sast` and `container-scan`.

`web-sast` supports `local_path` and `repo`.

`container-scan` supports `container_image` with a signed `fetchUrl`.

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_demo",
  "template": "web-sast",
  "targets": [
    {
      "kind": "local_path",
      "path": "./samples/demo-app"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": [],
    "maxDurationMinutes": 15,
    "network": "none",
    "tools": ["semgrep"]
  }
}
```

GitHub repo target:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_dvwa_github",
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
  }
}
```

## Artifact Layout

```text
artifacts/<runId>/
  input.engagement.json
  run-summary.json
  exports/
    findings.json
    synapdome-export.json
  plan.json
  inputs/
  tool-outputs/
    semgrep/
      semgrep.sarif
      stdout.log
      stderr.log
```

## Current Guardrails

- Runs require `policy.authorized: true`.
- MVP SAST accepts local paths and HTTPS GitHub repository URLs.
- Container scans accept signed image tarball URLs via `fetchUrl` and run Trivy.
- If `REDTEAM_AGENT_SECRET` is configured, API calls require `X-Internal-Secret` and callbacks send `X-Agent-Secret`.
- Git clone runs before Dockerized scanning; Semgrep still runs with container networking disabled.
- Repo URLs cannot contain embedded credentials.
- The orchestrator can pause runs as `awaiting_input` and emit a structured input request for the client prompt.
- LLM planning is disabled by default. Set `AGENT_LLM_ENABLED=true`, `AGENT_LLM_MODEL`, and `OPENAI_API_KEY` later when adding model-backed planning/analysis.
- Semgrep uses bundled local rules under `rules/semgrep`, so it works with container networking disabled.
- The bundled PHP rules include DVWA-oriented checks for reflected XSS, SQL injection, command injection, file inclusion, weak hashing, loose comparisons, and hardcoded credentials.
- Docker is launched with `--network none` by default.
- Worker concurrency defaults to `1`.
- Cloud metadata endpoints, `.gov`, and `.mil` hosts are denied before future networked templates run.

## Next Build Steps

1. Add a local run registry table or SQLite store if file summaries become too limiting.
2. Add TruffleHog and Trivy adapters to the `web-sast` template.
3. Add a webhook/export client that POSTs `exports/synapdome-export.json` back to the customer backend.
4. Add cancel support that terminates a running Docker container by run id.
5. Add model-backed planner/analyzer using the same deterministic tool whitelist.
