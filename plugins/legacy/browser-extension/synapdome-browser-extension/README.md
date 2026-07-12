# SynapDome Browser Traffic Capture Extension

This Chrome/Edge extension captures authorized browser request metadata and uploads it to SynapDome as a red-team engagement artifact.

## Install

1. Download `synapdome-browser-extension-v0.1.0.zip` from the GitHub release.
2. Unzip it.
3. Open `chrome://extensions` or `edge://extensions`.
4. Enable Developer mode.
5. Click **Load unpacked**.
6. Select the unzipped `synapdome-browser-extension` folder.

## Configure

Open the SynapDome extension popup and enter:

- SynapDome API URL, for example `https://synapdome.example.com`
- API token
- Tenant ID
- Engagement ID
- Allowed domains, comma-separated
- Target URL

## Use

1. Click **Save**.
2. Click **Start**.
3. Browse the authorized application/API.
4. Click **Stop**.
5. Click **Upload**.

The extension uploads to:

```text
POST /api/redteam/artifacts/browser
```

The SynapDome backend should store the artifact, create signed URLs if needed, and queue Red Team Agent Node scans such as `web-scan` with `nuclei` and `zap`.

## Captured Fields

- URL
- HTTP method
- Status code
- Resource type
- Initiator
- Browser tab ID
- Timestamp

Request/response bodies and secrets are not captured in this MVP.
