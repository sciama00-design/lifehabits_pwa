import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Home, Settings, Play, Leaf } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import clsx from 'clsx';
import { MobileBottomNav } from './MobileBottomNav';
import { DesktopSidebar } from './DesktopSidebar';

export default function ClientLayout() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { to: '/', icon: Home, label: 'Home' },
        { to: '/habits', icon: Leaf, label: 'Abitudini' },
        { to: '/videos', icon: Play, label: 'Video' },
        { to: '/profile', icon: Settings, label: 'Profilo' },
    ];

    // Scroll-to-hide logic
    useEffect(() => {
        const handleScroll = (e: any) => {
            const currentScrollY = e.target.scrollTop;
            if (currentScrollY > lastScrollY && currentScrollY > 60) {
                setIsNavVisible(false);
            } else {
                setIsNavVisible(true);
            }
            setLastScrollY(currentScrollY);
        };

        const mainContent = document.getElementById('client-main-content');
        mainContent?.addEventListener('scroll', handleScroll);
        return () => mainContent?.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    // First access permission check
    const { subscribe, permission } = usePushNotifications(); // Add hook usage

    useEffect(() => {
        const hasVisited = localStorage.getItem('has_visited_app');

        if (!hasVisited && permission === 'default') {
            // First time visit, ask for permission
            subscribe();
            localStorage.setItem('has_visited_app', 'true');
        } else if (!hasVisited) {
            // Mark as visited even if permission is not default (e.g. already granted/denied)
            localStorage.setItem('has_visited_app', 'true');
        }
    }, [permission, subscribe]);

    return (
        <div className="flex flex-col md:flex-row h-screen bg-background text-foreground overflow-hidden premium-gradient-bg relative">
            {/* Desktop Sidebar */}
            <DesktopSidebar
                items={navItems}
                profile={profile}
                onLogout={handleLogout}
            />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Top Header (Mobile only) */}
                <header
                    className={clsx(
                        "glass-header px-6 border-b-0 transition-transform duration-500 md:hidden",
                        !isNavVisible && "-translate-y-full"
                    )}
                >
                    <div className="flex h-16 items-center justify-between">
                        <h1 className="text-lg font-bold tracking-tight">
                            Life<span className="text-primary italic">Habits</span>
                        </h1>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                                {profile?.full_name?.charAt(0) || 'C'}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main
                    id="client-main-content"
                    className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pt-16 md:pt-8"
                >
                    <div className="mx-auto max-w-5xl md:px-4">
                        <Outlet />
                    </div>
                    {/* Padding for bottom nav on mobile */}
                    <div className="h-28 md:hidden" />
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            <MobileBottomNav items={navItems} isVisible={isNavVisible} />
        </div>
    );
}
