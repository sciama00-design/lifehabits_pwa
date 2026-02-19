import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ContentItem } from '@/types/database';
import { Search, Trash2, FileText, Video, CheckSquare, MessageSquare } from 'lucide-react';

interface ContentItemWithCoach extends ContentItem {
    coach_name?: string;
}

export default function AdminContent() {
    const [content, setContent] = useState<ContentItemWithCoach[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('all');

    const fetchContent = async () => {
        try {
            // Fetch all content
            const { data: contentData, error: contentError } = await supabase
                .from('content_library')
                .select('*, coach:profiles(full_name)')
                .order('created_at', { ascending: false });

            if (contentError) throw contentError;

            // Map and cast
            const formattedContent = contentData.map((item: any) => ({
                ...item,
                coach_name: item.coach?.full_name || 'Unknown Helper'
            }));

            setContent(formattedContent);
        } catch (error) {
            console.error('Error fetching content:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContent();
    }, []);

    const handleDeleteContent = async (id: string, title: string) => {
        if (!confirm(`Are you sure you want to delete "${title}"?`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('content_library')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchContent();
        } catch (error) {
            console.error('Error deleting content:', error);
            alert('Failed to delete content');
        }
    };

    const filteredContent = content.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.coach_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video className="h-5 w-5 text-blue-500" />;
            case 'pdf': return <FileText className="h-5 w-5 text-red-500" />;
            case 'habit': return <CheckSquare className="h-5 w-5 text-green-500" />;
            default: return <MessageSquare className="h-5 w-5 text-gray-500" />;
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Content Management</h1>

            <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 max-w-md">
                    <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                        </div>
                        <input
                            type="text"
                            className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                            placeholder="Search content or coach..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Type Filter */}
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="block w-full sm:w-48 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md"
                >
                    <option value="all">All Types</option>
                    <option value="video">Video</option>
                    <option value="pdf">PDF</option>
                    <option value="habit">Habit</option>
                </select>
            </div>

            {/* Content List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredContent.map((item) => (
                        <li key={item.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                                            {getTypeIcon(item.type)}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-primary-600 truncate">{item.title}</div>
                                            <div className="text-sm text-gray-500">
                                                by {item.coach_name} • {new Date(item.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ml-2 flex-shrink-0 flex items-center">
                                        <button
                                            onClick={() => handleDeleteContent(item.id, item.title)}
                                            className="text-gray-400 hover:text-red-600 p-2 transition-colors"
                                            title="Delete Content"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {filteredContent.length === 0 && !loading && (
                        <li className="px-4 py-8 text-center text-gray-500">
                            No content found.
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}
