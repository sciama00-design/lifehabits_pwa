import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export default function PrivacyConsentModal() {
    const { profile, refreshProfile } = useAuth();
    const [coachName, setCoachName] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);

    useEffect(() => {
        if (!profile || profile.role !== 'client') return;

        // Fetch coach name from clients_info joined with profiles
        supabase
            .from('clients_info')
            .select('coach_id, profiles!clients_info_coach_id_fkey(full_name)')
            .eq('id', profile.id)
            .single()
            .then(({ data }) => {
                const coachProfile = data?.profiles;
                if (coachProfile && !Array.isArray(coachProfile)) {
                    setCoachName((coachProfile as { full_name: string | null }).full_name || 'Il tuo coach');
                } else {
                    setCoachName('Il tuo coach');
                }
            });
    }, [profile]);

    const handleAccept = async () => {
        if (!profile) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ privacy_accepted_at: new Date().toISOString() })
                .eq('id', profile.id);

            if (error) throw error;

            setAccepted(true);
            // Brief delay for the success animation before closing
            setTimeout(() => {
                refreshProfile();
            }, 800);
        } catch (err) {
            console.error('Error saving privacy consent:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Blurred overlay */}
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="relative w-full max-w-md glass-card rounded-[2rem] p-8 shadow-2xl flex flex-col gap-6"
            >
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                        <div className="relative p-4 rounded-2xl bg-primary/10 border border-primary/20">
                            <Shield className="h-8 w-8 text-primary" />
                        </div>
                    </div>
                </div>

                {/* Header */}
                <div className="text-center space-y-1">
                    <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                        Informativa sulla Privacy
                    </h2>
                    <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                        Prima di continuare
                    </p>
                </div>

                {/* Body */}
                <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
                    <p>
                        Il tuo programma è gestito da{' '}
                        <span className="font-bold text-foreground">
                            {coachName ?? '…'}
                        </span>
                        , titolare del trattamento dei tuoi dati personali, nell'ambito del servizio <span className="font-bold text-primary">LifeHabits</span>.
                    </p>

                    <div className="rounded-2xl bg-primary/5 border border-primary/10 p-4 space-y-2">
                        <p className="text-[11px] font-bold text-foreground/70 uppercase tracking-widest mb-3">
                            Dati che conserviamo
                        </p>
                        {[
                            { label: 'Nome e indirizzo email', desc: 'per identificarti nel servizio' },
                            { label: 'Dati del percorso salute', desc: 'abitudini, video, piani assegnati' },
                            { label: 'Progressi giornalieri', desc: 'completamenti registrati ogni giorno' },
                        ].map((item) => (
                            <div key={item.label} className="flex items-start gap-2">
                                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span>
                                    <span className="font-semibold text-foreground">{item.label}</span>
                                    {' — '}
                                    {item.desc}
                                </span>
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-muted-foreground/60">
                        I tuoi dati non vengono ceduti a terzi e vengono trattati esclusivamente nell'ambito del tuo percorso. Puoi richiedere la cancellazione in qualsiasi momento contattando il tuo coach.
                    </p>
                </div>

                {/* CTA */}
                <button
                    onClick={handleAccept}
                    disabled={loading || accepted}
                    className="w-full h-13 rounded-full bg-primary text-[11px] font-bold uppercase tracking-widest text-primary-foreground shadow-2xl shadow-primary/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 py-4"
                >
                    {accepted ? (
                        <>
                            <CheckCircle2 className="h-4 w-4" />
                            Accettato
                        </>
                    ) : loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            <CheckCircle2 className="h-4 w-4" />
                            Ho letto e accetto
                        </>
                    )}
                </button>

                <p className="text-center text-[10px] text-muted-foreground/30 font-medium -mt-2">
                    Devi accettare per continuare a usare l'app
                </p>
            </motion.div>
        </div>
    );
}
