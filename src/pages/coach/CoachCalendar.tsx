import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { appointmentService } from '@/lib/appointmentService';
import { UnifiedCalendar } from '@/components/shared/UnifiedCalendar';
import { AddAppointmentModal } from '@/components/appointments/AddAppointmentModal';
import { Plus, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Appointment } from '@/types/database';

export default function CoachCalendar() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | undefined>();

  const fetchAppointments = async () => {
    if (!profile) return;
    try {
      const data = await appointmentService.getAppointments(profile.id, 'coach');
      setAppointments(data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [profile]);

  const handleAddClick = (date?: Date) => {
    setEditingAppointment(undefined);
    if (date) {
        // We can't easily pass it to the modal via 'editingAppointment' if it's new
        // so I'll just rely on the modal's internal logic or pass it as a prop.
        // For now, let's just open the modal.
    }
    setIsModalOpen(true);
  };

  const handleEditClick = (appointment: Appointment) => {
    setEditingAppointment(appointment);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
      try {
        await appointmentService.deleteAppointment(id);
        fetchAppointments();
      } catch (error) {
        console.error('Error deleting appointment:', error);
      }
    }
  };

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
              <span className="text-[9px] font-bold text-primary uppercase tracking-[0.3em] opacity-80">Gestione Appuntamenti</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tighter leading-none">
              Il Mio <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Calendario</span>
            </h1>
          </div>

          <button
            onClick={() => handleAddClick()}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-black uppercase tracking-widest text-xs rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Nuovo Appuntamento
          </button>
        </motion.div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <UnifiedCalendar
          appointments={appointments}
          feedbacks={[]}
          isCoach={true}
          onAddAppointment={handleAddClick}
          onEditAppointment={handleEditClick}
          onDeleteAppointment={handleDeleteClick}
          hideFeedback={true}
        />
      )}

      <AddAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchAppointments}
        appointment={editingAppointment}
      />
    </div>
  );
}
