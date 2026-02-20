import { useClientAssignments } from '@/hooks/useClientAssignments';
import { ContentCard } from '@/components/shared/ContentCard';
import { motion } from 'framer-motion';
import { CheckSquare, Sparkles, Leaf } from 'lucide-react';
import { CoachSelector } from '@/components/shared/CoachSelector';

export default function ClientHabits() {
    const {
        assignments,
        plans,
        selectedPlanId,
        setSelectedPlanId,
        loading,
        error,
        toggleComplete,
        isCompletedToday
    } = useClientAssignments('habit');

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        </div>
    );

    if (error) return (
        <div className="p-10 text-center glass-card mx-6">
            <p className="text-destructive font-medium">Errore: {error}</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-10 pb-20">
            {/* Header */}
            <section className="pt-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Crescita Reale</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
                            Le Tue <span className="text-primary italic inline-flex items-center gap-2">Abitudini <Leaf className="h-8 w-8" /></span>
                        </h1>
                        <p className="text-[10px] md:text-sm text-muted-foreground font-medium opacity-60">
                            Mantieni la costanza per vedere i risultati
                        </p>
                    </motion.div>

                    {plans.length > 0 && (
                        <CoachSelector
                            plans={plans}
                            selectedPlanId={selectedPlanId}
                            onSelect={setSelectedPlanId}
                        />
                    )}
                </div>
            </section>

            {/* Habits List */}
            <section className="space-y-6">
                {assignments.length === 0 ? (
                    <div className="p-10 rounded-[2.5rem] glass-card text-center border-dashed">
                        <div className="bg-primary/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                            <Sparkles className="h-5 w-5 text-primary/40" />
                        </div>
                        <p className="text-xs font-medium text-muted-foreground/60 leading-relaxed px-4">
                            Nessun abitudine assegnata per ora.<br />Continua così! 🌿
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assignments.map(habit => (
                            <ContentCard
                                key={habit.id}
                                item={habit as any}
                                isCoachView={false}
                                isCompleted={isCompletedToday(habit.id)}
                                onToggleComplete={toggleComplete}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
