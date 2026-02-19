import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { BoardPost } from '@/types/database';
import { useAuth } from './useAuth';

export function useBoardPosts(clientId?: string) {
    const { user, profile } = useAuth();
    const [posts, setPosts] = useState<BoardPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPosts = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('board_posts')
                .select(`
                    *,
                    coach:coach_id(full_name, avatar_url)
                `)
                .order('created_at', { ascending: false });

            // Ensure coach sees only their posts, and client sees only targeted posts
            if (profile?.role === 'coach') {
                query = query.eq('coach_id', user.id);
            } else if (profile?.role === 'client') {
                query = query.filter('target_client_ids', 'cs', `{${user.id}}`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setPosts(data as any[]);
        } catch (err: any) {
            console.error('Error fetching board posts:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user && profile) {
            fetchPosts();
        }
    }, [user, profile, clientId]);

    const createPost = async (post: Partial<BoardPost>) => {
        if (!user) return null;
        try {
            const newPost = { ...post, coach_id: user.id };

            const { data, error } = await supabase
                .from('board_posts')
                .insert([newPost])
                .select()
                .single();

            if (error) throw error;
            setPosts(prev => [data, ...prev]);

            // Trigger Push Notification
            supabase.functions.invoke('push-dispatcher', {
                body: {
                    type: 'announcement',
                    coach_id: user.id,
                    target_client_ids: post.target_client_ids,
                    title: post.title || 'Nuovo annuncio in bacheca',
                    body: post.content ? (post.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + (post.content.length > 100 ? '...' : '')) : 'Controlla le novità!',
                    url: '/client/board'
                }
            }).then(({ data, error }) => {
                if (error) console.error('Push Dispatcher Error:', error);
                else console.log('Push Dispatcher Response:', data);
            }).catch(console.error); // Fire and forget

            return data;
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    };

    const updatePost = async (id: string, post: Partial<BoardPost>) => {
        try {
            const { data, error } = await supabase
                .from('board_posts')
                .update(post)
                .eq('id', id)
                .select(); // Remove .single() to avoid 406 if no rows updated

            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error('Post non trovato o non autorizzato.');
            }

            setPosts(prev => prev.map(p => p.id === id ? data[0] : p));
            return data[0];
        } catch (err: any) {
            setError(err.message);
            return null;
        }
    };

    const deletePost = async (id: string) => {
        try {
            const { error } = await supabase
                .from('board_posts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setPosts(prev => prev.filter(p => p.id !== id));
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    };

    return { posts, loading, error, createPost, updatePost, deletePost, refresh: fetchPosts };
}
