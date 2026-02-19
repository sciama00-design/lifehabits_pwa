-- 1. Update UserRole check constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- 2. Helper Function: Check if user is an admin
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Update RLS Policies

-- Profiles: Admin can view all, update all, insert all
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all profiles" ON public.profiles FOR INSERT WITH CHECK (public.is_admin());

-- Clients Info: Admin can view all, update all, insert all
CREATE POLICY "Admins can view all clients info" ON public.clients_info FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all clients info" ON public.clients_info FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all clients info" ON public.clients_info FOR INSERT WITH CHECK (public.is_admin());

-- Client Coaches: Admin can view all, update all, insert all
CREATE POLICY "Admins can view all client_coaches" ON public.client_coaches FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all client_coaches" ON public.client_coaches FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all client_coaches" ON public.client_coaches FOR INSERT WITH CHECK (public.is_admin());

-- Content Library: Admin can view all, update all, insert all, delete all
CREATE POLICY "Admins can view all content" ON public.content_library FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all content" ON public.content_library FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all content" ON public.content_library FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete all content" ON public.content_library FOR DELETE USING (public.is_admin());

-- Subscription Plans: Admin can view all, update all, insert all, delete all
CREATE POLICY "Admins can view all plans" ON public.subscription_plans FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all plans" ON public.subscription_plans FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all plans" ON public.subscription_plans FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete all plans" ON public.subscription_plans FOR DELETE USING (public.is_admin());

-- Assignments: Admin can view all, update all, insert all, delete all
CREATE POLICY "Admins can view all assignments" ON public.assignments FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all assignments" ON public.assignments FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all assignments" ON public.assignments FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete all assignments" ON public.assignments FOR DELETE USING (public.is_admin());

-- Board Posts: Admin can view all, update all, insert all, delete all
CREATE POLICY "Admins can view all posts" ON public.board_posts FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all posts" ON public.board_posts FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can insert all posts" ON public.board_posts FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete all posts" ON public.board_posts FOR DELETE USING (public.is_admin());


-- 4. RPC Function to create a Coach
CREATE OR REPLACE FUNCTION public.create_coach_user(
  email TEXT,
  password TEXT,
  full_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- 1. Check if the executing user is an admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can create coaches.';
  END IF;

  -- 2. Create the user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    crypt(password, gen_salt('bf')),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('full_name', full_name, 'role', 'coach'),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- 3. Create the profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new_user_id, email, full_name, 'coach')
  ON CONFLICT (id) DO UPDATE SET
    role = 'coach',
    updated_at = NOW();

  RETURN new_user_id;
END;
$$;
