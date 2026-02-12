import { useState, useRef } from 'react';
import { useBoardPosts } from '@/hooks/useBoardPosts';
import { useClients } from '@/hooks/useClients';
import { Plus, Trash2, Clock, Users, Check, ChevronDown, X, Upload, Pencil } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { uploadFile, deleteFileFromUrl } from '@/lib/storage';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import clsx from 'clsx';

export default function CoachBoard() {
    const { posts, loading, createPost, updatePost, deletePost } = useBoardPosts();
    const { clients } = useClients();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const formRef = useRef<HTMLDivElement>(null);

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

        formRef.current?.scrollIntoView({ behavior: 'smooth' });
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
                // Delete media from storage if exists
                if (post.image_url) {
                    await deleteFileFromUrl(post.image_url);
                }
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
        <div className="space-y-10">
            {/* Add Post Section */}
            <div ref={formRef} className="glass-card border-border p-6 md:p-12 shadow-2xl rounded-[2rem] md:rounded-[3rem] space-y-8 md:space-y-12">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
                    <div className="flex items-center gap-4 md:gap-6">
                        <div className={clsx(
                            "h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all border shadow-inner",
                            editingPostId ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-primary/10 text-primary border-primary/20"
                        )}>
                            {editingPostId ? <Pencil className="h-5 w-5 md:h-7 md:w-7" /> : <Plus className="h-5 w-5 md:h-7 md:w-7" />}
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-xl md:text-3xl font-black italic tracking-tighter uppercase leading-none text-foreground">
                                {editingPostId ? (
                                    <>Modifica <span className="text-amber-500">Post</span></>
                                ) : (
                                    <>Aggiungi <span className="text-primary">Annuncio</span></>
                                )}
                            </h2>
                            <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em] mt-1 md:mt-2 opacity-80">Communication Center</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 w-full sm:w-auto">
                        {editingPostId && (
                            <button
                                onClick={handleCancel}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-3 rounded-[1.5rem] bg-destructive/10 border border-destructive/20 py-4 px-6 text-[10px] font-black uppercase tracking-widest text-destructive transition-all hover:bg-destructive hover:text-white"
                            >
                                <X className="h-4 w-4" />
                                <span>Annulla</span>
                            </button>
                        )}

                        {/* Client Selector Trigger */}
                        <div className="relative flex-1 sm:flex-none">
                            <button
                                type="button"
                                onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                                className="w-full flex items-center justify-center gap-2 md:gap-3 rounded-[1rem] md:rounded-[1.5rem] bg-muted/30 border border-border py-3 px-4 md:py-4 md:px-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 transition-all hover:bg-muted/50 hover:text-foreground"
                            >
                                <Users className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                                <span>
                                    {selectedClientIds.length === 0
                                        ? 'Tutti i Clienti'
                                        : `${selectedClientIds.length} Selezionati`}
                                </span>
                            </button>

                            {isClientDropdownOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-[60]"
                                        onClick={() => setIsClientDropdownOpen(false)}
                                    />
                                    <div className="absolute right-0 top-full mt-4 z-[70] w-72 max-h-80 overflow-y-auto rounded-[2rem] border border-border bg-card p-3 shadow-2xl no-scrollbar animate-in fade-in slide-in-from-top-2 duration-200">
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

                <form onSubmit={handleAdd} className="space-y-6">
                    <div>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Titolo dell'annuncio importante..."
                            className="w-full bg-muted/30 border border-border rounded-2xl py-3 px-5 md:py-5 md:px-8 text-lg md:text-2xl font-black italic uppercase tracking-tighter text-foreground placeholder:text-muted-foreground/50 focus:bg-muted/50 focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all mb-4 md:mb-8 shadow-inner"
                        />

                        <div className="rounded-[2.5rem] border border-border bg-muted/30 overflow-hidden shadow-inner">
                            <RichTextEditor
                                key={editingPostId || 'new'}
                                value={content}
                                onChange={setContent}
                                placeholder="Test annuncio"
                            />
                        </div>
                    </div>

                    {/* Image Preview / Selection */}
                    <div className="space-y-4">
                        {(previewUrl || imageUrl) ? (
                            <div className="relative group rounded-[3rem] overflow-hidden aspect-video bg-muted/30 border border-border shadow-2xl">
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
                                        className="h-16 w-16 rounded-full bg-destructive text-white flex items-center justify-center hover:scale-110 transition-transform shadow-2xl"
                                    >
                                        <X className="h-8 w-8" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full group aspect-[21/9] flex flex-col items-center justify-center gap-3 md:gap-4 rounded-[2rem] md:rounded-[3rem] bg-muted/30 border-2 border-dashed border-border text-foreground transition-all hover:bg-muted/50 hover:border-primary/50"
                            >
                                <div className="h-10 w-10 md:h-16 md:w-16 rounded-xl md:rounded-[1.5rem] bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all shadow-inner">
                                    <Upload className="h-5 w-5 md:h-8 md:w-8" />
                                </div>
                                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] opacity-40 group-hover:opacity-100 transition-opacity">Carica un'immagine di impatto</span>
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

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative w-full sm:w-auto group">
                            <Clock className="absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors pointer-events-none" />
                            <select
                                value={expirationDays}
                                onChange={(e) => setExpirationDays(e.target.value)}
                                className="w-full sm:w-60 appearance-none rounded-[1rem] md:rounded-[1.5rem] bg-muted/30 border border-border py-3 pl-12 pr-10 md:py-5 md:pl-14 md:pr-12 text-[10px] font-black uppercase tracking-widest text-foreground focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all cursor-pointer shadow-sm"
                            >
                                <option value="1" className="bg-background text-foreground">Scadenza: 24 Ore</option>
                                <option value="3" className="bg-background text-foreground">Scadenza: 3 Giorni</option>
                                <option value="7" className="bg-background text-foreground">Scadenza: 7 Giorni</option>
                                <option value="30" className="bg-background text-foreground">Scadenza: 30 Giorni</option>
                                <option value="never" className="bg-background text-foreground">Senza Limite Temporale</option>
                            </select>
                            <ChevronDown className="absolute right-4 md:right-6 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                        </div>

                        <button
                            type="submit"
                            disabled={addLoading || isUploading || !title || !content}
                            className={clsx(
                                "w-full flex-1 rounded-[1.5rem] py-3 md:py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:scale-100 flex items-center justify-center gap-3 md:gap-4 shadow-xl",
                                editingPostId ? "bg-amber-500 shadow-amber-500/20" : "bg-primary shadow-primary/20"
                            )}
                        >
                            {(addLoading || isUploading) ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                                    <span>Esecuzione in corso...</span>
                                </>
                            ) : (
                                <span>{editingPostId ? 'Salva Modifiche' : 'Archivia & Pubblica'}</span>
                            )}
                        </button>
                    </div>
                    {addError && <p className="text-[10px] text-destructive font-black uppercase tracking-widest text-center mt-4">{addError}</p>}
                </form>
            </div>

            {/* Posts Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black italic tracking-tighter uppercase leading-none">
                        Annunci <span className="text-primary">Globali Attivi</span>
                    </h2>
                </div>

                {loading ? (
                    <div className="grid gap-8 sm:grid-cols-2">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-96 rounded-[3rem] bg-muted/30 border border-border animate-pulse" />
                        ))}
                    </div>
                ) : posts.length === 0 ? (
                    <div className="text-center py-20 rounded-[3rem] bg-muted/10 border border-dashed border-border flex flex-col items-center gap-6">
                        <div className="h-20 w-20 rounded-3xl bg-muted/20 flex items-center justify-center text-muted-foreground">
                            <Clock className="h-10 w-10" />
                        </div>
                        <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nessun annuncio attivo nel sistema.</p>
                    </div>
                ) : (
                    <div className="grid gap-8 sm:grid-cols-2">
                        {posts.map((post) => (
                            <div
                                key={post.id}
                                className="group relative flex flex-col rounded-[3rem] glass-card border-border overflow-hidden transition-all shadow-2xl hover:border-primary/30"
                            >
                                <div className="p-8 pb-4">
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <h3 className="font-ex-bold text-foreground text-2xl italic uppercase tracking-tighter truncate flex-1">{post.title}</h3>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => handleEdit(post)}
                                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 border border-blue-500/20 shadow-lg"
                                                title="Modifica"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(post)}
                                                className="h-10 w-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 border border-red-500/20 shadow-lg"
                                                title="Elimina"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-4 opacity-70 flex items-center gap-2">
                                        <Clock className="h-3 w-3" />
                                        Creato il {format(new Date(post.created_at), 'dd/MM/yyyy')}
                                    </p>
                                </div>

                                {post.image_url && (
                                    <div className="px-8 mb-6">
                                        <div className="rounded-[2rem] overflow-hidden aspect-video bg-muted/30 border border-border">
                                            <img src={post.image_url} alt={post.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        </div>
                                    </div>
                                )}

                                <div className="px-8 flex-1">
                                    <div className="text-foreground/80 prose prose-invert prose-sm max-w-none mb-8 line-clamp-4 font-medium leading-relaxed" dangerouslySetInnerHTML={{ __html: post.content }} />
                                </div>

                                <div className="p-8 pt-0 mt-auto">
                                    <div className="flex flex-col gap-4 border-t border-border pt-6">
                                        <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                                            <Users className="h-4 w-4 text-primary" />
                                            <span>Target: {post.target_client_ids?.length || clients.length} Clienti</span>
                                        </div>

                                        {post.expires_at && (
                                            <div className="inline-flex items-center gap-3 rounded-2xl bg-red-500/5 px-6 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest border border-red-500/10 w-fit">
                                                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                                                <span>Scadenza: {format(new Date(post.expires_at), 'dd/MM/yyyy')}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
