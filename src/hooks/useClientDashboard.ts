import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useCoachSelection } from '@/context/CoachSelectionContext';
import type { Assignment, BoardPost, ClientInfo } from '@/types/database';

export function useClientDashboard() {
    const { profile } = useAuth();
    const { plans, selectedPlanId, setSelectedPlanId } = useCoachSelection();
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [boardPosts, setBoardPosts] = useState<BoardPost[]>([]);
    const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
    const [allAssignmentsMeta, setAllAssignmentsMeta] = useState<Pick<Assignment, 'id' | 'plan_id' | 'type' | 'completed' | 'content_id'>[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.role === 'client') {
            fetchDashboardData();
        } else if (profile) {
            setLoading(false);
        }
    }, [profile]);

    async function fetchDashboardData() {
        setLoading(true);
        try {
            // 1. Get Client Info
            const { data: cInfo, error: cError } = await supabase
                .from('clients_info')
                .select('*')
                .eq('id', profile!.id)
                .maybeSingle();

            if (cError) throw cError;
            setClientInfo(cInfo);

            // 2. Get All Active Subscription Plans (Handled by Context)
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // 3. Get Assignments
            let assignQuery = supabase
                .from('assignments')
                .select('*')
                .eq('client_id', profile!.id)
                .gte('scheduled_date', today);

            const { data: assignData, error: assignError } = await assignQuery
                .order('scheduled_date', { ascending: true });

            if (assignError) throw assignError;
            setAssignments(assignData || []);

            // 3b. Get All Assignments Metadata for Counts (lightweight)
            const { data: metaData, error: metaError } = await supabase
                .from('assignments')
                .select('id, plan_id, type, completed, content_id')
                .eq('client_id', profile!.id);

            if (metaError) throw metaError;
            setAllAssignmentsMeta(metaData || []);

            // 4. Get Board Posts from all coaches the client is subscribed to
            const coachIds = plans?.map(p => p.coach_id) || [];
            // Also include the main coach if it's not in the plans (legacy or fallback)
            if (cInfo?.coach_id && !coachIds.includes(cInfo.coach_id)) {
                coachIds.push(cInfo.coach_id);
            }

            if (coachIds.length > 0) {
                const { data: postData, error: postError } = await supabase
                    .from('board_posts')
                    .select('*, coach:profiles!coach_id(*)')
                    .in('coach_id', coachIds)
                    .gte('expires_at', now.toISOString())
                    .order('created_at', { ascending: false });

                if (postError) throw postError;
                setBoardPosts(postData || []);
            } else {
                setBoardPosts([]);
            }

        } catch (err: any) {
            console.error('Error fetching dashboard data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function toggleAssignment(id: string, currentStatus: boolean) {
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
            setError(err.message);
            return false;
        }
    }

    // Filter logic
    const filteredAssignments = selectedPlanId === 'all'
        ? assignments
        : assignments.filter(a => a.plan_id === selectedPlanId);

    // Board Posts are now always global on dashboard
    // const filteredBoardPosts = ... (removed)

    const filteredAllMeta = selectedPlanId === 'all'
        ? allAssignmentsMeta
        : allAssignmentsMeta.filter(a => a.plan_id === selectedPlanId);

    const stats = {
        habits: new Set(filteredAllMeta.filter(a => a.type === 'habit' && a.content_id).map(a => a.content_id)).size,
        videos: filteredAllMeta.filter(a => a.type === 'video' && !a.completed).length
    };

    return {
        assignments: filteredAssignments,
        boardPosts, // Return all posts
        clientInfo,
        plans,
        selectedPlanId,
        setSelectedPlanId,
        loading,
        error,
        toggleAssignment,
        stats,
        refresh: fetchDashboardData
    };
}
