import { useClientDashboard } from '@/hooks/useClientDashboard';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { Bell, Sparkles, Leaf, Play, Wind } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ContentCard } from '@/components/shared/ContentCard';
import { MediaViewer } from '@/components/shared/MediaViewer';
import { TextPostModal } from '@/components/shared/TextPostModal';
import { motion } from 'framer-motion';
import { useState } from 'react';
import type { BoardPost } from '@/types/database';

export default function ClientDashboard() {
    const {
        assignments,
        boardPosts,
        loading,
        error,
        toggleAssignment,
        stats
    } = useClientDashboard();

    const { profile } = useAuth();
    const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
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
        <div className="max-w-5xl mx-auto space-y-10 pb-20">

            {/* Top Bar with Plan Selector */}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-10">
                    {/* Board Announcements */}
                    {boardPosts.length > 0 && (
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                                        <Bell className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Dalla Bacheca</h3>
                                </div>
                            </div>

                            <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
                                {boardPosts.map(post => (
                                    <motion.div
                                        key={post.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        whileInView={{ opacity: 1, scale: 1 }}
                                        onClick={() => setSelectedPost(post)}
                                        className="min-w-[260px] max-w-[260px] glass-card p-5 snap-center relative overflow-hidden group shadow-xl cursor-pointer active:scale-[0.98] transition-transform"
                                    >
                                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Bell className="h-12 w-12" />
                                        </div>
                                        {post.image_url && (
                                            <img src={post.image_url} alt="" className="w-full h-24 object-cover rounded-xl mb-4 border border-border" />
                                        )}
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[8px] font-bold border border-primary/10">
                                                {post.coach?.full_name?.charAt(0) || 'C'}
                                            </div>
                                            <span className="text-[10px] font-bold text-primary/60 uppercase tracking-tight">{post.coach?.full_name?.split(' ')[0]}</span>
                                        </div>
                                        <h4 className="text-sm font-bold text-foreground mb-2 line-clamp-1">{post.title}</h4>
                                        <div
                                            className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 mb-1 prose dark:prose-invert prose-xs"
                                            dangerouslySetInnerHTML={{ __html: post.content }}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Upcoming Preview */}
                    {upcomingTasks.length > 0 && (
                        <section className="space-y-4 opacity-80">
                            <div className="flex items-center gap-2 px-1">
                                <div className="p-1 rounded-md bg-muted/40 border border-border">
                                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                                </div>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Prossimamente</h3>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                                {upcomingTasks.map(task => (
                                    <ContentCard
                                        key={task.id}
                                        item={task as any}
                                        isCoachView={false}
                                        isCompleted={task.completed}
                                        onToggleComplete={toggleAssignment}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <div className="space-y-6">
                    {/* Client Stats - Habits & Videos */}
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
                        <Link to="/habits" className="block">
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="glass-card p-5 h-full relative overflow-hidden group cursor-pointer border border-primary/10"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Leaf className="h-12 w-12 text-primary" />
                                </div>
                                <div className="flex flex-col h-full justify-between gap-4">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                                        <Leaf className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">
                                            Abitudini
                                        </p>
                                        <h3 className="text-sm font-medium text-foreground leading-snug">
                                            Hai <span className="text-xl font-bold text-primary">{stats?.habits || 0}</span> contenuti in abitudini
                                        </h3>
                                    </div>
                                </div>
                            </motion.div>
                        </Link>

                        <Link to="/videos" className="block">
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="glass-card p-5 h-full relative overflow-hidden group cursor-pointer border border-primary/10"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Play className="h-12 w-12 text-primary" />
                                </div>
                                <div className="flex flex-col h-full justify-between gap-4">
                                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/10">
                                        <Play className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">
                                            Video
                                        </p>
                                        <h3 className="text-sm font-medium text-foreground leading-snug">
                                            Hai <span className="text-xl font-bold text-primary">{stats?.videos || 0}</span> video da guardare
                                        </h3>
                                    </div>
                                </div>
                            </motion.div>
                        </Link>

                        {/* Breathing Exercise CTA */}
                        <Link to="/breathing" className="block">
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="relative overflow-hidden group cursor-pointer p-5 h-full rounded-[var(--radius-xl)]"
                                style={{
                                    background: 'linear-gradient(135deg, #059669, #0d9488)',
                                    border: '1px solid rgba(52,211,153,0.3)',
                                }}
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
                                    <Wind className="h-12 w-12 text-white" />
                                </div>
                                <div className="absolute inset-0 opacity-[0.04]" style={{
                                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                                    backgroundSize: '20px 20px',
                                }} />
                                <div className="relative flex flex-col h-full justify-between gap-4">
                                    <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center border border-white/15">
                                        <Wind className="h-4 w-4 text-white" />
                                    </div>
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
                                </div>
                            </motion.div>
                        </Link>
                    </section>
                </div>
            </div>

            {/* Board Post Modal */}
            {selectedPost?.image_url ? (
                <MediaViewer
                    isOpen={!!selectedPost}
                    onClose={() => setSelectedPost(null)}
                    type="post"
                    url={selectedPost.image_url}
                    title={selectedPost.title}
                    description={selectedPost.content}
                />
            ) : (
                <TextPostModal
                    isOpen={!!selectedPost}
                    onClose={() => setSelectedPost(null)}
                    title={selectedPost?.title || ''}
                    content={selectedPost?.content || ''}
                    author={selectedPost?.coach?.full_name || 'Coach'}
                    date={selectedPost ? format(new Date(selectedPost.created_at), 'd MMMM yyyy', { locale: it }) : undefined}
                />
            )}
        </div>
    );
}
