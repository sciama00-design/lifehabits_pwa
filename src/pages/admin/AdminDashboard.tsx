import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, UserCog, Activity } from 'lucide-react';

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        coaches: 0,
        clients: 0,
        activeSubscriptions: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                // Get counts
                const { count: coachesCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'coach');

                const { count: clientsCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'client');

                const { count: subsCount } = await supabase
                    .from('subscription_plans')
                    .select('*', { count: 'exact', head: true })
                    .gte('end_date', new Date().toISOString());

                setStats({
                    coaches: coachesCount || 0,
                    clients: clientsCount || 0,
                    activeSubscriptions: subsCount || 0
                });
            } catch (error) {
                console.error('Error fetching admin stats:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    if (loading) {
        return <div className="p-8">Loading stats...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {/* Coaches Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <UserCog className="h-6 w-6 text-gray-400" aria-hidden="true" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Coaches</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats.coaches}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Clients Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Users className="h-6 w-6 text-gray-400" aria-hidden="true" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats.clients}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Active Subscriptions Card */}
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Activity className="h-6 w-6 text-gray-400" aria-hidden="true" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">Active User Plans</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats.activeSubscriptions}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
