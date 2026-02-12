import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ClientInfo, Profile } from '@/types/database';
import { useAuth } from './useAuth';

export type ClientWithProfile = ClientInfo & {
    profiles: Profile;
    subscription_end: string | null;
};

export function useClients() {
    const { profile } = useAuth();
    const [clients, setClients] = useState<ClientWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.role === 'coach') {
            fetchClients();
        }
    }, [profile]);

    async function fetchClients() {
        setLoading(true);
        try {
            // Fetch clients via client_coaches for the current coach
            const { data, error } = await supabase
                .from('client_coaches')
                .select(`
                    client:profiles!client_coaches_client_id_fkey (
                        id,
                        email,
                        full_name,
                        avatar_url,
                        role,
                        clients_info:clients_info!clients_info_id_fkey (
                            created_at
                        ),
                        subscription_plans:subscription_plans!subscription_plans_client_id_fkey (
                            end_date
                        )
                    )
                `)
                .eq('coach_id', profile!.id);

            if (error) throw error;

            const formattedClients = (data as any[]).map(item => {
                const plans = item.client.subscription_plans || [];
                // Find if any plan is active today or just get the latest end_date
                const latestPlan = plans.length > 0
                    ? plans.reduce((prev: any, current: any) =>
                        (new Date(current.end_date) > new Date(prev.end_date)) ? current : prev
                    )
                    : null;

                return {
                    id: item.client.id,
                    coach_id: profile!.id,
                    created_at: item.client.clients_info?.created_at,
                    profiles: {
                        id: item.client.id,
                        email: item.client.email,
                        full_name: item.client.full_name,
                        avatar_url: item.client.avatar_url,
                        role: item.client.role,
                        created_at: item.client.clients_info?.created_at
                    },
                    subscription_end: latestPlan?.end_date || null
                };
            });

            setClients(formattedClients as unknown as ClientWithProfile[]);
        } catch (err: any) {
            console.error('Error fetching clients:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function createClient(email: string, fullName: string) {
        try {
            setError(null);

            const { error: rpcError } = await supabase.rpc('create_client_user', {
                email,
                password: 'lifehabits2026', // Default password
                full_name: fullName
            });

            if (rpcError) throw rpcError;

            // Refresh list
            await fetchClients();
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    async function linkColleague(clientId: string, coachId: string) {
        try {
            const { error } = await supabase
                .from('client_coaches')
                .insert({ client_id: clientId, coach_id: coachId });
            if (error) throw error;
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    async function unlinkColleague(clientId: string, coachId: string) {
        try {
            const { error } = await supabase
                .from('client_coaches')
                .delete()
                .match({ client_id: clientId, coach_id: coachId });
            if (error) throw error;
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    async function fetchClientCoaches(clientId: string) {
        try {
            const { data, error } = await supabase
                .from('client_coaches')
                .select(`
                    coach:profiles!client_coaches_coach_id_fkey (
                        id,
                        full_name,
                        email,
                        avatar_url
                    )
                `)
                .eq('client_id', clientId);
            if (error) throw error;
            return (data as any[]).map(d => d.coach) as Profile[];
        } catch (err: any) {
            console.error('Error fetching client coaches:', err);
            return [];
        }
    }

    async function searchCoaches(query: string) {
        try {
            let q = supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url')
                .eq('role', 'coach')
                .neq('id', profile?.id || ''); // Don't search for self

            if (query) {
                q = q.ilike('full_name', `%${query}%`);
            }

            const { data, error } = await q.limit(10);

            if (error) {
                console.error('Error in searchCoaches:', error);
                throw error;
            }
            return data as Profile[];
        } catch (err: any) {
            console.error('Catch error in searchCoaches:', err);
            return [];
        }
    }

    return {
        clients,
        loading,
        error,
        createClient,
        linkColleague,
        unlinkColleague,
        fetchClientCoaches,
        searchCoaches,
        refresh: fetchClients
    };
}
