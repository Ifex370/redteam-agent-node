# Consolidated deployment runbook

26 November 2026. Applies to the code in this repository; no cloud deployment was performed for this handoff. Start with [architecture](redteam-architecture.md) and [scanner inventory](redteam-scanners.md).

## 1. Choose topology and preserve data

Use a dedicated Ubuntu/Debian Linux scanner host, a separate AT workspace service, and the proven Apple Silicon Mac mobile runner. They can communicate privately across providers; AWS is not required. Keep customer access behind the main SynapDome backend. Separate execution hosts/workspaces per tenant before offering direct customer execution.

Inventory existing databases, artifact storage, DNS, model provider and identity provider before cutover. Restore approved backups if available. The Git repo contains code, not the AWS data or laptop sessions.

Prerequisites: Git, Docker Engine + Compose v2, Python 3, CA certificates, curl, OpenSSL and Node.js 24 LTS (also used by onboarding). Install Bun 1.3.9 separately for AT. Verify `node --version`, `docker compose version`, `bun --version`. Use a non-root deployment/service account; membership of the Docker group grants powerful host access. Create a dedicated account for it.

```sh
git clone https://github.com/Ifex370/redteam-agent-node.git
cd redteam-agent-node
git rev-parse HEAD  # record this release revision
npm ci
npm run build
npm run test:onboarding
```

Use a reviewed commit for production, not an unattended pull of changing main. Do not run `scripts/deploy-ubuntu.sh` over an existing deployment: it rewrites `.env`, installs floating dependencies and restarts processes. The steps below preserve explicit configuration.

## 2. Scanner environment and dependencies

As the service user, prepare a private `.env` (do not overwrite an existing one):

```sh
umask 077
cp -n .env.example .env
mkdir -p /var/lib/synapdome-redteam/artifacts
```

The administrator must first create `/var/lib/synapdome-redteam` owned by that service user. Edit `.env` privately:

```dotenv
API_HOST=127.0.0.1
API_PORT=4400
REDTEAM_AGENT_SECRET=REPLACE_WITH_RANDOM_SECRET
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
ARTIFACT_ROOT=/var/lib/synapdome-redteam/artifacts
WORKER_CONCURRENCY=1
RUN_TIMEOUT_MS=900000
DOCKER_NETWORK=none
CODEQL_CLI_PATH=/opt/codeql/codeql/codeql
TRIVY_CACHE_ROOT=/var/lib/synapdome-redteam/tool-cache/trivy
GRYPE_CACHE_ROOT=/var/lib/synapdome-redteam/tool-cache/grype
MOBSF_BASE_URL=http://127.0.0.1:18000
MOBSF_API_KEY=REPLACE_WITH_DIFFERENT_RANDOM_SECRET
MOBSF_MAX_UPLOAD_BYTES=524288000
AGENT_LLM_ENABLED=false
```

Generate independent secrets with `openssl rand -hex 32` and store them privately. The API does not enforce authentication if its secret is empty. Do not use the development MobSF key. `AGENT_LLM_ENABLED` is configuration scaffolding, not proof of a model planner; this scanner pipeline uses the deterministic planner. AT's model provider is configured separately.

```sh
bash scripts/pull-scanner-images.sh
# Explicit project name makes the MobSF volume predictable.
export COMPOSE_PROJECT_NAME=synapdome-redteam
docker compose up -d redis
docker volume create synapdome-redteam_mobsf-data
docker run --rm --user root \
  -v synapdome-redteam_mobsf-data:/home/mobsf/.MobSF \
  opensecurity/mobile-security-framework-mobsf:v4.4.6 \
  chown -R 9901:9901 /home/mobsf/.MobSF
docker compose up -d mobsf
docker compose ps
```

Use the same Compose project name for all subsequent commands. Install CodeQL separately using a reviewed compatible Linux bundle, verify its release/checksum and configure `CODEQL_CLI_PATH`. The scanner inventory lists each image and configuration dependency. MobSF can take several minutes to become healthy.

Run API and worker in separate terminals for first validation, both from repository root:

```sh
npm run start:api
# Separate terminal:
npm run start:worker
```

Then install both under the host's process manager with the same working directory, private `.env`, service account, Docker access and restart-on-failure. For an existing PM2 installation:

```sh
pm2 start dist/api/server.js --name synapdome-agent-api
pm2 start dist/worker/worker.js --name synapdome-agent-worker
pm2 save
# Run `pm2 startup` and execute its printed administrator command.
```

Do not launch duplicate manual and managed processes. Keep 4400 on loopback when the main backend is colocated; for separate hosts use a private address/firewall and TLS or a private tunnel. Never send the shared secret from browser code.

## 3. SynapDome AT operator workspace

Follow [the detailed workspace guide](../deploy/synapdome-ui/README.md). Directory/service identifiers retain `synapdome-ui` and `cyberstrike` for compatibility.

```sh
# /opt/releases must be writable by the deployment user.
bash deploy/synapdome-ui/scripts/prepare.sh /opt/releases/synapdome-at-20261126
sudo bash deploy/synapdome-ui/scripts/install-server.sh /opt/releases/synapdome-at-20261126
```

The prepare script reconstructs upstream commit `2bda675b68c8f81412267a5b331b74539e2d4e19`, applies the branded laptop patch, installs locked dependencies, typechecks and builds the UI. The installer creates persistent directories and a service but does not start it. No macOS executable is deployed to Linux.

Configure real model-provider credentials privately for the service account. The laptop's local model, credentials and sessions are not part of this package. Install any additional tools required by an AT workflow explicitly; copying an MCP configuration without its server binaries does not install those tools. The queued scanner node is a separate service, not automatically connected to AT.

Supply the main application's session-validation endpoint and TLS certificate, then render the Nginx gateway using the commands in the workspace guide. Use a dedicated hostname such as `redteam.synapdome.com`; `/redteam/` subpath mounting is not supported. Verify login, access entitlement and failure denial before exposing it.

```sh
sudo systemctl enable --now synapdome-ui
sudo nginx -t
sudo systemctl reload nginx
curl -fsS http://127.0.0.1:4096/global/health
```

The health route checks the engine only. Validate the real authenticated browser flow separately. Keep a single shared workspace restricted to internal operators; gateway login is not tenant isolation.

## 4. Android emulator, ADB and Frida

Run on a dedicated Apple Silicon Mac. Install official Android command-line tools and Java first. The package pins API 35 Google APIs ARM64 image revision 9, emulator 37.2.13, platform-tools 37.0.1, Frida 17.8.2 and frida-tools 14.6.0.

```sh
bash deploy/synapdome-ui/mobile/install.sh
# Run in a persistent visible Terminal, not a temporary remote command session:
bash deploy/synapdome-ui/mobile/start.sh
```

`start.sh` launches a visible emulator: do not add `-no-window` if an operator needs the Android screen. An ADB-connected headless process is not proof that a window exists. If the device already runs, inspect that process before starting a second instance. Cold boot without wiping data if snapshot loading fails; do not use `-wipe-data` for routine recovery.

In a second terminal, wait for `adb -s emulator-5554 shell getprop sys.boot_completed` to return `1`, then:

```sh
bash deploy/synapdome-ui/mobile/provision-frida.sh
```

Use `$HOME/Library/Android/sdk/platform-tools/adb` if ADB is not on PATH. Installation verifies the SDK baseline and stops on mismatched distributed revisions. The existing Mac can privately export the pinned SDK via `mobile/export-sdk.sh`; retain its checksum and follow SDK license requirements. New AVDs do not include APKs, app accounts or session data. Install approved APKs and log in separately.

For server access, install the matching Linux ADB client and Frida client using `mobile/install-server-client.sh`, as documented in the workspace guide. From the Mac, with a dedicated verified SSH key:

```sh
bash deploy/synapdome-ui/mobile/connect-server.sh lab-tunnel@YOUR_SERVER /private/path/to/key
```

On the server:

```sh
export PATH=/opt/synapdome-tools/bin:$PATH
export ADB_SERVER_SOCKET=tcp:127.0.0.1:15037
adb -s emulator-5554 get-state
frida-ps -H 127.0.0.1:27044
```

Expose neither ADB nor Frida publicly. Set the service's environment and tool path if AT should use these clients; an interactive shell export does not configure systemd. Restrict tunnel remote listeners to loopback; leave GatewayPorts disabled. Keep the Mac awake and restart Frida/tunnel after reboot. Dynamic mobile workflows require their own authorized test and evidence review; MobSF static analysis does not use this emulator.

A Linux/cloud emulator is not delivered as an equivalent replacement: CPU architecture, hardware virtualization and app behavior require separate qualification.

## 5. Marketing, scope PDF and email review

`Synap AT/` contains the marketing assets, while the current server is Node `src/onboarding`. Use [ONBOARDING.md](../Synap%20AT/ONBOARDING.md) and its environment example. Do not use the old Python Dockerfile for the current PDF/email APIs.

Configure `PUBLIC_ORIGIN`, private `ONBOARDING_DATA_DIR`, loopback port (default 4174), `ONBOARDING_LOCAL_PREVIEW=false` and verified Resend SMTP credentials in the private environment. Run one process:

```sh
npm run start:onboarding
# Or, after first validation:
pm2 start dist/onboarding/server.js --name synapdome-onboarding
pm2 save
```

Proxy all site/static, `/api/onboarding/*` and `/pdfjs/*` routes over HTTPS. Verify both staff and customer messages with owned mailboxes. This is manual review/signing: no automatic payment, signature or assessment start. Review draft commercial terms before customer use. Persist and back up the private records outside the public web root.

## 6. Burp/browser clients and main backend

Use [legacy-plugin-installation.md](legacy-plugin-installation.md). Install the versioned JAR/ZIP in `release-packages/`. Configure the main application's URL and a user-scoped token, not the Agent Node secret. The dev team must supply authenticated capture-upload endpoints, private evidence storage and tenant checks; these endpoints are not implemented by the scanner API.

Use [architecture](redteam-architecture.md) for scan dispatch and callback contracts. All Agent Node protected routes use `X-Internal-Secret`. The older directory guide's Bearer header is superseded by this actual implementation.

## 7. Acceptance, recovery and rollback

- API `/health` returns `{"ok":true}`; protected `/plugins` without a secret returns 401. `/health` alone does not prove Redis or worker readiness.
- Submit an owned fixture for each enabled scanner, inspect expected findings and raw/normalized outputs. Confirm callbacks and paused-run resumption in the main backend.
- AT: unauthenticated/expired/unauthorized users denied; valid internal operator can load UI, use its model and reconnect streams. Test tenant boundaries before customer access.
- Mobile: boot property `1`, visible Android window, Frida process enumeration, approved app navigation and reconnect after runner/tunnel restart.
- Onboarding: PDF preview, private persistence and actual email delivery. Capture clients: uploads associated with the correct tenant/engagement.
- Confirm backups restore on the new host. Do not claim AWS recovery based solely on a fresh code deployment.

Preserve the prior code revision and private data backup. Roll back the Node build from that revision and restart the API/worker; restore data only using a reviewed recovery plan. AT rollback uses the previous release/web symlinks as described in its package. Never delete emulator userdata to fix a missing window.

Upstream licenses and attribution remain in force; preserve the CyberStrike AGPL notices/source obligations. Rebranding does not remove them.
