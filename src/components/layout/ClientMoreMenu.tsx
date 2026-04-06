import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    Settings, 
    LogOut, 
    ChevronRight,
    LayoutGrid,
    Play,
    Calendar,
    Leaf
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useNavigate } from 'react-router-dom';

interface ClientMoreMenuProps {
    isOpen: boolean;
    onClose: () => void;
    profile: any;
}

export function ClientMoreMenu({ isOpen, onClose, profile }: ClientMoreMenuProps) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        onClose();
        navigate('/login');
    };

    const menuItems = [
        { to: '/habits', icon: Leaf, label: 'Abitudini', description: 'Monitora le tue abitudini' },
        { to: '/calendar', icon: Calendar, label: 'Calendario', description: 'I tuoi appuntamenti' },
        { to: '/videos', icon: Play, label: 'Video', description: 'Libreria video esercizi' },
        { to: '/profile', icon: Settings, label: 'Profilo', description: 'Gestisci le tue impostazioni' },
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[101] bg-black/60 backdrop-blur-sm md:hidden"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-y-0 right-0 z-[102] w-[280px] bg-background border-l border-border flex flex-col shadow-2xl md:hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-border bg-card/30">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-1 flex items-center gap-1.5">
                                    <LayoutGrid className="h-3.5 w-3.5" /> Menu
                                </h3>
                                <h2 className="text-xl font-black italic tracking-tighter uppercase text-foreground">
                                    Altre <span className="text-primary">Opzioni</span>
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="h-10 w-10 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:bg-muted transition-all hover:rotate-90"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Profile Summary */}
                        <div className="px-6 py-6 border-b border-border">
                            <div className="flex items-center gap-4 bg-card/50 p-4 rounded-2xl border border-border/50">
                                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
                                    {profile?.full_name?.charAt(0) || 'C'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground truncate">{profile?.full_name || 'Atleta'}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Atleta</p>
                                </div>
                            </div>
                        </div>

                        {/* Navigation Items */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {menuItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    onClick={onClose}
                                    className={({ isActive }) => `
                                        w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300
                                        ${isActive 
                                            ? 'bg-primary border-primary shadow-lg shadow-primary/20 text-primary-foreground' 
                                            : 'bg-card border-border text-foreground hover:bg-muted/50'}
                                    `}
                                >
                                    <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                                        <item.icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-bold leading-tight">{item.label}</p>
                                        <p className="text-[10px] opacity-60 font-medium leading-tight mt-0.5">{item.description}</p>
                                    </div>
                                    <ChevronRight className="h-4 w-4 opacity-40" />
                                </NavLink>
                            ))}
                        </div>

                        {/* Footer / Logout */}
                        <div className="p-6 border-t border-border mt-auto">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-destructive/10 text-destructive font-bold text-sm hover:bg-destructive hover:text-white transition-all duration-300 group"
                            >
                                <LogOut className="h-4.5 w-4.5 transition-transform group-hover:translate-x-1" />
                                ESCI DALL'APP
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
