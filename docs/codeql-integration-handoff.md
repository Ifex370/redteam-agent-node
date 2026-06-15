# CodeQL Integration Handoff

CodeQL is now available on the Red Team Agent Node.

This document is for the SynapDome frontend/backend team and their implementation AI.

## Base URL

```text
http://34.205.79.22:4400
```

## Tool Contract

```text
template: web-sast
tool: codeql
supported target kind: repo
supported repository type: HTTPS GitHub URL
current supported languages: JavaScript/TypeScript, Python
```

CodeQL runs on the Red Team Agent Node, not in GitHub Actions.

The Red Team Agent Node will:

1. Receive the run request from SynapDome.
2. Clone the GitHub repository.
3. Detect supported CodeQL languages.
4. Create a CodeQL database per supported language.
5. Run CodeQL analysis locally.
6. Produce SARIF artifacts.
7. Normalize findings into SynapDome-compatible results.
8. Send callback events back to SynapDome.

## Submit Endpoint

```http
POST http://34.205.79.22:4400/runs
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

The shared secret must be added by the SynapDome backend only. Do not expose it in frontend/browser code.

## CodeQL Submit Payload

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_codeql_github",
  "template": "web-sast",
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
    "network": "none",
    "tools": ["codeql"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_codeql_001",
    "tenantId": "tenant_demo"
  }
}
```

## Combined Source Analysis

CodeQL can be combined with the other source analysis tools:

```json
{
  "template": "web-sast",
  "policy": {
    "authorized": true,
    "allowedDomains": ["github.com"],
    "maxDurationMinutes": 30,
    "network": "none",
    "tools": ["semgrep", "trufflehog", "codeql"]
  }
}
```

## Callback Events

The existing callback flow is unchanged.

Expected callback event kinds:

```text
status
results
error
input_request
```

The final `results` callback includes:

```text
tool: codeql
status: succeeded | failed
summary.findingCount
summary.bySeverity
findings[]
artifacts[]
synapdomeExportKey
```

## Artifacts

Successful CodeQL runs produce artifacts like:

```text
tool-outputs/codeql/languages.json
tool-outputs/codeql/javascript-typescript.sarif
tool-outputs/codeql/javascript-typescript-database-create.stdout.log
tool-outputs/codeql/javascript-typescript-database-create.stderr.log
tool-outputs/codeql/javascript-typescript-database-analyze.stdout.log
tool-outputs/codeql/javascript-typescript-database-analyze.stderr.log
exports/findings.json
exports/synapdome-export.json
```

Python repositories will produce:

```text
tool-outputs/codeql/python.sarif
```

## Server Verification

CodeQL has already been tested successfully on the deployed Red Team Agent Node.

```text
runId: run_7RI-oDWgRfnk
template: web-sast
tool: codeql
target: https://github.com/Ifex370/redteam-agent-node.git
status: succeeded
findings: 12
```

## Frontend Notes

Recommended UI card:

```text
Name: CodeQL
Domain: Supply Chain
Group: Source Code Analysis
Status: Available
Template: web-sast
Tool ID: codeql
Inputs: GitHub repo URL, branch
Languages: JavaScript/TypeScript, Python
```

The frontend should not call the Red Team Agent Node directly. The browser should send user intent and engagement artifacts to the SynapDome backend. The SynapDome backend should add `X-Internal-Secret` and submit the run to the Red Team Agent Node.

## Current Limitation

Compiled language support is not enabled yet.

Languages such as Java, C#, C/C++, Go, Rust, and Swift often require build commands or dependency setup. These should be added later with explicit build-command inputs and resource controls.

