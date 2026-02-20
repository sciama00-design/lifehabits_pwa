import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useCoachSelection } from '@/context/CoachSelectionContext';
import { useDailyCompletions } from './useDailyCompletions';
import type { Assignment } from '@/types/database';

export function useClientAssignments(type?: 'habit' | 'video' | 'pdf') {
    const { profile } = useAuth();
    const { selectedPlanId, setSelectedPlanId, plans } = useCoachSelection();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isCompletedToday, toggleCompletion, fetchCompletions, getTodayStr } = useDailyCompletions();

    useEffect(() => {
        if (profile?.role === 'client') {
            fetchInitialData();
        } else if (profile) {
            setLoading(false);
        }
    }, [profile]);

    async function fetchInitialData() {
        setLoading(true);
        try {
            let query = supabase
                .from('assignments')
                .select('*')
                .eq('client_id', profile!.id);

            if (type) {
                query = query.eq('type', type);
            }

            const { data, error } = await query.order('scheduled_date', { ascending: false });

            if (error) throw error;
            setAssignments(data || []);

            // Also fetch today's completions so isCompletedToday works
            const today = getTodayStr();
            await fetchCompletions(today, today);
        } catch (err: any) {
            console.error('Error fetching client assignments:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function toggleComplete(id: string, _currentStatus: boolean) {
        // Use daily_completions instead of updating assignments.completed
        const result = await toggleCompletion(id);
        return result;
    }

    const filteredAssignments = selectedPlanId === 'all'
        ? assignments
        : assignments.filter(a => a.plan_id === selectedPlanId);

    return {
        assignments: filteredAssignments,
        plans,
        selectedPlanId,
        setSelectedPlanId,
        loading,
        error,
        toggleComplete,
        isCompletedToday,
        refresh: fetchInitialData
    };
}
