import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface NavItem {
    to: string;
    icon: LucideIcon;
    label: string;
}

interface MobileBottomNavProps {
    items: NavItem[];
    isVisible: boolean;
}

export function MobileBottomNav({ items, isVisible }: MobileBottomNavProps) {
    return (
        <motion.nav
            initial={{ y: 0 }}
            animate={{ y: isVisible ? 0 : 100 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-4 right-4 z-50 flex h-14 items-center justify-around rounded-2xl border border-border bg-background/60 px-2 backdrop-blur-2xl md:hidden shadow-2xl"
        >
            {items.map((item) => (
                <NavLink
                    key={item.to}
                    to={item.to}
                    className={() =>
                        clsx(
                            'relative h-12 flex-1 flex flex-col items-center justify-center gap-0.5 rounded-full transition-all duration-500',
                        )
                    }
                >
                    {({ isActive }) => (
                        <>
                            {isActive && (
                                <motion.div
                                    layoutId="activePill"
                                    className="absolute inset-x-0 inset-y-0 rounded-full bg-primary"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <item.icon className={clsx("relative z-10 h-5 w-5 transition-colors duration-300", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                            <span className={clsx("relative z-10 text-[9px] font-bold tracking-tight transition-colors duration-300", isActive ? "text-primary-foreground" : "text-muted-foreground")}>
                                {item.label}
                            </span>
                        </>
                    )}
                </NavLink>
            ))}
        </motion.nav>
    );
}
