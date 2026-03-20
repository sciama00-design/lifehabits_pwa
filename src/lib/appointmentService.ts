import { supabase } from './supabase';
import type { Appointment } from '@/types/database';

export const appointmentService = {
  async getAppointments(userId: string, role: 'coach' | 'client') {
    let query = supabase
      .from('appointments')
      .select(`
        *,
        client:profiles!appointments_client_id_fkey(*),
        coach:profiles!appointments_coach_id_fkey(*)
      `);

    if (role === 'coach') {
      // Coaches see appointments where they are the coach, the creator, or the coach of the client
      // The RLS handles the heavy lifting, but we can be explicit if needed.
      // However, usually we just want "my" appointments or "my clients'" appointments.
      query = query.or(`coach_id.eq.${userId},created_by.eq.${userId}`);
    } else {
      query = query.eq('client_id', userId);
    }

    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw error;
    return data as Appointment[];
  },

  async createAppointment(appointment: Omit<Appointment, 'id' | 'created_at' | 'updated_at'>) {
    const { data, error } = await supabase
      .from('appointments')
      .insert(appointment)
      .select()
      .single();

    if (error) throw error;
    return data as Appointment;
  },

  async updateAppointment(id: string, updates: Partial<Appointment>) {
    const { data, error } = await supabase
      .from('appointments')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Appointment;
  },

  async deleteAppointment(id: string) {
    const { error } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
