import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check, Users } from 'lucide-react';
import type { SubscriptionPlan } from '@/types/database';

interface CoachSelectorProps {
    plans: SubscriptionPlan[];
    selectedPlanId: string;
    onSelect: (planId: string) => void;
}

export function CoachSelector({ plans, selectedPlanId, onSelect }: CoachSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedPlan = plans.find(p => p.id === selectedPlanId);
    const label = selectedPlanId === 'all'
        ? 'TUTTI I COACH'
        : (selectedPlan?.coach?.full_name?.toUpperCase() || 'COACH');

    return (
        <div className="relative" ref={containerRef}>
            <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-primary uppercase tracking-widest hover:bg-primary/20 transition-colors backdrop-blur-md"
            >
                {label}
                <ChevronDown
                    className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-56 z-50 overflow-hidden rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl safe-area-block"
                    >
                        <div className="p-1.5 space-y-0.5">
                            <button
                                onClick={() => {
                                    onSelect('all');
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${selectedPlanId === 'all'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                    }`}
                            >
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${selectedPlanId === 'all' ? 'bg-white/20' : 'bg-white/5'
                                    }`}>
                                    <Users className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left">
                                    Tutti i Coach
                                </span>
                                {selectedPlanId === 'all' && <Check className="h-3.5 w-3.5" />}
                            </button>

                            {plans.map(plan => {
                                const isSelected = selectedPlanId === plan.id;
                                const initial = plan.coach?.full_name?.charAt(0) || 'C';
                                return (
                                    <button
                                        key={plan.id}
                                        onClick={() => {
                                            onSelect(plan.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isSelected
                                                ? 'bg-primary text-primary-foreground'
                                                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                            }`}
                                    >
                                        <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] ${isSelected ? 'bg-white/20' : 'bg-white/5'
                                            }`}>
                                            {initial}
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider flex-1 text-left truncate">
                                            {plan.coach?.full_name || 'Coach'}
                                        </span>
                                        {isSelected && <Check className="h-3.5 w-3.5" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
