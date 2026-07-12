const fields = [
  "apiBaseUrl",
  "apiToken",
  "tenantId",
  "engagementId",
  "allowedDomains",
  "targetUrl"
];

const els = Object.fromEntries([
  ...fields.map((id) => [id, document.getElementById(id)]),
  ["state", document.getElementById("state")],
  ["summary", document.getElementById("summary")],
  ["log", document.getElementById("log")],
  ["save", document.getElementById("save")],
  ["toggleCapture", document.getElementById("toggleCapture")],
  ["upload", document.getElementById("upload")],
  ["clear", document.getElementById("clear")]
]);

function log(message) {
  els.log.textContent = `${new Date().toLocaleTimeString()} ${message}\n${els.log.textContent}`.slice(0, 2000);
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function loadConfig() {
  const config = await chrome.storage.local.get(Object.fromEntries(fields.map((field) => [field, ""])));
  for (const field of fields) {
    els[field].value = config[field] || "";
  }
  await refreshState();
}

async function saveConfig() {
  const config = Object.fromEntries(fields.map((field) => [field, els[field].value.trim()]));
  await chrome.storage.local.set(config);
  log("Saved configuration");
}

async function refreshState() {
  const state = await sendMessage({ type: "GET_STATE" });
  els.state.textContent = state.capturing ? "Capturing" : "Idle";
  els.toggleCapture.textContent = state.capturing ? "Stop" : "Start";
  els.summary.textContent = `${state.requests.length} captured request${state.requests.length === 1 ? "" : "s"}`;
}

async function toggleCapture() {
  await saveConfig();
  const state = await sendMessage({ type: "GET_STATE" });
  const next = await sendMessage({ type: "SET_CAPTURING", capturing: !state.capturing });
  log(next.capturing ? "Capture started" : "Capture stopped");
  await refreshState();
}

async function clearRequests() {
  await sendMessage({ type: "CLEAR_REQUESTS" });
  log("Cleared captured requests");
  await refreshState();
}

async function uploadRequests() {
  await saveConfig();
  const config = await chrome.storage.local.get(Object.fromEntries(fields.map((field) => [field, ""])));
  const state = await sendMessage({ type: "GET_STATE" });
  if (!config.apiBaseUrl || !config.apiToken || !config.tenantId || !config.engagementId) {
    log("Missing API URL, token, tenant, or engagement");
    return;
  }

  const endpoint = `${config.apiBaseUrl.replace(/\/$/, "")}/api/redteam/artifacts/browser`;
  const payload = {
    source: "browser-extension",
    tenantId: config.tenantId,
    engagementId: config.engagementId,
    targetUrl: config.targetUrl,
    allowedDomains: String(config.allowedDomains)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    capturedAt: new Date().toISOString(),
    requests: state.requests
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    log(`Upload failed: ${response.status} ${await response.text()}`);
    return;
  }

  log(`Uploaded ${state.requests.length} requests`);
}

els.save.addEventListener("click", saveConfig);
els.toggleCapture.addEventListener("click", toggleCapture);
els.clear.addEventListener("click", clearRequests);
els.upload.addEventListener("click", uploadRequests);

void loadConfig();
setInterval(refreshState, 1500);
