#!/usr/bin/env bash
set -euo pipefail

cd /opt/redteam-agent-node

SECRET="$(grep '^REDTEAM_AGENT_SECRET=' .env | cut -d= -f2-)"

curl -sS -X POST http://127.0.0.1:4400/runs \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: $SECRET" \
  --data @samples/dvwa-github-secrets.engagement.json >/tmp/trufflehog-submit.json

cat /tmp/trufflehog-submit.json
echo

RUN_ID="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/trufflehog-submit.json", "utf8")).runId)')"

for _ in 1 2 3 4 5 6 7 8 9 10; do
  sleep 6
  curl -sS -H "X-Internal-Secret: $SECRET" "http://127.0.0.1:4400/runs/$RUN_ID" >/tmp/trufflehog-status.json
  STATUS="$(node -e 'console.log(JSON.parse(require("fs").readFileSync("/tmp/trufflehog-status.json", "utf8")).status)')"
  echo "status=$STATUS"
  if [ "$STATUS" = "succeeded" ] || [ "$STATUS" = "failed" ] || [ "$STATUS" = "awaiting_input" ]; then
    cat /tmp/trufflehog-status.json
    echo
    exit 0
  fi
done

cat /tmp/trufflehog-status.json
echo
