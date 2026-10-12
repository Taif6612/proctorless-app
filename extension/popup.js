/**
 * popup.js
 * Handles the popup UI for ProctorLess Focus extension
 */

const statusEl = document.getElementById('status');
const toggleBtn = document.getElementById('toggle');
const logCountEl = document.getElementById('logCount');
const examTokenDisplay = document.getElementById('examTokenDisplay');
const tokenValue = document.getElementById('tokenValue');
const submissionValue = document.getElementById('submissionValue');
const machineValue = document.getElementById('machineValue');
const resetBtn = document.getElementById('reset');

/**
 * Refresh popup UI based on current storage state
 */
async function refresh() {
  const { armed = false, examToken = null, logCount = 0, submissionId = null, machineId = null } = await chrome.storage.local.get([
    'armed',
    'examToken',
    'logCount',
    'submissionId',
    'machineId'
  ]);

  // Update status display
  statusEl.textContent = armed ? 'Armed ✓' : 'Disarmed';
  statusEl.className = armed ? 'armed' : 'disarmed';

  // Update button text
  toggleBtn.textContent = armed ? 'Disarm Monitoring' : 'Arm Monitoring';

  // Update log count
  logCountEl.textContent = logCount;

  submissionValue.textContent = submissionId || '(none)';

  if (machineId) {
    // If it's a long hash (fingerprint), show it with potential wrapping
    // If it's a short label (e.g. "Row 1, Col 1"), show as is
    machineValue.textContent = machineId;
    if (machineId.length > 20) {
      machineValue.style.fontSize = '10px';
      machineValue.style.wordBreak = 'break-all';
    } else {
      machineValue.style.fontSize = '11px';
      machineValue.style.wordBreak = 'normal';
    }
  } else {
    machineValue.textContent = '(auto)';
    machineValue.style.fontSize = '11px';
  }

  // Show/hide exam token if present
  if (examToken) {
    examTokenDisplay.style.display = 'block';
    tokenValue.textContent = examToken.substring(0, 20) + '...';
  } else {
    examTokenDisplay.style.display = 'none';
  }
}

/**
 * Toggle armed state when button is clicked
 */
toggleBtn.addEventListener('click', async () => {
  const data = await chrome.storage.local.get(['armed']);
  const newArmedState = !data.armed;

  await chrome.storage.local.set({ armed: newArmedState });

  // Log to console for debugging
  console.log(`[ProctorLess] Monitoring ${newArmedState ? 'ARMED' : 'DISARMED'}`);

  // Notify background script of state change
  chrome.runtime.sendMessage({
    action: 'armedStateChanged',
    armed: newArmedState
  }).catch(() => {
    // Background script may not be ready, that's ok
  });

  refresh();
});

// Submission ID is auto-attached by content script; no manual save needed

resetBtn.addEventListener('click', async () => {
  try {
    await chrome.runtime.sendMessage({ action: 'resetState' });
  } catch { }
  await chrome.storage.local.set({ armed: false, logCount: 0, submissionId: null, examToken: null, machineId: null });
  refresh();
});

/**
 * Listen for messages from the website (exam start/end)
 * This allows your Next.js app to arm/disarm the extension automatically
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setArmedState') {
    chrome.storage.local.set({
      armed: request.armed,
      examToken: request.examToken || null,
      submissionId: request.submissionId || null,
      machineId: request.machineId || null
    });
    refresh();
    sendResponse({ success: true });
  }

  if (request.action === 'getArmedState') {
    chrome.storage.local.get(['armed', 'examToken'], (data) => {
      sendResponse({
        armed: data.armed || false,
        examToken: data.examToken || null
      });
    });
    return true; // Keep channel open for async response
  }
});

// Initial refresh on popup open
refresh();

// Refresh every 2 seconds to show live log count
setInterval(refresh, 2000);
