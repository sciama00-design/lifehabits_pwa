-- Migration: Daily Completions Table
-- Tracks daily habit/video completions per client per assignment

CREATE TABLE public.daily_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  completed_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT daily_completions_pkey PRIMARY KEY (id),
  CONSTRAINT daily_completions_unique UNIQUE (client_id, assignment_id, completed_date),
  CONSTRAINT daily_completions_client_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT daily_completions_assignment_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE
);

ALTER TABLE public.daily_completions ENABLE ROW LEVEL SECURITY;

-- Clients can view their own completions
CREATE POLICY "Clients can view own completions" ON public.daily_completions
  FOR SELECT USING (client_id = auth.uid());

-- Clients can insert their own completions
CREATE POLICY "Clients can insert own completions" ON public.daily_completions
  FOR INSERT WITH CHECK (client_id = auth.uid());

-- Clients can delete their own completions (unchecking)
CREATE POLICY "Clients can delete own completions" ON public.daily_completions
  FOR DELETE USING (client_id = auth.uid());

-- Coaches can view their clients' completions
CREATE POLICY "Coaches can view client completions" ON public.daily_completions
  FOR SELECT USING (public.is_coach_of_client(client_id));
