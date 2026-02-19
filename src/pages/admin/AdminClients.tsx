import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { Search, Trash2 } from 'lucide-react';

interface ClientWithCoach extends Profile {
    coach_name?: string;
}

export default function AdminClients() {
    const [clients, setClients] = useState<ClientWithCoach[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        async function fetchClients() {
            try {
                // Fetch all clients
                const { data: clientsData, error: clientsError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('role', 'client')
                    .order('created_at', { ascending: false });

                if (clientsError) throw clientsError;

                // Fetch coach relations
                const { data: relations, error: relationsError } = await supabase
                    .from('client_coaches')
                    .select('client_id, coach_id, coach:profiles!client_coaches_coach_id_fkey(full_name)');

                if (relationsError) throw relationsError;

                // Map coach names to clients
                const clientsWithCoaches = clientsData.map(client => {
                    const relation = relations?.find((r: any) => r.client_id === client.id);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const coachData = relation?.coach as any;
                    return {
                        ...client,
                        coach_name: coachData?.full_name || 'Unassigned'
                    };
                });

                setClients(clientsWithCoaches);
            } catch (error) {
                console.error('Error fetching clients:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchClients();
    }, []);

    const handleDeleteClient = async (clientId: string, clientName: string) => {
        if (!confirm(`Are you sure you want to delete client "${clientName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', clientId);

            if (error) throw error;

            // Refresh list (re-run logic from useEffect - ideally refactor to function but copying for speed)
            window.location.reload(); // Simplest way to refresh complex joined data for now
        } catch (error) {
            console.error('Error deleting client:', error);
            alert('Failed to delete client');
        }
    };

    const filteredClients = clients.filter(client =>
        client.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.coach_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Clients</h1>

            <div className="max-w-md">
                <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="Search clients..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredClients.map((client) => (
                        <li key={client.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            {client.avatar_url ? (
                                                <img className="h-10 w-10 rounded-full" src={client.avatar_url} alt="" />
                                            ) : (
                                                <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                                                    <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-primary-600 truncate">{client.full_name || 'No Name'}</div>
                                            <div className="text-sm text-gray-500">{client.email}</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex items-center gap-4">
                                            <div className="text-sm text-gray-500">
                                                Coach: <span className="font-medium text-gray-900">{client.coach_name}</span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteClient(client.id, client.full_name || 'Client')}
                                                className="text-red-600 hover:text-red-900"
                                                title="Delete Client"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </button>
                                        </div>
                                        <div className="mt-1 text-xs text-gray-400">
                                            Joined {new Date(client.created_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {filteredClients.length === 0 && !loading && (
                        <li className="px-4 py-8 text-center text-gray-500">
                            No clients found.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}
