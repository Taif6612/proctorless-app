'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    getMachineFingerprint,
    registerMachine,
    getRegisteredMachines,
    deleteMachineRegistration,
    isExtensionAvailable,
    MachineFingerprint
} from '@/lib/machineFingerprint';

interface Machine {
    id: string;
    fingerprint_hash: string;
    lab_name: string;
    row_index: number;
    column_index: number;
    machine_label: string | null;
    fingerprint_components: any;
    registered_at: string;
    last_seen_at: string | null;
    is_active: boolean;
}

export default function MachineRegistryPage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string | null>(null);
    const [machines, setMachines] = useState<Machine[]>([]);
    const [labs, setLabs] = useState<Record<string, Machine[]>>({});

    // Registration form state
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [fingerprint, setFingerprint] = useState<MachineFingerprint | null>(null);
    const [extensionReady, setExtensionReady] = useState(false);
    const [labName, setLabName] = useState('');
    const [rowIndex, setRowIndex] = useState(0);
    const [colIndex, setColIndex] = useState(0);
    const [machineLabel, setMachineLabel] = useState('');
    const [registering, setRegistering] = useState(false);
    const [registerMessage, setRegisterMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Fetch user and data
    const fetchData = useCallback(async () => {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
            router.push('/auth/login');
            return;
        }
        setUser(currentUser);

        // Check role
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', currentUser.id)
            .single();

        if (!roleData || roleData.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        setRole(roleData.role);

        // Fetch machines
        const result = await getRegisteredMachines();
        setMachines(result.machines || []);
        setLabs(result.labs || {});

        setLoading(false);
    }, [supabase, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Check extension on form open
    useEffect(() => {
        if (showRegisterForm) {
            const checkExtension = async () => {
                const available = await isExtensionAvailable();
                setExtensionReady(available);

                if (available) {
                    const fp = await getMachineFingerprint();
                    setFingerprint(fp);
                }
            };
            checkExtension();
        }
    }, [showRegisterForm]);

    // Handle registration
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fingerprint?.hash) return;

        setRegistering(true);
        setRegisterMessage(null);

        const result = await registerMachine(
            fingerprint.hash,
            fingerprint.components,
            labName,
            rowIndex,
            colIndex,
            machineLabel || undefined
        );

        if (result.success) {
            setRegisterMessage({ type: 'success', text: `Machine registered as ${result.machine?.label}` });
            setShowRegisterForm(false);
            setLabName('');
            setRowIndex(0);
            setColIndex(0);
            setMachineLabel('');
            setFingerprint(null);
            fetchData();
        } else {
            setRegisterMessage({ type: 'error', text: result.error || 'Registration failed' });
        }

        setRegistering(false);
    };

    // Handle delete
    const handleDelete = async (machineId: string, label: string) => {
        if (!confirm(`Delete machine "${label}"?`)) return;

        const result = await deleteMachineRegistration(machineId);
        if (result.success) {
            fetchData();
        } else {
            alert('Failed to delete: ' + result.error);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className="text-indigo-600 hover:text-indigo-800 mb-2 flex items-center gap-1"
                        >
                            ← Back to Dashboard
                        </button>
                        <h1 className="text-3xl font-bold text-slate-800">Machine Registry</h1>
                        <p className="text-slate-600">Register lab machines for automatic quiz variant assignment</p>
                    </div>
                    <button
                        onClick={() => setShowRegisterForm(true)}
                        className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition shadow-lg"
                    >
                        + Register This Machine
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-white/80 backdrop-blur-xl rounded-xl p-6 shadow-lg">
                        <p className="text-3xl font-bold text-indigo-600">{machines.length}</p>
                        <p className="text-slate-600">Total Machines</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-xl p-6 shadow-lg">
                        <p className="text-3xl font-bold text-purple-600">{Object.keys(labs).length}</p>
                        <p className="text-slate-600">Labs</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-xl p-6 shadow-lg">
                        <p className="text-3xl font-bold text-green-600">
                            {machines.filter(m => m.is_active).length}
                        </p>
                        <p className="text-slate-600">Active</p>
                    </div>
                </div>

                {/* Registration Form Modal */}
                {showRegisterForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
                            <h2 className="text-2xl font-bold text-slate-800 mb-6">Register This Machine</h2>

                            {!extensionReady ? (
                                <div className="text-center py-8">
                                    <div className="text-5xl mb-4">🔌</div>
                                    <h3 className="text-lg font-semibold text-slate-700 mb-2">Extension Not Detected</h3>
                                    <p className="text-slate-600 mb-4">
                                        Install the ProctorLess Focus extension to register this machine.
                                    </p>
                                    <div className="flex flex-col gap-2 max-w-xs mx-auto">
                                        <button
                                            onClick={async () => {
                                                const available = await isExtensionAvailable();
                                                setExtensionReady(available);
                                                if (available) {
                                                    const fp = await getMachineFingerprint();
                                                    setFingerprint(fp);
                                                }
                                            }}
                                            className="px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition shadow-md"
                                        >
                                            🔄 Retry Detection
                                        </button>
                                        <button
                                            onClick={() => setShowRegisterForm(false)}
                                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 transition"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            ) : !fingerprint ? (
                                <div className="text-center py-8">
                                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-slate-600">Generating fingerprint...</p>
                                </div>
                            ) : (
                                <form onSubmit={handleRegister}>
                                    {/* Fingerprint Info */}
                                    <div className="bg-slate-50 rounded-xl p-4 mb-6">
                                        <p className="text-xs text-slate-500 mb-2">Fingerprint Hash (first 16 chars)</p>
                                        <p className="font-mono text-sm text-slate-700">
                                            {fingerprint.hash ? `${fingerprint.hash.substring(0, 16)}...` : <span className="text-red-500 italic">Failed to generate hash</span>}
                                        </p>
                                        {(fingerprint as any).error && (
                                            <p className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100 italic">
                                                Error: {(fingerprint as any).error}
                                            </p>
                                        )}
                                        <div className="mt-2 text-xs text-slate-500">
                                            <p>GPU: {fingerprint.components.gpu}</p>
                                            <p>Screen: {fingerprint.components.screen}</p>
                                        </div>
                                    </div>

                                    {/* Lab Name */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Lab Name</label>
                                        <input
                                            type="text"
                                            value={labName}
                                            onChange={(e) => setLabName(e.target.value)}
                                            placeholder="e.g., Physics Lab A"
                                            required
                                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                        {Object.keys(labs).length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <span className="text-xs text-slate-500">Existing:</span>
                                                {Object.keys(labs).map(lab => (
                                                    <button
                                                        key={lab}
                                                        type="button"
                                                        onClick={() => setLabName(lab)}
                                                        className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded"
                                                    >
                                                        {lab}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Row & Column */}
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Row (0-indexed)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={rowIndex}
                                                onChange={(e) => setRowIndex(parseInt(e.target.value) || 0)}
                                                required
                                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Column (0-indexed)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={colIndex}
                                                onChange={(e) => setColIndex(parseInt(e.target.value) || 0)}
                                                required
                                                className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            />
                                        </div>
                                    </div>

                                    {/* Label */}
                                    <div className="mb-6">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Machine Label (optional)</label>
                                        <input
                                            type="text"
                                            value={machineLabel}
                                            onChange={(e) => setMachineLabel(e.target.value)}
                                            placeholder={`${labName || 'Lab'}-R${rowIndex + 1}C${colIndex + 1}`}
                                            className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Message */}
                                    {registerMessage && (
                                        <div className={`mb-4 p-3 rounded-xl ${registerMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {registerMessage.text}
                                        </div>
                                    )}

                                    {/* Buttons */}
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowRegisterForm(false);
                                                setRegisterMessage(null);
                                            }}
                                            className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-xl"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={registering || !labName || !fingerprint?.hash}
                                            className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl disabled:opacity-50"
                                        >
                                            {registering ? 'Registering...' : 'Register Machine'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                )}

                {/* Machines by Lab */}
                {Object.keys(labs).length === 0 ? (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-12 text-center shadow-lg">
                        <div className="text-6xl mb-4">🖥️</div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-2">No Machines Registered</h2>
                        <p className="text-slate-600 mb-6">
                            Register lab machines to enable automatic quiz variant assignment.
                        </p>
                        <button
                            onClick={() => setShowRegisterForm(true)}
                            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl"
                        >
                            Register First Machine
                        </button>
                    </div>
                ) : (
                    Object.entries(labs).map(([labName, labMachines]) => (
                        <div key={labName} className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/40 mb-6">
                            <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <span className="p-2 bg-indigo-100 rounded-lg text-lg">🏢</span>
                                {labName}
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-left text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                            <th className="pb-3 px-2 font-bold">Label</th>
                                            <th className="pb-3 px-2 font-bold">Position</th>
                                            <th className="pb-3 px-2 font-bold">Variant</th>
                                            <th className="pb-3 px-2 font-bold">Fingerprint</th>
                                            <th className="pb-3 px-2 font-bold">Last Seen</th>
                                            <th className="pb-3 px-2 font-bold text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {labMachines.map((machine) => {
                                            const variantIndex = ((machine.row_index * 3) + machine.column_index) % 3;
                                            const variantLabel = String.fromCharCode(65 + variantIndex);
                                            return (
                                                <tr key={machine.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                                    <td className="py-4 px-2 font-bold text-slate-900">{machine.machine_label || '-'}</td>
                                                    <td className="py-4 px-2 text-slate-700 font-medium">Row {machine.row_index + 1}, Col {machine.column_index + 1}</td>
                                                    <td className="py-3">
                                                        <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded font-semibold">
                                                            {variantLabel}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-2 font-mono text-xs text-slate-400">
                                                        {machine.fingerprint_hash.substring(0, 12)}...
                                                    </td>
                                                    <td className="py-4 px-2 text-sm text-slate-600">
                                                        {machine.last_seen_at
                                                            ? new Date(machine.last_seen_at).toLocaleDateString()
                                                            : 'Never'}
                                                    </td>
                                                    <td className="py-4 px-2 text-right">
                                                        <button
                                                            onClick={() => handleDelete(machine.id, machine.machine_label || 'this machine')}
                                                            className="px-3 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                                                        >
                                                            Delete
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
