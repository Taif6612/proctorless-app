/**
 * Machine Registration API
 * 
 * POST /api/machine/register
 * 
 * Registers a new machine fingerprint with its physical location.
 * Only accessible by professors and admins.
 */

import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Create Supabase client with service role for writes
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        // Get authenticated user
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Check user role (only professors and admins can register machines)
        const { data: roleData } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (!roleData || !['professor', 'admin'].includes(roleData.role)) {
            return NextResponse.json(
                { error: 'Only professors and admins can register machines' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            fingerprintHash,
            fingerprintComponents,
            labName,
            rowIndex,
            columnIndex,
            machineLabel,
            notes
        } = body;

        // Validate required fields
        if (!fingerprintHash || typeof fingerprintHash !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid fingerprintHash' },
                { status: 400 }
            );
        }

        if (!labName || typeof labName !== 'string') {
            return NextResponse.json(
                { error: 'Missing or invalid labName' },
                { status: 400 }
            );
        }

        if (typeof rowIndex !== 'number' || rowIndex < 0) {
            return NextResponse.json(
                { error: 'Invalid rowIndex (must be >= 0)' },
                { status: 400 }
            );
        }

        if (typeof columnIndex !== 'number' || columnIndex < 0) {
            return NextResponse.json(
                { error: 'Invalid columnIndex (must be >= 0)' },
                { status: 400 }
            );
        }

        console.log('[Machine Register] Registering:', labName, `Row ${rowIndex}, Col ${columnIndex}`);

        // Check if fingerprint already registered
        const { data: existing } = await supabaseAdmin
            .from('machine_registry')
            .select('id, lab_name, row_index, column_index')
            .eq('fingerprint_hash', fingerprintHash)
            .single();

        if (existing) {
            return NextResponse.json({
                success: false,
                error: 'Machine already registered',
                existingRegistration: {
                    id: existing.id,
                    labName: existing.lab_name,
                    row: existing.row_index,
                    column: existing.column_index
                }
            }, { status: 409 });
        }

        // Check if position already taken
        const { data: positionTaken } = await supabaseAdmin
            .from('machine_registry')
            .select('id, fingerprint_hash, machine_label')
            .eq('lab_name', labName)
            .eq('row_index', rowIndex)
            .eq('column_index', columnIndex)
            .single();

        if (positionTaken) {
            return NextResponse.json({
                success: false,
                error: 'Position already has a registered machine',
                existingMachine: {
                    id: positionTaken.id,
                    label: positionTaken.machine_label
                }
            }, { status: 409 });
        }

        // Register the machine
        const { data: newMachine, error: insertError } = await supabaseAdmin
            .from('machine_registry')
            .insert({
                fingerprint_hash: fingerprintHash,
                fingerprint_components: fingerprintComponents || null,
                lab_name: labName,
                row_index: rowIndex,
                column_index: columnIndex,
                machine_label: machineLabel || `${labName}-R${rowIndex + 1}C${columnIndex + 1}`,
                registered_by: user.id,
                registration_notes: notes || null,
                is_active: true
            })
            .select()
            .single();

        if (insertError) {
            console.error('[Machine Register] Insert error:', insertError);
            return NextResponse.json(
                { error: 'Failed to register machine', details: insertError.message },
                { status: 500 }
            );
        }

        console.log('[Machine Register] Success:', newMachine.id);

        return NextResponse.json({
            success: true,
            machine: {
                id: newMachine.id,
                labName: newMachine.lab_name,
                row: newMachine.row_index,
                column: newMachine.column_index,
                label: newMachine.machine_label
            },
            message: `Machine registered as ${newMachine.machine_label}`
        });

    } catch (error) {
        console.error('[Machine Register] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET endpoint to list all registered machines (for admin)
export async function GET(request: NextRequest) {
    try {
        // Get authenticated user
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get query params
        const { searchParams } = new URL(request.url);
        const labName = searchParams.get('lab');

        // Build query
        let query = supabaseAdmin
            .from('machine_registry')
            .select('*')
            .order('lab_name')
            .order('row_index')
            .order('column_index');

        if (labName) {
            query = query.eq('lab_name', labName);
        }

        const { data: machines, error } = await query;

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Group by lab
        const labs: Record<string, any[]> = {};
        for (const machine of machines || []) {
            if (!labs[machine.lab_name]) {
                labs[machine.lab_name] = [];
            }
            labs[machine.lab_name].push(machine);
        }

        return NextResponse.json({
            total: machines?.length || 0,
            labs,
            machines
        });

    } catch (error) {
        console.error('[Machine Register GET] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE endpoint to remove a machine registration
export async function DELETE(request: NextRequest) {
    try {
        // Get authenticated user
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check user role
        const { data: roleData } = await supabaseAdmin
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (!roleData || !['professor', 'admin'].includes(roleData.role)) {
            return NextResponse.json({ error: 'Only professors and admins can delete machines' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const machineId = searchParams.get('id');

        if (!machineId) {
            return NextResponse.json({ error: 'Missing machine id' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('machine_registry')
            .delete()
            .eq('id', machineId);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, deleted: machineId });

    } catch (error) {
        console.error('[Machine Delete] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
