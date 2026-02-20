
import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Bell, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

export default function NotificationSettings() {
    const { subscription, subscribe, error: pushError } = usePushNotifications();
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

            // If enabling, also try to subscribe to push if not already
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
                            disabled={saving}
                            className={clsx(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                                isEnabled ? "bg-primary" : "bg-muted"
                            )}
                        >
                            <span
                                className={clsx(
                                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                    isEnabled ? "translate-x-6" : "translate-x-1"
                                )}
                            />
                        </button>
                    )}
                </div>
            </div>
        </motion.section>
    );
}
