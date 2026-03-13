-- Adattamento della tabella coach_notifications
ALTER TABLE public.coach_notifications ADD COLUMN title TEXT NOT NULL DEFAULT 'Nuova Notifica';

-- Risoluzione bug RLS: i clienti non potevano leggere il loro coach_id dalla tabella client_coaches
CREATE POLICY "Clients can view their coaches"
    ON public.client_coaches FOR SELECT
    USING (client_id = auth.uid());
