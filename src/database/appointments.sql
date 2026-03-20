-- Helper Function: Check if user is a coach
CREATE OR REPLACE FUNCTION public.is_coach() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coach');
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper Function: Check if user is a coach of a specific client (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_coach_of_client(client_uuid uuid) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_coaches WHERE coach_id = auth.uid() AND client_id = client_uuid);
$$ LANGUAGE sql SECURITY DEFINER;

-- Appointments table
CREATE TABLE public.appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  created_by uuid NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  location text,
  meeting_link text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT appointments_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT appointments_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT appointments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- RLS for appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Everyone involved can see the appointment
CREATE POLICY "Users can view their own appointments" ON public.appointments FOR SELECT
USING (
  auth.uid() = client_id OR 
  auth.uid() = coach_id OR 
  auth.uid() = created_by OR
  public.is_coach_of_client(client_id)
);

-- Coaches can manage appointments they created, are part of, or for their clients
CREATE POLICY "Coaches can manage appointments" ON public.appointments FOR ALL
USING (
  public.is_coach() AND (
    auth.uid() = coach_id OR 
    auth.uid() = created_by OR 
    public.is_coach_of_client(client_id)
  )
);

-- Index for performance
CREATE INDEX appointments_client_id_idx ON public.appointments(client_id);
CREATE INDEX appointments_coach_id_idx ON public.appointments(coach_id);
CREATE INDEX appointments_start_time_idx ON public.appointments(start_time);
