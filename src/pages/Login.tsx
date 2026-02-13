import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Mail, Lock, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const { user, profile, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const [isResetMode, setIsResetMode] = useState(false);
    const [resetSent, setResetSent] = useState(false);

    useEffect(() => {
        if (!authLoading && user) {
            if (profile?.role === 'coach') {
                navigate('/coach/dashboard');
            } else if (profile?.role === 'client') {
                navigate('/');
            }
        }
    }, [user, profile, authLoading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch (error: any) {
            console.error('Login error:', error);
            alert(error.message || 'Errore durante l\'accesso');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://lifehabits-pwa.pages.dev/reset-password',
            });
            if (error) throw error;
            setResetSent(true);
        } catch (error: any) {
            console.error('Reset error:', error);
            alert(error.message || 'Errore durante l\'invio del link');
        } finally {
            setLoading(false);
        }
    };

    const [showTimeout, setShowTimeout] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (authLoading && !user) {
                setShowTimeout(true);
            }
        }, 8000);
        return () => clearTimeout(timer);
    }, [authLoading, user]);

    if (authLoading && !user) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background premium-gradient-bg p-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                {showTimeout && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center space-y-4"
                    >
                        <p className="text-xs text-muted-foreground">Il caricamento sta impiegando più del previsto...</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                        >
                            Aggiorna Pagina
                        </button>
                    </motion.div>
                )}
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 premium-gradient-bg">
            <div className="w-full max-w-sm space-y-8 glass-card p-10 rounded-3xl shadow-2xl">
                <div className="flex flex-col items-center text-center">
                    <div className="mb-2 relative">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                        <img src="/icon.png" alt="LifeHabits" className="relative h-32 w-32 object-contain" />
                    </div>

                    <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-1">
                        Life<span className="text-primary italic">Habits</span>
                    </h1>
                    <p className="mt-2 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
                        {isResetMode ? 'Recupero Credenziali' : 'Wellness at 360°'}
                    </p>
                </div>

                {resetSent ? (
                    <div className="text-center space-y-6 py-4">
                        <div className="flex justify-center">
                            <div className="bg-primary/10 p-4 rounded-full border border-primary/20">
                                <CheckCircle2 className="w-8 h-8 text-primary" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold">Inviato!</h2>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Abbiamo inviato un link di recupero alla tua email. Controlla la tua posta.
                            </p>
                        </div>
                        <button
                            onClick={() => { setIsResetMode(false); setResetSent(false); }}
                            className="text-xs text-primary font-bold uppercase tracking-tight hover:underline flex items-center justify-center gap-2 w-full pt-4"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Torna al login
                        </button>
                    </div>
                ) : (
                    <form onSubmit={isResetMode ? handleResetPassword : handleLogin} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                                    <input
                                        type="email"
                                        required
                                        placeholder="nome@esempio.com"
                                        className="input-minimal pl-11"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                            </div>

                            {!isResetMode && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between ml-1">
                                        <label className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => setIsResetMode(true)}
                                            className="text-[10px] text-primary font-bold uppercase tracking-tight hover:underline"
                                        >
                                            Persa?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
                                        <input
                                            type="password"
                                            required
                                            placeholder="••••••••"
                                            className="input-minimal pl-11"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 rounded-full bg-primary text-[11px] font-bold uppercase tracking-widest text-primary-foreground shadow-2xl shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isResetMode ? 'Invia link' : 'Accedi'}
                        </button>

                        <div className="text-center pt-2">
                            {isResetMode ? (
                                <button
                                    type="button"
                                    onClick={() => setIsResetMode(false)}
                                    className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight hover:text-foreground flex items-center justify-center gap-2 mx-auto"
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                    Torna indietro
                                </button>
                            ) : (
                                <p className="text-[10px] text-muted-foreground/40 italic">
                                    LifeHabits Solution
                                </p>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
