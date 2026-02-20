-- Fix board_posts RLS: Drop the wide-open policy from init_db.sql
-- The correct policy "Clients can view relevant posts" from fix_rls.sql
-- already handles target_client_ids filtering properly.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Everyone can view board posts" ON public.board_posts;

-- Also drop the old "Clients can view their coach posts" if it exists (from full_schema_setup.sql)
DROP POLICY IF EXISTS "Clients can view their coach posts" ON public.board_posts;

-- Ensure the correct policy exists (idempotent)
DROP POLICY IF EXISTS "Clients can view relevant posts" ON public.board_posts;
CREATE POLICY "Clients can view relevant posts" ON public.board_posts
FOR SELECT USING (
  (
    -- Connected via client_coaches
    EXISTS (
      SELECT 1 FROM public.client_coaches 
      WHERE public.client_coaches.coach_id = public.board_posts.coach_id 
      AND public.client_coaches.client_id = auth.uid()
    )
    OR
    -- Connected via clients_info (primary coach)
    EXISTS (
      SELECT 1 FROM public.clients_info
      WHERE public.clients_info.id = auth.uid()
      AND public.clients_info.coach_id = public.board_posts.coach_id
    )
  )
  AND
  (
    -- Only show broadcast posts (null/empty) or posts targeted to this client
    public.board_posts.target_client_ids IS NULL 
    OR 
    public.board_posts.target_client_ids = '{}'
    OR
    auth.uid() = ANY(public.board_posts.target_client_ids)
  )
);
