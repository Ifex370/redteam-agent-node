# SynapDome Burp Suite Capture Extension

This Burp Suite extension uploads selected Burp messages to SynapDome as red-team engagement artifacts.

## Install

1. Download `synapdome-burp-extension-v0.1.0.jar` from the GitHub release.
2. Open Burp Suite.
3. Go to **Extensions**.
4. Click **Add**.
5. Choose extension type **Java**.
6. Select `synapdome-burp-extension-v0.1.0.jar`.
7. Open the **SynapDome** tab.

## Configure

In the SynapDome tab, enter:

- SynapDome API URL, for example `https://synapdome.example.com`
- API token
- Tenant ID
- Engagement ID
- Target URL
- Allowed domains, comma-separated

Click **Save settings**.

## Use

1. Capture or browse traffic in Burp Proxy/Sitemap.
2. Select one or more messages.
3. Right-click the selection.
4. Click **Send selected messages to SynapDome**.

The extension uploads to:

```text
POST /api/redteam/artifacts/burp
```

The SynapDome backend should store the artifact, create signed URLs if needed, and queue Red Team Agent Node scans such as `web-scan`, `api-scan`, `nuclei`, and `zap`.

## Safety Defaults

The MVP redacts these headers in uploaded previews:

- `Authorization`
- `Cookie`
- `Set-Cookie`

It sends previews of selected messages, not full unlimited raw traffic.
