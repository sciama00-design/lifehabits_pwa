import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { SubscriptionPlan } from '@/types/database';
import { useAuth } from './useAuth';

export function useSubscriptionPlans(clientId?: string) {
    const { user } = useAuth();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('subscription_plans')
                .select(`
                    *,
                    coach:profiles!subscription_plans_coach_id_fkey (
                        full_name
                    )
                `);

            if (clientId) {
                query = query.eq('client_id', clientId);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setPlans(data as any[]);
        } catch (err: any) {
            console.error('Error fetching plans:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPlans();
    }, [user, clientId]);

    const createPlan = async (name: string, description: string, clientIdForPlan: string, startDate?: string, endDate?: string) => {
        if (!user) return null;
        try {
            const { data, error } = await supabase
                .from('subscription_plans')
                .insert([
                    {
                        coach_id: user.id,
                        client_id: clientIdForPlan,
                        name,
                        description,
                        start_date: startDate,
                        end_date: endDate
                    }
                ])
                .select(`
                    *,
                    coach:profiles!subscription_plans_coach_id_fkey (
                        full_name
                    )
                `)
                .single();

            if (error) throw error;
            setPlans(prev => [data, ...prev]);
            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    };

    const updatePlan = async (id: string, updates: Partial<Omit<SubscriptionPlan, 'id' | 'created_at' | 'coach_id'>>) => {
        try {
            const { data, error } = await supabase
                .from('subscription_plans')
                .update(updates)
                .eq('id', id)
                .select(`
                    *,
                    coach:profiles!subscription_plans_coach_id_fkey (
                        full_name
                    )
                `)
                .single();

            if (error) throw error;
            setPlans(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    const deletePlan = async (id: string) => {
        try {
            const { error } = await supabase
                .from('subscription_plans')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPlans(prev => prev.filter(p => p.id !== id));
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    return {
        plans,
        loading,
        error,
        createPlan,
        updatePlan,
        deletePlan,
        refresh: fetchPlans
    };
}
