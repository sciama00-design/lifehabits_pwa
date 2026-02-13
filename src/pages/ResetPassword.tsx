import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function ResetPassword() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        // Check if we have a session or if we're coming from a reset link
        // Supabase handles the recovery session automatically when clicking the link
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                // If no session, the link might be expired or invalid
                // But sometimes reset flow doesn't require an active session BEFORE reset
                // Supabase typically sets a session when clicking the recovery link
            }
        });
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert('Le password non coincidono');
            return;
        }

        if (password.length < 6) {
            alert('La password deve essere di almeno 6 caratteri');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            // Sign out immediately after reset to prevent auto-login
            await supabase.auth.signOut();

            setIsSuccess(true);

            // Redirect after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (error: any) {
            console.error('Reset error:', error);
            alert(error.message || 'Errore durante il ripristino della password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground premium-gradient-bg">
            <div className="w-full max-w-xl space-y-12 rounded-[3.5rem] glass-card p-16 shadow-2xl animate-in zoom-in-95 duration-500 border-white/5 relative overflow-hidden">
                <div className="text-center space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-primary">Security Hub</h3>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase leading-none text-white">
                        Reset <span className="text-primary italic">Password</span>
                    </h1>
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Imposta le tue nuove credenziali di accesso</p>
                </div>

                {isSuccess ? (
                    <div className="text-center space-y-8 py-12 animate-in fade-in zoom-in duration-500">
                        <div className="flex justify-center">
                            <div className="bg-emerald-500/10 p-8 rounded-[2rem] border border-emerald-500/20 shadow-2xl shadow-emerald-500/10">
                                <svg className="w-16 h-16 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white">Configurazione <span className="text-emerald-500 text-3xl">OK</span></h2>
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] leading-relaxed">
                                Password aggiornata. Verrai reindirizzato al login tra pochi istanti per accedere con le nuove credenziali.
                            </p>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleReset} className="space-y-10">
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Nuova Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full rounded-2xl bg-white/5 border border-white/5 px-8 py-5 text-lg font-black tracking-widest text-white focus:bg-white/10 focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all placeholder:text-white/5"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 ml-1">Conferma Password</label>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full rounded-2xl bg-white/5 border border-white/5 px-8 py-5 text-lg font-black tracking-widest text-white focus:bg-white/10 focus:outline-none focus:ring-8 focus:ring-primary/5 transition-all placeholder:text-white/5"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-full bg-primary py-6 text-[10px] font-black uppercase tracking-[0.4em] text-primary-foreground shadow-2xl shadow-primary/30 transition-all hover:shadow-primary/50 active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-4"
                        >
                            {loading ? (
                                <>
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/20 border-t-primary-foreground" />
                                    <span>Syncing...</span>
                                </>
                            ) : 'Aggiorna Credenziali'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
