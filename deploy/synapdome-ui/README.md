# SynapDome AT workspace deployment handoff

Product name: **SynapDome AT** (formerly CyberStrike). Existing package, service and engine configuration identifiers are preserved. See the [consolidated deployment guide](../../docs/redteam-deployment.md) and [architecture](../../docs/redteam-architecture.md).

## Delivery status

Prepared 22 November 2026. This package reconstructs the branded laptop source from a fixed upstream commit plus the local patch and brand assets. It includes the existing local model-message adjustment as well as the UI changes. The root Red Team Agent Node remains a separate service and is not replaced.

**Not a production deployment:** AWS is unavailable; host architecture, live authentication, tenant isolation and full server/mobile execution are not validated. The old SSH destination is recorded in the existing server handoff, not hardcoded here. Obtain the current host and approved SSH key from the operator when AWS returns.

## Contents

- `versions.json`: pinned source revision and measured Android tooling versions.
- `patches/laptop-implementation.patch`: complete tracked laptop changes, including UI branding and the existing removal of model few-shot priming.
- `assets/`: original SynapDome brain logo and navy/teal light/dark theme.
- `scripts/prepare.sh`: reconstruct source, install locked dependencies, typecheck and build the web interface.
- `systemd/` and `scripts/install-server.sh`: isolated service account and loopback-only service installation.
- `nginx/` and `scripts/render-gateway.py`: authentication-gated TLS reverse proxy.
- `mobile/`: reproduce, verify, start and connect the stable Android lab.

No API keys, SSH keys, passwords, provider sessions, APKs, AVD userdata, banking logins, assessment reports or captured traffic are included. Configure fresh server secrets using your secret manager. Do not upload the laptop's runtime folders.

## 1. Prepare the server release

Ubuntu/Debian prerequisites: Git, CA certificates, curl, Python 3 with venv, OpenSSL, Nginx with `http_auth_request_module`, and **Bun 1.3.9** from the official Bun distribution. Install the executable at `/usr/local/bin/bun`. Run the build as a normal deployment user:

```sh
bash deploy/synapdome-ui/scripts/prepare.sh /opt/releases/synapdome-ui-20261122
sudo bash deploy/synapdome-ui/scripts/install-server.sh /opt/releases/synapdome-ui-20261122
```

The release parent must already be writable by the deployment user. The installer does not start the engine or reload Nginx. The systemd service runs the pinned source through Bun, not the incompatible macOS binary. Keep the source directory read-only to the service account.

Add provider credentials and model configuration securely under `/var/lib/synapdome-ui/config/cyberstrike/` or the engine's supported environment variables. Configure provider credentials using the normal engine authentication mechanism as the service user. A laptop Ollama endpoint will not become available on the server automatically; supply a reachable model provider. Never commit its keys.

## 2. Connect to SynapDome authentication (required before release)

Use a dedicated hostname such as `redteam.synapdome.com`. Add a navigation link from the authenticated SynapDome application. The current UI uses root-relative asset and API paths, so mounting under `/redteam/` is not supported by this package. An iframe is not configured; same-site SSO on a dedicated hostname is the integration target.

The SynapDome backend team must supply a **server-side session validation endpoint**, reachable on loopback, such as `http://127.0.0.1:9000/internal/auth/redteam`. This is an interface contract, not an implemented login system. If the real backend is remote, provide a private local authentication adapter and secure its upstream connection.

Required response behavior:

- `204` only for a currently valid session **and** permission to use this workspace.
- `401` for missing, invalid, expired or revoked credentials.
- `403` for a valid user without workspace access.
- Never redirect to a login HTML page or return `200` for an unauthenticated user. Nginx treats every 2xx as allowed.
- Ignore user-supplied role/identity headers. Validate the session against the backend's source of truth.
- Use a Secure, HttpOnly session cookie appropriate for the workspace hostname. A token stored only in the main site's localStorage will not authenticate initial page navigation. Implement a proper SSO exchange rather than placing tokens in URLs.

The proxy checks **every route**, including HTML, assets, API calls, event-stream connections and WebSocket upgrades. Cross-origin modifying requests and WebSocket handshakes are rejected. Backend Basic credentials are injected server-side and never returned to the browser. Keep port 4096 bound to loopback; do not expose ports 4096, 5037, 5555, 15037, 27042 or 27044 through AWS security groups.

Render the gateway on the host, with a restrictive shell environment:

```sh
sudo -i
set -a
. /etc/synapdome-ui/runtime.env
set +a
export WORKSPACE_HOST=redteam.synapdome.com
export TLS_CERT=/etc/letsencrypt/live/redteam.synapdome.com/fullchain.pem
export TLS_KEY=/etc/letsencrypt/live/redteam.synapdome.com/privkey.pem
export AUTH_VERIFY_URL=http://127.0.0.1:9000/internal/auth/redteam
python3 /path/to/repo/deploy/synapdome-ui/scripts/render-gateway.py /etc/nginx/conf.d/synapdome-workspace.conf
nginx -t
```

The renderer refuses missing inputs, short engine secrets and configuration injection. Generated configuration contains a reversible backend Basic credential: keep it mode 0600 and out of git. Integrate the template's `map` directives in Nginx's `http` context. Port 443 and valid TLS are required; no HTTP fallback is supplied.

After reviewing the live auth tests below, enable the service and reload the gateway through the deployment team's normal release process. Authentication is rechecked on new HTTP requests and stream handshakes. Already-open streams are not immediately revoked on logout; implement enforced stream lifetime/revocation before claiming immediate session termination.

### Shared-workspace boundary

This engine exposes powerful execution features and shared sessions/files. Login protection **does not provide per-customer isolation**. Initially restrict it to named internal red-team operators. For customer access, run separate OS/container/VM workspaces and credentials per tenant, route only after verifying tenant membership, and prevent cross-tenant session IDs, paths and network access. Do not grant all authenticated customers access to one engine instance.

## 3. Preserve the stable emulator

Measured baseline: Apple Silicon Mac, Pixel 7 AVD `SynapDome_Pixel_API35`, Android 15/API 35 Google APIs **ARM64**, image revision 9, emulator 37.2.13, platform tools 37.0.1, 2 GB RAM, 4 cores, GPU disabled, Frida 17.8.2 and frida-tools 14.6.0. This is the user's stable configuration; cross-host stability is not yet established.

On an Apple Silicon runner, install official Android command-line tools and Java as required by those tools, then:

```sh
bash deploy/synapdome-ui/mobile/install.sh
bash deploy/synapdome-ui/mobile/start.sh
# A second terminal, after Android has finished booting:
bash deploy/synapdome-ui/mobile/provision-frida.sh
```

SDK Manager installs currently distributed revisions. If they differ from the locked baseline, setup stops before creating the AVD. Preserve the exact SDK packages using `mobile/export-sdk.sh /private/artifacts/android-sdk-baseline.tar.gz` on the original Mac. Transfer that archive privately to an Apple Silicon runner, verify its SHA-256 from the separately trusted checksum file, extract to the SDK root, then rerun `verify-sdk.py`. SDK redistribution remains subject to Google's license. No image or APK is committed here.

Existing AVDs are preserved. New AVDs start clean; install an approved APK separately and sign in manually. Device account state, app data and snapshots are deliberately not cloned. Frida setup checks ARM64 and root, downloads the pinned upstream server, and verifies process enumeration. It does not install app-specific hooks or change banking behavior.

**For the AWS server, retain the proven Mac runner initially.** The server cannot run the Mac emulator binary. A Linux x86 image is a different runtime and must be qualified separately. Inspect server architecture and virtualization support before planning a local emulator. Remote mode provides the same actual device while requiring that runner to stay awake and connected.

From the Mac:

```sh
bash deploy/synapdome-ui/mobile/connect-server.sh lab-tunnel@YOUR_SERVER /private/path/deployment-key
```

SSH must allow loopback remote forwarding. Use a dedicated tunnel account/key; pin and verify its host key before connecting. Do not enable `GatewayPorts yes`. Configure the account to permit only remote listeners `127.0.0.1:15037` and `127.0.0.1:27044`. The forwarded ADB server controls devices connected to that runner, so use a dedicated test runner, not one with unrelated personal devices.

On the server obtain the official Linux Android platform-tools 37.0.1 archive and extract it, then run `sudo bash mobile/install-server-client.sh /absolute/linux-platform-tools` from this package. This installs the matching ADB client and Frida 17.8.2 / frida-tools 14.6.0 into `/opt/synapdome-tools/bin`. Use:

```sh
export ADB_SERVER_SOCKET=tcp:127.0.0.1:15037
adb -s emulator-5554 get-state
frida-ps -H 127.0.0.1:27044
```

ADB forwards its **server protocol**, not the device's emulator console port. Do not run `adb connect` against port 15037. Do not run `adb kill-server` against the shared remote server. For Frida use the explicit endpoint above, not automatic USB discovery. After reboot, restart Frida and the tunnel. If the tunnel drops, pause device-dependent testing until both checks pass.

## 4. Release acceptance and rollback

Local checks completed: laptop UI build and typecheck; SDK revision checks; gateway renderer unit tests; shell syntax checks. No server integration tests have passed while AWS is offline.

Before opening access, validate:

1. Logged-out HTML, JS assets, API, SSE and WebSocket requests are denied; no secret or session content is returned. Direct remote port 4096 is unreachable.
2. Expired/revoked sessions and authenticated users without the workspace role are denied. Auth service outage denies access.
3. A permitted operator can load the page, reconnect events and use an approved test session. Browser requests contain no engine password.
4. Foreign-origin writes and WebSocket upgrades fail. Verify the actual SynapDome cookie/login/logout flow.
5. ADB reports `device`, Frida process listing succeeds, and the approved banking app login and navigation remain stable on the chosen runner.
6. Confirm tenant isolation before any customer onboarding; verify logout/stream revocation requirements.

Rollback: point `/opt/synapdome-ui/current` and the web symlink to the previous release and restart through your release process. Keep a protected backup of persistent service data before upgrades; code rollback cannot reverse an incompatible database migration. Do not automatically install upstream updates over this branded release.

Upstream source and license are preserved by `prepare.sh`; the upstream project is AGPL-3.0. Keep its copyright/license notices and provide corresponding source as required. Brand changes do not remove upstream attribution.

References: [Android emulator acceleration](https://developer.android.com/studio/run/emulator-acceleration), [Nginx authentication subrequests](https://nginx.org/en/docs/http/ngx_http_auth_request_module.html), [Frida releases](https://github.com/frida/frida/releases/tag/17.8.2).
