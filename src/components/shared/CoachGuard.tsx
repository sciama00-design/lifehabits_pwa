import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';

export function CoachGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useAuth();
    const [showTimeout, setShowTimeout] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                setShowTimeout(true);
            }
        }, 8000);

        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-[#0f172a] p-6 text-white text-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary mb-4" />
                <p className="text-sm text-slate-400 animate-pulse font-medium">Verifica autorizzazione coach...</p>
                {showTimeout && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8 flex flex-col items-center gap-4"
                    >
                        <p className="text-xs text-slate-500 max-w-[250px] leading-relaxed">
                            La verifica sta richiedendo troppo tempo. Assicurati di avere una connessione stabile.
                        </p>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="text-xs font-bold text-primary uppercase tracking-widest border border-primary/40 px-6 py-2 rounded-full hover:bg-primary/5 transition-colors"
                        >
                            Torna alla Home
                        </button>
                    </motion.div>
                )}
            </div>
        );
    }

    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    if (profile.role !== 'coach') {
        // If a client tries to access coach area, send them to their dashboard
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}
