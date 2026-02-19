import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Database, HardDrive, Users, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface SystemStats {
    db_size: number;
    storage_size: number;
    user_count: number;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function SystemMonitor() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    const fetchStats = async () => {
        setLoading(true);
        setError(null);
        try {
            // Call the RPC function
            // Note: The return type is a single object { db_size, storage_size, user_count }
            // But RPCs sometimes return it wrapped or as keys.
            const { data, error } = await supabase.rpc('get_system_stats');

            if (error) throw error;

            // Data might be returned as a tuple or object depending on driver version, usually object for 'returns type'
            // Safely cast or assume properties
            if (data) {
                // Adjust based on actual return structure if needed (e.g. data[0] or data)
                const result = Array.isArray(data) ? data[0] : data;
                setStats({
                    db_size: Number(result.db_size || 0),
                    storage_size: Number(result.storage_size || 0),
                    user_count: Number(result.user_count || 0)
                });
            }
            setLastUpdated(new Date());

        } catch (err: any) {
            console.error('Failed to fetch system stats:', err);
            setError(err.message || 'Failed to fetch stats. Did you run the RPC SQL?');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    // Limits (Free Tier)
    const LIMIT_DB = 500 * 1024 * 1024; // 500 MB
    const LIMIT_STORAGE = 1 * 1024 * 1024 * 1024; // 1 GB

    const getUsageColor = (current: number, limit: number) => {
        const percentage = (current / limit) * 100;
        if (percentage > 90) return 'bg-red-500 text-red-500';
        if (percentage > 75) return 'bg-amber-500 text-amber-500';
        return 'bg-primary text-primary';
    };

    const dbPercent = stats ? (stats.db_size / LIMIT_DB) * 100 : 0;
    const storagePercent = stats ? (stats.storage_size / LIMIT_STORAGE) * 100 : 0;

    return (
        <div className="space-y-8">
            {/* Header Controls - Simplified */}
            <div className="flex justify-end">
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50 text-[10px] uppercase font-bold tracking-widest"
                >
                    <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? '...' : 'Aggiorna'}
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}

            {/* Stats Grid - Adjusted for embedded view */}
            <div className="grid grid-cols-1 gap-4">

                {/* Database Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-2xl bg-background/50 border border-white/5 relative overflow-hidden group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                                <Database className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-foreground">Database</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Limit: 500 MB</span>
                    </div>

                    <div className="space-y-3 relative z-10">
                        <div className="flex items-baseline justify-between">
                            <p className="text-xl font-black text-foreground">
                                {stats ? formatBytes(stats.db_size) : '---'}
                            </p>
                            {stats && (
                                <span className={dbPercent > 90 ? 'text-red-400 text-xs font-bold' : 'text-muted-foreground text-xs font-bold'}>
                                    {dbPercent.toFixed(1)}%
                                </span>
                            )}
                        </div>

                        {stats && (
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(dbPercent, 100)}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${getUsageColor(stats.db_size, LIMIT_DB).split(' ')[0]}`}
                                />
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Storage Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="p-5 rounded-2xl bg-background/50 border border-white/5 relative overflow-hidden group"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                                <HardDrive className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-foreground">Storage</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Limit: 1 GB</span>
                    </div>

                    <div className="space-y-3 relative z-10">
                        <div className="flex items-baseline justify-between">
                            <p className="text-xl font-black text-foreground">
                                {stats ? formatBytes(stats.storage_size) : '---'}
                            </p>
                            {stats && (
                                <span className={storagePercent > 90 ? 'text-red-400 text-xs font-bold' : 'text-muted-foreground text-xs font-bold'}>
                                    {storagePercent.toFixed(1)}%
                                </span>
                            )}
                        </div>

                        {stats && (
                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(storagePercent, 100)}%` }}
                                    transition={{ duration: 1, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${getUsageColor(stats.storage_size, LIMIT_STORAGE).split(' ')[0]}`}
                                />
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Users Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="p-5 rounded-2xl bg-background/50 border border-white/5 relative overflow-hidden group"
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/10 text-green-400 rounded-lg">
                                <Users className="h-4 w-4" />
                            </div>
                            <span className="text-sm font-medium text-foreground">Users</span>
                        </div>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-baseline gap-2">
                            <p className="text-xl font-black text-foreground">
                                {stats ? stats.user_count : '---'}
                            </p>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Registrati</span>
                        </div>
                    </div>
                </motion.div>
            </div>



            <div className="text-center text-xs text-muted-foreground/40 mt-12 pb-4">
                Data last updated: {format(lastUpdated, 'HH:mm:ss')}
            </div>
        </div>
    );
}
