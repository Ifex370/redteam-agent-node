# Checkov IaC Integration Handoff

## Contract

```text
base URL: http://34.205.79.22:4400
template: iac-scan
tool: checkov
target kinds: repo, local_path
```

## Request

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_checkov_iac",
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
    "network": "restricted",
    "tools": ["checkov"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_checkov_001",
    "tenantId": "tenant_demo"
  }
}
```

Submit with `POST /runs`, `Content-Type: application/json`, and the backend-only `X-Internal-Secret`.

## Results

Normalized findings use:

```text
source: agent:iac-scan
tool: checkov
category: Infrastructure as Code
```

Artifacts:

```text
tool-outputs/checkov/checkov.json
tool-outputs/checkov/stdout.log
tool-outputs/checkov/stderr.log
exports/findings.json
exports/synapdome-export.json
```

## UI Card

```text
Name: Checkov
Domain: Supply Chain
Group: Infrastructure as Code
Status: Available
Template: iac-scan
Tool ID: checkov
```

## Verification Baseline

The vulnerable Terraform fixture produced:

```text
status: succeeded
findings: 15
```

