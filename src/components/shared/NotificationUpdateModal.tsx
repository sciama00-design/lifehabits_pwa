
import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Bell, RefreshCw, Loader2, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

const STORAGE_KEY = 'lh_notification_refresh_v1';

export default function NotificationUpdateModal() {
    const { repairNotifications, loading } = usePushNotifications();
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Show only if not already refreshed/dismissed and user has notifications possible
        const hasBeenRefreshed = localStorage.getItem(STORAGE_KEY);
        if (!hasBeenRefreshed) {
            // Small delay to not overwhelm on load
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleUpdate = async () => {
        localStorage.setItem(STORAGE_KEY, 'refreshed');
        await repairNotifications();
    };

    const handleDismiss = () => {
        setIsOpen(false);
        // We'll show it again next session if they don't update, or we could mark as ignored.
        // Let's mark as 'ignored' for now to avoid being annoying, or 'v1' to allow future versions.
        localStorage.setItem(STORAGE_KEY, 'dismissed');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 shadow-2xl">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={handleDismiss}
                    />
                    
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] glass-card border-white/10 bg-background/80 shadow-2xl"
                    >
                        {/* Decorative background blur */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-[80px] rounded-full" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 blur-[60px] rounded-full" />

                        <div className="relative p-8 text-center space-y-6">
                            <button 
                                onClick={handleDismiss}
                                className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/5 text-muted-foreground/40 transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>

                            <div className="mx-auto w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center relative">
                                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse" />
                                <Bell className="h-10 w-10 text-primary relative z-10" />
                                <div className="absolute -top-1 -right-1">
                                    <Sparkles className="h-5 w-5 text-amber-400 animate-bounce" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h2 className="text-2xl font-black tracking-tight text-foreground">
                                    Notifiche Potenziate 🔔
                                </h2>
                                <p className="text-xs text-muted-foreground font-medium leading-relaxed px-4">
                                    Abbiamo aggiornato il sistema di notifiche per renderlo più affidabile. 
                                    Aggiorna la tua connessione per non perdere i messaggi dei tuoi coach.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 pt-4">
                                <button
                                    onClick={handleUpdate}
                                    disabled={loading}
                                    className={clsx(
                                        "w-full h-14 rounded-2xl bg-primary flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                                    )}
                                >
                                    {loading ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-5 w-5" />
                                    )}
                                    {loading ? 'Aggiornamento...' : 'Aggiorna Ora'}
                                </button>
                                
                                <button
                                    onClick={handleDismiss}
                                    disabled={loading}
                                    className="w-full h-12 rounded-2xl bg-white/5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:bg-white/10 hover:text-muted-foreground transition-all"
                                >
                                    Magari più tardi
                                </button>
                            </div>

                            <p className="text-[10px] text-muted-foreground/40 font-bold uppercase tracking-tighter">
                                L'app si ricaricherà automaticamente
                            </p>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
