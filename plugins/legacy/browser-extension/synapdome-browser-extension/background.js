const DEFAULT_STATE = {
  capturing: false,
  requests: []
};

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    capturing: Boolean(stored.capturing),
    requests: Array.isArray(stored.requests) ? stored.requests : []
  };
}

async function setState(next) {
  await chrome.storage.local.set(next);
}

function hostMatches(url, domains) {
  if (!domains.length) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    if (message.type === "GET_STATE") {
      sendResponse(await getState());
      return;
    }

    if (message.type === "SET_CAPTURING") {
      await setState({ capturing: Boolean(message.capturing) });
      sendResponse(await getState());
      return;
    }

    if (message.type === "CLEAR_REQUESTS") {
      await setState({ requests: [] });
      sendResponse(await getState());
      return;
    }
  })();
  return true;
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    void (async () => {
      const state = await getState();
      if (!state.capturing) return;

      const config = await chrome.storage.local.get({
        allowedDomains: ""
      });
      const domains = String(config.allowedDomains)
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);

      if (!hostMatches(details.url, domains)) return;

      const entry = {
        id: details.requestId,
        method: details.method,
        url: details.url,
        statusCode: details.statusCode,
        type: details.type,
        initiator: details.initiator,
        tabId: details.tabId,
        timeStamp: details.timeStamp
      };

      await setState({ requests: [...state.requests.slice(-499), entry] });
    })();
  },
  { urls: ["<all_urls>"] }
);
