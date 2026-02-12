import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
    Users,
    Library,
    LayoutDashboard,
    LogOut,
    Settings
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import clsx from 'clsx';

import { MobileBottomNav } from './MobileBottomNav';

export default function CoachLayout() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const navItems = [
        { to: '/coach/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/coach/clients', icon: Users, label: 'Clienti' },
        { to: '/coach/library', icon: Library, label: 'Libreria' },
        { to: '/coach/settings', icon: Settings, label: 'Impostazioni' },
    ];

    // Check if we are on the client detail page
    // Pattern: /coach/clients/:id (where id is not empty and not 'new' if that's a thing, but mostly just check depth)
    const isClientDetail = /^\/coach\/clients\/[^/]+$/.test(location.pathname);

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

        const mainContent = document.getElementById('main-content');
        mainContent?.addEventListener('scroll', handleScroll);
        return () => mainContent?.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden premium-gradient-bg">
            {/* Sidebar for Desktop */}
            <aside className="hidden w-64 flex-col border-r border-border bg-card/20 backdrop-blur-2xl md:flex">
                <div className="flex h-20 items-center px-8">
                    <h1 className="text-xl font-bold tracking-tight">
                        Life<span className="text-primary italic">Habits</span>
                    </h1>
                </div>

                <nav className="flex-1 space-y-1.5 px-6 py-4">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                clsx(
                                    'flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-300',
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                                )
                            }
                        >
                            <item.icon className="h-4.5 w-4.5" />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-6">
                    <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">
                            {profile?.full_name?.charAt(0) || 'C'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="truncate text-xs font-bold text-foreground">
                                {profile?.full_name || 'Coach'}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground uppercase tracking-widest leading-none mt-1">Status: Attivo</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                            <LogOut className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex flex-1 flex-col overflow-hidden relative">
                {/* Mobile Header - Globally Fixed, BUT hidden on ClientDetail */}
                {!isClientDetail && (
                    <header
                        className={clsx(
                            "glass-header px-6 border-b-0 md:hidden transition-transform duration-500",
                            !isNavVisible && "-translate-y-full"
                        )}
                    >
                        <div className="flex h-16 items-center justify-between">
                            <h1 className="text-lg font-bold tracking-tight">
                                Life<span className="text-primary italic">Habits</span>
                            </h1>
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                                {profile?.full_name?.charAt(0) || 'C'}
                            </div>
                        </div>
                    </header>
                )}

                <main
                    id="main-content"
                    className={clsx(
                        "flex-1 overflow-y-auto custom-scrollbar md:p-8",
                        // If header is hidden (ClientDetail), remove top padding so content flows naturally from top
                        // If header is visible, keep padding
                        isClientDetail ? "p-0 pt-0" : "p-4 pt-20 md:pt-8"
                    )}
                >
                    <div className={clsx("mx-auto max-w-5xl", !isClientDetail && "px-2")}>
                        <Outlet context={{ isNavVisible }} />
                    </div>
                    {/* Padding for bottom nav on mobile */}
                    <div className="h-24 md:hidden" />
                </main>

                {/* Mobile Bottom Navigation */}
                <MobileBottomNav items={navItems} isVisible={isNavVisible} />
            </div>
        </div>
    );
}
