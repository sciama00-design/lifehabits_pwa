import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { LogOut } from 'lucide-react';
import clsx from 'clsx';

interface NavItem {
    to: string;
    icon: LucideIcon;
    label: string;
}

interface DesktopSidebarProps {
    items: NavItem[];
    profile: any;
    onLogout: () => void;
}

export function DesktopSidebar({ items, profile, onLogout }: DesktopSidebarProps) {
    return (
        <aside className="hidden md:flex flex-col w-64 border-r border-border bg-background/50 backdrop-blur-xl h-screen sticky top-0">
            <div className="p-8">
                <h1 className="text-2xl font-bold tracking-tight">
                    Life<span className="text-primary italic">Habits</span>
                </h1>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {items.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            clsx(
                                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden',
                                isActive
                                    ? 'text-primary bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                            )
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <item.icon className="h-5 w-5" />
                                <span className="font-semibold">{item.label}</span>

                                {/* Selected Indicator */}
                                <div className={clsx(
                                    "absolute left-0 w-1 h-1/2 bg-primary rounded-r-full transition-transform duration-300",
                                    isActive ? "scale-100" : "scale-0"
                                )} />
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-6 border-t border-border mt-auto">
                <div className="flex items-center gap-3 mb-6 p-3 rounded-2xl bg-muted/30">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/20">
                        {profile?.full_name?.charAt(0) || 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">
                            {profile?.full_name || 'Cliente'}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                            Client Account
                        </p>
                    </div>
                </div>

                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all duration-300 group"
                >
                    <LogOut className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
                    <span className="font-semibold">Esci</span>
                </button>
            </div>
        </aside>
    );
}
