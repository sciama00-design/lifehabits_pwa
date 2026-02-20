import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar,
    CheckCircle2,
    Leaf,
    Play,
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
import type { Assignment } from '@/types/database';
import { useClientCompletions } from '@/hooks/useClientCompletions';

interface CoachHabitCalendarProps {
    assignments: Assignment[];
    clientId: string;
}

export function CoachHabitCalendar({ assignments, clientId }: CoachHabitCalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const {
        fetchCompletions,
        getCompletionsForDate,
        getCompletionCountByDate,
    } = useClientCompletions(clientId);

    useEffect(() => {
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        fetchCompletions(start, end);
    }, [currentMonth, fetchCompletions]);

    const calendarDays = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

        const startDow = (getDay(monthStart) + 6) % 7; // Mon=0
        const padding = Array(startDow).fill(null);

        return [...padding, ...days];
    }, [currentMonth]);

    const completionCounts = useMemo(() => getCompletionCountByDate(), [getCompletionCountByDate]);

    const getAssignmentsForDate = (dateStr: string) =>
        assignments.filter(a =>
            (a.type === 'habit' || a.type === 'video') &&
            a.scheduled_date <= dateStr
        );

    const getDayStatus = (date: Date): 'full' | 'partial' | 'none' | 'future' => {
        if (isFuture(date) && !isToday(date)) return 'future';
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayAssignments = getAssignmentsForDate(dateStr);
        if (dayAssignments.length === 0) return 'none';
        const count = completionCounts[dateStr] || 0;
        if (count === 0) return 'none';
        if (count >= dayAssignments.length) return 'full';
        return 'partial';
    };

    const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
    const selectedDayAssignments = selectedDateStr ? getAssignmentsForDate(selectedDateStr) : [];
    const selectedDayCompletions = selectedDateStr ? getCompletionsForDate(selectedDateStr) : [];
    const completedAssignmentIds = new Set(selectedDayCompletions.map(c => c.assignment_id));

    const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

    return (
        <div className="space-y-4">
            <div className="glass-card p-5 relative overflow-hidden rounded-[var(--radius-xl)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/10">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Calendario del Cliente
                        </h3>
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-wider bg-muted/30 px-2 py-1 rounded-full">
                        Sola lettura
                    </span>
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

                {/* Week Day Headers */}
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
                                    ${status === 'partial' && !isSelected ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : ''}
                                    ${status === 'none' && !isSelected ? 'text-foreground/70 hover:bg-muted/50' : ''}
                                    ${status === 'future' ? 'text-muted-foreground/20 cursor-default' : 'cursor-pointer'}
                                `}
                            >
                                {format(day, 'd')}
                                {status === 'full' && !isSelected && (
                                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                                )}
                                {status === 'partial' && !isSelected && (
                                    <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" />
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
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/30" />
                        <span className="text-[9px] text-muted-foreground">Parziale</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-muted/50 border border-border" />
                        <span className="text-[9px] text-muted-foreground">Nessuno</span>
                    </div>
                </div>

                {/* Selected Day Detail Panel */}
                <AnimatePresence>
                    {selectedDate && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 z-10 bg-card/95 backdrop-blur-md p-5 flex flex-col rounded-[var(--radius-xl)]"
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
                                    className="p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <X className="h-4 w-4 text-foreground" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-2">
                                {selectedDayAssignments.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                        <div className="p-3 rounded-full bg-muted/30 mb-3">
                                            <Calendar className="h-6 w-6 text-muted-foreground/50" />
                                        </div>
                                        <p className="text-xs text-muted-foreground/70">
                                            Nessuna abitudine o video assegnato
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        {selectedDayAssignments.map(assignment => {
                                            const done = completedAssignmentIds.has(assignment.id);
                                            return (
                                                <motion.div
                                                    key={assignment.id}
                                                    initial={{ opacity: 0, x: -5 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    className={`
                                                        flex items-center gap-3 p-3 rounded-xl border
                                                        ${done
                                                            ? 'bg-primary/5 border-primary/10'
                                                            : 'bg-card border-border/50 shadow-sm'
                                                        }
                                                    `}
                                                >
                                                    {/* Icon */}
                                                    <div className={`p-2 rounded-lg flex-shrink-0 ${done ? 'bg-primary/10' : 'bg-muted/40'}`}>
                                                        {assignment.type === 'habit'
                                                            ? <Leaf className={`h-4 w-4 ${done ? 'text-primary' : 'text-muted-foreground/60'}`} />
                                                            : <Play className={`h-4 w-4 ${done ? 'text-primary' : 'text-muted-foreground/60'}`} />
                                                        }
                                                    </div>

                                                    {/* Title */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-xs font-semibold truncate ${done ? 'text-foreground' : 'text-foreground/80'}`}>
                                                            {assignment.title}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium mt-0.5">
                                                            {assignment.type === 'habit' ? 'Abitudine' : 'Video'}
                                                        </p>
                                                    </div>

                                                    {/* Status — display only */}
                                                    {done ? (
                                                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                                                    ) : (
                                                        <div className="h-5 w-5 rounded-full border-2 border-muted/30 flex-shrink-0" />
                                                    )}
                                                </motion.div>
                                            );
                                        })}

                                        {/* Summary Footer */}
                                        <div className="text-center pt-2 pb-1">
                                            <p className="text-[10px] bg-muted/30 inline-block px-3 py-1 rounded-full text-muted-foreground font-medium">
                                                <span className="text-primary font-bold">{selectedDayCompletions.length}</span>
                                                <span className="opacity-50 mx-1">/</span>
                                                <span>{selectedDayAssignments.length}</span>
                                                <span className="ml-1 opacity-70">completati</span>
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
