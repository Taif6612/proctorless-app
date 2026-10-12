/**
 * fingerprint.js
 * Deterministic Machine Fingerprinting for ProctorLess
 * 
 * Generates a consistent hash from GPU + Canvas + Screen data.
 * Same hardware = Same fingerprint every time (survives Deep Freeze).
 * 
 * Components:
 * 1. GPU Info (WebGL renderer, vendor, version)
 * 2. Canvas Fingerprint (pixel-level rendering differences)
 * 3. Screen Info (resolution, DPI, color depth)
 */

// ============================================
// SHA-256 Hashing (Web Crypto API)
// ============================================
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================
// 1. GPU Information (WebGL)
// ============================================
function getGPUInfo() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl) {
            return { vendor: 'unknown', renderer: 'unknown', version: 'unknown' };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

        const gpuInfo = {
            vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
            renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxVertexAttribs: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
            // WebGL extensions provide additional uniqueness
            extensions: (gl.getSupportedExtensions() || []).sort().join(',')
        };

        return gpuInfo;
    } catch (e) {
        console.warn('[Fingerprint] GPU info error:', e);
        return { vendor: 'error', renderer: 'error', version: 'error' };
    }
}

// ============================================
// 2. Canvas Fingerprint
// ============================================
function generateCanvasFingerprint() {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) return 'canvas-unavailable';

        canvas.width = 200;
        canvas.height = 50;

        // Draw complex shapes - rendering differs by GPU/driver
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);

        ctx.fillStyle = '#069';
        ctx.fillText('ProctorLess', 2, 15);

        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('Fingerprint', 4, 17);

        // Add gradients and curves for more uniqueness
        ctx.beginPath();
        ctx.arc(50, 25, 20, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(50, 25, 0, 50, 25, 20);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(1, '#0000ff');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Get the data URL - this varies by GPU/driver rendering
        return canvas.toDataURL();
    } catch (e) {
        console.warn('[Fingerprint] Canvas error:', e);
        return 'canvas-error';
    }
}

// ============================================
// 3. Screen Information
// ============================================
function getScreenInfo() {
    try {
        return {
            width: window.screen.width,
            height: window.screen.height,
            availWidth: window.screen.availWidth,
            availHeight: window.screen.availHeight,
            colorDepth: window.screen.colorDepth,
            pixelDepth: window.screen.pixelDepth,
            devicePixelRatio: window.devicePixelRatio || 1,
            orientation: window.screen.orientation?.type || 'unknown'
        };
    } catch (e) {
        console.warn('[Fingerprint] Screen info error:', e);
        return { width: 0, height: 0 };
    }
}

// ============================================
// 4. Additional Hardware Info (if available)
// ============================================
function getHardwareInfo() {
    return {
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        deviceMemory: navigator.deviceMemory || 0,
        platform: navigator.platform || 'unknown',
        maxTouchPoints: navigator.maxTouchPoints || 0
    };
}

// ============================================
// MAIN: Generate Composite Fingerprint
// ============================================
async function generateMachineFingerprint() {
    console.log('[Fingerprint] Generating composite fingerprint...');

    // Collect all components
    const gpuData = getGPUInfo();
    const canvasData = generateCanvasFingerprint();
    const screenData = getScreenInfo();
    const hardwareData = getHardwareInfo();

    // Create composite string from most stable components
    // Order matters for consistency!
    const composite = [
        // Primary: GPU (most unique)
        `GPU:${gpuData.vendor}|${gpuData.renderer}|${gpuData.version}`,
        // Secondary: Canvas (highly unique)
        `CANVAS:${canvasData}`,
        // Tertiary: Screen (stable)
        `SCREEN:${screenData.width}x${screenData.height}|${screenData.colorDepth}|${screenData.devicePixelRatio}`,
        // Quaternary: Hardware (additional entropy)
        `HW:${hardwareData.hardwareConcurrency}|${hardwareData.platform}`
    ].join('||');

    // Generate SHA-256 hash
    const fingerprintHash = await sha256(composite);

    console.log('[Fingerprint] Generated hash:', fingerprintHash.substring(0, 16) + '...');

    return {
        hash: fingerprintHash,
        components: {
            gpu: `${gpuData.vendor} | ${gpuData.renderer}`,
            canvas: canvasData.substring(0, 50) + '...',
            screen: `${screenData.width}x${screenData.height} @ ${screenData.devicePixelRatio}x`,
            hardware: `${hardwareData.hardwareConcurrency} cores, ${hardwareData.platform}`
        },
        timestamp: Date.now()
    };
}

// ============================================
// Similarity Check (for drift detection)
// ============================================
function calculateSimilarity(components1, components2) {
    if (!components1 || !components2) return 0;

    let matches = 0;
    let total = 0;

    // Compare GPU
    if (components1.gpu === components2.gpu) matches++;
    total++;

    // Compare Screen
    if (components1.screen === components2.screen) matches++;
    total++;

    // Compare Hardware
    if (components1.hardware === components2.hardware) matches++;
    total++;

    return matches / total;
}

// Export for use in background.js and content.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { generateMachineFingerprint, calculateSimilarity };
}

// Make available globally for extension context
self.generateMachineFingerprint = generateMachineFingerprint;
self.calculateSimilarity = calculateSimilarity;
