-- Add missing RLS policies for subscription_plans
CREATE POLICY "Clients can view their own plans" ON public.subscription_plans 
FOR SELECT USING (client_id = auth.uid());

CREATE POLICY "Coaches can view their plans" ON public.subscription_plans 
FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY "Coaches can manage their plans" ON public.subscription_plans 
FOR ALL USING (coach_id = auth.uid());

-- Add missing RLS policies for board_posts
-- Clients can view posts from coaches they are connected to
CREATE POLICY "Clients can view relevant posts" ON public.board_posts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.client_coaches 
    WHERE public.client_coaches.coach_id = public.board_posts.coach_id 
    AND public.client_coaches.client_id = auth.uid()
  )
);

CREATE POLICY "Coaches can manage their posts" ON public.board_posts
FOR ALL USING (coach_id = auth.uid());
