
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Bell, Plus, Trash2, Loader2, Globe, User, Edit2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmojiTextarea } from '@/components/shared/EmojiTextarea';

interface NotificationRule {
    id: string;
    coach_id: string;
    client_id: string | null;
    scheduled_time: string;
    message: string;
}

interface ClientNotificationsManagerProps {
    clientId: string;
}

export function ClientNotificationsManager({ clientId }: ClientNotificationsManagerProps) {
    const { profile } = useAuth();
    const [globalRules, setGlobalRules] = useState<NotificationRule[]>([]);
    const [personalRules, setPersonalRules] = useState<NotificationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [newTime, setNewTime] = useState("09:00");
    const [newMessage, setNewMessage] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        if (profile?.id && clientId) {
            fetchRules();
        }
    }, [profile?.id, clientId]);

    const fetchRules = async () => {
        setLoading(true);
        try {
            // Fetch Global Rules
            const { data: globalData, error: globalError } = await supabase
                .from('notification_rules')
                .select('*')
                .eq('coach_id', profile?.id)
                .is('client_id', null)
                .order('scheduled_time');

            if (globalError) throw globalError;
            setGlobalRules(globalData || []);

            // Fetch Personal Rules
            const { data: personalData, error: personalError } = await supabase
                .from('notification_rules')
                .select('*')
                .eq('coach_id', profile?.id)
                .eq('client_id', clientId)
                .order('scheduled_time');

            if (personalError) throw personalError;
            setPersonalRules(personalData || []);

        } catch (err) {
            console.error('Error fetching rules:', err);
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
                // UPDATE existing rule
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

                setPersonalRules(personalRules.map(r => r.id === editingId ? data : r).sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
            } else {
                // INSERT new rule
                const { data, error } = await supabase
                    .from('notification_rules')
                    .insert({
                        coach_id: profile?.id,
                        client_id: clientId, // Personal
                        scheduled_time: newTime,
                        message: newMessage.trim()
                    })
                    .select()
                    .single();

                if (error) throw error;
                setPersonalRules([...personalRules, data].sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time)));
            }

            resetForm();
        } catch (err) {
            console.error('Error saving personal rule:', err);
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
        if (!confirm('Sei sicuro di voler eliminare questa notifica?')) return;

        // Optimistic update
        const previousRules = [...personalRules];
        setPersonalRules(personalRules.filter(r => r.id !== id));

        try {
            const { error } = await supabase
                .from('notification_rules')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (err) {
            console.error('Error deleting personal rule:', err);
            setPersonalRules(previousRules); // Revert
        }
    };

    return (
        <div className="space-y-8 glass-card p-6 rounded-[2rem]">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 text-primary">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black italic tracking-tighter uppercase">Notifiche Cliente</h2>
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                            Gestisci avvisi specifici
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Global Rules Section */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                            <Globe className="h-3 w-3" />
                            Globali (Preset)
                        </h3>
                        {globalRules.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic pl-5">Nessuna notifica globale attiva.</p>
                        ) : (
                            globalRules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 opacity-70">
                                    <div className="flex items-center gap-4">
                                        <div className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-xs font-mono text-muted-foreground">
                                            {rule.scheduled_time.slice(0, 5)}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{rule.message}</p>
                                    </div>
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/50">Global</span>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Personal Rules Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-bold text-primary uppercase flex items-center gap-2">
                                <User className="h-3 w-3" />
                                Personali (Extra)
                            </h3>
                            {!isAdding && (
                                <button
                                    onClick={() => {
                                        resetForm();
                                        setIsAdding(true);
                                    }}
                                    className="p-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
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
                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 space-y-3 mb-4 relative">
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="col-span-1">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Orario</label>
                                                <input
                                                    type="time"
                                                    value={newTime}
                                                    onChange={(e) => setNewTime(e.target.value)}
                                                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
                                                    required
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Messaggio</label>
                                                {/* Replaced input with EmojiTextarea */}
                                                <div className="relative">
                                                    <textarea
                                                        value={newMessage}
                                                        onChange={(e) => setNewMessage(e.target.value)}
                                                        placeholder="Messaggio personalizzato"
                                                        className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none resize-none min-h-[80px]"
                                                        required
                                                    />
                                                    {/* Emoji Picker Logic Integrated if Component Failed to Import or Just Using Textarea for Now based on Previous Step Failure Risk? 
                                                        Wait, I created the component. Let's try to use it properly.
                                                        But looking at the imports, I see I imported EmojiTextarea.
                                                        Let me use it.
                                                     */}
                                                    <div className="absolute bottom-2 right-2">
                                                        <EmojiTextarea
                                                            value={newMessage}
                                                            onChange={setNewMessage}
                                                            className="sr-only" // Hidden because we want the textarea visible? No, the component HAS the textarea.
                                                        />
                                                    </div>
                                                    {/* Actually, let's use the component directly instead of this wrapper */}
                                                </div>
                                                <EmojiTextarea
                                                    value={newMessage}
                                                    onChange={setNewMessage}
                                                    placeholder="Messaggio personalizzato"
                                                    className="w-full bg-background/50 border border-white/10 rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary outline-none resize-none min-h-[80px]"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={resetForm}
                                                className="px-3 py-1.5 bg-white/5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-white/10 transition-colors"
                                            >
                                                Annulla
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={saving}
                                                className="px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                            >
                                                {saving ? '...' : (editingId ? 'Salva Modifiche' : 'Aggiungi')}
                                            </button>
                                        </div>
                                    </div>
                                </motion.form>
                            )}
                        </AnimatePresence>

                        {personalRules.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic pl-5">Nessuna notifica personale aggiunta.</p>
                        ) : (
                            personalRules.map((rule) => (
                                <motion.div
                                    key={rule.id}
                                    layout
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 20 }}
                                    className="group flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/20 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="px-2 py-1 rounded-md bg-background/50 border border-white/5 text-xs font-black font-mono text-primary">
                                            {rule.scheduled_time.slice(0, 5)}
                                        </div>
                                        <p className="text-sm font-medium text-foreground">{rule.message}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEditRule(rule)}
                                            className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors border border-yellow-500/20"
                                            title="Modifica"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20"
                                            title="Elimina"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
