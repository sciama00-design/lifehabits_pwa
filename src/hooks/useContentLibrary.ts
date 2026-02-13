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
            // 1. Get content info to check for storage cleanup
            const itemToDelete = content.find(c => c.id === id);
            if (!itemToDelete) return false;

            // 2. Check if the media files are used in ANY assignment (by URL, since content_id is gone)
            // We need to check both link (for video/pdf) and thumbnail_url
            let keepLink = false;
            let keepThumbnail = false;

            if (itemToDelete.link) {
                const { count, error } = await supabase
                    .from('assignments')
                    .select('*', { count: 'exact', head: true })
                    .eq('link', itemToDelete.link);

                if (!error && count && count > 0) {
                    keepLink = true;
                    console.log('Skipping link deletion: used in assignments');
                }
            }

            if (itemToDelete.thumbnail_url) {
                const { count, error } = await supabase
                    .from('assignments')
                    .select('*', { count: 'exact', head: true })
                    .eq('thumbnail_url', itemToDelete.thumbnail_url);

                if (!error && count && count > 0) {
                    keepThumbnail = true;
                    console.log('Skipping thumbnail deletion: used in assignments');
                }
            }

            // 3. Delete from DB
            const { error } = await supabase
                .from('content_library')
                .delete()
                .eq('id', id);

            if (error) throw error;

            // 4. Cleanup Storage if needed AND not used elsewhere
            import('@/lib/storage').then(({ deleteFileFromUrl }) => {
                if (itemToDelete.link && !keepLink) {
                    const isStorageUrl = itemToDelete.link.includes('supabase.co') || itemToDelete.link.includes('/storage/v1/object/public/');
                    if (isStorageUrl) {
                        deleteFileFromUrl(itemToDelete.link).catch(err => console.error('Failed to cleanup file:', err));
                    }
                }
                if (itemToDelete.thumbnail_url && !keepThumbnail) {
                    const isStorageUrl = itemToDelete.thumbnail_url.includes('supabase.co') || itemToDelete.thumbnail_url.includes('/storage/v1/object/public/');
                    if (isStorageUrl) {
                        deleteFileFromUrl(itemToDelete.thumbnail_url).catch(err => console.error('Failed to cleanup thumbnail:', err));
                    }
                }
            });

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
