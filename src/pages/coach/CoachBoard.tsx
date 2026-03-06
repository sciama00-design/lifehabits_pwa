import { useState, useRef } from 'react';
import { useBoardPosts } from '@/hooks/useBoardPosts';
import { useClients } from '@/hooks/useClients';
import { Plus, Trash2, Clock, Users, Check, ChevronDown, X, Upload, Pencil, Bell, MessageSquarePlus } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { uploadFile } from '@/lib/storage';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

export default function CoachBoard() {
    const { posts, loading, createPost, updatePost, deletePost } = useBoardPosts();
    const { clients } = useClients();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);

    // Form visibility
    const [isFormOpen, setIsFormOpen] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [expirationDays, setExpirationDays] = useState('7');
    const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [editingPostId, setEditingPostId] = useState<string | null>(null);

    const toggleClient = (clientId: string) => {
        setSelectedClientIds((prev: string[]) =>
            prev.includes(clientId)
                ? prev.filter((id: string) => id !== clientId)
                : [...prev, clientId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedClientIds.length === clients.length) {
            setSelectedClientIds([]);
        } else {
            setSelectedClientIds(clients.map(c => c.id));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setImageUrl(''); // Clear URL if file selected
        }
    };

    const removeFile = () => {
        setFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleCancel = () => {
        setEditingPostId(null);
        setTitle('');
        setContent('');
        setImageUrl('');
        setFile(null);
        setPreviewUrl(null);
        setExpirationDays('7');
        setSelectedClientIds([]);
        setAddError(null);
        setIsFormOpen(false);
    };

    const handleEdit = (post: any) => {
        setEditingPostId(post.id);
        setTitle(post.title);
        setContent(post.content);
        setImageUrl(post.image_url || '');
        setPreviewUrl(post.image_url || null);
        setFile(null);
        setSelectedClientIds(post.target_client_ids || []);

        // Find expiration in days (approximate)
        if (post.expires_at) {
            const days = Math.round((new Date(post.expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (days <= 1) setExpirationDays('1');
            else if (days <= 3) setExpirationDays('3');
            else if (days <= 7) setExpirationDays('7');
            else setExpirationDays('30');
        } else {
            setExpirationDays('never');
        }

        setIsFormOpen(true);
        setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError(null);

        try {
            let finalImageUrl = imageUrl;

            // Handle File Upload
            if (file) {
                setIsUploading(true);
                const uploadedUrl = await uploadFile(file);
                setIsUploading(false);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                } else {
                    throw new Error('Errore durante il caricamento dell\'immagine.');
                }
            }

            const expirationDate = expirationDays === 'never'
                ? null
                : addDays(new Date(), parseInt(expirationDays));

            const postData = {
                title,
                content,
                image_url: finalImageUrl || null,
                target_client_ids: selectedClientIds.length > 0 ? selectedClientIds : null,
                expires_at: expirationDate ? expirationDate.toISOString() : null,
            };

            let success;
            if (editingPostId) {
                success = await updatePost(editingPostId, postData);
            } else {
                success = await createPost(postData);
            }

            if (success) {
                handleCancel();
            } else {
                setAddError(`Errore durante la ${editingPostId ? 'modifica' : 'pubblicazione'}.`);
            }
        } catch (err: any) {
            setAddError(err.message || 'Si è verificato un errore.');
        } finally {
            setAddLoading(false);
            setIsUploading(false);
        }
    };

    const handleDelete = async (post: any) => {
        if (confirm('Eliminare questo post?')) {
            try {
                const success = await deletePost(post.id);
                if (!success) {
                    alert('Errore durante l\'eliminazione del post.');
                }
            } catch (err) {
                console.error('Delete error:', err);
                alert('Errore durante l\'eliminazione.');
            }
        }
    };

    return (
        <div className="space-y-4">
            {/* ─── CTA Toggle ──────────────────────────────────── */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { if (isFormOpen) handleCancel(); else setIsFormOpen(true); }}
                className="w-full relative overflow-hidden group cursor-pointer p-5 rounded-[var(--radius-xl)] text-left"
                style={{
                    background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                    border: '1px solid rgba(251,191,36,0.3)',
                }}
            >
                <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                }} />
                <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
                    <MessageSquarePlus className="h-12 w-12 text-white" />
                </div>
                <div className="relative flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center border border-white/15">
                        <Plus className="h-5 w-5 text-white transition-transform duration-300" style={{ transform: isFormOpen ? 'rotate(45deg)' : 'rotate(0deg)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-0.5">
                            Communication Center
                        </p>
                        <h3 className="text-sm font-bold text-white leading-snug">
                            {isFormOpen ? 'Chiudi' : 'Nuovo Annuncio'}
                        </h3>
                    </div>
                </div>
            </motion.button>

            {/* ─── Expanded Form ───────────────────────────────────── */}
            <AnimatePresence>
                {isFormOpen && (
                    <motion.div
                        ref={formRef}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        <div className="glass-card border-border p-5 md:p-8 shadow-2xl rounded-[var(--radius-xl)] space-y-5">
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={clsx(
                                        "h-9 w-9 rounded-xl flex items-center justify-center transition-all border shadow-inner",
                                        editingPostId ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-primary/10 text-primary border-primary/20"
                                    )}>
                                        {editingPostId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    </div>
                                    <div>
                                        <h2 className="text-base font-black italic tracking-tighter uppercase leading-none text-foreground">
                                            {editingPostId ? (
                                                <>Modifica <span className="text-amber-500">Post</span></>
                                            ) : (
                                                <>Nuovo <span className="text-primary">Annuncio</span></>
                                            )}
                                        </h2>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Client Selector */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                            className="flex items-center justify-center gap-2 rounded-xl bg-muted/30 border border-border py-2.5 px-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 transition-all hover:bg-muted/50 hover:text-foreground"
                                        >
                                            <Users className="h-3.5 w-3.5 text-primary" />
                                            <span>
                                                {selectedClientIds.length === 0
                                                    ? 'Tutti'
                                                    : `${selectedClientIds.length}`}
                                            </span>
                                        </button>

                                        {isClientDropdownOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-[60]"
                                                    onClick={() => setIsClientDropdownOpen(false)}
                                                />
                                                <div className="absolute right-0 top-full mt-2 z-[70] w-72 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-2xl no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
                                                    <button
                                                        type="button"
                                                        onClick={toggleSelectAll}
                                                        className="w-full flex items-center justify-between p-3 mb-1 rounded-xl text-sm transition-colors hover:bg-muted/50 text-primary font-bold"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                                                                <Check className={clsx("h-4 w-4 transition-opacity", selectedClientIds.length === clients.length ? "opacity-100" : "opacity-0")} />
                                                            </div>
                                                            <span>Seleziona Tutti</span>
                                                        </div>
                                                    </button>
                                                    <div className="h-px bg-border my-1" />
                                                    {clients.map(client => (
                                                        <button
                                                            key={client.id}
                                                            type="button"
                                                            onClick={() => toggleClient(client.id)}
                                                            className={clsx(
                                                                "w-full flex items-center justify-between p-3 rounded-xl text-sm transition-colors mb-1",
                                                                selectedClientIds.includes(client.id)
                                                                    ? "bg-primary/10 text-primary"
                                                                    : "hover:bg-accent text-muted-foreground"
                                                            )}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold">
                                                                    {client.profiles?.full_name?.charAt(0) || '?'}
                                                                </div>
                                                                <span className="truncate font-medium">{client.profiles?.full_name}</span>
                                                            </div>
                                                            {selectedClientIds.includes(client.id) && <Check className="h-4 w-4" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleAdd} className="space-y-4">
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Titolo dell'annuncio..."
                                    className="w-full bg-muted/30 border border-border rounded-xl py-3 px-4 text-sm font-bold text-foreground placeholder:text-muted-foreground/50 focus:bg-muted/50 focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all shadow-inner"
                                />

                                <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden shadow-inner">
                                    <RichTextEditor
                                        key={editingPostId || 'new'}
                                        value={content}
                                        onChange={setContent}
                                        placeholder="Testo annuncio"
                                    />
                                </div>

                                {/* Image Preview / Selection */}
                                <div>
                                    {(previewUrl || imageUrl) ? (
                                        <div className="relative group rounded-2xl overflow-hidden aspect-video bg-muted/30 border border-border">
                                            <img
                                                src={previewUrl || imageUrl}
                                                alt="Anteprima"
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (previewUrl === imageUrl) {
                                                            setImageUrl('');
                                                            setPreviewUrl(null);
                                                        } else {
                                                            removeFile();
                                                        }
                                                    }}
                                                    className="h-12 w-12 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 hover:rotate-90 transition-all shadow-2xl"
                                                >
                                                    <X className="h-6 w-6" />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full group flex items-center justify-center gap-3 py-4 rounded-2xl bg-muted/20 border border-dashed border-border text-foreground transition-all hover:bg-muted/40 hover:border-primary/50"
                                        >
                                            <Upload className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">Carica immagine</span>
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1 group">
                                        <Clock className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors pointer-events-none" />
                                        <select
                                            value={expirationDays}
                                            onChange={(e) => setExpirationDays(e.target.value)}
                                            className="w-full appearance-none rounded-xl bg-muted/30 border border-border py-2.5 pl-10 pr-8 text-[9px] font-black uppercase tracking-widest text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                                        >
                                            <option value="1" className="bg-background text-foreground">24 Ore</option>
                                            <option value="3" className="bg-background text-foreground">3 Giorni</option>
                                            <option value="7" className="bg-background text-foreground">7 Giorni</option>
                                            <option value="30" className="bg-background text-foreground">30 Giorni</option>
                                            <option value="never" className="bg-background text-foreground">Nessun Limite</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={addLoading || isUploading || !title || !content}
                                        className={clsx(
                                            "flex-1 rounded-xl py-2.5 text-[9px] font-black uppercase tracking-[0.15em] text-primary-foreground hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-2",
                                            editingPostId ? "bg-amber-500 shadow-amber-500/20" : "bg-primary shadow-primary/20"
                                        )}
                                    >
                                        {(addLoading || isUploading) ? (
                                            <>
                                                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                                                <span>Caricamento...</span>
                                            </>
                                        ) : (
                                            <span>{editingPostId ? 'Salva Modifiche' : 'Pubblica'}</span>
                                        )}
                                    </button>
                                </div>
                                {addError && <p className="text-[10px] text-destructive font-black uppercase tracking-widest text-center">{addError}</p>}
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Posts — Client-Style Horizontal Scroll ───────────── */}
            {loading ? (
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x no-scrollbar">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="min-w-[220px] max-w-[220px] h-48 rounded-[var(--radius-xl)] bg-muted/30 border border-border animate-pulse snap-center" />
                    ))}
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-10 rounded-[var(--radius-xl)] bg-muted/10 border border-dashed border-border flex flex-col items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-muted/20 flex items-center justify-center text-muted-foreground">
                        <Clock className="h-6 w-6" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nessun annuncio attivo</p>
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x no-scrollbar">
                    {posts.map((post) => (
                        <motion.div
                            key={post.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            className="min-w-[220px] max-w-[220px] snap-center relative overflow-hidden group rounded-[var(--radius-xl)] flex flex-col"
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

                            <div className="relative p-4 flex-1 flex flex-col">
                                {/* Date */}
                                <p className="text-[8px] font-bold text-white/40 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {format(new Date(post.created_at), 'dd/MM/yyyy')}
                                </p>

                                <h4 className="text-xs font-bold text-white mb-1 line-clamp-2">{post.title}</h4>
                                <div
                                    className="text-[10px] text-white/60 leading-relaxed line-clamp-2 flex-1"
                                    dangerouslySetInnerHTML={{ __html: post.content }}
                                />

                                {/* Meta */}
                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/15">
                                    <div className="flex items-center gap-1 text-[8px] font-bold text-white/50">
                                        <Users className="h-2.5 w-2.5" />
                                        <span>{post.target_client_ids?.length || clients.length}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleEdit(post); }}
                                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/30 transition-colors"
                                            title="Modifica"
                                        >
                                            <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(post); }}
                                            className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/15 text-white hover:bg-red-500/80 transition-colors"
                                            title="Elimina"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>

                                {post.expires_at && (
                                    <div className="mt-2 flex items-center gap-1 text-[8px] font-bold text-white/40">
                                        <div className="h-1 w-1 rounded-full bg-white/60 animate-pulse" />
                                        Scade: {format(new Date(post.expires_at), 'dd/MM')}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
