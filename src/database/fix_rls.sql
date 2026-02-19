-- Add missing RLS policies for subscription_plans

DROP POLICY IF EXISTS "Clients can view their own plans" ON public.subscription_plans;
CREATE POLICY "Clients can view their own plans" ON public.subscription_plans 
FOR SELECT USING (client_id = auth.uid());

DROP POLICY IF EXISTS "Coaches can view their plans" ON public.subscription_plans;
CREATE POLICY "Coaches can view their plans" ON public.subscription_plans 
FOR SELECT USING (coach_id = auth.uid());

DROP POLICY IF EXISTS "Coaches can manage their plans" ON public.subscription_plans;
CREATE POLICY "Coaches can manage their plans" ON public.subscription_plans 
FOR ALL USING (coach_id = auth.uid());

-- Add missing RLS policies for board_posts

-- First, drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Clients can view relevant posts" ON public.board_posts;

-- Clients can view posts from coaches they are connected to
CREATE POLICY "Clients can view relevant posts" ON public.board_posts
FOR SELECT USING (
  (
    -- 1. Connected via client_coaches
    EXISTS (
      SELECT 1 FROM public.client_coaches 
      WHERE public.client_coaches.coach_id = public.board_posts.coach_id 
      AND public.client_coaches.client_id = auth.uid()
    )
    OR
    -- 2. Connected via clients_info (primary coach)
    EXISTS (
      SELECT 1 FROM public.clients_info
      WHERE public.clients_info.id = auth.uid()
      AND public.clients_info.coach_id = public.board_posts.coach_id
    )
    OR
    -- 3. Connected via active subscription plan
    EXISTS (
      SELECT 1 FROM public.subscription_plans
      WHERE public.subscription_plans.client_id = auth.uid()
      AND public.subscription_plans.coach_id = public.board_posts.coach_id
      AND (public.subscription_plans.end_date IS NULL OR public.subscription_plans.end_date >= CURRENT_DATE)
    )
  )
  AND
  (
    -- 4. Filter by target_client_ids if specified
    public.board_posts.target_client_ids IS NULL 
    OR 
    public.board_posts.target_client_ids = '{}'
    OR
    auth.uid() = ANY(public.board_posts.target_client_ids)
  )
);

DROP POLICY IF EXISTS "Coaches can manage their posts" ON public.board_posts;
CREATE POLICY "Coaches can manage their posts" ON public.board_posts
FOR ALL USING (coach_id = auth.uid());
