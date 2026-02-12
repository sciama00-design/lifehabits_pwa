import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { SubscriptionPlan } from '@/types/database';

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading: authLoading } = useAuth();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading) {
            if (profile?.role === 'client') {
                fetchPlans(profile.id);
            } else {
                setLoading(false);
            }
        }
    }, [profile, authLoading]);

    async function fetchPlans(uid: string) {
        setLoading(true);
        try {
            const { data, error: fetchError } = await supabase
                .from('subscription_plans')
                .select('*')
                .eq('client_id', uid);

            if (fetchError) throw fetchError;
            setPlans(data || []);
        } catch (err: any) {
            console.error('Error fetching plan info:', err);
        } finally {
            setLoading(false);
        }
    }

    if (authLoading || loading) {
        return <div className="flex h-screen items-center justify-center">Caricamento...</div>;
    }

    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    if (profile.role === 'coach') {
        return <>{children}</>;
    }

    // Use local date for comparison to avoid UTC shifts
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const activePlan = plans.find(plan => {
        if (!plan.start_date || !plan.end_date) return false;
        const start = plan.start_date.split('T')[0];
        const end = plan.end_date.split('T')[0];
        return today >= start && today <= end;
    });

    if (!activePlan) {
        return <Navigate to="/scaduto" replace />;
    }

    return <>{children}</>;
}
