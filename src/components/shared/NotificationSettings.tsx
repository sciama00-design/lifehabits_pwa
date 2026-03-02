
import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Bell, AlertCircle, Loader2, Smartphone, Share2 } from 'lucide-react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationSettings() {
    const { subscription, subscribe, error: pushError, isIOS, isStandalone } = usePushNotifications();
    const { profile } = useAuth();
    const [isEnabled, setIsEnabled] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (profile) {
            fetchSettings();
        }
    }, [profile]);

    const fetchSettings = async () => {
        setLoadingSettings(true);
        try {
            const { data, error } = await supabase
                .from('alert_settings')
                .select('is_enabled')
                .eq('user_id', profile?.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                setIsEnabled(data.is_enabled);
            }
        } catch (e) {
            console.error('Error fetching settings:', e);
        } finally {
            setLoadingSettings(false);
        }
    };

    const toggleEnabled = async () => {
        const newValue = !isEnabled;
        setIsEnabled(newValue); // Optimistic
        setSaving(true);

        try {
            const { error } = await supabase
                .from('alert_settings')
                .upsert({
                    user_id: profile?.id,
                    role: profile?.role,
                    is_enabled: newValue,
                }, { onConflict: 'user_id' });

            if (error) throw error;

            if (newValue && !subscription) {
                subscribe();
            }
        } catch (e) {
            console.error('Error saving settings:', e);
            setIsEnabled(!newValue); // Revert
        } finally {
            setSaving(false);
        }
    };

    // iOS not in standalone mode → show install guide
    const showIOSInstallGuide = isIOS && !isStandalone;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-6 glass-card p-8 rounded-[2rem]"
        >
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 text-primary">
                    <Bell className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Notifiche Push</h2>
            </div>

            {/* iOS Install Guide */}
            <AnimatePresence>
                {showIOSInstallGuide && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-3">
                            <div className="flex items-center gap-2 text-amber-400">
                                <Smartphone className="h-4 w-4 flex-shrink-0" />
                                <p className="text-xs font-bold">iPhone: installa l'app per ricevere notifiche</p>
                            </div>
                            <p className="text-[11px] text-amber-300/80 leading-relaxed">
                                Su iPhone le notifiche push funzionano solo dalla Home Screen. Segui questi passi:
                            </p>
                            <ol className="space-y-2">
                                {[
                                    { icon: '1', text: 'Apri questa pagina in Safari' },
                                    { icon: '2', text: 'Tocca l\'icona Condividi (□↑)' },
                                    { icon: '3', text: 'Scorri e tocca "Aggiungi a Home Screen"' },
                                    { icon: '4', text: 'Apri l\'app dalla Home Screen e torna qui' },
                                ].map((step) => (
                                    <li key={step.icon} className="flex items-start gap-2 text-[11px] text-amber-200/70">
                                        <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px]">
                                            {step.icon}
                                        </span>
                                        {step.text}
                                    </li>
                                ))}
                            </ol>
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-400/60">
                                <Share2 className="h-3 w-3" />
                                <span>Richiesto da Apple per le PWA su iPhone</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Message */}
            {pushError && (
                <div className="p-3 bg-destructive/10 text-destructive text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    {pushError}
                </div>
            )}

            <div className="space-y-6">
                {/* Account Preference Toggle */}
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <div className="space-y-1">
                        <p className="text-sm font-bold">Ricevi notifiche</p>
                        <p className="text-[10px] text-muted-foreground">
                            {profile?.role === 'coach'
                                ? "Abilita la ricezione di avvisi."
                                : "Ricevi promemoria e avvisi dai tuoi coach."}
                        </p>
                    </div>

                    {loadingSettings ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                        <button
                            onClick={toggleEnabled}
                            disabled={saving || showIOSInstallGuide}
                            title={showIOSInstallGuide ? 'Prima installa l\'app dalla Home Screen' : undefined}
                            className={clsx(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                                isEnabled && !showIOSInstallGuide ? "bg-primary" : "bg-muted",
                                showIOSInstallGuide && "opacity-40 cursor-not-allowed"
                            )}
                        >
                            <span
                                className={clsx(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    isEnabled && !showIOSInstallGuide ? "translate-x-6" : "translate-x-1"
                                )}
                            />
                        </button>
                    )}
                </div>
            </div>
        </motion.section>
    );
}
