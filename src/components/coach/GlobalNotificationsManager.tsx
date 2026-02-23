
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Clock, Plus, Trash2, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmojiTextarea } from '@/components/shared/EmojiTextarea';

interface NotificationRule {
    id: string;
    coach_id: string;
    client_id: string | null;
    scheduled_time: string;
    message: string;
}

export function GlobalNotificationsManager() {
    const { profile } = useAuth();
    const [rules, setRules] = useState<NotificationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [newTime, setNewTime] = useState("09:00");
    const [newMessage, setNewMessage] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.id) {
            fetchRules();
        }
    }, [profile?.id]);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('notification_rules')
                .select('*')
                .eq('coach_id', profile?.id)
                .is('client_id', null)
                .order('scheduled_time');

            if (error) throw error;
            setRules(data || []);
        } catch (err) {
            console.error('Error fetching global rules:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTime || !newMessage.trim()) return;

        setSaving(true);
        try {
            if (editingId) {
                const { data, error } = await supabase
                    .from('notification_rules')
                    .update({
                        scheduled_time: newTime,
                        message: newMessage.trim()
                    })
                    .eq('id', editingId)
                    .select()
                    .single();

                if (error) throw error;
                setRules(rules.map(r => r.id === editingId ? data : r).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
            } else {
                const { data, error } = await supabase
                    .from('notification_rules')
                    .insert({
                        coach_id: profile?.id,
                        client_id: null,
                        scheduled_time: newTime,
                        message: newMessage.trim()
                    })
                    .select()
                    .single();

                if (error) throw error;
                setRules([...rules, data].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
            }

            resetForm();
        } catch (err) {
            console.error('Error saving rule:', err);
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setNewMessage("");
        setNewTime("09:00");
        setEditingId(null);
        setIsAdding(false);
    };

    const handleEditRule = (rule: NotificationRule) => {
        setNewTime(rule.scheduled_time);
        setNewMessage(rule.message);
        setEditingId(rule.id);
        setIsAdding(true);
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm('Sei sicuro di voler eliminare questa notifica globale?')) return;

        const previousRules = [...rules];
        setRules(rules.filter(r => r.id !== id));

        try {
            const { error } = await supabase
                .from('notification_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting rule:', err);
            setRules(previousRules);
        }
    };

    return (
        <div className="space-y-4">
            {/* ─── CTA Toggle ──────────────────────────────────── */}
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { if (isAdding) resetForm(); else { resetForm(); setIsAdding(true); } }}
                className="w-full relative overflow-hidden group cursor-pointer p-5 rounded-[var(--radius-xl)] text-left"
                style={{
                    background: 'linear-gradient(135deg, #0d9488, #06b6d4)',
                    border: '1px solid rgba(94,234,212,0.3)',
                }}
            >
                <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                }} />
                <div className="absolute top-0 right-0 p-3 opacity-15 group-hover:opacity-25 transition-opacity">
                    <Bell className="h-12 w-12 text-white" />
                </div>
                <div className="relative flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center border border-white/15">
                        <Plus className="h-5 w-5 text-white transition-transform duration-300" style={{ transform: isAdding ? 'rotate(45deg)' : 'rotate(0deg)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-0.5">
                            Per tutti i clienti
                        </p>
                        <h3 className="text-sm font-bold text-white leading-snug">
                            {isAdding ? 'Chiudi' : 'Nuova Notifica'}
                        </h3>
                    </div>
                </div>
            </motion.button>

            {/* ─── Expanded Form ───────────────────────────────────── */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
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
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center transition-all border shadow-inner bg-teal-500/10 text-teal-500 border-teal-500/20">
                                        {editingId ? <Edit2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                    </div>
                                    <h2 className="text-base font-black italic tracking-tighter uppercase leading-none text-foreground">
                                        {editingId ? (
                                            <>Modifica <span className="text-teal-500">Notifica</span></>
                                        ) : (
                                            <>Nuova <span className="text-teal-500">Notifica</span></>
                                        )}
                                    </h2>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSaveRule} className="space-y-4">
                                <div className="flex gap-3">
                                    <div className="relative w-28 shrink-0">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                        <input
                                            type="time"
                                            value={newTime}
                                            onChange={(e) => setNewTime(e.target.value)}
                                            className="w-full bg-muted/30 border border-border rounded-xl pl-8 pr-2 py-3 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none"
                                            required
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <EmojiTextarea
                                            value={newMessage}
                                            onChange={setNewMessage}
                                            placeholder="Es: Ricordati di bere!"
                                            className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-primary/10 outline-none resize-none min-h-[60px]"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="px-4 py-2.5 bg-muted/30 border border-border text-muted-foreground text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-muted/50 transition-colors"
                                    >
                                        Annulla
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-4 py-2.5 bg-teal-500 text-primary-foreground text-[9px] font-bold uppercase tracking-wider rounded-xl hover:bg-teal-500/90 transition-colors disabled:opacity-50 shadow-lg shadow-teal-500/20"
                                    >
                                        {saving ? '...' : (editingId ? 'Salva Modifiche' : 'Aggiungi')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Rules — Horizontal Scroll Cards ─────────────────── */}
            {loading ? (
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x no-scrollbar">
                    {[1, 2].map((i) => (
                        <div key={i} className="min-w-[200px] max-w-[200px] h-32 rounded-[var(--radius-xl)] bg-muted/30 border border-border animate-pulse snap-center" />
                    ))}
                </div>
            ) : rules.length === 0 ? (
                <div className="text-center py-8 rounded-[var(--radius-xl)] bg-muted/10 border border-dashed border-border flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-muted/20 flex items-center justify-center text-muted-foreground">
                        <Bell className="h-5 w-5" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nessuna notifica programmata</p>
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 snap-x no-scrollbar">
                    {rules.map((rule) => (
                        <motion.div
                            key={rule.id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            whileInView={{ opacity: 1, scale: 1 }}
                            className="min-w-[200px] max-w-[200px] snap-center relative overflow-hidden group rounded-[var(--radius-xl)] flex flex-col"
                            style={{
                                background: 'linear-gradient(135deg, #0d9488, #06b6d4)',
                                border: '1px solid rgba(94,234,212,0.3)',
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

                            <div className="relative p-4 flex-1 flex flex-col">
                                {/* Time badge */}
                                <div className="inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-lg bg-black/15 border border-white/10 mb-3">
                                    <Clock className="h-2.5 w-2.5 text-white/60" />
                                    <span className="text-[10px] font-black font-mono text-white">{rule.scheduled_time.slice(0, 5)}</span>
                                </div>

                                <p className="text-xs font-medium text-white/90 line-clamp-3 flex-1">{rule.message}</p>

                                {/* Actions */}
                                <div className="flex items-center justify-end mt-3 pt-2 border-t border-white/15 gap-1">
                                    <button
                                        onClick={() => handleEditRule(rule)}
                                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/30 transition-colors"
                                        title="Modifica"
                                    >
                                        <Edit2 className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteRule(rule.id)}
                                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-white/15 text-white hover:bg-red-500/80 transition-colors"
                                        title="Elimina"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
