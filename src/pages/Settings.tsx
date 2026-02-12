import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/components/shared/ThemeProvider";
import { User, Lock, Mail, Moon, Sun, Monitor, LogOut, CheckCircle2, AlertCircle } from "lucide-react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function Settings() {
    const { profile } = useAuth();
    const { theme, setTheme } = useTheme();
    const navigate = useNavigate();

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    const [loadingProfile, setLoadingProfile] = useState(false);
    const [loadingAccount, setLoadingAccount] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || "");
            setEmail(profile.email || "");
        }
    }, [profile]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile) return;

        setLoadingProfile(true);
        setMessage(null);

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: fullName })
                .eq('id', profile.id);

            if (error) throw error;
            setMessage({ type: 'success', text: 'Profilo aggiornato con successo!' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Errore durante l\'aggiornamento del profilo.' });
        } finally {
            setLoadingProfile(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingAccount(true);
        setMessage(null);

        try {
            if (!profile?.email) throw new Error("Email non trovata");

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: profile.email,
                password: currentPassword,
            });

            if (signInError) throw new Error("La password attuale non è corretta.");

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            setMessage({ type: 'success', text: 'Password aggiornata con successo!' });
            setCurrentPassword("");
            setNewPassword("");
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Errore durante l\'aggiornamento della password.' });
        } finally {
            setLoadingAccount(false);
        }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingAccount(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({ email: email });
            if (error) throw error;
            setMessage({ type: 'success', text: 'Ti abbiamo inviato una mail di conferma al nuovo indirizzo.' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Errore durante l\'aggiornamento dell\'email.' });
        } finally {
            setLoadingAccount(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
            <header className="pt-6">
                <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
                    Impostazioni
                </h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-3 opacity-60">Personalizza la tua esperienza</p>
            </header>

            <AnimatePresence>
                {message && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={clsx(
                            "flex items-center gap-3 p-4 rounded-2xl glass-card",
                            message.type === 'success' ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive"
                        )}
                    >
                        {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                        <span className="text-xs font-bold tracking-tight">{message.text}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                    {/* Profile Section */}
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 glass-card p-8 rounded-[2rem] h-full"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 text-primary">
                                <User className="h-4 w-4" />
                            </div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Profilo Personale</h2>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="input-minimal"
                                    placeholder="Filippo Rossi"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loadingProfile}
                                className="w-full h-11 rounded-full bg-primary text-[11px] font-bold uppercase tracking-widest text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                            >
                                {loadingProfile ? 'Salvataggio...' : 'Applica Modifiche'}
                            </button>
                        </form>
                    </motion.section>

                    {/* Appearance Section */}
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-6 glass-card p-8 rounded-[2rem]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-secondary/10 border border-secondary/10 text-secondary">
                                <Monitor className="h-4 w-4" />
                            </div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preferenze Visive</h2>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'light', label: 'Chiaro', icon: Sun },
                                { id: 'dark', label: 'Scuro', icon: Moon },
                                { id: 'system', label: 'Auto', icon: Monitor },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id as any)}
                                    className={clsx(
                                        "flex flex-col items-center justify-center gap-2 h-20 rounded-2xl border transition-all duration-300",
                                        theme === t.id
                                            ? "border-primary bg-primary/10 text-primary shadow-inner"
                                            : "border-white/5 bg-background/20 text-muted-foreground/40 hover:bg-white/5 hover:text-foreground"
                                    )}
                                >
                                    <t.icon className="h-4 w-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </motion.section>
                </div>

                <div className="space-y-6">
                    {/* Account Section */}
                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-8 glass-card p-8 rounded-[2rem]"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-primary/10 border border-primary/10 text-primary">
                                <Lock className="h-4 w-4" />
                            </div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Accesso e Sicurezza</h2>
                        </div>

                        <div className="space-y-8">
                            <form onSubmit={handleUpdateEmail} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Email</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/20" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="input-minimal pl-11"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loadingAccount || email === profile?.email}
                                            className="h-11 px-6 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-colors disabled:opacity-30"
                                        >
                                            Aggiorna
                                        </button>
                                    </div>
                                </div>
                            </form>

                            <div className="h-px bg-white/5 w-full" />

                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div className="grid gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Attuale</label>
                                        <input
                                            type="password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            className="input-minimal"
                                            placeholder="••••••••"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Nuova Password</label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="input-minimal"
                                            placeholder="Min. 6 caratteri"
                                            required
                                            minLength={6}
                                        />
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loadingAccount || !newPassword}
                                    className="w-full h-11 rounded-full bg-primary/10 text-primary border border-primary/10 text-[11px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-all disabled:opacity-30"
                                >
                                    {loadingAccount ? 'Salvataggio...' : 'Ripristina Password'}
                                </button>
                            </form>
                        </div>
                    </motion.section>

                    {/* Logout Section */}
                    <motion.section
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="p-8 rounded-[2rem] bg-destructive/5 border border-destructive/10 text-center"
                    >
                        <h2 className="text-sm font-bold text-destructive uppercase tracking-widest mb-2">Logout</h2>
                        <p className="text-xs text-muted-foreground font-medium opacity-60 mb-6 px-4 leading-relaxed">
                            Ti disconnetterai dal tuo account Life Habits su questo dispositivo.
                        </p>
                        <button
                            onClick={handleLogout}
                            className="flex items-center justify-center gap-2 mx-auto h-11 rounded-full bg-destructive text-[11px] font-bold uppercase tracking-widest text-white px-10 hover:opacity-90 transition-all shadow-lg shadow-destructive/20"
                        >
                            <LogOut className="h-4 w-4" />
                            Esci Adesso
                        </button>
                    </motion.section>
                </div>
            </div>
        </div>
    );
}
