import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { DailyCompletion } from '@/types/database';

export function useDailyCompletions() {
    const { profile } = useAuth();
    const [completions, setCompletions] = useState<DailyCompletion[]>([]);
    const [loading, setLoading] = useState(false);

    // Get today's date string in YYYY-MM-DD format
    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    // Fetch completions for a date range (e.g., full month)
    const fetchCompletions = useCallback(async (startDate: string, endDate: string) => {
        if (!profile) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('daily_completions')
                .select('*')
                .eq('client_id', profile.id)
                .gte('completed_date', startDate)
                .lte('completed_date', endDate)
                .order('completed_date', { ascending: true });

            if (error) throw error;
            setCompletions(data || []);
        } catch (err) {
            console.error('Error fetching daily completions:', err);
        } finally {
            setLoading(false);
        }
    }, [profile]);

    // Toggle completion for a specific assignment on a specific date (default: today)
    const toggleCompletion = useCallback(async (assignmentId: string, date?: string) => {
        if (!profile) return false;
        const targetDate = date || getTodayStr();

        try {
            // Check if already completed for this date
            const existing = completions.find(
                c => c.assignment_id === assignmentId && c.completed_date === targetDate
            );

            if (existing) {
                // Remove completion (unchecking)
                const { error } = await supabase
                    .from('daily_completions')
                    .delete()
                    .eq('id', existing.id);

                if (error) throw error;
                setCompletions(prev => prev.filter(c => c.id !== existing.id));
            } else {
                // Add completion (checking)
                const { data, error } = await supabase
                    .from('daily_completions')
                    .insert({
                        client_id: profile.id,
                        assignment_id: assignmentId,
                        completed_date: targetDate
                    })
                    .select()
                    .single();

                if (error) throw error;
                if (data) {
                    setCompletions(prev => [...prev, data]);
                }
            }
            return true;
        } catch (err) {
            console.error('Error toggling daily completion:', err);
            return false;
        }
    }, [profile, completions]);

    // Check if an assignment is completed for today
    const isCompletedToday = useCallback((assignmentId: string) => {
        const today = getTodayStr();
        return completions.some(
            c => c.assignment_id === assignmentId && c.completed_date === today
        );
    }, [completions]);

    // Check if an assignment is completed for a specific date
    const isCompletedOnDate = useCallback((assignmentId: string, date: string) => {
        return completions.some(
            c => c.assignment_id === assignmentId && c.completed_date === date
        );
    }, [completions]);

    // Get completions for a specific date
    const getCompletionsForDate = useCallback((date: string) => {
        return completions.filter(c => c.completed_date === date);
    }, [completions]);

    // Get completion count per day (for calendar heatmap)
    const getCompletionCountByDate = useCallback(() => {
        const counts: Record<string, number> = {};
        completions.forEach(c => {
            counts[c.completed_date] = (counts[c.completed_date] || 0) + 1;
        });
        return counts;
    }, [completions]);

    // Load today's completions on mount
    useEffect(() => {
        if (profile) {
            const today = getTodayStr();
            fetchCompletions(today, today);
        }
    }, [profile]);

    return {
        completions,
        loading,
        fetchCompletions,
        toggleCompletion,
        isCompletedToday,
        isCompletedOnDate,
        getCompletionsForDate,
        getCompletionCountByDate,
        getTodayStr
    };
}
