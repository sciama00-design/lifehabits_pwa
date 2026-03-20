import { Calendar } from 'lucide-react';
import type { Appointment } from '@/types/database';

interface GoogleCalendarButtonProps {
  appointment: Appointment;
  className?: string;
}

export function GoogleCalendarButton({ appointment, className = "" }: GoogleCalendarButtonProps) {
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toISOString().replace(/-|:|\.\d+/g, '');
  };

  const title = encodeURIComponent(appointment.title);
  const details = encodeURIComponent(appointment.description || '');
  const location = encodeURIComponent(appointment.location || '');
  const dates = `${formatDateTime(appointment.start_time)}/${formatDateTime(appointment.end_time)}`;

  const googleUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;

  return (
    <a
      href={googleUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2 bg-[#4285F4] hover:bg-[#357ae8] text-white rounded-xl font-medium transition-all shadow-lg hover:shadow-[#4285F4]/20 active:scale-95 ${className}`}
    >
      <Calendar className="h-4 w-4" />
      <span>Aggiungi a Google Calendar</span>
    </a>
  );
}
