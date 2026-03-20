import { useState, useMemo } from 'react';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths, 
    startOfWeek, 
    endOfWeek,
    isToday as isDateToday,
    isFuture
} from 'date-fns';
import { it } from 'date-fns/locale';
import { 
    ChevronLeft, 
    ChevronRight, 
    MapPin, 
    Video, 
    Trash2, 
    Edit2, 
    Calendar as CalendarIcon,
    MessageSquare,
    CheckCircle2,
    X,
    Plus,
    Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Appointment, DailyFeedback } from '@/types/database';
import { GoogleCalendarButton } from '../appointments/GoogleCalendarButton';
import clsx from 'clsx';

interface UnifiedCalendarProps {
    appointments: Appointment[];
    feedbacks: DailyFeedback[];
    onAddAppointment?: (date: Date) => void;
    onEditAppointment?: (appointment: Appointment) => void;
    onDeleteAppointment?: (id: string) => void;
    isCoach?: boolean;
    hideFeedback?: boolean;
    title?: string;
}

export function UnifiedCalendar({
    appointments,
    feedbacks,
    onAddAppointment,
    onEditAppointment,
    onDeleteAppointment,
    isCoach = false,
    hideFeedback = false
}: UnifiedCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = useMemo(() => eachDayOfInterval({
        start: startDate,
        end: endDate,
    }), [startDate, endDate]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const getDayData = (day: Date) => {
        const dayAppointments = appointments.filter(app => isSameDay(new Date(app.start_time), day));
        const dayFeedback = feedbacks.find(f => f.date === format(day, 'yyyy-MM-dd'));
        return { dayAppointments, dayFeedback };
    };

    const selectedDayData = selectedDate ? getDayData(selectedDate) : { dayAppointments: [], dayFeedback: null };

    return (
        <div className="relative">
            {/* Calendar Main Grid */}
            <div className="flex flex-col space-y-4">
                <div className="glass-card overflow-hidden rounded-[var(--radius-2xl)] border-white/5 shadow-2xl">
                    {/* Header */}
                    <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-br from-white/5 to-transparent">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                <CalendarIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-foreground capitalize tracking-tighter">
                                    {format(currentDate, 'MMMM yyyy', { locale: it })}
                                </h3>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" /> {appointments.length} Appuntamenti
                                    </span>
                                    {!hideFeedback && (
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                            <div className="h-1.5 w-1.5 rounded-full bg-rose-500" /> {feedbacks.length} Feedback
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={prevMonth}
                                className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/20 border border-white/5 text-foreground hover:bg-muted/40 transition-all hover:scale-110 active:scale-95 shadow-lg"
                            >
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button
                                onClick={nextMonth}
                                className="h-10 w-10 rounded-xl flex items-center justify-center bg-muted/20 border border-white/5 text-foreground hover:bg-muted/40 transition-all hover:scale-110 active:scale-95 shadow-lg"
                            >
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Grid Header */}
                    <div className="grid grid-cols-7 border-b border-white/5 bg-white/[0.02]">
                        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                            <div key={day} className="py-3 text-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Grid Content */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day: Date, idx: number) => {
                            const { dayAppointments, dayFeedback } = getDayData(day);
                            const isSelectedMonth = isSameMonth(day, monthStart);
                            const isToday = isDateToday(day);
                            const isSelected = selectedDate && isSameDay(day, selectedDate);

                            return (
                                <motion.div
                                    key={idx}
                                    whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
                                    onClick={() => setSelectedDate(day)}
                                    className={clsx(
                                        "min-h-[100px] p-2 border-r border-b border-white/5 group transition-all cursor-pointer relative",
                                        !isSelectedMonth && "opacity-20",
                                        isSelected && "bg-white/[0.05] ring-1 ring-inset ring-primary/30 z-10",
                                        isToday && !isSelected && "bg-primary/5"
                                    )}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={clsx(
                                            "text-xs font-black w-7 h-7 flex items-center justify-center rounded-xl transition-colors",
                                            isToday ? "bg-primary text-white shadow-lg shadow-primary/30" : 
                                            isSelected ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground group-hover:text-foreground"
                                        )}>
                                            {format(day, 'd')}
                                        </span>
                                        <div className="flex gap-0.5">
                                            {dayAppointments.length > 0 && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                                            )}
                                            {dayFeedback && !hideFeedback && (
                                                <div className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        {dayAppointments.slice(0, 2).map(app => (
                                            <div
                                                key={app.id}
                                                className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/10 border border-primary/10 text-primary rounded-md truncate"
                                            >
                                                {format(new Date(app.start_time), 'HH:mm')} {app.title}
                                            </div>
                                        ))}
                                        {dayAppointments.length > 2 && (
                                            <div className="text-[8px] text-muted-foreground/60 text-center font-black uppercase tracking-tighter">
                                                + {dayAppointments.length - 2} altri
                                            </div>
                                        )}
                                        {dayFeedback && !hideFeedback && (
                                            <div className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 border border-rose-500/10 text-rose-500 rounded-md truncate flex items-center gap-1">
                                                <CheckCircle2 className="h-2.5 w-2.5 shrink-0" /> Check-in
                                            </div>
                                        )}
                                    </div>

                                    {isCoach && isSelectedMonth && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddAppointment?.(day);
                                            }}
                                            className="absolute bottom-1 right-1 h-6 w-6 rounded-lg bg-primary/20 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-primary hover:text-white"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-6 py-4 px-6 glass-card rounded-2xl border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Appuntamenti</span>
                    </div>
                    {!hideFeedback && (
                        <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-muted-foreground">Feedback</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay View - Daily Details */}
            <AnimatePresence>
                {selectedDate && (
                    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDate(null)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 100, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 100, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="relative w-full h-[90vh] sm:h-auto sm:max-h-[85vh] sm:max-w-xl bg-card/90 backdrop-blur-3xl border-t sm:border border-white/10 sm:rounded-3xl rounded-t-3xl p-6 lg:p-8 space-y-6 shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between border-b border-white/10 pb-6 shrink-0">
                                <div>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Sparkles className="h-3 w-3 text-primary animate-pulse" />
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Dettaglio Giorno</p>
                                    </div>
                                    <h4 className="text-2xl font-black text-foreground capitalize tracking-tighter">
                                        {format(selectedDate, 'EEEE d MMMM', { locale: it })}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-3">
                                    {isCoach && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onAddAppointment?.(selectedDate);
                                            }}
                                            className="h-11 w-11 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 hover:scale-110 active:scale-95 transition-all"
                                        >
                                            <Plus className="h-5 w-5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedDate(null)}
                                        className="h-11 w-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all hover:rotate-90 hover:bg-white/10"
                                    >
                                        <X className="h-6 w-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-10 custom-scrollbar pt-4">
                                {/* Appointments Section */}
                                <section className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                            <CalendarIcon className="h-4.5 w-4.5" />
                                        </div>
                                        <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Appuntamenti</h5>
                                    </div>

                                    {selectedDayData.dayAppointments.length === 0 ? (
                                        <div className="p-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                                            <p className="text-xs font-medium text-muted-foreground/40 italic">Nessun appuntamento in programma.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4">
                                            {selectedDayData.dayAppointments.map(app => (
                                                <motion.div
                                                    key={app.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 hover:border-primary/40 transition-all group"
                                                >
                                                    <div className="flex items-start justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="px-3 py-1.5 rounded-xl bg-primary/15 text-primary text-[10px] font-black tracking-wider">
                                                                {format(new Date(app.start_time), 'HH:mm')}
                                                            </div>
                                                            <span className="text-muted-foreground/30 font-bold text-lg">→</span>
                                                            <div className="px-3 py-1.5 rounded-xl bg-muted/40 text-muted-foreground text-[10px] font-black tracking-wider">
                                                                {format(new Date(app.end_time), 'HH:mm')}
                                                            </div>
                                                        </div>
                                                        {isCoach && (
                                                            <div className="flex gap-1.5">
                                                                <button onClick={() => onEditAppointment?.(app)} className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"><Edit2 className="h-4 w-4" /></button>
                                                                <button onClick={() => onDeleteAppointment?.(app.id)} className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"><Trash2 className="h-4 w-4" /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <h6 className="text-base font-bold text-foreground mb-4 leading-tight">{app.title}</h6>
                                                    
                                                    <div className="flex flex-wrap gap-4 items-center">
                                                        <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
                                                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-black border border-primary/20">
                                                                { (isCoach ? app.client?.full_name : app.coach?.full_name)?.charAt(0) }
                                                            </div>
                                                            {isCoach ? app.client?.full_name : (
                                                                <span className="flex flex-col">
                                                                    <span className="text-[9px] uppercase tracking-widest opacity-50 font-black">Coach</span>
                                                                    {app.coach?.full_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex gap-4 ml-auto">
                                                            {app.location && (
                                                                <div className="flex items-center gap-2 text-[11px] font-bold text-muted-foreground/80">
                                                                    <MapPin className="h-3.5 w-3.5 text-primary/60" /> {app.location}
                                                                </div>
                                                            )}
                                                            {app.meeting_link && (
                                                                <a href={app.meeting_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[11px] font-bold text-primary hover:opacity-80">
                                                                    <Video className="h-3.5 w-3.5" /> Meeting
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="mt-5 pt-5 border-t border-white/5">
                                                        <GoogleCalendarButton appointment={app} className="!w-full !justify-center !py-3 !rounded-2xl !bg-white/5 !border-white/10 hover:!bg-white/10" />
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Feedback Section */}
                                {!hideFeedback && (
                                    <section className="space-y-5">
                                        <div className="flex items-center gap-3 pt-6 border-t border-white/10">
                                            <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 border border-rose-500/20">
                                                <MessageSquare className="h-4.5 w-4.5" />
                                            </div>
                                            <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Feedback Giornaliero</h5>
                                        </div>

                                        {!selectedDayData.dayFeedback ? (
                                            <div className="p-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                                                <p className="text-xs font-medium text-muted-foreground/40 italic">
                                                    {(isFuture(selectedDate) && !isDateToday(selectedDate)) 
                                                        ? "Il feedback sarà disponibile dopo l'invio." 
                                                        : "Nessun resoconto inviato per questa giornata."}
                                                </p>
                                            </div>
                                        ) : (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-6 rounded-[var(--radius-2xl)] bg-rose-500/[0.03] border border-rose-500/15 space-y-6 relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 p-6 opacity-10">
                                                    <Sparkles className="h-10 w-10 text-rose-500" />
                                                </div>
                                                
                                                <div className="space-y-2 relative">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-rose-500">Stato d'animo</p>
                                                    <p className="text-base font-medium text-foreground leading-relaxed italic pr-8">
                                                        "{selectedDayData.dayFeedback.feeling}"
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/10 shadow-lg">
                                                    <div className={clsx(
                                                        "h-10 w-10 rounded-xl flex items-center justify-center",
                                                        selectedDayData.dayFeedback.exercises_done ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                                                    )}>
                                                        {selectedDayData.dayFeedback.exercises_done ? <CheckCircle2 className="h-5 w-5" /> : <X className="h-5 w-5" />}
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Allenamento</p>
                                                        <p className={clsx(
                                                            "text-xs font-black uppercase tracking-wider",
                                                            selectedDayData.dayFeedback.exercises_done ? "text-emerald-400" : "text-rose-400"
                                                        )}>
                                                            {selectedDayData.dayFeedback.exercises_done ? "Sessione Completata 🎉" : "Sessione Saltata"}
                                                        </p>
                                                    </div>
                                                </div>

                                                {selectedDayData.dayFeedback.activities_summary && (
                                                    <div className="space-y-2">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Note Addizionali</p>
                                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-xs text-muted-foreground/90 font-medium whitespace-pre-wrap leading-relaxed">
                                                            {selectedDayData.dayFeedback.activities_summary}
                                                        </div>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </section>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
