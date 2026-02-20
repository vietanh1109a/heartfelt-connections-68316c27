// content.js v2.2.0 — Relay messages between web page and background script

const EXTENSION_VERSION = "2.2.0";

console.log("[Netflix Extension] Content script v" + EXTENSION_VERSION + " loaded on:", window.location.href);

// Lắng nghe postMessage từ trang web
window.addEventListener("message", (event) => {
  if (!event.data || event.source !== window) return;

  // === Cookie Transfer ===
  if (event.data.type === "TRANSFER_COOKIE") {
    console.log("[Netflix Extension] Nhận cookie data từ web");
    chrome.runtime.sendMessage(
      { type: "SET_NETFLIX_COOKIE", payload: event.data.payload },
      (response) => {
        if (chrome.runtime.lastError) {
          window.postMessage({ type: "COOKIE_SET_ERROR", error: chrome.runtime.lastError.message }, "*");
          return;
        }
        if (response && response.success) {
          window.postMessage({ type: "COOKIE_SET_SUCCESS" }, "*");
        } else {
          window.postMessage({ type: "COOKIE_SET_ERROR", error: response?.error || "Unknown error" }, "*");
        }
      }
    );
  }

  // === Version Check — respond directly ===
  if (event.data.type === "GET_EXTENSION_VERSION") {
    window.postMessage({ type: "EXTENSION_VERSION_RESPONSE", version: EXTENSION_VERSION }, "*");
    // Also register this tab as a web app tab for auto-logout
    chrome.runtime.sendMessage({ type: "REGISTER_WEB_TAB" });
  }

  // === Ping ===
  if (event.data.type === "PING_EXTENSION") {
    window.postMessage({ type: "PONG_EXTENSION", version: EXTENSION_VERSION }, "*");
    // Also register this tab as a web app tab for auto-logout
    chrome.runtime.sendMessage({ type: "REGISTER_WEB_TAB" });
  }

  // === Register Web Tab (for auto-logout tracking) ===
  if (event.data.type === "REGISTER_WEB_TAB") {
    chrome.runtime.sendMessage({ type: "REGISTER_WEB_TAB" });
  }

  // === TV Activation ===
  if (event.data.type === "ACTIVATE_TV") {
    const code = event.data.code;
    const cookies = event.data.cookies || [];
    chrome.runtime.sendMessage({ type: "ACTIVATE_TV", code, cookies }, (response) => {
      if (chrome.runtime.lastError) {
        window.postMessage({ type: "TV_ACTIVATE_ERROR", error: chrome.runtime.lastError.message }, "*");
        return;
      }
      if (response && response.success) {
        window.postMessage({ type: "TV_ACTIVATE_SUCCESS" }, "*");
      } else {
        window.postMessage({ type: "TV_ACTIVATE_ERROR", error: response?.error || "Lỗi không xác định" }, "*");
      }
    });
  }

  // === Check Live Batch — use Port connection (keeps service worker alive) ===
  if (event.data.type === "CHECK_LIVE_BATCH") {
    console.log("[Netflix Extension] Check Live Batch via Port:", event.data.cookieSets?.length, "sets");
    try {
      const port = chrome.runtime.connect({ name: "checkLive" });
      console.log("[Netflix Extension] Port connected to background");

      port.onMessage.addListener((message) => {
        console.log("[Netflix Extension] Port message:", message.action, message.id, message.alive);
        if (message.action === "checkLiveResult") {
          window.postMessage({
            type: "CHECK_LIVE_RESULT",
            id: message.id, alive: message.alive, detail: message.detail,
            index: message.index, total: message.total
          }, "*");
        }
        if (message.action === "checkLiveComplete") {
          window.postMessage({ type: "CHECK_LIVE_COMPLETE" }, "*");
          try { port.disconnect(); } catch (e) {}
        }
      });

      port.onDisconnect.addListener(() => {
        console.log("[Netflix Extension] Port disconnected");
        if (chrome.runtime.lastError) {
          console.log("[Netflix Extension] Port error:", chrome.runtime.lastError.message);
        }
      });

      port.postMessage({ action: "checkLiveBatch", cookieSets: event.data.cookieSets });
    } catch (e) {
      console.log("[Netflix Extension] Port connection failed:", e.message);
      (event.data.cookieSets || []).forEach((item, i) => {
        window.postMessage({
          type: "CHECK_LIVE_RESULT",
          id: item.id, alive: false,
          detail: "Port error: " + e.message,
          index: i, total: event.data.cookieSets.length
        }, "*");
      });
      window.postMessage({ type: "CHECK_LIVE_COMPLETE" }, "*");
    }
  }
});

// Auto-announce presence
window.postMessage({ type: "EXTENSION_READY", version: EXTENSION_VERSION }, "*");

// Re-announce every 3s for 15s in case page loads slowly
let announceCount = 0;
const announceInterval = setInterval(() => {
  announceCount++;
  window.postMessage({ type: "EXTENSION_READY", version: EXTENSION_VERSION }, "*");
  if (announceCount >= 5) clearInterval(announceInterval);
}, 3000);
