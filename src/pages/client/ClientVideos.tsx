import { useClientAssignments } from '@/hooks/useClientAssignments';
import { ContentCard } from '@/components/shared/ContentCard';
// import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { CoachSelector } from '@/components/shared/CoachSelector';

export default function ClientVideos() {
    const {
        assignments,
        plans,
        selectedPlanId,
        setSelectedPlanId,
        loading,
        error,
        toggleComplete,
        isCompletedToday
    } = useClientAssignments('video');

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
            {/* Header - Premium Horizontal Style */}
            <section className="pt-1 flex flex-row items-center justify-between gap-3 border-b border-white/5 pb-4">
                <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-none flex items-center gap-3">
                    I Tuoi Video <span className="shrink-0 text-xl md:text-3xl">🎥</span>
                </h1>
                {plans.length > 0 && (
                    <div className="shrink-0">
                        <CoachSelector
                            plans={plans}
                            selectedPlanId={selectedPlanId}
                            onSelect={setSelectedPlanId}
                        />
                    </div>
                )}
            </section>

            {/* Videos List */}
            <section className="space-y-6">
                {assignments.length === 0 ? (
                    <div className="p-10 rounded-[2.5rem] glass-card text-center border-dashed">
                        <div className="bg-primary/5 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                            <Sparkles className="h-5 w-5 text-primary/40" />
                        </div>
                        <p className="text-xs font-medium text-muted-foreground/60 leading-relaxed px-4">
                            Nessun video assegnato per ora.<br />Nuovi contenuti in arrivo! 🎥
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {assignments.map(video => (
                            <ContentCard
                                key={video.id}
                                item={video as any}
                                isCoachView={false}
                                isCompleted={isCompletedToday(video.id)}
                                onToggleComplete={toggleComplete}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
