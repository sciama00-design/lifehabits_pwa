import { useClientDashboard } from '@/hooks/useClientDashboard';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Bell, Sparkles, Leaf, Play, Wind, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentCard } from '@/components/shared/ContentCard';
import { TextPostModal } from '@/components/shared/TextPostModal';
import { HabitCalendar } from '@/components/shared/HabitCalendar';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import type { BoardPost } from '@/types/database';

// ─── Gradient Block Component ────────────────────────────────────────
interface GradientBlockProps {
    gradientFrom: string;
    gradientTo: string;
    borderColor: string;
    icon: React.ReactNode;
    bgIcon: React.ReactNode;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
}

function GradientBlock({ gradientFrom, gradientTo, borderColor, icon, bgIcon, children, onClick, className = '' }: GradientBlockProps) {
    return (
        <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            className={`relative overflow-hidden group cursor-pointer p-5 rounded-[var(--radius-xl)] ${className}`}
            style={{
                background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                border: `1px solid ${borderColor}`,
            }}
        >
            {/* Dot pattern overlay */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                backgroundSize: '20px 20px',
            }} />
            {/* Background icon */}
            <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
                {bgIcon}
            </div>
            {/* Content */}
            <div className="relative flex flex-col h-full justify-between gap-4">
                <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center border border-white/15">
                    {icon}
                </div>
                {children}
            </div>
        </motion.div>
    );
}

export default function ClientDashboard() {
    const {
        assignments,
        boardPosts,
        loading,
        error,
        toggleAssignment,
        isCompletedToday,
        stats
    } = useClientDashboard();

    const { profile } = useAuth();
    const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const today = new Date();

    const firstName = profile?.full_name?.split(' ')[0] || '';

    const upcomingTasks = assignments.filter(a => new Date(a.scheduled_date) > today).slice(0, 3);

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
    );

    if (error) return (
        <div className="p-10 text-center glass-card mx-6">
            <p className="text-destructive font-medium">Errore: {error}</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20">

            {/* Top Bar */}
            <section className="pt-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Live Well</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                            Ciao{firstName ? ` ${firstName}` : ''}!
                        </h1>
                        <p className="text-[10px] md:text-sm text-muted-foreground font-medium opacity-60">
                            Oggi è {format(today, 'EEEE d MMMM', { locale: it })}
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* ─── Board Announcements (top) ────────────────────── */}
            {boardPosts.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                            <Bell className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dalla Bacheca</h3>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-4 snap-x no-scrollbar">
                        {boardPosts.map(post => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setSelectedPost(post)}
                                className="min-w-[200px] max-w-[200px] snap-center relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform rounded-[var(--radius-xl)]"
                                style={{
                                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                                    border: '1px solid rgba(251,191,36,0.3)',
                                }}
                            >
                                {/* Dot pattern */}
                                <div className="absolute inset-0 opacity-[0.04]" style={{
                                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                                    backgroundSize: '20px 20px',
                                }} />
                                <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
                                    <Bell className="h-10 w-10 text-white" />
                                </div>

                                {post.image_url && (
                                    <img src={post.image_url} alt="" className="w-full h-20 object-cover rounded-t-[var(--radius-xl)]" />
                                )}

                                <div className="relative p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-white text-[8px] font-bold border border-white/15">
                                            {post.coach?.full_name?.charAt(0) || 'C'}
                                        </div>
                                        <span className="text-[9px] font-bold text-white/60 uppercase tracking-tight">{post.coach?.full_name?.split(' ')[0]}</span>
                                    </div>
                                    <h4 className="text-xs font-bold text-white mb-1 line-clamp-2">{post.title}</h4>
                                    <div
                                        className="text-[10px] text-white/60 leading-relaxed line-clamp-2"
                                        dangerouslySetInnerHTML={{ __html: post.content }}
                                    />
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </section>
            )}

            {/* ─── Gradient Blocks Grid ───────────────────────────── */}
            {/* ─── Gradient Blocks Section ────────────────────────── */}
            <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Esplora</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {/* Abitudini (half) */}
                    <Link to="/habits" className="block">
                        <GradientBlock
                            gradientFrom="#059669"
                            gradientTo="#10b981"
                            borderColor="rgba(52,211,153,0.3)"
                            icon={<Leaf className="h-4 w-4 text-white" />}
                            bgIcon={<Leaf className="h-12 w-12 text-white" />}
                        >
                            <div>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                                    Abitudini
                                </p>
                                <h3 className="text-sm font-bold text-white leading-snug">
                                    <span className="text-xl font-extrabold">{stats?.habits || 0}</span> contenuti
                                </h3>
                                <p className="text-[10px] text-white/50 mt-1">
                                    Le tue abitudini
                                </p>
                            </div>
                        </GradientBlock>
                    </Link>

                    {/* Video (half) */}
                    <Link to="/videos" className="block">
                        <GradientBlock
                            gradientFrom="#7c3aed"
                            gradientTo="#8b5cf6"
                            borderColor="rgba(167,139,250,0.3)"
                            icon={<Play className="h-4 w-4 text-white" />}
                            bgIcon={<Play className="h-12 w-12 text-white" />}
                        >
                            <div>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                                    Video
                                </p>
                                <h3 className="text-sm font-bold text-white leading-snug">
                                    <span className="text-xl font-extrabold">{stats?.videos || 0}</span> da guardare
                                </h3>
                                <p className="text-[10px] text-white/50 mt-1">
                                    I tuoi video
                                </p>
                            </div>
                        </GradientBlock>
                    </Link>

                    {/* Calendar Compact Block (full width) */}
                    <div className="col-span-2">
                        <GradientBlock
                            gradientFrom="#1e40af"
                            gradientTo="#3b82f6"
                            borderColor="rgba(96,165,250,0.3)"
                            icon={<Calendar className="h-4 w-4 text-white" />}
                            bgIcon={<Calendar className="h-12 w-12 text-white" />}
                            onClick={() => setCalendarOpen(!calendarOpen)}
                        >
                            <div>
                                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                                    Calendario
                                </p>
                                <h3 className="text-sm font-bold text-white leading-snug">
                                    {format(today, 'd MMMM', { locale: it })}
                                </h3>
                                <p className="text-[10px] text-white/50 mt-1 flex items-center gap-1">
                                    {calendarOpen ? 'Tocca per chiudere' : 'Tocca per aprire'} <ChevronRight className={`h-3 w-3 transition-transform ${calendarOpen ? 'rotate-90' : ''}`} />
                                </p>
                            </div>
                        </GradientBlock>
                    </div>
                </div>

                {/* Calendar Expanded */}
                <AnimatePresence>
                    {calendarOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            <HabitCalendar assignments={assignments} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Breathing Exercise (full width) */}
                <Link to="/breathing" className="block">
                    <GradientBlock
                        gradientFrom="#0d9488"
                        gradientTo="#06b6d4"
                        borderColor="rgba(94,234,212,0.3)"
                        icon={<Wind className="h-4 w-4 text-white" />}
                        bgIcon={<Wind className="h-12 w-12 text-white" />}
                    >
                        <div>
                            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">
                                Respira
                            </p>
                            <h3 className="text-sm font-bold text-white leading-snug">
                                Respiriamo Insieme 🧘
                            </h3>
                            <p className="text-[10px] text-white/50 mt-1">
                                2 min · Box Breathing
                            </p>
                        </div>
                    </GradientBlock>
                </Link>
            </section>

            {/* ─── Upcoming Preview ──────────────────────────────── */}
            {upcomingTasks.length > 0 && (
                <section className="space-y-4 opacity-80">
                    <div className="flex items-center gap-2 px-1">
                        <div className="p-1 rounded-md bg-muted/40 border border-border">
                            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        </div>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Prossimamente</h3>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        {upcomingTasks.map(task => (
                            <ContentCard
                                key={task.id}
                                item={task as any}
                                isCoachView={false}
                                isCompleted={isCompletedToday(task.id)}
                                onToggleComplete={toggleAssignment}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Board Post Modal */}
            <TextPostModal
                isOpen={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                title={selectedPost?.title || ''}
                content={selectedPost?.content || ''}
                author={selectedPost?.coach?.full_name || 'Coach'}
                date={selectedPost ? format(new Date(selectedPost.created_at), 'd MMMM yyyy', { locale: it }) : undefined}
                imageUrl={selectedPost?.image_url}
            />
        </div>
    );
}
