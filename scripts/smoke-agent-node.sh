#!/usr/bin/env bash
set -euo pipefail

echo "health"
curl -sS http://127.0.0.1:4400/health
echo

SECRET="$(grep '^REDTEAM_AGENT_SECRET=' /opt/redteam-agent-node/.env | cut -d= -f2-)"

cat >/tmp/agent-smoke-payload.json <<'JSON'
{
  "tenantId": "tenant_smoke",
  "engagementId": "eng_smoke",
  "template": "container-scan",
  "targets": [
    {
      "kind": "container_image"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": [],
    "maxDurationMinutes": 5,
    "network": "none",
    "tools": ["trivy-image"]
  }
}
JSON

echo "submit"
curl -sS -X POST http://127.0.0.1:4400/runs \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $SECRET" \
  --data @/tmp/agent-smoke-payload.json >/tmp/agent-submit.json
cat /tmp/agent-submit.json
echo

RUN_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/agent-submit.json", "utf8")).runId)')"
sleep 3

echo "status"
curl -sS -H "X-Internal-Secret: $SECRET" "http://127.0.0.1:4400/runs/$RUN_ID"
echo
