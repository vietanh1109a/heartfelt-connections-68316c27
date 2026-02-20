// ============================================================
// Netflix Cookie Manager — Background Script v2.1.0
// Steps 1-5, CheckAlive, CheckLiveBatch
// ============================================================

// ============ Netflix Icon ============
function setNetflixIcon() {
  try {
    const size = 128;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#221f1f";
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 14);
    ctx.fill();
    ctx.fillStyle = "#e50914";
    ctx.fillRect(26, 16, 18, 96);
    ctx.fillRect(84, 16, 18, 96);
    ctx.beginPath();
    ctx.moveTo(26, 16); ctx.lineTo(44, 16);
    ctx.lineTo(102, 112); ctx.lineTo(84, 112);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b1060f";
    ctx.beginPath();
    ctx.moveTo(44, 16); ctx.lineTo(56, 16);
    ctx.lineTo(102, 112); ctx.lineTo(90, 112);
    ctx.closePath(); ctx.fill();
    const imageData = ctx.getImageData(0, 0, size, size);
    chrome.action.setIcon({ imageData: { 128: imageData } });
  } catch (e) {
    console.log("[BG] setIcon failed (non-critical):", e.message);
  }
}
setNetflixIcon();

// ============ Netflix Tab ============
let netflixTabId = null;

async function step1() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab && activeTab.url && activeTab.url.includes("netflix.com")) {
    netflixTabId = activeTab.id;
    await chrome.storage.local.set({ netflixTabId });
    return { success: true, detail: `Dùng tab hiện tại (ID: ${activeTab.id})` };
  }
  const tabs = await chrome.tabs.query({ url: "*://*.netflix.com/*" });
  if (tabs.length > 0) {
    netflixTabId = tabs[0].id;
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
    await chrome.storage.local.set({ netflixTabId });
    return { success: true, detail: `Chuyển sang tab Netflix (ID: ${tabs[0].id})` };
  }
  const newTab = await chrome.tabs.create({ url: "https://www.netflix.com", active: true });
  netflixTabId = newTab.id;
  await chrome.storage.local.set({ netflixTabId });
  return { success: true, detail: `Mở tab mới (ID: ${newTab.id})` };
}

async function step2() {
  if (!netflixTabId) {
    const data = await chrome.storage.local.get(["netflixTabId"]);
    netflixTabId = data.netflixTabId;
  }
  if (!netflixTabId) return { success: false, detail: "Chưa có tab Netflix" };
  try {
    const tab = await chrome.tabs.get(netflixTabId);
    if (tab.status === "complete") return { success: true, detail: "Trang đã load xong" };
  } catch (e) {
    return { success: false, detail: "Tab không tồn tại" };
  }
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve({ success: false, detail: "Timeout 10s" });
    }, 10000);
    function listener(tabId, info) {
      if (tabId === netflixTabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ success: true, detail: "Trang đã load xong" });
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function step3() {
  const cookies = await chrome.cookies.getAll({ domain: ".netflix.com" });
  if (cookies.length === 0) return { success: true, detail: "Không có cookie cũ" };
  await Promise.all(cookies.map(c => {
    const url = `${c.secure ? "https" : "http"}://www.netflix.com${c.path}`;
    return chrome.cookies.remove({ url, name: c.name });
  }));
  return { success: true, detail: `Đã xóa ${cookies.length} cookie` };
}

async function step4(cookieList) {
  if (!cookieList || cookieList.length === 0) return { success: false, detail: "Không có cookie" };
  const results = [];
  for (const cookie of cookieList) {
    try {
      const details = {
        url: `https://www.netflix.com${cookie.path || "/"}`,
        name: cookie.name, value: cookie.value,
        domain: cookie.domain || ".netflix.com",
        path: cookie.path || "/",
        secure: cookie.secure !== undefined ? cookie.secure : true,
        httpOnly: cookie.httpOnly !== undefined ? cookie.httpOnly : false,
      };
      if (cookie.sameSite) {
        const map = { "no_restriction": "no_restriction", "lax": "lax", "strict": "strict", "None": "no_restriction", "Lax": "lax", "Strict": "strict" };
        details.sameSite = map[cookie.sameSite] || "no_restriction";
      } else {
        details.sameSite = "no_restriction";
      }
      details.expirationDate = cookie.expirationDate || (Math.floor(Date.now() / 1000) + 30 * 86400);
      const result = await chrome.cookies.set(details);
      results.push({ name: cookie.name, ok: !!result });
    } catch (err) {
      results.push({ name: cookie.name, ok: false, err: err.message });
    }
  }
  const ok = results.filter(r => r.ok);
  return { success: ok.length > 0, detail: `${ok.length}/${results.length} thành công` };
}

async function step5() {
  if (!netflixTabId) {
    const data = await chrome.storage.local.get(["netflixTabId"]);
    netflixTabId = data.netflixTabId;
  }
  if (!netflixTabId) return { success: false, detail: "Chưa có tab Netflix" };
  try {
    await chrome.tabs.reload(netflixTabId);
    return { success: true, detail: "Đã reload" };
  } catch (err) {
    return { success: false, detail: `Lỗi reload: ${err.message}` };
  }
}

// ============ Check Alive — reuse a single hidden tab for speed ============
async function checkAliveWithTab(existingTabId) {
  let tabId = existingTabId;
  try {
    if (!tabId) {
      const tab = await chrome.tabs.create({ url: "about:blank", active: false });
      tabId = tab.id;
    }
    // Navigate to netflix.com/browse
    await chrome.tabs.update(tabId, { url: "https://www.netflix.com/browse" });

    // Wait for load + settle
    await new Promise((resolve) => {
      const maxTimeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 12000);
      function listener(tid, info) {
        if (tid !== tabId || info.status !== "complete") return;
        // Give a moment for final redirects
        setTimeout(() => {
          clearTimeout(maxTimeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 1200);
      }
      chrome.tabs.onUpdated.addListener(listener);
    });

    const updatedTab = await chrome.tabs.get(tabId);
    const finalUrl = (updatedTab.url || "").toLowerCase();
    console.log("[BG] checkAlive final URL:", finalUrl);

    if (finalUrl.includes("/login") || finalUrl.includes("/signin")) {
      return { tabId, success: true, alive: false, detail: "Redirect login → DIE" };
    }
    if (finalUrl.includes("netflix.com") && !finalUrl.includes("/login") && !finalUrl.includes("/signin")) {
      return { tabId, success: true, alive: true, detail: "LIVE ✓" };
    }
    return { tabId, success: true, alive: false, detail: "Unknown: " + finalUrl.slice(0, 60) };
  } catch (e) {
    return { tabId, success: false, alive: false, detail: `Error: ${e.message}` };
  }
}

async function runWithTimeout(fn, ms, msg) {
  return Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

// ============ Parse Netscape cookie string ============
function parseCookieString(cookieString) {
  const cookies = [];
  const lines = cookieString.split("\n").map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("#") || line.startsWith("//")) continue;
    const tabs = line.split("\t");
    if (tabs.length >= 7) {
      const domain = tabs[0].trim();
      const path = tabs[2].trim();
      const isSecure = tabs[3].trim().toUpperCase() === "TRUE";
      const expiry = parseInt(tabs[4].trim(), 10);
      const name = tabs[5].trim();
      const value = tabs[6].trim();
      if (name && value) {
        cookies.push({ domain, path, secure: isSecure, expirationDate: expiry > 0 ? expiry : undefined, name, value, httpOnly: false });
      }
      continue;
    }
    const parts = line.split(/;/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) continue;
      const name = part.substring(0, eqIndex).trim();
      const value = part.substring(eqIndex + 1).trim();
      const skipNames = ["path", "domain", "expires", "max-age", "secure", "httponly", "samesite"];
      if (skipNames.includes(name.toLowerCase())) continue;
      if (name && value) cookies.push({ name, value });
    }
  }
  return cookies;
}

// ============ TV Activation ============
// Helper: navigate a tab and wait for load
async function navigateTabAndWait(tabId, url, timeoutMs = 15000) {
  await chrome.tabs.update(tabId, { url });
  return new Promise((resolve) => {
    const maxTimeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
    function listener(tid, info) {
      if (tid !== tabId || info.status !== "complete") return;
      setTimeout(() => {
        clearTimeout(maxTimeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 1500);
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Helper: inject fill-code script into tab
async function injectFillCode(tabId, code) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (tvCode) => {
      return new Promise((resolve) => {
        function tryFill() {
          const allInputs = Array.from(document.querySelectorAll('input'));
          const visibleInputs = allInputs.filter(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });

          // Case 1: Multiple individual character inputs (one per digit)
          if (visibleInputs.length >= tvCode.length) {
            const charInputs = visibleInputs.slice(0, tvCode.length);
            charInputs.forEach((input, i) => {
              input.focus();
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
              nativeInputValueSetter.call(input, tvCode[i]);
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keydown', { key: tvCode[i], bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keyup', { key: tvCode[i], bubbles: true }));
            });
            setTimeout(() => {
              const btn = document.querySelector('button[type="submit"], button[data-uia="btn-confirm"], button');
              if (btn) btn.click();
            }, 600);
            resolve({ success: true, method: "multi-input" });
            return;
          }

          // Case 2: Single input field
          if (visibleInputs.length >= 1) {
            const input = visibleInputs[0];
            input.focus();
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(input, tvCode);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            setTimeout(() => {
              input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
              const btn = document.querySelector('button[type="submit"], button[data-uia="btn-confirm"], button');
              if (btn) btn.click();
            }, 600);
            resolve({ success: true, method: "single-input" });
            return;
          }

          resolve({ success: false, error: "Không tìm thấy ô nhập mã trên trang" });
        }
        setTimeout(tryFill, 500);
      });
    },
    args: [code],
  });
  return results?.[0]?.result;
}

// Parse Netscape cookie string (reuse parseCookieString)
async function activateTv(code, cookieStrings) {
  // Step 1: Open netflix.com/browse in a new visible tab to check login status
  const tab = await chrome.tabs.create({ url: "https://www.netflix.com/browse", active: true });
  const tabId = tab.id;

  // Wait for load
  await new Promise((resolve) => {
    const maxTimeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
    function listener(tid, info) {
      if (tid !== tabId || info.status !== "complete") return;
      setTimeout(() => {
        clearTimeout(maxTimeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 1500);
    }
    chrome.tabs.onUpdated.addListener(listener);
  });

  // Step 2: Check if logged in by looking at final URL
  const currentTab = await chrome.tabs.get(tabId);
  const finalUrl = (currentTab.url || "").toLowerCase();
  const isLoggedIn = finalUrl.includes("netflix.com") &&
    !finalUrl.includes("/login") &&
    !finalUrl.includes("/signin") &&
    !finalUrl.includes("/signup");

  console.log("[BG] activateTv — isLoggedIn:", isLoggedIn, "URL:", finalUrl.slice(0, 80));

  let importedCookies = false;

  if (!isLoggedIn) {
    // Step 3: Not logged in → import cookie from user's assigned cookies
    if (!cookieStrings || cookieStrings.length === 0) {
      await chrome.tabs.remove(tabId).catch(() => {});
      throw new Error("Không có cookie khả dụng để đăng nhập");
    }

    // Try each cookie string until one works
    let imported = false;
    for (const cookieStr of cookieStrings) {
      const cookies = parseCookieString(cookieStr);
      if (cookies.length === 0) continue;
      await step3(); // clear old cookies
      const result = await step4(cookies);
      if (result.success) { imported = true; break; }
    }

    if (!imported) {
      await chrome.tabs.remove(tabId).catch(() => {});
      throw new Error("Import cookie thất bại");
    }

    importedCookies = true;

    // Reload tab and wait for Netflix to load with new cookies
    await chrome.tabs.reload(tabId);
    await new Promise((resolve) => {
      const maxTimeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 15000);
      function listener(tid, info) {
        if (tid !== tabId || info.status !== "complete") return;
        setTimeout(() => {
          clearTimeout(maxTimeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }, 1500);
      }
      chrome.tabs.onUpdated.addListener(listener);
    });
    console.log("[BG] activateTv — cookie imported, tab reloaded");
  }

  // Step 4: Navigate to netflix.com/tv2
  await navigateTabAndWait(tabId, "https://www.netflix.com/tv2", 15000);
  console.log("[BG] activateTv — navigated to tv2");

  // Step 5: Fill the TV code
  const fillResult = await injectFillCode(tabId, code);
  console.log("[BG] activateTv — fill result:", fillResult);

  if (!fillResult || !fillResult.success) {
    if (importedCookies) await step3().catch(() => {});
    await chrome.tabs.remove(tabId).catch(() => {});
    throw new Error(fillResult?.error || "Script inject thất bại");
  }

  // Step 6: Wait a moment for submit to process, then clean up
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Step 7: If we imported cookies, clear them afterwards
  if (importedCookies) {
    await step3().catch(() => {});
    console.log("[BG] activateTv — cookies cleared after activation");
  }

  return { success: true };
}

// ============ Message Listener ============
function handleMessage(message, sender, sendResponse) {
  // TV Activation
  if (message.type === "ACTIVATE_TV") {
    activateTv(message.code, message.cookies || [])
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  // Legacy: SET_NETFLIX_COOKIE from content script
  if (message.type === "SET_NETFLIX_COOKIE") {
    (async () => {
      try {
        const cookies = parseCookieString(message.payload);
        await step3();
        await step4(cookies);
        await step1();
        await step2();
        await step5();
        sendResponse({ success: true });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }

  // Step actions
  if (message.action === "step1") { step1().then(sendResponse).catch(e => sendResponse({ success: false, detail: e.message })); return true; }
  if (message.action === "step2") { step2().then(sendResponse).catch(e => sendResponse({ success: false, detail: e.message })); return true; }
  if (message.action === "step3") { step3().then(sendResponse).catch(e => sendResponse({ success: false, detail: e.message })); return true; }
  if (message.action === "step4") { step4(message.cookies).then(sendResponse).catch(e => sendResponse({ success: false, detail: e.message })); return true; }
  if (message.action === "step5") { step5().then(sendResponse).catch(e => sendResponse({ success: false, detail: e.message })); return true; }

  // Version check
  if (message.action === "getVersion") {
    sendResponse({ success: true, version: chrome.runtime.getManifest().version });
    return false;
  }

  // checkLiveBatch handled via port connection below
  return false;
}

chrome.runtime.onMessage.addListener(handleMessage);
chrome.runtime.onMessageExternal.addListener(handleMessage);

// ============ Port-based Check Live (reuses single tab for speed) ============
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "checkLive") return;
  console.log("[BG] Port connected: checkLive");

  port.onMessage.addListener(async (message) => {
    if (message.action !== "checkLiveBatch") return;
    const cookieSets = message.cookieSets || [];
    console.log("[BG] checkLiveBatch via port, sets:", cookieSets.length);

    // Create one hidden tab, reuse for all checks
    let checkTabId = null;
    try {
      const tab = await chrome.tabs.create({ url: "about:blank", active: false });
      checkTabId = tab.id;
    } catch (e) {
      console.log("[BG] Failed to create check tab:", e.message);
    }

    for (let i = 0; i < cookieSets.length; i++) {
      const item = cookieSets[i];
      try {
        console.log("[BG] Processing", i + 1, "/", cookieSets.length, item.id);
        await runWithTimeout(() => step3(), 5000, "Clear timeout");
        await runWithTimeout(() => step4(item.cookies), 5000, "Import timeout");
        const check = await runWithTimeout(() => checkAliveWithTab(checkTabId), 18000, "Check timeout");
        checkTabId = check.tabId || checkTabId; // keep tab reference
        console.log("[BG] Result:", check.alive, check.detail);
        port.postMessage({ action: "checkLiveResult", id: item.id, alive: !!check.alive, detail: check.detail, index: i, total: cookieSets.length });
      } catch (e) {
        console.log("[BG] Error:", e.message);
        port.postMessage({ action: "checkLiveResult", id: item.id, alive: false, detail: e.message, index: i, total: cookieSets.length });
      }
    }

    // Cleanup
    if (checkTabId) chrome.tabs.remove(checkTabId).catch(() => {});
    await step3().catch(() => {});
    port.postMessage({ action: "checkLiveComplete" });
    console.log("[BG] checkLiveBatch complete");
  });
});

console.log("[Netflix Extension] Background v2.1.0 loaded.");
