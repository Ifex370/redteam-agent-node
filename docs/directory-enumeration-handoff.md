# SynapDome Directory Enumeration Handover

This handover implements the unified directory enumeration workflow from the attached PDF. The Red Team Agent Node now accepts one client-facing run template and hides scanner-specific output formats behind a canonical response.

## Capability

Template:

```text
directory-enumeration
```

Supported tools:

```text
feroxbuster
ffuf
```

Target type:

```text
url
```

Primary canonical artifact:

```text
exports/directory-results.json
```

Raw artifacts:

```text
tool-outputs/feroxbuster/feroxbuster.jsonl
tool-outputs/feroxbuster/stdout.log
tool-outputs/feroxbuster/stderr.log
tool-outputs/ffuf/ffuf.json
tool-outputs/ffuf/stdout.log
tool-outputs/ffuf/stderr.log
wordlists/directory-enumeration/common.txt
```

## Submit A Run

Endpoint:

```http
POST /runs
Authorization: Bearer <REDTEAM_AGENT_SECRET>
Content-Type: application/json
```

Sample payload:

```json
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_directory_demo",
  "template": "directory-enumeration",
  "targets": [
    {
      "kind": "url",
      "url": "https://example.com/"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["example.com"],
    "maxDurationMinutes": 15,
    "network": "restricted",
    "tools": ["feroxbuster", "ffuf"]
  },
  "callback": {
    "url": "https://<synapdome-backend>/agent-runs/callback",
    "runId": "<client-run-id>",
    "tenantId": "tenant_demo"
  }
}
```

Notes for the SynapDome server AI:

- `policy.authorized` must be `true`; this is the authorization attestation.
- `policy.allowedDomains` must include the target hostname or parent domain.
- If `policy.tools` is omitted or empty, the server defaults to `feroxbuster` and `ffuf`.
- The frontend/client backend should not parse Feroxbuster or ffuf native output. Use `exports/directory-results.json`.

## Canonical Response

The canonical file is written to `exports/directory-results.json` and is also listed in the normal run summary artifact list.

Shape:

```ts
type DirectoryScanResponse = {
  scanId: string;
  scanType: "directory-enumeration";
  target: string;
  status: "queued" | "running" | "completed" | "partial" | "failed";
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  toolsRun: string[];
  summary: {
    totalDiscovered: number;
    directories: number;
    files: number;
    endpoints: number;
    redirects: number;
    errors: number;
  };
  results: DirectoryScanEntry[];
  errors: Array<{
    tool: string;
    code: string;
    message: string;
  }>;
};
```

Result entry:

```ts
type DirectoryScanEntry = {
  id: string;
  url: string;
  path: string;
  resourceType: "directory" | "file" | "endpoint" | "redirect" | "unknown";
  method: string;
  statusCode?: number;
  contentLength?: number;
  contentType?: string;
  redirectLocation?: string;
  depth?: number;
  sources: string[];
  firstDiscoveredBy: string;
  confidence: "low" | "medium" | "high";
  requiresAuthentication: boolean;
  metadata: Record<string, unknown>;
};
```

## Frontend Extraction Rules

Use this contract:

```ts
const directoryArtifact = runSummary.artifacts.find(
  (artifact) => artifact === "exports/directory-results.json"
);
```

Then fetch/download that artifact through the existing SynapDome artifact retrieval flow and render:

- `summary.totalDiscovered` as the main discovered count.
- `summary.directories`, `summary.files`, `summary.endpoints`, and `summary.redirects` as category counters.
- `results[].url` as the primary clickable URL.
- `results[].path` as the compact path label.
- `results[].statusCode`, `contentLength`, `contentType`, and `redirectLocation` as detail columns.
- `results[].sources` as the source attribution chip list.
- `results[].confidence` as the confidence indicator.
- `errors[]` as non-blocking scanner warnings when status is `partial`.

Do not rely on `findings[]` for directory enumeration depth. The agent still creates `info` findings for compatibility, but the complete directory enumeration data lives in `exports/directory-results.json`.

## Normalization Behavior

The Red Team Agent Node normalizes scanner output before returning it:

- Hostnames are lower-cased.
- Duplicate slashes in paths are collapsed.
- URL fragments are removed.
- Default ports are removed.
- Query parameters are sorted when retained.
- Relative URLs are resolved against the submitted target.
- HTTP and HTTPS are not merged.
- Trailing slash variants are treated as equivalent for extensionless paths.

Deduplication key:

```text
method + scheme + hostname + port + normalized path + normalized query
```

When two scanners discover the same resource:

- `sources` are merged.
- `firstDiscoveredBy` keeps the first scanner.
- Non-null status/content metadata is preserved.
- Conflicts are recorded in `metadata.observations`.
- Confidence becomes `high` when multiple tools confirm the same resource.

## Status Handling

`completed` means every selected scanner completed and canonical results were produced.

`partial` means at least one scanner failed but at least one scanner produced usable output. The frontend should show results and surface `errors[]` as warnings.

`failed` means no scanner produced usable output. The frontend should show the safe `errors[]` messages and ask the user to validate the target/scope.

Tool error messages do not include stack traces, secrets, credentials, or local server paths.

## Roadmap Status

Closed by this update:

```text
Applications / Web / Directory Enumeration
├── Feroxbuster
└── ffuf
```

Still future work:

```text
Applications / Web / Recursive crawling enrichment
Applications / API / Endpoint-aware directory discovery
Infrastructure / External Recon / Naabu and Httpx correlation
```

## Repository Files Added Or Changed

Implementation:

```text
src/directory/directory-result.schema.ts
src/directory/directory-result.normalizer.ts
src/directory/directory-result.deduplicator.ts
src/directory/adapters/generic-directory.adapter.ts
src/directory/adapters/feroxbuster.adapter.ts
src/directory/adapters/ffuf.adapter.ts
src/tools/directory-enumeration.ts
src/agent/planner.ts
src/agent/orchestrator.ts
src/security/safety-gate.ts
src/domain/schemas.ts
src/plugins/catalog.ts
scripts/deploy-ubuntu.sh
samples/directory-enumeration.engagement.json
docs/directory-enumeration-handoff.md
```
