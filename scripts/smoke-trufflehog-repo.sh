#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/trufflesecurity/trufflehog.git}"
BRANCH="${2:-main}"

cd /opt/redteam-agent-node

SECRET="$(grep '^REDTEAM_AGENT_SECRET=' .env | cut -d= -f2-)"

cat >/tmp/trufflehog-repo-payload.json <<JSON
{
  "tenantId": "tenant_demo",
  "engagementId": "engagement_trufflehog_repo",
  "template": "web-sast",
  "targets": [
    {
      "kind": "repo",
      "url": "$REPO_URL",
      "branch": "$BRANCH"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["github.com"],
    "maxDurationMinutes": 15,
    "network": "none",
    "tools": ["trufflehog"]
  }
}
JSON

curl -sS -X POST http://127.0.0.1:4400/runs \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $SECRET" \
  --data @/tmp/trufflehog-repo-payload.json >/tmp/trufflehog-repo-submit.json

cat /tmp/trufflehog-repo-submit.json
echo

RUN_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/trufflehog-repo-submit.json", "utf8")).runId)')"

for _ in $(seq 1 40); do
  sleep 6
  curl -sS -H "X-Internal-Secret: $SECRET" "http://127.0.0.1:4400/runs/$RUN_ID" >/tmp/trufflehog-repo-status.json
  STATUS="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/trufflehog-repo-status.json", "utf8")).status)')"
  COUNT="$(node -e 'const s=JSON.parse(require("fs").readFileSync("/tmp/trufflehog-repo-status.json", "utf8")); console.log(s.findingCount ?? 0)')"
  echo "status=$STATUS findingCount=$COUNT"
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "awaiting_input" ]; then
    cat /tmp/trufflehog-repo-status.json
    echo
    exit 0
  fi
done

cat /tmp/trufflehog-repo-status.json
echo
