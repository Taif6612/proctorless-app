/**
 * background.js
 * Service Worker for ProctorLess Focus extension
 * 
 * Monitors active tab URL changes and sends logs to backend API
 * when the extension is "armed" (monitoring enabled by student)
 */

const API_BASE_URL = 'http://localhost:3003';
const APP_ORIGIN = 'http://localhost:3003';
let lastUrl = null;
let lastTs = 0;

function isDashboardUrl(u) {
  try {
    const x = new URL(u);
    if (x.origin !== APP_ORIGIN) return false;
    const p = x.pathname || '';
    if (p.startsWith('/dashboard/quiz')) return false;
    return p === '/dashboard';
  } catch {
    return false;
  }
}

function isQuizUrl(u) {
  try {
    const x = new URL(u);
    if (x.origin !== APP_ORIGIN) return false;
    const p = x.pathname || '';
    return p.startsWith('/dashboard/quiz');
  } catch {
    return false;
  }
}
const API_ENDPOINT = `${API_BASE_URL}/api/integrity/tab`;

/**
 * Send a URL log to the backend
 * @param {string} url - The active tab URL
 * @param {string} kind - Type of event (ACTIVE_TAB_URL, TAB_CHANGE, etc.)
 */
async function sendLog(url) {
  const now = Date.now();
  if (typeof url === 'string' && url.startsWith(APP_ORIGIN)) return;
  if (lastUrl && lastUrl === url && now - lastTs < 1000) return;
  try {
    const { examToken = null, submissionId = null } = await chrome.storage.local.get([
      'examToken',
      'submissionId'
    ]);

    const payload = {
      url,
      ts: now,
      kind: 'ACTIVE_TAB_URL',
      ...(examToken ? { examToken } : {}),
      ...(submissionId ? { submissionId } : {})
    };

    // Build headers with optional authorization
    const headers = {
      'Content-Type': 'application/json'
    };

    if (examToken) {
      headers['Authorization'] = `Bearer ${examToken}`;
    }

    console.log('[ProctorLess] Sending log:', payload);

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.warn(
        `[ProctorLess] Backend returned ${response.status}:`,
        await response.text()
      );
      return;
    }

    const result = await response.json();
    console.log('[ProctorLess] Log sent successfully:', result);

    // Increment local log count for popup display
    const { logCount = 0 } = await chrome.storage.local.get(['logCount']);
    await chrome.storage.local.set({ logCount: logCount + 1 });
    lastUrl = url;
    lastTs = now;
  } catch (error) {
    // Don't spam console; silently fail (robust to network issues)
    console.warn('[ProctorLess] Failed to send log:', error.message);
  }
}

/**
 * When user switches to a different tab, log it
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { armed = false } = await chrome.storage.local.get(['armed']);

  if (!armed) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url) {
    if (isDashboardUrl(tab.url)) {
      await chrome.storage.local.set({ armed: false, logCount: 0, submissionId: null, examToken: null });
      return;
    }
    if (isQuizUrl(tab.url)) {
      const { submissionId = null } = await chrome.storage.local.get(['submissionId']);
      if (submissionId) {
        await chrome.storage.local.set({ armed: true });
      }
    }
    await sendLog(tab.url);
  }
});

/**
 * When a tab finishes loading a new URL, log it
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const { armed = false } = await chrome.storage.local.get(['armed']);

  // Only log when page finishes loading and has a valid URL
  if (armed && changeInfo.status === 'complete' && tab?.url && !tab.url.startsWith('chrome://')) {
    if (isDashboardUrl(tab.url)) {
      await chrome.storage.local.set({ armed: false, logCount: 0, submissionId: null, examToken: null });
      return;
    }
    if (isQuizUrl(tab.url)) {
      const { submissionId = null } = await chrome.storage.local.get(['submissionId']);
      if (submissionId) {
        await chrome.storage.local.set({ armed: true });
      }
    }
    await sendLog(tab.url);
  }
});

/**
 * Listen for popup messages (like state changes)
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'armedStateChanged') {
    console.log(`[ProctorLess] Armed state changed to: ${request.armed}`);
  }
  if (request.action === 'setArmedState') {
    const armed = !!request.armed;
    const examToken = request.examToken || null;
    const submissionId = request.submissionId || null;
    chrome.storage.local.set({ armed, examToken, submissionId }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'resetState') {
    chrome.storage.local.set({ armed: false, logCount: 0, submissionId: null, examToken: null }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'getArmedState') {
    chrome.storage.local.get(['armed', 'examToken']).then((data) => {
      sendResponse({ armed: !!data.armed, examToken: data.examToken || null });
    });
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === 'setArmedState') {
    const armed = !!request.armed;
    const examToken = request.examToken || null;
    const submissionId = request.submissionId || null;
    chrome.storage.local.set({ armed, examToken, submissionId }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'resetState') {
    chrome.storage.local.set({ armed: false, logCount: 0, submissionId: null, examToken: null }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (request.action === 'getArmedState') {
    chrome.storage.local.get(['armed', 'examToken']).then((data) => {
      sendResponse({ armed: !!data.armed, examToken: data.examToken || null });
    });
    return true;
  }
});

// Log initialization
console.log('[ProctorLess] Background service worker loaded');
