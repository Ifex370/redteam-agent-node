# tfsec IaC Integration Handoff

## Contract

```text
base URL: http://34.205.79.22:4400
template: iac-scan
tool: tfsec
target kinds: repo, local_path
```

## Request

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_tfsec_iac",
  "template": "iac-scan",
  "targets": [{
    "kind": "repo",
    "url": "https://github.com/CLIENT/REPOSITORY.git",
    "branch": "main"
  }],
  "policy": {
    "authorized": true,
    "allowedDomains": ["github.com"],
    "maxDurationMinutes": 30,
    "network": "none",
    "tools": ["tfsec"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_tfsec_001",
    "tenantId": "tenant_demo"
  }
}
```

Submit with `POST /runs`, `Content-Type: application/json`, and the backend-only `X-Internal-Secret`.

## Results And Artifacts

```text
source: agent:iac-scan
tool: tfsec
category: Infrastructure as Code

tool-outputs/tfsec/tfsec.json
tool-outputs/tfsec/stdout.log
tool-outputs/tfsec/stderr.log
```

## UI Card

```text
Name: tfsec
Domain: Supply Chain
Group: Infrastructure as Code
Status: Available
Template: iac-scan
Tool ID: tfsec
```

## Verification Baseline

```text
status: succeeded
findings: 12
```

Upstream note: tfsec remains available, but Aqua directs new engineering investment toward Trivy.

