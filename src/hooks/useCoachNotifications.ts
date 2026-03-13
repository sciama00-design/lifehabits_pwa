import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { CoachNotification } from '@/types/database';

export function useCoachNotifications() {
    const { profile, user } = useAuth();
    const [notifications, setNotifications] = useState<CoachNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!user || profile?.role !== 'coach') return;
        
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('coach_notifications')
                .select(`
                    *,
                    client:client_id(full_name, avatar_url)
                `)
                .eq('coach_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50); // Get recent notifications

            if (error) throw error;
            
            const notifs = data || [];
            setNotifications(notifs as CoachNotification[]);
            setUnreadCount(notifs.filter(n => !n.is_read).length);
        } catch (err) {
            console.error('Error fetching coach notifications:', err);
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Set up realtime subscription for new notifications
    useEffect(() => {
        if (!user || profile?.role !== 'coach') return;

        const channel = supabase.channel('coach_notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'coach_notifications',
                    filter: `coach_id=eq.${user.id}`
                },
                () => {
                    fetchNotifications(); // Refresh list to get hydrated client profile
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, profile, fetchNotifications]);

    const markAsRead = async (notificationId: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.map(n => 
                n.id === notificationId ? { ...n, is_read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));

            const { error } = await supabase
                .from('coach_notifications')
                .update({ is_read: true })
                .eq('id', notificationId);

            if (error) throw error;
        } catch (err) {
            console.error('Error marking notification as read:', err);
            // Revert on failure
            fetchNotifications(); 
        }
    };

    const markAllAsRead = async () => {
        try {
            if (!user) return;
            
            // Optimistic update
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);

            const { error } = await supabase
                .from('coach_notifications')
                .update({ is_read: true })
                .eq('coach_id', user.id)
                .eq('is_read', false);

            if (error) throw error;
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
            fetchNotifications();
        }
    };

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications
    };
}
