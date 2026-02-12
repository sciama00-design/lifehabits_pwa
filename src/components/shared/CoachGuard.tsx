import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export function CoachGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useAuth();

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-[#0f172a] text-white">Caricamento...</div>;
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
