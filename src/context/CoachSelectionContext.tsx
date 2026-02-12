import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import type { SubscriptionPlan } from '@/types/database';

interface CoachSelectionContextType {
    plans: SubscriptionPlan[];
    selectedPlanId: string;
    setSelectedPlanId: (id: string) => void;
    loadingPlans: boolean;
    refreshPlans: () => Promise<void>;
}

const CoachSelectionContext = createContext<CoachSelectionContextType | undefined>(undefined);

export function CoachSelectionProvider({ children }: { children: ReactNode }) {
    const { profile } = useAuth();
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string>('all');
    const [loadingPlans, setLoadingPlans] = useState(true);

    useEffect(() => {
        if (profile?.role === 'client') {
            fetchPlans();
        } else if (profile) {
            setLoadingPlans(false);
        }
    }, [profile]);

    async function fetchPlans() {
        setLoadingPlans(true);
        try {
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const { data: plansData, error: plansError } = await supabase
                .from('subscription_plans')
                .select('*, coach:profiles!coach_id(*)')
                .eq('client_id', profile!.id)
                .lte('start_date', today)
                .gte('end_date', today)
                .order('created_at', { ascending: false });

            if (plansError) throw plansError;
            setPlans(plansData || []);
        } catch (err) {
            console.error('Error fetching plans:', err);
        } finally {
            setLoadingPlans(false);
        }
    }

    return (
        <CoachSelectionContext.Provider value={{
            plans,
            selectedPlanId,
            setSelectedPlanId,
            loadingPlans,
            refreshPlans: fetchPlans
        }}>
            {children}
        </CoachSelectionContext.Provider>
    );
}

export function useCoachSelection() {
    const context = useContext(CoachSelectionContext);
    if (context === undefined) {
        throw new Error('useCoachSelection must be used within a CoachSelectionProvider');
    }
    return context;
}
