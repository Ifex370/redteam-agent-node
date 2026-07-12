# SynapDome Legacy Plugin Installation

This document explains how customers and testers install the packaged SynapDome Burp Suite and browser traffic capture extensions.

## Download Packages

Download from the repository:

```text
release-packages/synapdome-burp-extension-v0.1.0.jar
release-packages/synapdome-browser-extension-v0.1.0.zip
```

## Burp Suite Extension

Package:

```text
synapdome-burp-extension-v0.1.0.jar
```

Install:

1. Open Burp Suite.
2. Go to **Extensions**.
3. Click **Add**.
4. Set extension type to **Java**.
5. Select `synapdome-burp-extension-v0.1.0.jar`.
6. Open the new **SynapDome** tab.

Configure:

1. Enter the SynapDome API URL.
2. Enter the user's API token.
3. Enter the tenant ID.
4. Enter the engagement ID.
5. Enter the target URL.
6. Enter allowed domains, comma-separated.
7. Click **Save settings**.

Use:

1. Capture traffic in Burp Proxy, Repeater, or Sitemap.
2. Select one or more messages.
3. Right-click.
4. Click **Send selected messages to SynapDome**.

Upload endpoint expected on SynapDome:

```http
POST /api/redteam/artifacts/burp
Authorization: Bearer <user token>
Content-Type: application/json
```

## Browser Extension

Package:

```text
synapdome-browser-extension-v0.1.0.zip
```

Install in Chrome or Edge:

1. Unzip `synapdome-browser-extension-v0.1.0.zip`.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the unzipped extension folder.
6. Pin/open the SynapDome extension.

Configure:

1. Enter the SynapDome API URL.
2. Enter the user's API token.
3. Enter the tenant ID.
4. Enter the engagement ID.
5. Enter allowed domains, comma-separated.
6. Enter the target URL.
7. Click **Save**.

Use:

1. Click **Start**.
2. Browse the authorized application/API.
3. Click **Stop**.
4. Click **Upload**.

Upload endpoint expected on SynapDome:

```http
POST /api/redteam/artifacts/browser
Authorization: Bearer <user token>
Content-Type: application/json
```

## Backend Responsibility

The SynapDome backend should receive these uploaded artifacts, store them against the engagement, create signed artifact URLs where needed, and queue Red Team Agent Node runs.

For current web testing, queue:

```json
{
  "template": "web-dast",
  "targets": [
    {
      "kind": "url",
      "url": "https://target.example.com"
    }
  ],
  "policy": {
    "authorized": true,
    "allowedDomains": ["target.example.com"],
    "tools": ["nuclei", "zap"],
    "network": "restricted",
    "maxDurationMinutes": 15
  }
}
```

## MVP Limits

- Burp extension uploads selected message previews, not full unlimited proxy history.
- Sensitive headers are redacted in Burp previews.
- Browser extension captures request metadata, not request/response bodies.
- Authentication replay and API-spec-driven scans should be handled in the upcoming `api-scan` implementation.
