/**
 * content.js
 * Content script for ProctorLess Focus extension
 * 
 * Handles communication between webpage and extension:
 * 1. Receives submission ID from quiz page
 * 2. Exposes machine fingerprinting to the webpage
 */

(() => {
  const canUseExtension = () => {
    try {
      return typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.storage?.local;
    } catch {
      return false;
    }
  };

  const safeSet = (submissionId) => {
    if (!submissionId || typeof submissionId !== 'string') return;
    if (!canUseExtension()) return;
    try {
      chrome.storage.local.set({ submissionId });
    } catch {
      // swallow if extension context invalidated
    }
  };

  // ============================================
  // Fingerprint Generation (runs in page context)
  // ============================================
  async function generateFingerprintInPage() {
    try {
      // SHA-256 hashing
      async function sha256(message) {
        const msgBuffer = new TextEncoder().encode(message);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      // GPU Info
      function getGPUInfo() {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) return { vendor: 'unknown', renderer: 'unknown', version: 'unknown' };

          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          return {
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION)
          };
        } catch {
          return { vendor: 'error', renderer: 'error', version: 'error' };
        }
      }

      // Canvas Fingerprint
      function generateCanvasFingerprint() {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return 'canvas-unavailable';

          canvas.width = 200;
          canvas.height = 50;
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#f60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('ProctorLess', 2, 15);
          ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
          ctx.fillText('Fingerprint', 4, 17);

          // Add gradient circle
          ctx.beginPath();
          ctx.arc(50, 25, 20, 0, Math.PI * 2);
          const gradient = ctx.createRadialGradient(50, 25, 0, 50, 25, 20);
          gradient.addColorStop(0, '#ff0000');
          gradient.addColorStop(1, '#0000ff');
          ctx.fillStyle = gradient;
          ctx.fill();

          return canvas.toDataURL();
        } catch {
          return 'canvas-error';
        }
      }

      // Screen Info
      function getScreenInfo() {
        return {
          width: window.screen.width,
          height: window.screen.height,
          colorDepth: window.screen.colorDepth,
          devicePixelRatio: window.screen.devicePixelRatio || window.devicePixelRatio || 1
        };
      }

      // Hardware Info
      function getHardwareInfo() {
        return {
          hardwareConcurrency: navigator.hardwareConcurrency || 0,
          platform: navigator.platform || 'unknown'
        };
      }

      // Generate composite
      const gpuInfo = getGPUInfo();
      const canvasInfo = generateCanvasFingerprint();
      const screenInfo = getScreenInfo();
      const hardwareInfo = getHardwareInfo();

      const composite = [
        `GPU:${gpuInfo.vendor}|${gpuInfo.renderer}|${gpuInfo.version}`,
        `CANVAS:${canvasInfo}`,
        `SCREEN:${screenInfo.width}x${screenInfo.height}|${screenInfo.colorDepth}|${screenInfo.devicePixelRatio}`,
        `HW:${hardwareInfo.hardwareConcurrency}|${hardwareInfo.platform}`
      ].join('||');

      const hash = await sha256(composite);

      return {
        hash,
        components: {
          gpu: `${gpuInfo.vendor} | ${gpuInfo.renderer}`,
          canvas: canvasInfo.substring(0, 50) + '...',
          screen: `${screenInfo.width}x${screenInfo.height} @ ${screenInfo.devicePixelRatio}x`,
          hardware: `${hardwareInfo.hardwareConcurrency} cores, ${hardwareInfo.platform}`
        },
        timestamp: Date.now()
      };
    } catch (e) {
      console.error('[ProctorLess] Fingerprint error:', e);
      return { hash: null, error: e.message };
    }
  }

  // ============================================
  // Message Handlers
  // ============================================
  try {
    window.addEventListener('message', async (event) => {
      const data = event && event.data;
      if (!data || typeof data !== 'object') return;

      // Handle submission ID
      if (data.type === 'PROCTORLESS_SUBMISSION_ID' && typeof data.submissionId === 'string') {
        safeSet(data.submissionId);
      }

      // Handle machine ID from app (e.g., after identification)
      if (data.type === 'PROCTORLESS_MACHINE_ID' && typeof data.machineId === 'string') {
        if (canUseExtension()) {
          chrome.storage.local.set({ machineId: data.machineId });
        }
      }

      // Handle ping request
      if (data.type === 'PROCTORLESS_PING') {
        window.postMessage({
          type: 'PROCTORLESS_PONG',
          version: '1.1.0'
        }, '*');
      }

      // Handle fingerprint request from webpage
      if (data.type === 'PROCTORLESS_GET_FINGERPRINT') {
        console.log('[ProctorLess] Fingerprint requested by page');
        const fingerprint = await generateFingerprintInPage();

        // Also cache the fingerprint hash locally as the "Machine ID" until verified
        if (fingerprint && fingerprint.hash && canUseExtension()) {
          chrome.storage.local.get(['machineId'], (res) => {
            // Only update if not already set or if it's a raw hash (verified label preferred)
            if (!res.machineId || res.machineId.length > 20) {
              chrome.storage.local.set({ machineId: fingerprint.hash });
            }
          });
        }

        // Post response back to the page
        window.postMessage({
          type: 'PROCTORLESS_FINGERPRINT_RESPONSE',
          fingerprint,
          requestId: data.requestId
        }, '*');
      }
    }, false);

    // Check for submission ID in DOM
    const el = document.querySelector('[data-proctorless-submission-id]');
    const val = el ? el.getAttribute('data-proctorless-submission-id') : null;
    if (val && /^[0-9a-fA-F-]{36}$/.test(val)) {
      safeSet(val);
    }

    // Announce extension presence to the page
    window.postMessage({
      type: 'PROCTORLESS_EXTENSION_READY',
      version: '1.1.0',
      capabilities: ['fingerprint', 'tab-monitoring']
    }, '*');

    // Proactive: Generate and store fingerprint hash immediately on load
    (async () => {
      const fingerprint = await generateFingerprintInPage();
      if (fingerprint && fingerprint.hash && canUseExtension()) {
        chrome.storage.local.get(['machineId'], (res) => {
          // Only update if not already set or if it's a raw hash (verified label preferred)
          if (!res.machineId || res.machineId.length > 20) {
            chrome.storage.local.set({ machineId: fingerprint.hash });
          }
        });
      }
    })();

    console.log('[ProctorLess] Content script loaded, fingerprinting available');
  } catch {
    // ignore
  }
})();
