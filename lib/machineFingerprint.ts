/**
 * machineFingerprint.ts
 * 
 * Client-side utilities for machine fingerprinting.
 * Communicates with the ProctorLess extension to get fingerprint
 * and with the server to identify/register machines.
 */

// ============================================
// Types
// ============================================
export interface MachineFingerprint {
    hash: string;
    components: {
        gpu: string;
        canvas: string;
        screen: string;
        hardware: string;
    };
    timestamp: number;
}

export interface MachineIdentification {
    identified: boolean;
    requiresManualAssignment?: boolean;
    machine?: {
        id: string;
        labName: string;
        row: number;
        column: number;
        label: string;
    };
    variantIndex?: number;
    totalVariants?: number;
    message?: string;
    error?: string;
}

export interface MachineRegistration {
    success: boolean;
    machine?: {
        id: string;
        labName: string;
        row: number;
        column: number;
        label: string;
    };
    error?: string;
    existingRegistration?: {
        id: string;
        labName: string;
        row: number;
        column: number;
    };
}

// ============================================
// Check Extension Availability
// ============================================
export function isExtensionAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        let resolved = false;

        const cleanup = () => {
            window.removeEventListener('message', handler);
        };

        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'PROCTORLESS_EXTENSION_READY' ||
                event.data?.type === 'PROCTORLESS_PONG') {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(true);
                }
            }
        };

        window.addEventListener('message', handler);

        // 1. Send PING to see if it's already loaded
        window.postMessage({ type: 'PROCTORLESS_PING' }, '*');

        // 2. Also wait briefly for the READY message if it just finished loading
        setTimeout(() => {
            if (!resolved) {
                resolved = true;
                cleanup();
                resolve(false);
            }
        }, 1000); // Increased timeout to 1s for better reliability
    });
}

// ============================================
// Get Fingerprint from Extension
// ============================================
export function getMachineFingerprint(): Promise<MachineFingerprint | null> {
    return new Promise((resolve) => {
        const requestId = `fp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Listen for response
        const handler = (event: MessageEvent) => {
            if (event.data?.type === 'PROCTORLESS_FINGERPRINT_RESPONSE' &&
                event.data?.requestId === requestId) {
                window.removeEventListener('message', handler);
                resolve(event.data.fingerprint || null);
            }
        };

        window.addEventListener('message', handler);

        // Request fingerprint
        window.postMessage({
            type: 'PROCTORLESS_GET_FINGERPRINT',
            requestId
        }, '*');

        // Timeout after 3 seconds
        setTimeout(() => {
            window.removeEventListener('message', handler);
            resolve(null);
        }, 3000);
    });
}

// ============================================
// Identify Machine via Server
// ============================================
export async function identifyMachine(
    fingerprintHash: string,
    sessionId?: string,
    totalVariants: number = 3
): Promise<MachineIdentification> {
    try {
        const response = await fetch('/api/machine/identify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fingerprintHash,
                sessionId,
                totalVariants
            })
        });

        return await response.json();
    } catch (error) {
        console.error('[identifyMachine] Error:', error);
        return {
            identified: false,
            requiresManualAssignment: true,
            error: 'Failed to identify machine'
        };
    }
}

// ============================================
// Register Machine (Admin/Professor only)
// ============================================
export async function registerMachine(
    fingerprintHash: string,
    fingerprintComponents: MachineFingerprint['components'],
    labName: string,
    rowIndex: number,
    columnIndex: number,
    machineLabel?: string,
    notes?: string
): Promise<MachineRegistration> {
    try {
        const response = await fetch('/api/machine/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fingerprintHash,
                fingerprintComponents,
                labName,
                rowIndex,
                columnIndex,
                machineLabel,
                notes
            })
        });

        return await response.json();
    } catch (error) {
        console.error('[registerMachine] Error:', error);
        return {
            success: false,
            error: 'Failed to register machine'
        };
    }
}

// ============================================
// Get All Registered Machines
// ============================================
export async function getRegisteredMachines(labName?: string) {
    try {
        const url = labName
            ? `/api/machine/register?lab=${encodeURIComponent(labName)}`
            : '/api/machine/register';

        const response = await fetch(url);
        return await response.json();
    } catch (error) {
        console.error('[getRegisteredMachines] Error:', error);
        return { total: 0, labs: {}, machines: [] };
    }
}

// ============================================
// Delete Machine Registration
// ============================================
export async function deleteMachineRegistration(machineId: string) {
    try {
        const response = await fetch(`/api/machine/register?id=${machineId}`, {
            method: 'DELETE'
        });
        return await response.json();
    } catch (error) {
        console.error('[deleteMachineRegistration] Error:', error);
        return { success: false, error: 'Failed to delete machine' };
    }
}

// ============================================
// Full Flow: Get Fingerprint → Identify → Return Result
// ============================================
export async function autoIdentifyMachine(
    sessionId?: string,
    totalVariants: number = 3
): Promise<{
    fingerprint: MachineFingerprint | null;
    identification: MachineIdentification;
    extensionAvailable: boolean;
}> {
    // Check extension
    const extensionAvailable = await isExtensionAvailable();

    if (!extensionAvailable) {
        return {
            fingerprint: null,
            identification: {
                identified: false,
                requiresManualAssignment: true,
                message: 'Extension not installed or not responding'
            },
            extensionAvailable: false
        };
    }

    // Get fingerprint
    const fingerprint = await getMachineFingerprint();

    if (!fingerprint || !fingerprint.hash) {
        return {
            fingerprint: null,
            identification: {
                identified: false,
                requiresManualAssignment: true,
                message: 'Failed to generate fingerprint'
            },
            extensionAvailable: true
        };
    }

    // Identify machine
    const identification = await identifyMachine(
        fingerprint.hash,
        sessionId,
        totalVariants
    );

    return {
        fingerprint,
        identification,
        extensionAvailable: true
    };
}
