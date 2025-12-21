/**
 * Machine Identification API
 * 
 * POST /api/machine/identify
 * 
 * Looks up a machine by its fingerprint hash and returns:
 * - Machine info (lab, row, col, label)
 * - Variant index (calculated using Latin Square)
 * 
 * If machine not found, returns requiresManualAssignment: true
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// Create Supabase client with service role for RLS bypass
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { fingerprintHash, sessionId, totalVariants = 3 } = body;

        if (!fingerprintHash || typeof fingerprintHash !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid fingerprintHash' },
                { status: 400 }
            );
        }

        console.log('[Machine Identify] Looking up fingerprint:', fingerprintHash.substring(0, 16) + '...');

        // Look up machine in registry
        const { data: machine, error } = await supabase
            .from('machine_registry')
            .select('*')
            .eq('fingerprint_hash', fingerprintHash)
            .eq('is_active', true)
            .single();

        if (error || !machine) {
            console.log('[Machine Identify] Machine not found, requires manual assignment');
            return NextResponse.json({
                identified: false,
                requiresManualAssignment: true,
                fingerprintHash: fingerprintHash.substring(0, 16) + '...',
                message: 'Machine not registered. Proctor will assign your seat.'
            });
        }

        // Calculate variant index using Latin Square formula
        const variantIndex = ((machine.row_index * 3) + machine.column_index) % totalVariants;

        // Update last_seen timestamp
        await supabase
            .from('machine_registry')
            .update({
                last_seen_at: new Date().toISOString(),
                last_verified_at: new Date().toISOString()
            })
            .eq('id', machine.id);

        console.log('[Machine Identify] Machine found:', machine.lab_name, `Row ${machine.row_index}, Col ${machine.column_index}`, `Variant ${variantIndex}`);

        return NextResponse.json({
            identified: true,
            machine: {
                id: machine.id,
                labName: machine.lab_name,
                row: machine.row_index,
                column: machine.column_index,
                label: machine.machine_label
            },
            variantIndex,
            totalVariants,
            message: `Identified as ${machine.machine_label || `Row ${machine.row_index + 1}, Col ${machine.column_index + 1}`} in ${machine.lab_name}`
        });

    } catch (error) {
        console.error('[Machine Identify] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint for health check
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        endpoint: '/api/machine/identify',
        method: 'POST',
        description: 'Identify a machine by its fingerprint hash'
    });
}
