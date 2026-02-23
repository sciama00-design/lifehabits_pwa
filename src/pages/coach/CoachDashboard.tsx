import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useClients } from '@/hooks/useClients';
import CoachBoard from './CoachBoard';
import { Users, AlertTriangle, Sparkles, Bell, TrendingUp, UserX } from 'lucide-react';
import { addDays, isAfter, isBefore, format } from 'date-fns';
import { it } from 'date-fns/locale';
import { GlobalNotificationsManager } from '@/components/coach/GlobalNotificationsManager';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// Nomi maschili italiani comuni che finiscono in -a (eccezioni alla regola)
const MALE_NAMES_ENDING_A = new Set([
    'luca', 'andrea', 'nicola', 'mattia', 'elia', 'enea', 'battista',
    'cosma', 'evangelista', 'gianluca', 'luca', 'joshua', 'noah',
]);

function getGreeting(fullName?: string | null): string {
    if (!fullName) return 'Bentornato';
    const firstName = fullName.split(' ')[0].toLowerCase().trim();
    if (MALE_NAMES_ENDING_A.has(firstName)) return 'Bentornato';
    if (firstName.endsWith('a')) return 'Bentornata';
    return 'Bentornato';
}

export default function CoachDashboard() {
    const { profile } = useAuth();
    const { clients, loading: clientsLoading } = useClients();
    const today = new Date();

    const greeting = getGreeting(profile?.full_name);
    const firstName = profile?.full_name?.split(' ')[0] || '';

    // ─── Extra Stats ──────────────────────────────────────
    const [completionRate, setCompletionRate] = useState<{ completed: number; total: number } | null>(null);

    useEffect(() => {
        if (!profile?.id) return;

        // Today's completion rate across all clients
        const todayStr = format(today, 'yyyy-MM-dd');
        supabase
            .from('assignments')
            .select('id')
            .eq('coach_id', profile.id)
            .eq('scheduled_date', todayStr)
            .then(async ({ data: todayAssignments }) => {
                if (!todayAssignments) return;
                const total = todayAssignments.length;
                if (total === 0) {
                    setCompletionRate({ completed: 0, total: 0 });
                    return;
                }
                const assignmentIds = todayAssignments.map(a => a.id);
                const { count } = await supabase
                    .from('daily_completions')
                    .select('*', { count: 'exact', head: true })
                    .eq('completed_date', todayStr)
                    .in('assignment_id', assignmentIds);

                setCompletionRate({ completed: count || 0, total });
            });
    }, [profile?.id]);

    // Calculate Statistics
    const activeClientsCount = clients.filter(c =>
        c.subscription_end && isAfter(new Date(c.subscription_end), new Date())
    ).length;

    const expiringClientsCount = clients.filter(c => {
        if (!c.subscription_end) return false;
        const endDate = new Date(c.subscription_end);
        const now = new Date();
        const nextWeek = addDays(now, 7);
        return isAfter(endDate, now) && isBefore(endDate, nextWeek);
    }).length;

    const inactiveClientsCount = clients.length - activeClientsCount;

    const ratePercent = completionRate && completionRate.total > 0
        ? Math.round((completionRate.completed / completionRate.total) * 100)
        : null;

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">

            {/* ─── Top Bar — Client-Style Greeting ─────────────────── */}
            <section className="pt-1">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-white/5 pb-4"
                >
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-2.5 w-2.5 text-primary animate-pulse" />
                            <span className="text-[9px] font-bold text-primary uppercase tracking-[0.3em] opacity-80">Coach Dashboard</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-none flex items-center gap-3">
                            {greeting},
                            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
                                {firstName}
                            </span>
                            <span className="inline-block animate-wave origin-[70%_70%]">👋</span>
                        </h1>
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-0.5">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40">Oggi è</p>
                        <p className="text-xs md:text-sm text-foreground font-semibold tracking-tight">
                            {format(today, 'EEEE d MMMM', { locale: it })}
                        </p>
                    </div>
                </motion.div>
            </section>

            {/* ─── Statistics — Gradient Card Grid ──────────────────── */}
            <section className="grid grid-cols-2 gap-3">
                {/* Active Clients */}
                <StatCard
                    delay={0.1}
                    gradientFrom="#059669" gradientTo="#10b981"
                    borderColor="rgba(52,211,153,0.3)"
                    icon={<Users className="h-4 w-4 text-white" />}
                    bgIcon={<Users className="h-12 w-12 text-white" />}
                    label="Clienti Attivi"
                    value={clientsLoading ? '-' : String(activeClientsCount)}
                    subtitle={`su ${clients.length}`}
                />

                {/* Expiring */}
                <StatCard
                    delay={0.15}
                    gradientFrom="#c2410c" gradientTo="#f97316"
                    borderColor="rgba(251,146,60,0.3)"
                    icon={<AlertTriangle className="h-4 w-4 text-white" />}
                    bgIcon={<AlertTriangle className="h-12 w-12 text-white" />}
                    label="In Scadenza (7gg)"
                    value={clientsLoading ? '-' : String(expiringClientsCount)}
                    subtitle="intervenire"
                />

                {/* Inactive Clients */}
                <StatCard
                    delay={0.2}
                    gradientFrom="#475569" gradientTo="#64748b"
                    borderColor="rgba(100,116,139,0.3)"
                    icon={<UserX className="h-4 w-4 text-white" />}
                    bgIcon={<UserX className="h-12 w-12 text-white" />}
                    label="Clienti Inattivi"
                    value={clientsLoading ? '-' : String(inactiveClientsCount)}
                    subtitle={inactiveClientsCount === 1 ? 'senza piano' : 'senza piano'}
                />

                {/* Today's Completion Rate */}
                <StatCard
                    delay={0.25}
                    gradientFrom="#0891b2" gradientTo="#22d3ee"
                    borderColor="rgba(34,211,238,0.3)"
                    icon={<TrendingUp className="h-4 w-4 text-white" />}
                    bgIcon={<TrendingUp className="h-12 w-12 text-white" />}
                    label="Completamento Oggi"
                    value={ratePercent !== null ? `${ratePercent}%` : (completionRate?.total === 0 ? '—' : '-')}
                    subtitle={completionRate ? `${completionRate.completed}/${completionRate.total} attività` : ''}
                />
            </section>

            {/* ─── Board / Announcements Section ───────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                        <Bell className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Bacheca</h3>
                </div>

                <CoachBoard />
            </section>

            {/* ─── Notifications Section ───────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notifiche Programmate</h3>
                </div>

                <GlobalNotificationsManager />
            </section>
        </div>
    );
}


// ─── Reusable Stat Card Component ──────────────────────────────────
function StatCard({ delay, gradientFrom, gradientTo, borderColor, icon, bgIcon, label, value, subtitle }: {
    delay: number;
    gradientFrom: string;
    gradientTo: string;
    borderColor: string;
    icon: React.ReactNode;
    bgIcon: React.ReactNode;
    label: string;
    value: string;
    subtitle: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay }}
            className="relative overflow-hidden group p-5 rounded-[var(--radius-xl)]"
            style={{
                background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                border: `1px solid ${borderColor}`,
            }}
        >
            <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '20px 20px',
            }} />
            <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
                {bgIcon}
            </div>
            <div className="relative flex flex-col h-full justify-between gap-4">
                <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center border border-white/15">
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">{label}</p>
                    <h3 className="text-sm font-bold text-white leading-snug">
                        <span className="text-xl font-extrabold">{value}</span> {subtitle}
                    </h3>
                </div>
            </div>
        </motion.div>
    );
}
