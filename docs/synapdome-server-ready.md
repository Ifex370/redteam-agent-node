# Red Team Agent Node Is Ready

Our Red Team Agent Node server is deployed and reachable.

## Base URL

```text
http://18.206.91.36:4400
```

## Health Check

```http
GET http://18.206.91.36:4400/health
```

Expected response:

```json
{"ok":true}
```

## Authentication

All non-health endpoints require this header:

```http
X-Internal-Secret: <shared-secret>
```

The shared secret must be provided securely server-to-server. Do not expose it in frontend code, browser storage, logs, public repositories, or client-side prompts.

## Submit Engagement Run

Use this endpoint to submit red team scan jobs and engagement artifacts:

```http
POST http://18.206.91.36:4400/runs
```

Required headers:

```http
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

The Red Team Agent Node will:

1. Accept the engagement payload.
2. Queue the run.
3. Select and execute the appropriate scanner or tool.
4. Request missing information when needed.
5. Return structured statuses, input requests, errors, and final results through the supplied callback URL.

## Callback Contract

When submitting a run, include a `callback` object:

```json
{
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/callback",
    "runId": "your-client-run-id",
    "tenantId": "your-tenant-id"
  }
}
```

The Red Team Agent Node will call that callback URL with updates using:

```http
X-Agent-Secret: <shared-secret-or-agreed-callback-secret>
```

## Example Submit Payload

```json
{
  "tenantId": "tenant_123",
  "engagementId": "eng_456",
  "template": "container-scan",
  "targets": [
    {
      "kind": "container_image",
      "fetchUrl": "https://signed-url-to-container-image-tar"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": [],
    "maxDurationMinutes": 15,
    "network": "none",
    "tools": ["trivy-image"]
  },
  "callback": {
    "url": "https://YOUR-SYNAPDOME-SERVER/api/redteam/callback",
    "runId": "client_run_123",
    "tenantId": "tenant_123"
  }
}
```

## Missing Information Loop

If required scan data is missing, the Red Team Agent Node will send an `input_request` callback instead of failing silently.

For example, if a container scan is submitted without `targets[0].fetchUrl`, the worker returns an input request similar to:

```json
{
  "kind": "input_request",
  "question": "The container_image target is missing its signed fetchUrl.",
  "requiredFields": [
    {
      "key": "targets[0].fetchUrl",
      "label": "Signed image tarball URL"
    }
  ],
  "resumeAction": "provide_container_image_source"
}
```

The missing information can then be provided through:

```http
POST http://18.206.91.36:4400/runs/:runId/input
```

Required headers:

```http
Content-Type: application/json
X-Internal-Secret: <shared-secret>
```

## Cancel Run

```http
POST http://18.206.91.36:4400/runs/:runId/cancel
```

Required header:

```http
X-Internal-Secret: <shared-secret>
```

## Current Status

The server is live, public health check is passing, and internal queue-to-worker smoke testing has passed.

We are ready for integration testing.

