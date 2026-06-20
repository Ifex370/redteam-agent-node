# Red Team Agents UI Template

This document defines the frontend template for the SynapDome Red Team Agents experience. It is intended for the client-side/frontend team and their implementation AI.

The goal is to present red team automation as a structured agent catalog, where users choose a security domain, select a capability, provide required engagement artifacts, and launch an agent run against the Red Team Agent Node.

## Product Concept

Red Team Agents are grouped by security domain:

```text
Red Team Agents
+-- Supply Chain
+-- Applications
+-- Cloud
+-- Identity
+-- Infrastructure
```

Each domain contains capability groups, and each capability group contains tools or agent templates.

The UI should feel like an operational security console, not a marketing page. It should be compact, clear, and built for repeated use by security teams.

## Primary Navigation

Use a left-side navigation or top-level tab system with these primary sections:

```text
Supply Chain
Applications
Cloud
Identity
Infrastructure
```

Each section opens a catalog view of capabilities.

## Agent Catalog Structure

### Supply Chain

```text
Supply Chain
+-- Source Code Analysis
|   +-- Semgrep
|   +-- TruffleHog
|   +-- CodeQL
|
+-- Dependency Analysis
|   +-- Trivy
|   +-- Grype
|   +-- Snyk
|
+-- Infrastructure as Code
    +-- Checkov
    +-- tfsec
    +-- Terrascan
```

### Applications

```text
Applications
+-- Web
|   +-- ZAP
|   +-- Nuclei
|   +-- Burp
|
+-- API
|   +-- ZAP API
|   +-- Nuclei API
|
+-- GraphQL
```

### Cloud

```text
Cloud
+-- AWS
|   +-- Prowler
|
+-- Azure
+-- GCP
+-- Kubernetes
```

### Identity

```text
Identity
+-- Active Directory
+-- Entra ID
+-- Okta
```

### Infrastructure

```text
Infrastructure
+-- External Recon
|   +-- Nmap
|   +-- Naabu
|   +-- Httpx
|
+-- Containers
|   +-- Trivy
|   +-- Dockle
|
+-- Internal Network
```

## Recommended Screen Layout

### 1. Agent Catalog Screen

Purpose: let the user choose what type of red team test they want to run.

Recommended layout:

```text
+------------------------------------------------------------+
| Red Team Agents                                             |
| [Supply Chain] [Applications] [Cloud] [Identity] [Infra]    |
+------------------------------------------------------------+
| Domain Overview / Filters                                   |
| Search agents, filter by status, artifact type, environment |
+------------------------------------------------------------+
| Capability Group: Source Code Analysis                      |
| [Semgrep] [TruffleHog] [CodeQL]                             |
|                                                            |
| Capability Group: Dependency Analysis                       |
| [Trivy] [Grype] [Snyk]                                      |
+------------------------------------------------------------+
```

Each tool card should show:

```text
Tool name
Short purpose
Supported input types
Status: Available / Coming Soon / Requires Setup
Last run status if applicable
Primary action: Configure Run
```

Example Semgrep card:

```text
Semgrep
Source code SAST for insecure patterns and vulnerable code paths.
Inputs: GitHub repo URL, branch
Status: Available
Action: Configure Run
```

### 2. Configure Agent Run Screen

Purpose: collect the information needed to queue a run.

Recommended layout:

```text
+------------------------------------------------------------+
| Configure Run: Semgrep Source Code Analysis                 |
+------------------------------------------------------------+
| Engagement                                                  |
| Tenant / Customer                                           |
| Engagement ID                                               |
| Authorization confirmation                                  |
+------------------------------------------------------------+
| Target                                                      |
| Repository URL                                              |
| Branch                                                      |
| Allowed domains                                             |
+------------------------------------------------------------+
| Execution Policy                                            |
| Max duration                                                |
| Network mode                                                |
| Tool selection                                              |
+------------------------------------------------------------+
| [Queue Run]                                                 |
+------------------------------------------------------------+
```

For the current working Semgrep flow, collect:

```text
tenantId
engagementId
GitHub repository URL
branch
authorization confirmation
callback run ID
callback URL
```

### 3. Run Monitor Screen

Purpose: show lifecycle state, logs, input requests, and findings.

Recommended states:

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

Recommended layout:

```text
+------------------------------------------------------------+
| Run: Semgrep / Source Code Analysis                         |
| Status: running_tool                                        |
+------------------------------------------------------------+
| Timeline                                                    |
| Done: Queued                                                |
| Done: Validating                                            |
| Done: Planning                                              |
| Active: Running Semgrep                                     |
| Pending: Normalizing                                        |
| Pending: Complete                                           |
+------------------------------------------------------------+
| Findings Summary                                            |
| Critical | High | Medium | Low | Info                       |
+------------------------------------------------------------+
| Findings Table                                              |
| Severity | Title | Tool | Asset | Location | Evidence       |
+------------------------------------------------------------+
| Artifacts                                                   |
| semgrep.sarif | findings.json | synapdome-export.json       |
+------------------------------------------------------------+
```

### 4. Input Request Screen State

If the Red Team Agent Node needs more information, the UI should show an interactive prompt or form.

Example:

```text
The agent needs more information to continue.

Question:
The repo target is missing its GitHub URL.

Required fields:
- GitHub repository URL

[Submit Missing Information]
```

The frontend should post the answer back to:

```http
POST /runs/:runId/input
```

## Tool Availability States

Use these states in the UI so users understand what is live today.

```text
Available
Coming Soon
Requires Setup
Disabled
```

Suggested current status:

```text
Semgrep: Available
Trivy Dependency Analysis: Available
Trivy Container Image Scan: Available
TruffleHog: Available
CodeQL: Available
Grype: Coming Soon
Snyk: Requires Setup
Checkov: Coming Soon
tfsec: Coming Soon
Terrascan: Coming Soon
ZAP: Coming Soon
Nuclei: Coming Soon
Burp: Requires Setup
Prowler: Coming Soon
Nmap: Coming Soon
Naabu: Coming Soon
Httpx: Coming Soon
Dockle: Coming Soon
```

## Current Working Semgrep Payload

Use this as the first frontend integration test.

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_dvwa_github",
    "template": "secrets-scan",
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
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_dvwa_semgrep_001",
    "tenantId": "tenant_demo"
  }
}
```

Submit to:

```http
POST http://18.206.91.36:4400/runs
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

Expected immediate response:

```json
{
  "runId": "run_xxx",
  "jobId": "run_xxx",
  "status": "queued",
  "streamUrl": "/runs/run_xxx/stream"
}
```

## Current Working TruffleHog Payload

Use this as the first frontend integration test for source-code secret scanning.

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_dvwa_github_secrets",
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
    "tools": ["trufflehog"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/agents/callback/runs/TENANT_ID/RUN_ID/events",
    "runId": "client_run_dvwa_trufflehog_001",
    "tenantId": "tenant_demo"
  }
}
```

Use `template: "secrets-scan"` for TruffleHog-only secret scanning. Repo targets run a full-history Git scan. Use `template: "web-sast"` with `tools: ["semgrep", "trufflehog"]` when the user selects both Source Code Analysis and current-checkout Secret Scanning for the same repository.

## Current Working CodeQL Payload

Use this for CodeQL source analysis. Current supported languages are JavaScript/TypeScript and Python.

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

## Callback Events

The client backend should expect these callback kinds:

```text
status
input_request
results
error
```

### Status Callback

```json
{
  "tenantId": "tenant_demo",
  "externalRunId": "client_run_dvwa_semgrep_001",
  "stepTemplateSlug": "web-sast",
  "kind": "status",
  "phase": "running_tool",
  "message": "Run status changed to running_tool"
}
```

### Results Callback

```json
{
  "tenantId": "tenant_demo",
  "externalRunId": "client_run_dvwa_semgrep_001",
  "stepTemplateSlug": "web-sast",
  "kind": "results",
  "status": "succeeded",
  "runId": "run_xxx",
  "engagementId": "engagement_dvwa_github",
  "summary": {
    "tool": "semgrep",
    "durationMs": 47432,
    "findingCount": 10,
    "toolsRun": ["semgrep"],
    "bySeverity": {
      "high": 3,
      "medium": 6,
      "low": 1
    }
  },
  "findings": [
    {
      "title": "Semgrep Finding: rules.synapdome.php.sql-injection-superglobal",
      "severity": "high",
      "category": "Vulnerability",
      "asset": "https://github.com/digininja/DVWA.git",
      "location": "/src/file.php:42",
      "evidence": "User-controlled request data reaches a SQL execution sink.",
      "source": "agent:web-sast",
      "tool": "semgrep",
      "confidence": "high",
      "rawArtifactKey": "tool-outputs/semgrep"
    }
  ],
  "artifacts": [
    "exports/findings.json",
    "exports/synapdome-export.json",
    "tool-outputs/semgrep/semgrep.sarif"
  ],
  "synapdomeExportKey": "exports/synapdome-export.json"
}
```

## Frontend Data Model

Recommended client-side model:

```ts
type AgentDomain =
  | "supply-chain"
  | "applications"
  | "cloud"
  | "identity"
  | "infrastructure";

type AgentStatus =
  | "available"
  | "coming-soon"
  | "requires-setup"
  | "disabled";

type AgentTool = {
  id: string;
  name: string;
  domain: AgentDomain;
  group: string;
  description: string;
  status: AgentStatus;
  template?: string;
  toolId?: string;
  supportedInputs: string[];
};
```

Example:

```ts
const agentTools: AgentTool[] = [
  {
    id: "semgrep",
    name: "Semgrep",
    domain: "supply-chain",
    group: "Source Code Analysis",
    description: "Source code SAST for insecure patterns and vulnerable code paths.",
    status: "available",
    template: "secrets-scan",
    toolId: "semgrep",
    supportedInputs: ["GitHub repo URL", "branch"]
  },
  {
    id: "trufflehog",
    name: "TruffleHog",
    domain: "supply-chain",
    group: "Source Code Analysis",
    description: "Secret scanning for exposed credentials and tokens in source code.",
    status: "available",
    template: "web-sast",
    toolId: "trufflehog",
    supportedInputs: ["GitHub repo URL", "branch"]
  },
  {
    id: "codeql",
    name: "CodeQL",
    domain: "supply-chain",
    group: "Source Code Analysis",
    description: "Semantic source analysis for deeper code vulnerabilities.",
    status: "available",
    template: "web-sast",
    toolId: "codeql",
    supportedInputs: ["GitHub repo URL", "branch"]
  },
  {
    id: "trivy-dependencies",
    name: "Trivy",
    domain: "supply-chain",
    group: "Dependency Analysis",
    description: "Dependency vulnerability analysis from repository manifests and lockfiles.",
    status: "available",
    template: "dependency-scan",
    toolId: "trivy",
    supportedInputs: ["GitHub repo URL", "branch"]
  },
  {
    id: "trivy-container",
    name: "Trivy",
    domain: "infrastructure",
    group: "Containers",
    description: "Container image vulnerability scan from a signed image tarball.",
    status: "available",
    template: "container-scan",
    toolId: "trivy-image",
    supportedInputs: ["signed container image tarball URL"]
  }
];
```

## Design Notes

- Keep the interface dense and operational.
- Use tabs or side navigation for the five top-level domains.
- Use grouped tool cards for capabilities.
- Clearly mark tools that are not yet available.
- Avoid exposing secrets in the browser.
- All calls to the Red Team Agent Node should come from the SynapDome backend, not directly from the browser.
- Use the browser only to collect user intent and engagement artifacts.
- The backend should add `X-Internal-Secret` before calling the Red Team Agent Node.
- Treat callback errors as backend integration issues and surface them clearly in the run monitor.

## Implementation Priority

Recommended first build order:

1. Agent catalog with Supply Chain and Semgrep enabled.
2. Configure Run screen for GitHub repository SAST.
3. Run submission from SynapDome backend to Red Team Agent Node.
4. Run monitor using callback events.
5. Findings summary and findings table.
6. Artifact links.
7. Add Trivy container scan.
8. Add coming-soon cards for the remaining tools.
