import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const { profile, loading } = useAuthContext();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!profile || profile.role !== 'admin') {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <>{children}</>;
}
