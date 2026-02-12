import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import type { ContentItem } from '@/types/database';

export function useContentLibrary() {
    const { profile } = useAuth();
    const [content, setContent] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.role === 'coach') {
            fetchContent();
        }
    }, [profile]);

    async function fetchContent() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('content_library')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setContent(data);
        } catch (err: any) {
            console.error('Error fetching content:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function addContent(item: Omit<ContentItem, 'id' | 'created_at' | 'coach_id'>) {
        try {
            setError(null);
            const { data, error } = await supabase
                .from('content_library')
                .insert({
                    ...item,
                    coach_id: profile!.id,
                })
                .select()
                .single();

            if (error) throw error;
            setContent([data, ...content]);
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }
    }

    async function updateContent(id: string, item: Partial<Omit<ContentItem, 'id' | 'created_at' | 'coach_id'>>) {
        try {
            setError(null);

            // 1. Get current item to check for files to delete
            const oldItem = content.find(c => c.id === id);

            const { data, error } = await supabase
                .from('content_library')
                .update(item)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            // 2. Cleanup old files if they were replaced
            if (oldItem) {
                const { deleteFileFromUrl } = await import('@/lib/storage');

                // If link changed and old was a storage file
                if (item.link !== undefined && oldItem.link && item.link !== oldItem.link) {
                    if (oldItem.link.includes('supabase.co')) {
                        deleteFileFromUrl(oldItem.link).catch(err => console.error('Cleanup old link error:', err));
                    }
                }

                // If thumbnail changed and old was a storage file
                if (item.thumbnail_url !== undefined && oldItem.thumbnail_url && item.thumbnail_url !== oldItem.thumbnail_url) {
                    if (oldItem.thumbnail_url.includes('supabase.co')) {
                        deleteFileFromUrl(oldItem.thumbnail_url).catch(err => console.error('Cleanup old thumb error:', err));
                    }
                }
            }

            setContent(content.map(c => c.id === id ? data : c));
            return true;
        } catch (err: any) {
            setError(err.message);
            return false;
        }

    }

    async function deleteContent(id: string) {
        try {
            // 1. Check if used in assignments
            const { count, error: countError } = await supabase
                .from('assignments')
                .select('*', { count: 'exact', head: true })
                .eq('content_id', id);

            if (countError) throw countError;

            if (count && count > 0) {
                throw new Error(`Impossibile eliminare: questo contenuto è utilizzato in ${count} assegnazioni.`);
            }

            // 2. Get content info for storage cleanup
            const itemToDelete = content.find(c => c.id === id);

            // 3. Delete from DB
            const { error } = await supabase
                .from('content_library')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // 4. Cleanup Storage if needed
            if (itemToDelete?.link || itemToDelete?.thumbnail_url) {
                import('@/lib/storage').then(({ deleteFileFromUrl }) => {
                    if (itemToDelete.link) {
                        const isStorageUrl = itemToDelete.link.includes('supabase.co') || itemToDelete.link.includes('/storage/v1/object/public/');
                        if (isStorageUrl) {
                            deleteFileFromUrl(itemToDelete.link!).catch(err => console.error('Failed to cleanup file:', err));
                        }
                    }
                    if (itemToDelete.thumbnail_url) {
                        const isStorageUrl = itemToDelete.thumbnail_url.includes('supabase.co') || itemToDelete.thumbnail_url.includes('/storage/v1/object/public/');
                        if (isStorageUrl) {
                            deleteFileFromUrl(itemToDelete.thumbnail_url!).catch(err => console.error('Failed to cleanup thumbnail:', err));
                        }
                    }
                });
            }

            setContent(content.filter(c => c.id !== id));
            return true;
        } catch (err: any) {
            console.error('Delete error:', err);
            setError(err.message);
            setTimeout(() => setError(null), 3000);
            return false;
        }
    }

    const clearError = () => setError(null);

    return { content, loading, error, addContent, updateContent, deleteContent, refresh: fetchContent, profile, clearError };
}
