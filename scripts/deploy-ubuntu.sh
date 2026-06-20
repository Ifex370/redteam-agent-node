#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/redteam-agent-node"
ARTIFACT_ROOT="/var/lib/synapdome-redteam/artifacts"
REPO_URL="https://github.com/Ifex370/redteam-agent-node.git"
BRANCH="main"
APP_USER="${APP_USER:-ubuntu}"

CODEQL_ROOT="/opt/codeql"
CODEQL_CLI="$CODEQL_ROOT/codeql/codeql"

echo "[1/10] Installing system dependencies"
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git docker.io openssl
if ! docker compose version >/dev/null 2>&1; then
  sudo apt-get install -y docker-compose-v2
fi

echo "[2/10] Installing Node.js 20 if needed"
if ! command -v node >/dev/null 2>&1 || ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "[3/10] Enabling Docker"
sudo systemctl enable --now docker
sudo usermod -aG docker "$APP_USER"

echo "[4/10] Preparing directories"
sudo mkdir -p "$APP_DIR" "$ARTIFACT_ROOT" "$CODEQL_ROOT"
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR" /var/lib/synapdome-redteam "$CODEQL_ROOT"

echo "[5/10] Fetching application"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"

echo "[6/10] Installing CodeQL CLI if needed"
if [ ! -x "$CODEQL_CLI" ]; then
  CODEQL_ARCHIVE="/tmp/codeql-bundle-linux64.tar.gz"
  curl -fsSL "https://github.com/github/codeql-action/releases/latest/download/codeql-bundle-linux64.tar.gz" -o "$CODEQL_ARCHIVE"
  rm -rf "$CODEQL_ROOT/codeql"
  tar -xzf "$CODEQL_ARCHIVE" -C "$CODEQL_ROOT"
fi
"$CODEQL_CLI" version

echo "[7/10] Configuring environment"
if [ ! -f .env ]; then
  cp .env.example .env
fi

SECRET="$(grep -E '^REDTEAM_AGENT_SECRET=' .env | cut -d= -f2- || true)"
if [ -z "$SECRET" ]; then
  SECRET="$(openssl rand -hex 32)"
fi

cat > .env <<EOF
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
API_HOST=0.0.0.0
API_PORT=4400
REDTEAM_AGENT_SECRET=$SECRET
ARTIFACT_ROOT=$ARTIFACT_ROOT
WORKER_CONCURRENCY=1
RUN_TIMEOUT_MS=900000
DOCKER_NETWORK=none
CODEQL_CLI_PATH=$CODEQL_CLI
TRIVY_CACHE_ROOT=/var/lib/synapdome-redteam/tool-cache/trivy
GRYPE_CACHE_ROOT=/var/lib/synapdome-redteam/tool-cache/grype
AGENT_LLM_ENABLED=false
AGENT_LLM_MODEL=gpt-5-mini
OPENAI_API_KEY=
EOF

chmod 600 .env

echo "[8/10] Installing app dependencies and building"
npm ci
npm run build

echo "[9/10] Starting Redis and warming scanner images"
sudo docker compose up -d redis
sudo docker pull semgrep/semgrep:1.99.0
sudo docker pull trufflesecurity/trufflehog:latest
sudo docker pull aquasec/trivy:0.58.1
sudo docker pull anchore/grype:v0.114.0

echo "[10/10] Starting PM2 services"
sudo npm install -g pm2
pm2 delete synapdome-agent-api >/dev/null 2>&1 || true
pm2 delete synapdome-agent-worker >/dev/null 2>&1 || true
sg docker -c "cd '$APP_DIR' && pm2 start dist/api/server.js --name synapdome-agent-api"
sg docker -c "cd '$APP_DIR' && pm2 start dist/worker/worker.js --name synapdome-agent-worker"
pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null

echo "Deployment complete"
echo "Health check: curl http://127.0.0.1:4400/health"
echo "Shared secret is stored in $APP_DIR/.env as REDTEAM_AGENT_SECRET"
