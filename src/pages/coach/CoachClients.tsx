import { motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClients } from '@/hooks/useClients';
import { Plus, Search, Mail, Users, X } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function CoachClients() {
    const navigate = useNavigate();
    const { clients, loading, error, createClient } = useClients();
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newClientEmail, setNewClientEmail] = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const handleAddClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError(null);

        // Call the new createClient function
        const success = await createClient(newClientEmail, newClientName);

        if (success) {
            setIsAddModalOpen(false);
            setNewClientEmail('');
            setNewClientName('');
        } else {
            setAddError('Errore durante la creazione. Verifica i dati.');
        }
        setAddLoading(false);
    };

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl sm:text-4xl font-black italic tracking-tighter uppercase text-foreground">
                    I tuoi <span className="text-primary">Clienti</span>
                </h1>
                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] opacity-80">Gestione Atleti / Anagrafica</p>
            </div>

            {/* Floating Action Button */}
            <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsAddModalOpen(true)}
                className="fixed bottom-24 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/40 transition-shadow hover:shadow-primary/60 md:bottom-12 md:right-12 md:h-20 md:w-20 md:rounded-[2rem]"
            >
                <Plus className="h-7 w-7 md:h-10 md:w-10 shrink-0" />
            </motion.button>

            {/* Search */}
            <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Cerca un cliente..."
                    className="w-full bg-muted/30 border border-border rounded-2xl sm:rounded-[1.5rem] py-4 sm:py-5 pl-14 sm:pl-16 pr-6 text-sm font-bold text-foreground focus:bg-muted/50 focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all placeholder:text-muted-foreground/50"
                />
            </div>

            {/* Error Message */}
            {error && (
                <div className="rounded-2xl bg-destructive/10 p-4 text-destructive border border-destructive/20 text-sm font-medium">
                    {error}
                </div>
            )}

            {/* Client List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">Caricamento clienti...</p>
                </div>
            ) : clients.length === 0 ? (
                <div className="text-center py-20 px-6 rounded-2xl sm:rounded-[3rem] bg-muted/10 border border-dashed border-border flex flex-col items-center gap-6">
                    <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl sm:rounded-[2.5rem] bg-muted/20 flex items-center justify-center text-muted-foreground">
                        <Users className="h-10 w-10 sm:h-12 sm:w-12" />
                    </div>
                    <div>
                        <p className="text-lg sm:text-xl font-black italic tracking-tighter uppercase text-foreground">Nessun <span className="text-primary">Atleta</span></p>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-2">Inizia aggiungendo il tuo primo atleta oggi.</p>
                    </div>
                </div>
            ) : (
                <div className="grid gap-4">
                    {clients.map((client) => (
                        <div
                            key={client.id}
                            onClick={() => navigate(`/coach/clients/${client.id}`)}
                            className="group relative flex items-center justify-between gap-4 sm:gap-6 rounded-2xl sm:rounded-[2.5rem] glass-card p-4 sm:p-6 border-border hover:border-primary/50 transition-all cursor-pointer shadow-2xl"
                        >
                            <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                                <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl sm:rounded-[1.5rem] bg-primary/10 text-primary font-black text-xl sm:text-2xl border border-primary/20 shadow-inner">
                                    {client.profiles?.full_name?.charAt(0) || '?'}
                                    <div className={`absolute -bottom-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 rounded-full border-4 border-black ${new Date(client.subscription_end || '') > new Date() ? 'bg-primary' : 'bg-destructive'}`} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-extrabold text-foreground text-xl group-hover:text-primary transition-colors truncate leading-tight tracking-tight">
                                        {client.profiles?.full_name || 'Utente'}
                                    </h3>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground truncate mt-1">{client.profiles?.email}</p>

                                    <div className="mt-3 flex items-center gap-4">
                                        <span className={`inline-flex items-center rounded-lg px-3 py-1 text-[9px] font-black uppercase tracking-widest ${new Date(client.subscription_end || '') > new Date()
                                            ? 'bg-primary/10 text-primary border border-primary/20'
                                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                                            }`}>
                                            {new Date(client.subscription_end || '') > new Date() ? 'Attivo' : 'Scaduto'}
                                        </span>
                                        {client.subscription_end && (
                                            <span className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-[0.2em]">
                                                FINO AL {format(new Date(client.subscription_end), 'd MMM y', { locale: it })}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="hidden sm:flex items-center gap-2">
                                <button className="px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-widest bg-muted/30 border border-border text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all shadow-lg hover:shadow-primary/20">
                                    Dettagli Hub
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Client Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/40 backdrop-blur-xl p-4 animate-in fade-in duration-500">
                    <div className="w-full max-w-xl rounded-2xl sm:rounded-[3rem] glass-card border-border p-6 sm:p-12 shadow-2xl animate-in zoom-in-95 duration-300 relative">
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute top-6 right-6 sm:top-8 sm:right-8 h-10 w-10 sm:h-12 sm:w-12 rounded-full flex items-center justify-center bg-muted/30 border border-border text-muted-foreground hover:bg-muted/50 transition-all hover:rotate-90"
                        >
                            <X className="h-6 w-6" />
                        </button>
                        <h3 className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.4em] text-primary mb-2">Registration Hub</h3>
                        <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase mb-3 sm:mb-4 text-foreground">Nuovo <span className="text-primary">Atleta</span></h2>
                        <p className="mb-8 sm:mb-10 text-[9px] sm:text-[10px] font-black tracking-[0.2em] text-muted-foreground">
                            CREDENZIALI PROVVISORIE: <code className="bg-primary/10 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-primary border border-primary/20 lowercase font-mono">lifehabits2026</code>
                        </p>

                        <form onSubmit={handleAddClient} className="space-y-8">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Nome e Cognome</label>
                                <input
                                    type="text"
                                    required
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    className="w-full rounded-2xl bg-muted/30 border border-border py-5 px-6 text-foreground focus:bg-muted/50 focus:border-primary/50 focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all font-bold placeholder:text-muted-foreground/30 text-lg"
                                    placeholder="Mario Rossi"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Email Istituzionale</label>
                                <div className="relative group">
                                    <Mail className="absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <input
                                        type="email"
                                        required
                                        value={newClientEmail}
                                        onChange={(e) => setNewClientEmail(e.target.value)}
                                        className="w-full rounded-2xl bg-muted/30 border border-border py-5 pl-16 pr-6 text-foreground focus:bg-muted/50 focus:border-primary/50 focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all font-bold placeholder:text-muted-foreground/30 text-lg"
                                        placeholder="atleta@email.com"
                                    />
                                </div>
                            </div>

                            {addError && <p className="text-[10px] text-destructive font-black uppercase tracking-widest bg-destructive/10 p-4 rounded-2xl border border-destructive/20">{addError}</p>}

                            <div className="flex gap-6 pt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="flex-1 rounded-full bg-muted/30 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all border border-border"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={addLoading}
                                    className="flex-1 rounded-full bg-primary py-5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground hover:shadow-2xl hover:shadow-primary/30 transition-all shadow-xl shadow-primary/20"
                                >
                                    {addLoading ? 'Esecuzione...' : 'Crea Profilo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
