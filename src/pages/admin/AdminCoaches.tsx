import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { Plus, Search, Trash2 } from 'lucide-react';
import { CreateCoachModal } from '@/components/admin/CreateCoachModal';

export default function AdminCoaches() {
    const [coaches, setCoaches] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCoaches = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'coach')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCoaches(data || []);
        } catch (error) {
            console.error('Error fetching coaches:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteCoach = async (coachId: string, coachName: string) => {
        if (!confirm(`Are you sure you want to delete coach "${coachName}"? This will delete ALL their clients, content, and data. This action cannot be undone.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', coachId);

            if (error) throw error;

            // Refresh list
            fetchCoaches();
        } catch (error) {
            console.error('Error deleting coach:', error);
            alert('Failed to delete coach');
        }
    };

    useEffect(() => {
        fetchCoaches();
    }, []);

    const filteredCoaches = coaches.filter(coach =>
        coach.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coach.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Coaches</h1>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                    <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                    New Coach
                </button>
            </div>

            {/* Search */}
            <div className="max-w-md">
                <div className="relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                        type="text"
                        className="focus:ring-primary-500 focus:border-primary-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                        placeholder="Search coaches..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Coaches List */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                    {filteredCoaches.map((coach) => (
                        <li key={coach.id}>
                            <div className="px-4 py-4 sm:px-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10">
                                            {coach.avatar_url ? (
                                                <img className="h-10 w-10 rounded-full" src={coach.avatar_url} alt="" />
                                            ) : (
                                                <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                                                    <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                                        <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                                                    </svg>
                                                </span>
                                            )}
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-primary-600 truncate">{coach.full_name || 'No Name'}</div>
                                            <div className="text-sm text-gray-500">{coach.email}</div>
                                        </div>
                                    </div>
                                    <div className="ml-2 flex-shrink-0 flex items-center gap-4">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                            Active
                                        </span>
                                        <button
                                            onClick={() => handleDeleteCoach(coach.id, coach.full_name || 'Coach')}
                                            className="text-red-600 hover:text-red-900 p-2"
                                            title="Delete Coach"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                    {filteredCoaches.length === 0 && !loading && (
                        <li className="px-4 py-8 text-center text-gray-500">
                            No coaches found.
                        </li>
                    )}
                </ul>
            </div>

            {/* Create Coach Modal */}
            {isCreateModalOpen && (
                <CreateCoachModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        fetchCoaches();
                        setIsCreateModalOpen(false);
                    }}
                />
            )}
        </div>
    );
}
