
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Clock, Plus, Trash2, Loader2, Edit2, X } from 'lucide-react';
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
                // UPDATE
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
                // INSERT
                const { data, error } = await supabase
                    .from('notification_rules')
                    .insert({
                        coach_id: profile?.id,
                        client_id: null, // Global
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

        // Optimistic update
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
            setRules(previousRules); // Revert
        }
    };

    return (
        <div className="space-y-6 glass-card p-6 rounded-[2rem]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 text-primary">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black italic tracking-tighter uppercase">Notifiche Globali</h2>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            Per tutti i tuoi clienti attivi
                        </p>
                    </div>
                </div>

                {!isAdding && (
                    <button
                        onClick={() => {
                            resetForm();
                            setIsAdding(true);
                        }}
                        className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isAdding && (
                    <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        onSubmit={handleSaveRule}
                        className="overflow-hidden"
                    >
                        <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-4 relative">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-3 w-3" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">Orario</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                                        <input
                                            type="time"
                                            value={newTime}
                                            onChange={(e) => setNewTime(e.target.value)}
                                            className="w-full bg-background/50 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-sm font-bold focus:ring-1 focus:ring-primary outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1.5 block">Messaggio</label>
                                    <EmojiTextarea
                                        value={newMessage}
                                        onChange={setNewMessage}
                                        placeholder="Es: Ricordati di bere!"
                                        className="w-full bg-background/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-1 focus:ring-primary outline-none resize-none min-h-[80px]"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2 bg-white/5 text-muted-foreground text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-white/10 transition-colors"
                                >
                                    Annulla
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {saving ? '...' : (editingId ? 'Salva Modifiche' : 'Aggiungi Notifica')}
                                </button>
                            </div>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            <div className="space-y-3">
                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : rules.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
                        <p className="text-sm font-medium text-muted-foreground">Nessuna notifica globale impostata.</p>
                        <p className="text-xs text-muted-foreground/50 mt-1">Queste notifiche verranno inviate a tutti i tuoi clienti.</p>
                    </div>
                ) : (
                    rules.map((rule) => (
                        <motion.div
                            key={rule.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="px-3 py-1.5 rounded-lg bg-background/50 border border-white/5 text-sm font-black font-mono text-primary">
                                    {rule.scheduled_time.slice(0, 5)}
                                </div>
                                <p className="text-sm font-medium text-foreground">{rule.message}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleEditRule(rule)}
                                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                    title="Modifica"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Elimina"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
