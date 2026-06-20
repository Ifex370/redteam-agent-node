# Trivy Dependency Analysis Integration Handoff

Trivy dependency analysis is available on the Red Team Agent Node.

This document is for the SynapDome frontend/backend team and their implementation AI.

## Base URL

```text
http://34.205.79.22:4400
```

## Tool Contract

```text
template: dependency-scan
tool: trivy
supported target kinds: repo, local_path
cloud integration target: HTTPS GitHub repository
```

This is separate from the existing container image contract:

```text
template: container-scan
tool: trivy-image
```

## What The Agent Node Does

For a GitHub repository target, the Red Team Agent Node:

1. Accepts the authorized engagement request.
2. Clones the requested repository and branch.
3. Runs Trivy filesystem vulnerability analysis.
4. Examines supported dependency manifests and lockfiles.
5. Produces a Trivy JSON artifact.
6. Normalizes vulnerabilities into SynapDome findings.
7. Sends progress and final results through the callback URL.

Trivy may recognize ecosystems including npm, Yarn, pnpm, Python, Go, Maven, Gradle, NuGet, Ruby, and others when supported manifest or lock files are present.

## Submit Endpoint

```http
POST http://34.205.79.22:4400/runs
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

The SynapDome backend must add `X-Internal-Secret`. Never expose the shared secret in frontend/browser code.

## Example Submit Payload

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_trivy_dependencies",
  "template": "dependency-scan",
  "targets": [
    {
      "kind": "repo",
      "url": "https://github.com/Ifex370/redteam-agent-node.git",
      "branch": "main"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["github.com"],
    "maxDurationMinutes": 30,
    "network": "restricted",
    "tools": ["trivy"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_trivy_dependencies_001",
    "tenantId": "tenant_demo"
  }
}
```

## Immediate Response

```json
{
  "runId": "run_xxx",
  "jobId": "run_xxx",
  "status": "queued",
  "streamUrl": "/runs/run_xxx/stream"
}
```

## Callback Events

The existing callback event contract is unchanged:

```text
status
input_request
results
error
```

The final `results` callback includes:

```text
status
summary.findingCount
summary.bySeverity
findings[]
artifacts[]
synapdomeExportKey
```

Each normalized Trivy dependency finding contains:

```text
title
severity
category
asset
location
evidence
remediation
source: agent:dependency-scan
tool: trivy
```

## Artifacts

Successful dependency scans produce:

```text
tool-outputs/trivy/trivy.json
tool-outputs/trivy/stdout.log
tool-outputs/trivy/stderr.log
exports/findings.json
exports/synapdome-export.json
```

The main raw scanner result is:

```text
tool-outputs/trivy/trivy.json
```

## Frontend Card

Recommended UI metadata:

```text
Name: Trivy
Domain: Supply Chain
Group: Dependency Analysis
Status: Available
Template: dependency-scan
Tool ID: trivy
Inputs: GitHub repository URL, branch
```

## Run States

The UI should support:

```text
queued
validating
planning
running_tool
analyzing_results
normalizing
succeeded
failed
awaiting_input
cancelled
```

The UI should wait for the final `kind: "results"` callback before treating the displayed finding count as final.

## Local Verification

The implementation was tested locally against an intentionally vulnerable npm lockfile using `lodash 4.17.20`.

Expected verification result:

```text
template: dependency-scan
tool: trivy
status: succeeded
findings: 5
severity: 2 high, 3 medium
```

## Security Notes

- The repository URL must use HTTPS.
- Credentials must not be embedded in the Git URL.
- Repository scanning is currently restricted to GitHub targets.
- The Trivy vulnerability database requires outbound network access from the scanner container.
- Dependency findings should be reviewed for applicability before customer reporting.

