import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    CheckCircle2,
    MessageSquare,
    CheckSquare,
    X
} from 'lucide-react';
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    isSameDay,
    addMonths,
    subMonths,
    getDay,
    isToday,
    isFuture
} from 'date-fns';
import { it } from 'date-fns/locale';
import { useDailyFeedbacks } from '@/hooks/useDailyFeedbacks';
import { useAuth } from '@/hooks/useAuth';

interface HabitCalendarProps {
    clientId?: string;
}

export function HabitCalendar({ clientId }: HabitCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const { profile } = useAuth();
    const { fetchFeedbacks, getFeedbackForDate } = useDailyFeedbacks();
    
    const effectiveClientId = clientId || profile?.id;

    // Fetch feedbacks for the current month view
    useEffect(() => {
        if (effectiveClientId) {
            const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
            fetchFeedbacks(effectiveClientId, start, end);
        }
    }, [currentMonth, effectiveClientId, fetchFeedbacks]);

    // Generate calendar days
    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        // Pad start with empty days (Monday start)
        const startDow = (getDay(monthStart) + 6) % 7; // Mon=0, Sun=6
        const padding = Array(startDow).fill(null);

        return [...padding, ...days];
    }, [currentMonth]);

    const getDayStatus = (date: Date): 'full' | 'none' | 'future' => {
        if (isFuture(date) && !isToday(date)) return 'future';
        const dateStr = format(date, 'yyyy-MM-dd');
        const feedback = getFeedbackForDate(dateStr);
        return feedback ? 'full' : 'none';
    };

    const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
    const selectedDayFeedback = selectedDateStr ? getFeedbackForDate(selectedDateStr) : null;

    const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    return (
        <div className="space-y-4">
            {/* Calendar Card */}
            <div className="glass-card p-5 relative overflow-hidden rounded-[var(--radius-xl)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            {clientId ? 'Calendario del Cliente' : 'Il Tuo Calendario'}
                        </h3>
                    </div>
                </div>

                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-4">
                    <button
                        onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
                        className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <h4 className="text-sm font-bold text-foreground capitalize">
                        {format(currentMonth, 'MMMM yyyy', { locale: it })}
                    </h4>
                    <button
                        onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
                        className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Week day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider py-1">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((day, i) => {
                        if (!day) {
                            return <div key={`pad-${i}`} className="aspect-square" />;
                        }

                        const status = getDayStatus(day);
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const today = isToday(day);

                        return (
                            <motion.button
                                key={day.toISOString()}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => status !== 'future' && setSelectedDate(isSelected ? null : day)}
                                disabled={status === 'future'}
                                className={`
                                    aspect-square rounded-xl flex items-center justify-center text-[11px] font-bold
                                    transition-all duration-200 relative
                                    ${isSelected
                                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-110'
                                        : today
                                            ? 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background'
                                            : ''
                                    }
                                    ${status === 'full' && !isSelected ? 'bg-primary/20 text-primary' : ''}
                                    ${status === 'none' && !isSelected ? 'text-foreground/70 hover:bg-muted/50' : ''}
                                    ${status === 'future' ? 'text-muted-foreground/20 cursor-default' : 'cursor-pointer'}
                                `}
                            >
                                {format(day, 'd')}
                                {status === 'full' && !isSelected && (
                                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                )}
                            </motion.button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-border/50">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary/30" />
                        <span className="text-[9px] text-muted-foreground">Completo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary/30" />
                        <span className="text-[9px] text-muted-foreground">Check-in Effettuato</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-muted/50 border border-border" />
                        <span className="text-[9px] text-muted-foreground">Nessuno</span>
                    </div>
                </div>
                {/* Selected Day Detail Panel Overlay */}
                <AnimatePresence>
                    {selectedDate && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 z-10 bg-card/95 backdrop-blur-md p-5 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                                <div>
                                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest">
                                        Dettaglio Giorno
                                    </p>
                                    <h4 className="text-sm font-bold text-foreground capitalize">
                                        {format(selectedDate, 'EEEE d MMMM', { locale: it })}
                                    </h4>
                                </div>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-all hover:rotate-90"
                                >
                                    <X className="h-4 w-4 text-foreground" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
                                {!selectedDayFeedback ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                        <div className="p-4 rounded-full bg-muted/30 mb-4">
                                            <Calendar className="h-8 w-8 text-muted-foreground/30" />
                                        </div>
                                        <p className="text-sm font-semibold text-foreground/80">
                                            Nessun check-in
                                        </p>
                                        <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">
                                            Non è stato effettuato il resoconto per questa giornata.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4 pt-1">
                                        <div className="space-y-2">
                                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary/80 flex items-center gap-1.5">
                                                <MessageSquare className="h-3.5 w-3.5" /> Come ti sentivi
                                            </h5>
                                            <div className="p-3 bg-muted/40 rounded-xl border border-border">
                                                <p className="text-sm text-foreground leading-relaxed">{selectedDayFeedback.feeling}</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary/80 flex items-center gap-1.5">
                                                <CheckSquare className="h-3.5 w-3.5" /> Esercizi
                                            </h5>
                                            <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center gap-2">
                                                {selectedDayFeedback.exercises_done ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                        <span className="text-sm font-medium text-foreground">Completati</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="h-4 w-4 text-destructive" />
                                                        <span className="text-sm font-medium text-foreground">Non completati</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {selectedDayFeedback.activities_summary && (
                                            <div className="space-y-2">
                                                <h5 className="text-[10px] font-bold uppercase tracking-widest text-primary/80 flex items-center gap-1.5">
                                                    <Calendar className="h-3.5 w-3.5" /> Riepilogo Attività
                                                </h5>
                                                <div className="p-3 bg-muted/40 rounded-xl border border-border">
                                                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedDayFeedback.activities_summary}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
