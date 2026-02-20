import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { DailyCompletion } from '@/types/database';

/**
 * Read-only hook that fetches daily_completions for a specific client.
 * Intended for coach use — does NOT expose any toggle/mutation.
 */
export function useClientCompletions(clientId: string) {
    const [completions, setCompletions] = useState<DailyCompletion[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchCompletions = useCallback(async (startDate: string, endDate: string) => {
        if (!clientId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('daily_completions')
                .select('*')
                .eq('client_id', clientId)
                .gte('completed_date', startDate)
                .lte('completed_date', endDate)
                .order('completed_date', { ascending: true });

            if (error) throw error;
            setCompletions(data || []);
        } catch (err) {
            console.error('Error fetching client completions:', err);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    const getCompletionsForDate = useCallback((date: string) => {
        return completions.filter(c => c.completed_date === date);
    }, [completions]);

    const getCompletionCountByDate = useCallback(() => {
        const counts: Record<string, number> = {};
        completions.forEach(c => {
            counts[c.completed_date] = (counts[c.completed_date] || 0) + 1;
        });
        return counts;
    }, [completions]);

    return {
        loading,
        fetchCompletions,
        getCompletionsForDate,
        getCompletionCountByDate,
    };
}
