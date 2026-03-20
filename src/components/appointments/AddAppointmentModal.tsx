import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Link as LinkIcon, Users, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { appointmentService } from '@/lib/appointmentService';
import { useClients } from '@/hooks/useClients';
import { useAuth } from '@/hooks/useAuth';
import type { Appointment, Profile } from '@/types/database';
import { format } from 'date-fns';

interface AddAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment?: Appointment; // If provided, we are editing
}

export function AddAppointmentModal({ isOpen, onClose, onSuccess, appointment }: AddAppointmentModalProps) {
  const { profile } = useAuth();
  const { clients, searchCoaches } = useClients();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coaches, setCoaches] = useState<Profile[]>([]);

  const [formData, setFormData] = useState({
    client_id: '',
    coach_id: profile?.id || '',
    title: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '10:00',
    duration: '60', // minutes
    location: '',
    meeting_link: ''
  });

  useEffect(() => {
    if (appointment) {
      const start = new Date(appointment.start_time);
      const end = new Date(appointment.end_time);
      const durationMs = end.getTime() - start.getTime();
      const durationMins = Math.round(durationMs / (1000 * 60));

      setFormData({
        client_id: appointment.client_id,
        coach_id: appointment.coach_id,
        title: appointment.title,
        description: appointment.description || '',
        start_date: format(start, 'yyyy-MM-dd'),
        start_time: format(start, 'HH:mm'),
        duration: durationMins.toString(),
        location: appointment.location || '',
        meeting_link: appointment.meeting_link || ''
      });
    } else {
        setFormData(prev => ({ ...prev, coach_id: profile?.id || '' }));
    }
  }, [appointment, profile, isOpen]);

  useEffect(() => {
    const fetchCoaches = async () => {
      const data = await searchCoaches('');
      // searchCoaches excludes self by default in its current implementation, 
      // but for this feature we might want to include self.
      // Let's check searchCoaches implementation again.
      setCoaches(data);
    };
    if (isOpen) fetchCoaches();
  }, [isOpen, searchCoaches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const start = new Date(`${formData.start_date}T${formData.start_time}`);
      const end = new Date(start.getTime() + parseInt(formData.duration) * 60000);

      const appointmentData = {
        client_id: formData.client_id,
        coach_id: formData.coach_id,
        created_by: profile!.id,
        title: formData.title,
        description: formData.description,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        location: formData.location,
        meeting_link: formData.meeting_link
      };

      if (appointment) {
        await appointmentService.updateAppointment(appointment.id, appointmentData);
      } else {
        await appointmentService.createAppointment(appointmentData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-background/5 backdrop-blur-3xl p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-background/80 border border-white/5 rounded-3xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground">
              {appointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* Client */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Atleta</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                >
                  <option value="" disabled>Seleziona un atleta</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.profiles?.full_name || client.profiles?.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Coach */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Coach</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  required
                  value={formData.coach_id}
                  onChange={(e) => setFormData({ ...formData, coach_id: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                >
                  <option value={profile?.id}>{profile?.full_name} (Io)</option>
                  {coaches.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Titolo</label>
              <input
                required
                type="text"
                placeholder="Es: Prima consulenza, Revisione scheda..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Data</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    required
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Ora Inizio</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    required
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Durata (minuti)</label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
              >
                <option value="15">15 minuti</option>
                <option value="30">30 minuti</option>
                <option value="45">45 minuti</option>
                <option value="60">1 ora</option>
                <option value="90">1 ora e 30</option>
                <option value="120">2 ore</option>
              </select>
            </div>

            {/* Location & Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Luogo / Link</label>
              <div className="grid grid-cols-1 gap-2">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Luogo fisico"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder="Link riunione (Zoom, Meet...)"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase ml-1">Note (Opzionale)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
                placeholder="Dettagli aggiuntivi per l'appuntamento..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? 'Salvataggio...' : appointment ? 'Aggiorna Appuntamento' : 'Crea Appuntamento'}
            </button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
