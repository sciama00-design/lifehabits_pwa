import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function Expired() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            // Clear local storage as a precaution if needed
            window.localStorage.clear();
            navigate('/login', { replace: true });
        } catch (error: any) {
            console.error('Logout error:', error);
            alert('Errore durante il logout. Riprova.');
            // Even on error, it's often better to try and go to login
            navigate('/login', { replace: true });
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-white premium-gradient-bg">
            <div className="w-full max-w-xl space-y-12 rounded-[3.5rem] glass-card border-white/5 p-16 text-center shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-destructive/20" />

                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2.5rem] bg-destructive/10 text-destructive border border-destructive/20 shadow-2xl shadow-destructive/10">
                    <svg
                        className="h-16 w-16"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                    </svg>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-destructive">Subscription Timeout</h3>
                    <h1 className="text-5xl font-black italic tracking-tighter uppercase text-white leading-none">
                        Accesso <span className="text-destructive">Negato</span>
                    </h1>
                </div>

                <p className="text-sm font-black text-white/40 uppercase tracking-[0.2em] leading-relaxed max-w-sm mx-auto">
                    Il tuo abbonamento a <span className="text-primary italic">LifeHabits</span> non è più attivo. Contatta il tuo coach per riattivare i servizi.
                </p>

                <div className="pt-8">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-center gap-4 rounded-full bg-white/5 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-white transition-all hover:bg-white/10 border border-white/10 shadow-lg"
                    >
                        <LogOut className="h-4 w-4" />
                        Esci dall'Hub Account
                    </button>
                </div>
            </div>
        </div>
    );
}
