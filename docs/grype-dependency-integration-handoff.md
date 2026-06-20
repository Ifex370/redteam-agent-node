# Grype Dependency Analysis Integration Handoff

Grype dependency analysis is available on the Red Team Agent Node.

This document is for the SynapDome frontend/backend team and their implementation AI.

## Base URL

```text
http://34.205.79.22:4400
```

## Tool Contract

```text
template: dependency-scan
tool: grype
supported target kinds: repo, local_path
cloud integration target: HTTPS GitHub repository
```

## What The Agent Node Does

For a GitHub repository target, the Red Team Agent Node:

1. Receives the authorized engagement request.
2. Clones the requested repository and branch.
3. Runs Grype against the repository directory.
4. Catalogs supported language dependencies and lockfiles.
5. Matches detected packages against the Grype vulnerability database.
6. Produces a Grype JSON artifact.
7. Normalizes vulnerabilities into SynapDome findings.
8. Sends progress and final results through the callback URL.

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
  "engagementId": "engagement_grype_dependencies",
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
    "tools": ["grype"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_grype_dependencies_001",
    "tenantId": "tenant_demo"
  }
}
```

## Combined Trivy And Grype Scan

Both dependency scanners can run in the same engagement:

```json
{
  "template": "dependency-scan",
  "policy": {
    "authorized": true,
    "allowedDomains": ["github.com"],
    "maxDurationMinutes": 30,
    "network": "restricted",
    "tools": ["trivy", "grype"]
  }
}
```

The result will contain findings from both tools. SynapDome should preserve the finding `tool` field and may deduplicate equivalent vulnerabilities in its presentation layer.

## Callback Events

The existing callback contract is unchanged:

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

Each normalized Grype finding contains:

```text
title
severity
category
asset
location
evidence
remediation
source: agent:dependency-scan
tool: grype
```

## Artifacts

Successful Grype scans produce:

```text
tool-outputs/grype/grype.json
tool-outputs/grype/stdout.log
tool-outputs/grype/stderr.log
exports/findings.json
exports/synapdome-export.json
```

The main raw scanner result is:

```text
tool-outputs/grype/grype.json
```

## Frontend Card

Recommended UI metadata:

```text
Name: Grype
Domain: Supply Chain
Group: Dependency Analysis
Status: Available
Template: dependency-scan
Tool ID: grype
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

The displayed finding count becomes final after the `kind: "results"` callback.

## Verification Baseline

The implementation was tested against an intentionally vulnerable npm lockfile using `lodash 4.17.20`.

Expected result for that fixture:

```text
template: dependency-scan
tool: grype
status: succeeded
findings: 5
severity: 2 high, 3 medium
```

## Security And Operational Notes

- Repository URLs must use HTTPS.
- Credentials must not be embedded in Git URLs.
- Repository scanning is currently restricted to GitHub targets.
- Grype requires outbound access to update its vulnerability database.
- The Red Team Agent Node stores a shared Grype database cache to avoid downloading the database for every run.
- Dependency findings should be reviewed for applicability before customer reporting.

