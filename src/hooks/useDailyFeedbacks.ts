import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { DailyFeedback } from '@/types/database';

export function useDailyFeedbacks() {
    const { profile } = useAuth();
    const [feedbacks, setFeedbacks] = useState<DailyFeedback[]>([]);
    const [loading, setLoading] = useState(false);

    // Get today's date string in YYYY-MM-DD format
    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    // Fetch feedbacks for a specific client (used by both client and coach)
    const fetchFeedbacks = useCallback(async (clientId: string, startDate?: string, endDate?: string) => {
        setLoading(true);
        try {
            let query = supabase
                .from('daily_feedbacks')
                .select('*')
                .eq('client_id', clientId)
                .order('date', { ascending: true });

            if (startDate) query = query.gte('date', startDate);
            if (endDate) query = query.lte('date', endDate);

            const { data, error } = await query;
            if (error) throw error;
            setFeedbacks(data || []);
            return data;
        } catch (err) {
            console.error('Error fetching feedbacks:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Submit a new feedback
    const submitFeedback = useCallback(async (feeling: string, exercisesDone: boolean, summary: string) => {
        if (!profile || profile.role !== 'client') return false;
        
        try {
            const date = getTodayStr();

            // 1. Insert Feedback
            const { data: feedbackData, error: feedbackError } = await supabase
                .from('daily_feedbacks')
                .insert({
                    client_id: profile.id,
                    date: date,
                    feeling,
                    exercises_done: exercisesDone,
                    activities_summary: summary
                })
                .select()
                .single();

            if (feedbackError) throw feedbackError;

            if (feedbackData) {
                setFeedbacks(prev => [...prev.filter(f => f.date !== date), feedbackData]);
            }

            // 2. Fetch Coach ID to send notification
            const { data: coachRel } = await supabase
                .from('client_coaches')
                .select('coach_id')
                .eq('client_id', profile.id)
                .single();

            if (coachRel?.coach_id) {
                // 3. Insert Coach Notification
                const title = 'Nuovo Feedback! 📝';
                const message = `Hai ricevuto un feedback da ${profile.full_name?.split(' ')[0] || 'un cliente'}`;
                await supabase
                    .from('coach_notifications')
                    .insert({
                        coach_id: coachRel.coach_id,
                        client_id: profile.id,
                        title: title,
                        message: message
                    });

                // 4. Trigger Push Notification to Coach
                supabase.functions.invoke('push-dispatcher', {
                    body: {
                        type: 'direct',
                        user_id: coachRel.coach_id,
                        title: 'Nuovo Feedback! 📝',
                        body: message,
                        url: `/coach/clients/${profile.id}`
                    }
                }).catch(err => console.error("Push dispatcher error:", err)); // Fire and forget
            }

            return true;
        } catch (err) {
            console.error('Error submitting daily feedback:', err);
            return false;
        }
    }, [profile]);

    // Get feedback for a specific date
    const getFeedbackForDate = useCallback((dateStr: string) => {
        return feedbacks.find(f => f.date === dateStr);
    }, [feedbacks]);

    return {
        feedbacks,
        loading,
        fetchFeedbacks,
        submitFeedback,
        getFeedbackForDate,
        getTodayStr
    };
}
