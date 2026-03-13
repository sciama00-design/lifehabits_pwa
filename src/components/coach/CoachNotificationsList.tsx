import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle2, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface CoachNotificationsListProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: any[];
    unreadCount: number;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
}

export function CoachNotificationsList({
    isOpen,
    onClose,
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead
}: CoachNotificationsListProps) {
    const navigate = useNavigate();

    const handleNotificationClick = (n: any) => {
        if (!n.is_read) {
            markAsRead(n.id);
        }
        onClose();
        // Spostati sul profilo del cliente
        navigate(`/coach/clients/${n.client_id}`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="w-full h-full max-w-sm bg-background border-l border-border flex flex-col shadow-2xl"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border bg-card/50">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
                                    <Bell className="h-3.5 w-3.5" /> Notifiche
                                </h3>
                                <h2 className="text-xl font-black italic tracking-tighter uppercase text-foreground">
                                    I tuoi <span className="text-primary">Avvisi</span>
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-all hover:rotate-90"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Actions */}
                        {unreadCount > 0 && (
                            <div className="px-6 py-3 border-b border-border bg-muted/20 flex justify-between items-center">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    {unreadCount} da leggere
                                </span>
                                <button
                                    onClick={() => markAllAsRead()}
                                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/80 transition-colors flex items-center gap-1.5"
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Segna tutti letti
                                </button>
                            </div>
                        )}

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
                                    <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                                    <p className="text-sm font-bold text-foreground">Tutto tranquillo!</p>
                                    <p className="text-xs text-muted-foreground mt-1">Non hai nuove notifiche al momento.</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <motion.button
                                        key={n.id}
                                        whileTap={{ scale: 0.98 }}
                                        onClick={() => handleNotificationClick(n)}
                                        className={`w-full flex items-start text-left p-4 rounded-2xl border transition-all ${
                                            !n.is_read 
                                                ? 'bg-primary/5 border-primary/20 shadow-md shadow-primary/5' 
                                                : 'bg-card border-border hover:bg-muted/50'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0 pr-3">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />}
                                                <p className="text-xs font-bold text-foreground truncate">
                                                    {n.client?.full_name || 'Cliente'}
                                                </p>
                                                <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                    {format(new Date(n.created_at), 'd MMM HH:mm', { locale: it })}
                                                </span>
                                            </div>
                                            <h4 className={`text-sm tracking-tight mb-1 ${!n.is_read ? 'font-bold text-primary' : 'font-semibold text-foreground/90'}`}>
                                                {n.title}
                                            </h4>
                                            <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                                {n.message}
                                            </p>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground flex-shrink-0 self-center">
                                            <ChevronRight className="h-4 w-4" />
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
