import { useState } from 'react';
import { useContentLibrary } from '@/hooks/useContentLibrary';
import {
    Plus,
    Search,
    Filter,
    LayoutGrid,
    Type,
    Video
} from 'lucide-react';
import clsx from 'clsx';
import type { ContentData } from '@/components/editor/ContentEditorCard';
import { ContentEditorCard } from '@/components/editor/ContentEditorCard';
import type { ContentItem } from '@/types/database';
import { ContentCard } from '@/components/shared/ContentCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';

type TabType = 'all' | 'habit' | 'video';

export default function CoachLibrary() {
    const { content, loading, error, addContent, updateContent, deleteContent, clearError } = useContentLibrary();
    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showOnlyMine, setShowOnlyMine] = useState(false);
    const { profile } = useContentLibrary() as any;
    const { isNavVisible = true } = useOutletContext<{ isNavVisible: boolean }>() || {};

    const filteredContent = content.filter(item => {
        const matchesTab = activeTab === 'all' ? true :
            (activeTab === 'habit' ? (item.type === 'habit' || item.type === 'pdf') : item.type === activeTab);
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMine = !showOnlyMine || item.coach_id === (profile?.id || '');
        return matchesTab && matchesSearch && matchesMine;
    });

    const handleSave = async (data: ContentData) => {
        let success = false;
        if (editingItem) {
            success = await updateContent(editingItem.id, {
                title: data.title,
                description: data.description,
                type: data.type as any,
                link: data.link || null,
                thumbnail_url: data.thumbnail_url || null,
            });
        } else {
            success = await addContent({
                title: data.title,
                description: data.description,
                type: data.type as any,
                link: data.link || null,
                thumbnail_url: data.thumbnail_url || null,
            });
        }

        if (success) {
            setIsModalOpen(false);
            setEditingItem(null);
        }
    };

    const handleEdit = (item: ContentItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between px-2">
                <div>
                    <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground leading-none">
                        Libreria<span className="text-primary italic">Contenuti</span>
                    </h1>
                    <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-2 sm:mt-3 opacity-60">Gestione Libreria Wellness</p>
                </div>
            </header>

            {/* Controls Bar */}
            <div className="space-y-4 px-1 sm:px-0">
                <div className="flex w-full p-1 bg-black/20 rounded-2xl backdrop-blur-md border border-white/5">
                    {[
                        { id: 'all', label: 'Tutti', icon: LayoutGrid },
                        { id: 'habit', label: 'Habits', icon: Type },
                        { id: 'video', label: 'Video', icon: Video },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={clsx(
                                'flex-1 relative flex items-center justify-center gap-2 px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl',
                                activeTab === tab.id
                                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                            )}
                        >
                            <tab.icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 lg:items-center lg:justify-between bg-card/40 backdrop-blur-xl border border-white/5 p-2 rounded-2xl shadow-xl">
                    <button
                        onClick={() => setShowOnlyMine(!showOnlyMine)}
                        className={clsx(
                            'w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-xl border',
                            showOnlyMine
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'text-muted-foreground border-white/5 hover:bg-white/5 hover:text-foreground'
                        )}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        I Miei Contenuti
                    </button>

                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
                        <input
                            type="text"
                            placeholder="Cerca contenuti..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-10 sm:h-11 rounded-xl bg-background/40 border border-white/5 pl-10 sm:pl-11 pr-4 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/30"
                        />
                    </div>
                </div>
            </div>

            {/* Content Display */}
            <div className="relative">
                {error && (
                    <div className="relative rounded-xl bg-destructive/10 p-4 text-destructive border border-destructive/20 text-xs mb-6 font-bold uppercase tracking-widest flex items-center justify-between">
                        <span>{error}</span>
                        <button
                            onClick={clearError}
                            className="p-1 hover:bg-destructive/10 rounded-full transition-colors"
                        >
                            <span className="sr-only">Chiudi</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="aspect-square rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
                        ))}
                    </div>
                ) : filteredContent.length === 0 ? (
                    <div className="text-center py-24 rounded-3xl glass-card border-dashed">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/5 border border-primary/10 mb-6">
                            <Plus className="h-8 w-8 text-primary/40" />
                        </div>
                        <h3 className="text-base font-bold text-foreground">Nessun contenuto trovato</h3>
                        <p className="text-xs text-muted-foreground mt-2 max-w-[200px] mx-auto opacity-60">Aggiungi nuovi contenuti per iniziare a distribuire valore.</p>
                    </div>
                ) : (
                    <motion.div
                        layout
                        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pb-24"
                    >
                        <AnimatePresence>
                            {filteredContent.map((item) => (
                                <ContentCard
                                    key={item.id}
                                    item={item}
                                    onEdit={() => handleEdit(item)}
                                    onDelete={() => deleteContent(item.id)}
                                />
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )}
            </div>

            {/* Modern FAB */}
            <motion.button
                initial={{ y: 0 }}
                animate={{
                    y: isNavVisible ? -64 : 0,
                    scale: 1
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                    setEditingItem(null);
                    setIsModalOpen(true);
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/40 transition-shadow md:bottom-8 md:right-8 group sm:rounded-full"
            >
                <Plus className="h-7 w-7 transition-transform group-hover:rotate-90" />
            </motion.button>

            {/* Modal Redesign */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-10 bg-background/20 backdrop-blur-xl">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-xl max-h-full overflow-y-auto glass-card rounded-2xl sm:rounded-[2.5rem] shadow-2xl border border-white/10"
                        >
                            <div className="p-5 sm:p-10">
                                <header className="flex items-center justify-between mb-8">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                                            {editingItem ? 'Modifica' : 'Nuovo'}<span className="text-primary italic">Contenuto</span>
                                        </h2>
                                        <p className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">Library Hub</p>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(false)}
                                        className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors text-muted-foreground"
                                    >
                                        <Plus className="h-4 w-4 rotate-45" />
                                    </button>
                                </header>

                                <ContentEditorCard
                                    onSave={handleSave}
                                    onCancel={() => setIsModalOpen(false)}
                                    saveLabel={editingItem ? 'Aggiorna' : 'Crea'}
                                    initialData={editingItem ? {
                                        title: editingItem.title,
                                        description: editingItem.description || '',
                                        type: editingItem.type as any,
                                        link: editingItem.link || '',
                                    } : undefined}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
