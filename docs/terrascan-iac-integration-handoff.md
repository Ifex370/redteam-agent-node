# Terrascan IaC Integration Handoff

## Contract

```text
base URL: http://34.205.79.22:4400
template: iac-scan
tool: terrascan
target kinds: repo, local_path
```

## Request

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_terrascan_iac",
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
    "tools": ["terrascan"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_terrascan_001",
    "tenantId": "tenant_demo"
  }
}
```

Terrascan requires restricted outbound access to initialize and update its policy bundle.

## Results And Artifacts

```text
source: agent:iac-scan
tool: terrascan

tool-outputs/terrascan/terrascan.json
tool-outputs/terrascan/stdout.log
tool-outputs/terrascan/stderr.log
```

## UI Card

```text
Name: Terrascan
Domain: Supply Chain
Group: Infrastructure as Code
Status: Available
Template: iac-scan
Tool ID: terrascan
```

## Verification Baseline

```text
status: succeeded
findings: 2 high
```

