import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { SubscriptionPlan } from '@/types/database';
import { motion } from 'framer-motion';

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading: authLoading } = useAuth();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showTimeout, setShowTimeout] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading || authLoading) {
                setShowTimeout(true);
            }
        }, 8000); // 8 seconds timeout

        return () => clearTimeout(timer);
    }, [loading, authLoading]);

    useEffect(() => {
        if (!authLoading) {
            if (profile?.role === 'client') {
                fetchPlans(profile.id);
            } else if (profile?.role === 'coach') {
                // Coaches shouldn't be in SubscriptionGuard (client area)
                // but if they hit it, we should let the check below handle it or redirect
                setLoading(false);
            } else {
                // No profile found, stop loading so we can redirect to login
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
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-background p-6">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary mb-4" />
                <p className="text-sm text-muted-foreground animate-pulse">Caricamento in corso...</p>
                {showTimeout && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 flex flex-col items-center gap-4 text-center"
                    >
                        <p className="text-xs text-muted-foreground max-w-[250px]">
                            Il caricamento sta impiegando più del previsto. Potrebbe esserci un problema di connessione.
                        </p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="text-xs font-bold text-primary uppercase tracking-widest border border-primary/20 px-6 py-2 rounded-full hover:bg-primary/5 transition-colors"
                        >
                            Torna alla Home
                        </button>
                    </motion.div>
                )}
            </div>
        );
    }

    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    if (profile.role === 'coach') {
        return <Navigate to="/coach/dashboard" replace />;
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
