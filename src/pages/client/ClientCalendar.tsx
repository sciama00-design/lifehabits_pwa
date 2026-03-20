import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { appointmentService } from '@/lib/appointmentService';
import { UnifiedCalendar } from '@/components/shared/UnifiedCalendar';
import { useDailyFeedbacks } from '@/hooks/useDailyFeedbacks';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Appointment } from '@/types/database';

export default function ClientCalendar() {
  const { profile } = useAuth();
  const { fetchFeedbacks, feedbacks } = useDailyFeedbacks();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        const [appData] = await Promise.all([
          appointmentService.getAppointments(profile.id, 'client'),
          fetchFeedbacks(profile.id)
        ]);
        setAppointments(appData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile, fetchFeedbacks]);

  return (
    <div className="space-y-6">
      <section className="pt-1">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-white/5 pb-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-2.5 w-2.5 text-primary animate-pulse" />
              <span className="text-[9px] font-bold text-primary uppercase tracking-[0.3em] opacity-80">I Tuoi Appuntamenti</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-none">
              Il Tuo <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Calendario</span>
            </h1>
          </div>
        </motion.div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <UnifiedCalendar
          appointments={appointments}
          feedbacks={feedbacks}
          isCoach={false}
        />
      )}
    </div>
  );
}
