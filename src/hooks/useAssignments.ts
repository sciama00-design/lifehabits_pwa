import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { Assignment } from '@/types/database';

export function useAssignments(clientId: string, selectedPlanId?: string | null) {
    const { profile } = useAuth();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (profile && clientId) {
            fetchAssignments();
        }
    }, [profile, clientId, selectedPlanId]);

    async function fetchAssignments() {
        setLoading(true);
        try {
            let query = supabase
                .from('assignments')
                .select('*')
                .eq('client_id', clientId);

            if (selectedPlanId) {
                query = query.eq('plan_id', selectedPlanId);
            } else {
                query = query.is('plan_id', null);
            }

            const { data, error } = await query
                .order('scheduled_date', { ascending: true });

            if (error) throw error;
            setAssignments(data);
        } catch (err: any) {
            console.error('Error fetching assignments:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function addAssignment(assignment: Omit<Assignment, 'id' | 'created_at' | 'coach_id' | 'client_id' | 'plan_id'>) {
        try {
            setError(null);
            const { data, error } = await supabase
                .from('assignments')
                .insert({
                    ...assignment,
                    coach_id: profile!.id,
                    client_id: clientId,
                    plan_id: selectedPlanId || null,
                })
                .select()
                .single();

            if (error) throw error;
            setAssignments([...assignments, data]);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    async function deleteAssignment(id: string) {
        try {
            const { error } = await supabase
                .from('assignments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setAssignments(assignments.filter(a => a.id !== id));
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    async function updateAssignment(id: string, updates: Partial<Omit<Assignment, 'id' | 'created_at' | 'coach_id' | 'client_id' | 'plan_id'>>) {
        try {
            setError(null);
            const { data, error } = await supabase
                .from('assignments')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            setAssignments(assignments.map(a => a.id === id ? data : a));
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    return { assignments, loading, error, addAssignment, deleteAssignment, updateAssignment, refresh: fetchAssignments };
}
