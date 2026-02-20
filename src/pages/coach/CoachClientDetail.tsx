import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useAssignments } from '@/hooks/useAssignments';
import { useClients } from '@/hooks/useClients';
import { useContentLibrary } from '@/hooks/useContentLibrary';
import { useBoardPosts } from '@/hooks/useBoardPosts';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef } from 'react';
import { format, addDays, addWeeks, addMonths } from 'date-fns';
import { it } from 'date-fns/locale';
import {
    Trash2,
    ArrowLeft,
    Plus,
    User,
    X,
    MessageSquare,
    Search,
    UserPlus,
    Users,
    Video,
    ChevronDown,
    Pencil,
    LayoutGrid,
    Calendar,
    CalendarDays,
    Leaf,
    Check,
    Bell
} from 'lucide-react';
import { ClientNotificationsManager } from '@/components/coach/ClientNotificationsManager';
import { CoachHabitCalendar } from '@/components/coach/CoachHabitCalendar';
import clsx from 'clsx';
import type { ContentData } from '@/components/editor/ContentEditorCard';
import { ContentEditorCard } from '@/components/editor/ContentEditorCard';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { MediaPreview } from '@/components/editor/MediaPreview';
import { ContentCard } from '@/components/shared/ContentCard';
import { supabase } from '@/lib/supabase';
import type { ContentItem, Profile } from '@/types/database';

const safeFormat = (date: string | null | undefined, formatStr: string) => {
    if (!date) return '-';
    try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return format(d, formatStr, { locale: it });
    } catch {
        return '-';
    }
};

type Tab = 'anagrafica' | 'bacheca' | 'abitudini' | 'video' | 'notifiche' | 'calendario';

export default function CoachClientDetail() {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const { profile } = useAuth();
    const { isNavVisible = true } = useOutletContext<{ isNavVisible: boolean }>() || {};

    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

    // Data Hooks
    const { clients } = useClients();
    const { assignments, addAssignment, deleteAssignment, updateAssignment, refresh: refreshAssignments } = useAssignments(clientId || '', selectedPlanId);
    const { content: libraryContent } = useContentLibrary();
    const { posts, createPost, deletePost, refresh: refreshPosts } = useBoardPosts(clientId);
    const {
        plans,
        createPlan,
        updatePlan,
        deletePlan: removePlan,
        refresh: refreshPlans
    } = useSubscriptionPlans(clientId);

    const {
        linkColleague,
        unlinkColleague,
        fetchClientCoaches,
        searchCoaches
    } = useClients();

    // Local State
    const [activeTab, setActiveTab] = useState<Tab>('anagrafica');
    const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
    const [isPostModalOpen, setIsPostModalOpen] = useState(false);
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<any>(null);
    const [editingAssignment, setEditingAssignment] = useState<any>(null);
    const [selectedLibraryItem, setSelectedLibraryItem] = useState<ContentItem | null>(null);
    const [viewMode, setViewMode] = useState<'create' | 'library'>('create');
    const [planEndMode, setPlanEndMode] = useState<'date' | 'duration'>('date');
    const [durationAmount, setDurationAmount] = useState<number>(4);
    const [durationUnit, setDurationUnit] = useState<'days' | 'weeks' | 'months'>('weeks');
    const [hasSetDefaultPlan, setHasSetDefaultPlan] = useState(false);

    // UI State for custom dropdown
    const [isPlanFilterOpen, setIsPlanFilterOpen] = useState(false);
    const planFilterRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (planFilterRef.current && !planFilterRef.current.contains(event.target as Node)) {
                setIsPlanFilterOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (plans.length > 0 && !hasSetDefaultPlan) {
            const latestPlan = [...plans].sort((a, b) => {
                const dateA = a.end_date ? new Date(a.end_date).getTime() : 0;
                const dateB = b.end_date ? new Date(b.end_date).getTime() : 0;
                return dateB - dateA;
            })[0];
            if (latestPlan) {
                setSelectedPlanId(latestPlan.id);
                setHasSetDefaultPlan(true);
            }
        }
    }, [plans, hasSetDefaultPlan]);

    const client = clients.find(c => c.id === clientId);
    const habits = assignments.filter(a => a.type === 'habit');
    const videos = assignments.filter(a => a.type === 'video');

    if (!clientId) return <div className="p-8 text-center text-muted-foreground animate-pulse">Errore: ID Cliente mancante</div>;
    if (!client) return <div className="p-8 text-center text-muted-foreground animate-pulse font-medium">Caricamento cliente...</div>;

    const handleAssignContent = async (data: ContentData) => {
        if (editingAssignment) {
            await updateAssignment(editingAssignment.id, {
                title: data.title,
                description: data.description,
                link: data.link || null,
                thumbnail_url: data.thumbnail_url || null,
                type: data.type === 'video' ? 'video' : 'habit',
            });
        } else {
            await addAssignment({
                title: data.title,
                description: data.description,
                link: data.link || null,
                thumbnail_url: data.thumbnail_url || null,
                type: data.type === 'video' ? 'video' : 'habit',
                scheduled_date: format(new Date(), 'yyyy-MM-dd'),
                completed: false,
            });
        }
        setIsAssignmentModalOpen(false);
        setEditingAssignment(null);
        refreshAssignments();
        setTimeout(() => {
            setSelectedLibraryItem(null);
            setViewMode('create');
            setEditingAssignment(null);
        }, 500);
    };

    const handleCreatePost = async (data: ContentData) => {
        await createPost({
            title: data.title,
            content: data.description,
            image_url: data.thumbnail_url || data.link || null,
            target_client_ids: [clientId],
        });
        setIsPostModalOpen(false);
        refreshPosts();
    };

    const handleSavePlan = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('name') as string;
        const startDate = formData.get('start_date') as string;
        const endDate = formData.get('end_date') as string;
        const description = formData.get('description') as string;

        let finalEndDate = endDate;
        if (planEndMode === 'duration') {
            const start = startDate ? new Date(startDate) : new Date();
            let end: Date;
            if (durationUnit === 'days') end = addDays(start, durationAmount);
            else if (durationUnit === 'weeks') end = addWeeks(start, durationAmount);
            else end = addMonths(start, durationAmount);
            finalEndDate = format(end, 'yyyy-MM-dd');
        }

        if (editingPlan) {
            await updatePlan(editingPlan.id, { name, start_date: startDate, end_date: finalEndDate, description });
        } else {
            await createPlan(name, description, clientId, startDate, finalEndDate);
        }
        setIsPlanModalOpen(false);
        setEditingPlan(null);
        refreshPlans();
    };

    const filteredLibrary = libraryContent.filter(item => {
        if (activeTab === 'video') return item.type === 'video';
        // For 'abitudini', include both habits and pdfs
        return item.type === 'habit' || item.type === 'pdf';
    });

    return (
        <div className="min-h-screen bg-background pb-20 sm:pb-24">
            {/* Scrollable "Global" Header for this page */}
            <div className="md:hidden flex h-16 items-center justify-between px-6 bg-background/80 backdrop-blur-xl border-b border-border">
                <h1 className="text-lg font-bold tracking-tight">
                    Life<span className="text-primary italic">Habits</span>
                </h1>
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                    {profile?.full_name?.charAt(0) || 'C'}
                </div>
            </div>

            {/* Mobile-Optimized Header - Sticky */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border safe-top">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button
                        onClick={() => navigate('/coach/clients')}
                        className="rounded-xl bg-card/50 border border-border p-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="text-center">
                        <h1 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Cliente
                        </h1>
                        <p className="text-sm font-bold text-foreground">
                            {client?.profiles?.full_name}
                        </p>
                    </div>
                    <div className="w-9" /> {/* Spacer for centering */}
                </div>

                {/* Mobile Navigation Tabs - Scrollable */}
                <div className="px-2 pb-2">
                    <div className="flex gap-1 overflow-x-auto no-scrollbar scroll-smooth snap-x">
                        <TabButton active={activeTab === 'anagrafica'} onClick={() => setActiveTab('anagrafica')} icon={<User className="h-4 w-4" />} label="Profilo" />
                        <TabButton active={activeTab === 'bacheca'} onClick={() => setActiveTab('bacheca')} icon={<MessageSquare className="h-4 w-4" />} label="Bacheca" />
                        <TabButton active={activeTab === 'abitudini'} onClick={() => setActiveTab('abitudini')} icon={<Leaf className="h-4 w-4" />} label="Abitudini" />
                        <TabButton active={activeTab === 'video'} onClick={() => setActiveTab('video')} icon={<Video className="h-4 w-4" />} label="Video" />
                        <TabButton active={activeTab === 'calendario'} onClick={() => setActiveTab('calendario')} icon={<CalendarDays className="h-4 w-4" />} label="Calendario" />
                        <TabButton active={activeTab === 'notifiche'} onClick={() => setActiveTab('notifiche')} icon={<Bell className="h-4 w-4" />} label="Notifiche" />
                    </div>
                </div>
            </div>

            <div className="px-4 py-6 space-y-6 container mx-auto max-w-5xl">
                <AnimatePresence mode="wait">
                    {activeTab === 'anagrafica' && (
                        <motion.div
                            key="anagrafica"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Profile Info Card */}
                            <div className="glass-card p-5 space-y-4 rounded-3xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-lg font-bold text-foreground">Dettagli</h2>
                                </div>

                                <div className="space-y-3">
                                    <div className="bg-muted/30 p-4 rounded-2xl">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Nome</label>
                                        <div className="text-foreground font-semibold text-lg">{client.profiles?.full_name}</div>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-2xl">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Email</label>
                                        <div className="text-foreground font-medium">{client.profiles?.email}</div>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-2xl">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Iscritto dal</label>
                                        <div className="text-muted-foreground font-medium">{safeFormat(client.created_at, 'd MMM yyyy')}</div>
                                    </div>
                                </div>

                                <button
                                    onClick={() => {
                                        if (confirm('Sei sicuro di voler eliminare questo utente?')) {
                                            supabase.from('profiles').delete().eq('id', clientId).then(() => navigate('/coach/clients'));
                                        }
                                    }}
                                    className="w-full mt-2 py-3 rounded-xl bg-destructive/10 text-xs font-black uppercase tracking-widest text-destructive hover:bg-destructive hover:text-white transition-colors border border-destructive/20"
                                >
                                    Elimina Utente
                                </button>
                            </div>

                            {/* Plans Card */}
                            <div className="glass-card p-5 space-y-4 rounded-3xl">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                        <h2 className="text-lg font-bold text-foreground">Piani</h2>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingPlan(null);
                                            setIsPlanModalOpen(true);
                                        }}
                                        className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20"
                                    >
                                        <Plus className="h-5 w-5" />
                                    </button>
                                </div>

                                {plans.length === 0 ? (
                                    <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-2xl">
                                        <p className="text-muted-foreground text-xs font-medium">Nessun piano attivo</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {plans.map(plan => (
                                            <div key={plan.id} className="p-4 rounded-2xl bg-card border border-border relative group active:scale-[0.98] transition-transform">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h3 className="font-bold text-foreground text-base">{plan.name}</h3>
                                                        <p className="text-[10px] text-muted-foreground font-medium line-clamp-1">{plan.description}</p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingPlan(plan);
                                                                setIsPlanModalOpen(true);
                                                            }}
                                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-muted/50 text-muted-foreground"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => removePlan(plan.id)}
                                                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 pt-3 border-t border-border mt-3">
                                                    <span>Inizio: <span className="text-foreground">{safeFormat(plan.start_date, 'dd/MM/yy')}</span></span>
                                                    <span>Fine: <span className="text-foreground">{safeFormat(plan.end_date, 'dd/MM/yy')}</span></span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Colleagues Manager */}
                            <div className="glass-card p-5 space-y-4 rounded-3xl">
                                <ColleagueManager
                                    clientId={clientId}
                                    fetchColleagues={fetchClientCoaches}
                                    linkColleague={linkColleague}
                                    unlinkColleague={unlinkColleague}
                                    searchCoaches={searchCoaches}
                                />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'bacheca' && (
                        <motion.div
                            key="bacheca"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            {/* Mobile "New Post" Button - only visible here if we want an inline composer, otherwise FAB handles it */}
                            <div className="hidden sm:block mb-6">
                                <ContentEditorCard
                                    onSave={handleCreatePost}
                                    saveLabel="Pubblica"
                                    showTitle={true}
                                    initialData={{ type: 'post' }}
                                />
                            </div>

                            {posts.length === 0 ? (
                                <div className="text-center py-20 px-6 rounded-3xl bg-muted/10 border border-dashed border-border flex flex-col items-center gap-4">
                                    <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                                        <MessageSquare className="h-8 w-8" />
                                    </div>
                                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nessun messaggio.</p>
                                </div>
                            ) : (
                                posts.map(post => (
                                    <div key={post.id} className="glass-card border-border overflow-hidden shadow-lg rounded-3xl">
                                        <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black border border-primary/20 text-sm">
                                                    {post.coach?.full_name?.charAt(0) || 'C'}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-foreground text-base leading-tight">{post.title}</div>
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mt-0.5">
                                                        {safeFormat(post.created_at, 'd MMM, HH:mm')}
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => deletePost(post.id)}
                                                className="h-9 w-9 flex items-center justify-center rounded-xl bg-destructive/10 text-destructive/50 hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <div className="p-5 space-y-4">
                                            <div className="text-foreground/80 text-sm font-medium leading-relaxed">
                                                <RichTextEditor value={post.content} onChange={() => { }} editable={false} />
                                            </div>
                                            {post.image_url && (
                                                <div className="rounded-2xl overflow-hidden border border-border shadow-lg">
                                                    <MediaPreview url={post.image_url} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </motion.div>
                    )}

                    {(activeTab === 'abitudini' || activeTab === 'video') && (
                        <motion.div
                            key="assignments"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Filter Section */}
                            {/* Filter Section */}
                            <div className="glass-card p-4 rounded-3xl flex items-center gap-4 sticky top-[130px] z-30 shadow-xl border-border">
                                <div className="h-10 w-10 rounded-full bg-muted/30 flex items-center justify-center text-primary border border-border shrink-0">
                                    <LayoutGrid className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0 relative" ref={planFilterRef}>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Filtra Piano</label>

                                    <button
                                        onClick={() => setIsPlanFilterOpen(!isPlanFilterOpen)}
                                        className="w-full flex items-center justify-between text-left group"
                                    >
                                        <span className="text-sm font-bold text-foreground truncate block">
                                            {selectedPlanId ? plans.find(p => p.id === selectedPlanId)?.name : 'Tutti (Libero)'}
                                        </span>
                                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 group-hover:text-primary ${isPlanFilterOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    <AnimatePresence>
                                        {isPlanFilterOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                transition={{ duration: 0.2 }}
                                                className="absolute left-0 right-0 top-full mt-4 bg-popover/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl z-50 overflow-hidden p-1.5 min-w-[200px]"
                                            >
                                                <button
                                                    onClick={() => {
                                                        setSelectedPlanId(null);
                                                        setIsPlanFilterOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${!selectedPlanId ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                                >
                                                    <div className={`h-6 w-6 rounded-full flex items-center justify-center ${!selectedPlanId ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                                                        <LayoutGrid className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left">Tutti (Libero)</span>
                                                    {!selectedPlanId && <Check className="h-3.5 w-3.5" />}
                                                </button>

                                                {plans.map(plan => {
                                                    const isSelected = selectedPlanId === plan.id;
                                                    return (
                                                        <button
                                                            key={plan.id}
                                                            onClick={() => {
                                                                setSelectedPlanId(plan.id);
                                                                setIsPlanFilterOpen(false);
                                                            }}
                                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isSelected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                                        >
                                                            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary-foreground/20' : 'bg-muted'}`}>
                                                                <span className="text-[9px] font-bold">{plan.name.charAt(0)}</span>
                                                            </div>
                                                            <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left truncate">{plan.name}</span>
                                                            {isSelected && <Check className="h-3.5 w-3.5" />}
                                                        </button>
                                                    )
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Content Grid */}
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {(activeTab === 'abitudini' ? habits : videos).length === 0 ? (
                                    <div className="col-span-full text-center py-20 px-6 rounded-3xl bg-muted/10 border border-dashed border-border flex flex-col items-center gap-4">
                                        <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                                            <Search className="h-8 w-8" />
                                        </div>
                                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nessun contenuto.</p>
                                    </div>
                                ) : (
                                    (activeTab === 'abitudini' ? habits : videos).map(item => (
                                        <ContentCard
                                            key={item.id}
                                            item={item as any}
                                            onEdit={(id) => {
                                                const itemToEdit = (activeTab === 'abitudini' ? habits : videos).find(a => a.id === id);
                                                setEditingAssignment(itemToEdit);
                                                setViewMode('create');
                                                setIsAssignmentModalOpen(true);
                                            }}
                                            onDelete={() => deleteAssignment(item.id)}
                                            isCoachView={true}
                                            isCompleted={item.completed}
                                        />
                                    ))
                                )}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'calendario' && (
                        <motion.div
                            key="calendario"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <CoachHabitCalendar
                                assignments={assignments}
                                clientId={clientId || ''}
                            />
                        </motion.div>
                    )}

                    {activeTab === 'notifiche' && (
                        <motion.div
                            key="notifiche"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <ClientNotificationsManager clientId={clientId || ''} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating Action Button */}
            <AnimatePresence>
                {(activeTab === 'abitudini' || activeTab === 'video' || activeTab === 'bacheca') && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0, y: 0 }}
                        animate={{
                            scale: 1,
                            opacity: 1,
                            y: isNavVisible ? -64 : 0
                        }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                            if (activeTab === 'bacheca') {
                                setIsPostModalOpen(true);
                            } else {
                                setViewMode('create');
                                setSelectedLibraryItem(null);
                                setEditingAssignment(null);
                                setIsAssignmentModalOpen(true);
                            }
                        }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 flex items-center justify-center"
                    >
                        <Plus className="h-7 w-7" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Modals - Optimized for Mobile Full Screen / Sheets */}

            {/* Assignment / Content Modal */}
            {
                isAssignmentModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
                        <div className="w-full h-[95vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-background sm:rounded-3xl rounded-t-3xl sm:border border-border flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                                        {editingAssignment ? 'Modifica' : 'Nuovo'}
                                    </h3>
                                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-foreground">
                                        {activeTab === 'abitudini' ? <span className="flex items-center gap-2">Abitudine <Leaf className="h-5 w-5 text-primary" /></span> : 'Video'}
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsAssignmentModalOpen(false)}
                                    className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Mode Switcher */}
                            <div className="px-6 py-4">
                                <div className="grid grid-cols-2 bg-muted/30 p-1 rounded-2xl">
                                    <button
                                        onClick={() => setViewMode('create')}
                                        className={clsx("py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", viewMode === 'create' ? "bg-background text-foreground shadow-lg" : "text-muted-foreground")}
                                    >
                                        Crea
                                    </button>
                                    <button
                                        onClick={() => setViewMode('library')}
                                        className={clsx("py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", viewMode === 'library' ? "bg-background text-foreground shadow-lg" : "text-muted-foreground")}
                                    >
                                        Libreria
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                                {viewMode === 'library' ? (
                                    <div className="space-y-6">
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Cerca..."
                                                className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 text-sm font-medium text-foreground focus:bg-muted/50 focus:outline-none transition-all"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {filteredLibrary.map(item => (
                                                <ContentCard
                                                    key={item.id}
                                                    item={item}
                                                    isCoachView={false}
                                                    onAssign={() => {
                                                        setSelectedLibraryItem(item);
                                                        setViewMode('create');
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {(selectedLibraryItem || editingAssignment) && (
                                            <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                                                <span className="text-xs font-bold text-primary truncate flex-1 mr-2">
                                                    {editingAssignment ? 'Modifica contenuto' : `Selezionato: ${selectedLibraryItem?.title}`}
                                                </span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedLibraryItem(null);
                                                        setEditingAssignment(null);
                                                    }}
                                                    className="text-[10px] font-black uppercase tracking-wider text-primary/70 hover:text-primary underline"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        )}
                                        <ContentEditorCard
                                            key={editingAssignment?.id || selectedLibraryItem?.id || 'new'}
                                            onSave={handleAssignContent}
                                            onCancel={() => setIsAssignmentModalOpen(false)}
                                            initialData={{
                                                type: (editingAssignment?.type || (activeTab === 'video' ? 'video' : 'habit')) as any,
                                                title: editingAssignment?.title || selectedLibraryItem?.title || '',
                                                description: editingAssignment?.description || selectedLibraryItem?.description || '',
                                                link: editingAssignment?.link || selectedLibraryItem?.link || ''
                                            }}
                                            saveLabel={editingAssignment ? 'Salva' : 'Assegna'}
                                            showTitle={true}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Plan Modal */}
            {
                isPlanModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
                        <div className="w-full h-auto bg-background sm:rounded-3xl rounded-t-3xl sm:border border-border flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                                        Struttura
                                    </h3>
                                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-foreground">
                                        {editingPlan ? 'Modifica' : 'Nuovo'} Piano
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsPlanModalOpen(false)}
                                    className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="p-6 md:p-8 overflow-y-auto max-h-[80vh]">
                                <form onSubmit={handleSavePlan} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Nome</label>
                                        <input name="name" defaultValue={editingPlan?.name} required className="w-full rounded-2xl bg-muted/30 border border-border py-4 px-5 text-foreground focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-base" placeholder="Es: Masterclass" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Inizio</label>
                                            <input type="date" name="start_date" defaultValue={editingPlan?.start_date || format(new Date(), 'yyyy-MM-dd')} className="w-full rounded-2xl bg-muted/30 border border-border py-4 px-5 text-foreground focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Scadenza</label>
                                            <div className="flex bg-muted/30 rounded-2xl p-1 border border-border mb-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setPlanEndMode('date')}
                                                    className={clsx("flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", planEndMode === 'date' ? "bg-background text-foreground shadow-lg" : "text-muted-foreground")}
                                                >
                                                    Data
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPlanEndMode('duration')}
                                                    className={clsx("flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all", planEndMode === 'duration' ? "bg-background text-foreground shadow-lg" : "text-muted-foreground")}
                                                >
                                                    Durata
                                                </button>
                                            </div>
                                            {planEndMode === 'date' ? (
                                                <input type="date" name="end_date" defaultValue={editingPlan?.end_date} className="w-full rounded-2xl bg-muted/30 border border-border py-4 px-5 text-foreground focus:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium" />
                                            ) : (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={durationAmount}
                                                        onChange={(e) => setDurationAmount(parseInt(e.target.value) || 1)}
                                                        className="w-24 bg-muted/30 border border-border rounded-2xl p-4 text-foreground text-center font-bold text-lg focus:outline-none"
                                                    />
                                                    <select
                                                        value={durationUnit}
                                                        onChange={(e) => setDurationUnit(e.target.value as any)}
                                                        className="flex-1 bg-muted/30 border border-border rounded-2xl p-4 text-xs font-black uppercase tracking-widest text-foreground focus:outline-none"
                                                    >
                                                        <option value="days" className="bg-background text-foreground">Giorni</option>
                                                        <option value="weeks" className="bg-background text-foreground">Settimane</option>
                                                        <option value="months" className="bg-background text-foreground">Mesi</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground ml-1">Descrizione</label>
                                        <textarea name="description" defaultValue={editingPlan?.description} className="w-full rounded-2xl bg-muted/30 border border-border py-4 px-5 text-foreground h-32 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium leading-relaxed resize-none" placeholder="Dettagli aggiuntivi..." />
                                    </div>

                                    <button type="submit" className="w-full rounded-2xl bg-primary py-4 text-[10px] font-black uppercase tracking-widest text-primary-foreground shadow-xl shadow-primary/20">
                                        {editingPlan ? 'Aggiorna Piano' : 'Crea Piano'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Post Modal */}
            {
                isPostModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
                        <div className="w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl bg-background sm:rounded-3xl rounded-t-3xl sm:border border-border flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <div>
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                                        Bacheca
                                    </h3>
                                    <h2 className="text-xl font-black italic tracking-tighter uppercase text-foreground">
                                        Scrivi <span className="text-primary">Post</span>
                                    </h2>
                                </div>
                                <button
                                    onClick={() => setIsPostModalOpen(false)}
                                    className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-6 md:p-8 overflow-y-auto">
                                <ContentEditorCard
                                    onSave={handleCreatePost}
                                    onCancel={() => setIsPostModalOpen(false)}
                                    saveLabel="Pubblica"
                                    showTitle={true}
                                    initialData={{ type: 'post' }}
                                />
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "flex-none flex items-center gap-2 px-4 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all snap-start border",
                active
                    ? "bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
            )}
        >
            {icon}
            {label}
        </button>
    );
}

interface ColleagueManagerProps {
    clientId: string;
    fetchColleagues: (id: string) => Promise<Profile[]>;
    linkColleague: (clientId: string, coachId: string) => Promise<boolean>;
    unlinkColleague: (clientId: string, coachId: string) => Promise<boolean>;
    searchCoaches: (query: string) => Promise<Profile[]>;
}

function ColleagueManager({ clientId, fetchColleagues, linkColleague, unlinkColleague, searchCoaches }: ColleagueManagerProps) {
    const [colleagues, setColleagues] = useState<Profile[]>([]);
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadColleagues();
    }, [clientId]);

    const loadColleagues = async () => {
        setLoading(true);
        const data = await fetchColleagues(clientId);
        setColleagues(data);
        setLoading(false);
    };

    const handleSearch = async (val: string) => {
        setSearchQuery(val);
        setIsSearching(true);
        const results = await searchCoaches(val);
        setSearchResults(results.filter(r => !colleagues.find(c => c.id === r.id)));
        setIsSearching(false);
    };

    useEffect(() => {
        if (isModalOpen && searchQuery === '') {
            handleSearch('');
        }
    }, [isModalOpen]);

    const handleLink = async (coach: Profile) => {
        const ok = await linkColleague(clientId, coach.id);
        if (ok) {
            setColleagues([...colleagues, coach]);
            setSearchResults(searchResults.filter(r => r.id !== coach.id));
            setSearchQuery('');
            setIsModalOpen(false);
        }
    };

    const handleUnlink = async (coachId: string) => {
        if (!confirm('Rimuovere questo collega dal cliente?')) return;
        const ok = await unlinkColleague(clientId, coachId);
        if (ok) {
            setColleagues(colleagues.filter(c => c.id !== coachId));
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Users className="h-5 w-5" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">Colleghi</h2>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all"
                >
                    <UserPlus className="h-5 w-5" />
                </button>
            </div>

            {loading ? (
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {[1, 2].map(i => (
                        <div key={i} className="h-16 w-40 rounded-2xl bg-white/5 animate-pulse flex-none" />
                    ))}
                </div>
            ) : colleagues.length === 0 ? (
                <div className="py-6 text-center border-2 border-dashed border-white/5 rounded-2xl">
                    <p className="text-muted-foreground text-xs font-medium">Nessun collega</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {colleagues.map(coach => (
                        <div key={coach.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                {coach.full_name?.charAt(0) || 'C'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-white text-sm truncate">{coach.full_name}</div>
                                <div className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider truncate">{coach.email}</div>
                            </div>
                            <button
                                onClick={() => handleUnlink(coach.id)}
                                className="p-2 rounded-lg text-white/30 hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-300">
                    <div className="w-full h-[80vh] sm:h-auto sm:max-h-[85vh] sm:max-w-md bg-[#0a0a0a] sm:rounded-3xl rounded-t-3xl sm:border border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <div className="flex justify-between items-center p-6 border-b border-white/5">
                            <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Aggiungi <span className="text-primary">Collega</span></h2>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setSearchQuery('');
                                    setSearchResults([]);
                                }}
                                className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:bg-white/10"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Cerca coach..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    autoFocus
                                    className="w-full rounded-2xl bg-white/5 border border-white/5 py-3 pl-12 pr-4 text-white focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                                />
                            </div>
                            <div className="space-y-2">
                                {isSearching ? (
                                    <div className="py-4 text-center text-xs text-white/30 italic">Ricerca...</div>
                                ) : searchResults.length === 0 ? (
                                    <div className="py-4 text-center text-xs text-white/30 italic">
                                        {searchQuery ? "Nessun risultato" : "Cerca per nome o email"}
                                    </div>
                                ) : (
                                    searchResults.map(coach => (
                                        <button
                                            key={coach.id}
                                            onClick={() => handleLink(coach)}
                                            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-left transition-all group"
                                        >
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {coach.full_name?.charAt(0) || 'C'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-white text-sm truncate">{coach.full_name}</div>
                                                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider truncate">{coach.email}</div>
                                            </div>
                                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Plus className="h-4 w-4" />
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
