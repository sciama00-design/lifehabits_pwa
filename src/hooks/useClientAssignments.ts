import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useCoachSelection } from '@/context/CoachSelectionContext';
import type { Assignment } from '@/types/database';

export function useClientAssignments(type?: 'habit' | 'video' | 'pdf') {
    const { profile } = useAuth();
    const { selectedPlanId, setSelectedPlanId, plans } = useCoachSelection();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            // 1. Fetch Assignments (Plans handled by context)
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
        } catch (err: any) {
            console.error('Error fetching client assignments:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function toggleComplete(id: string, currentStatus: boolean) {
        try {
            const { error } = await supabase
                .from('assignments')
                .update({ completed: !currentStatus })
                .eq('id', id)
                .eq('client_id', profile!.id);

            if (error) throw error;

            setAssignments(assignments.map(a =>
                a.id === id ? { ...a, completed: !currentStatus } : a
            ));
            return true;
        } catch (err: any) {
            console.error('Error toggling assignment:', err);
            return false;
        }
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
        refresh: fetchInitialData
    };
}
