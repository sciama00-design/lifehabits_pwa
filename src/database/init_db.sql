-- INIT DB SCRIPT FOR LIFE HABITS V2

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop existing tables if needed
-- DROP TABLE IF EXISTS public.board_posts CASCADE;
-- DROP TABLE IF EXISTS public.assignments CASCADE;
-- DROP TABLE IF EXISTS public.content_library CASCADE;
-- DROP TABLE IF EXISTS public.subscription_plans CASCADE;
-- DROP TABLE IF EXISTS public.client_coaches CASCADE;
-- DROP TABLE IF EXISTS public.clients_info CASCADE;
-- DROP TABLE IF EXISTS public.profiles CASCADE;

-- 3. Profiles (Common for Coaches and Clients)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'coach'::text CHECK (role = ANY (ARRAY['coach'::text, 'client'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- 4. Clients Info (Extra data for clients)
CREATE TABLE IF NOT EXISTS public.clients_info (
  id uuid NOT NULL,
  coach_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_info_pkey PRIMARY KEY (id),
  CONSTRAINT clients_info_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT clients_info_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 5. Client Coaches (Collaboration junction)
CREATE TABLE IF NOT EXISTS public.client_coaches (
  client_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  CONSTRAINT client_coaches_pkey PRIMARY KEY (client_id, coach_id),
  CONSTRAINT client_coaches_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT client_coaches_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 6. Content Library (Base repository)
CREATE TABLE IF NOT EXISTS public.content_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['habit'::text, 'video'::text, 'pdf'::text, 'post'::text])),
  title text NOT NULL,
  description text,
  link text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT content_library_pkey PRIMARY KEY (id),
  CONSTRAINT content_library_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id)
);

-- 7. Subscription Plans
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  client_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  start_date date,
  end_date date,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT subscription_plans_pkey PRIMARY KEY (id),
  CONSTRAINT subscription_plans_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT subscription_plans_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 8. Assignments (Customized per client)
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  client_id uuid NOT NULL,
  content_id uuid,
  title text NOT NULL,
  description text,
  link text,
  type text NOT NULL CHECK (type = ANY (ARRAY['habit'::text, 'video'::text, 'pdf'::text])),
  completed boolean DEFAULT false,
  scheduled_date date NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT assignments_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_library(id) ON DELETE SET NULL,
  CONSTRAINT assignments_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id) ON DELETE CASCADE
);

-- 9. Board Posts
CREATE TABLE IF NOT EXISTS public.board_posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  image_url text,
  target_client_ids uuid[],
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT board_posts_pkey PRIMARY KEY (id),
  CONSTRAINT board_posts_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id)
);

-- 10. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

-- 11. Helper Functions
CREATE OR REPLACE FUNCTION public.is_coach() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coach');
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper Function: Check if user is a coach of a specific client (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_coach_of_client(client_uuid uuid) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_coaches WHERE coach_id = auth.uid() AND client_id = client_uuid);
$$ LANGUAGE sql SECURITY DEFINER;

-- 12. Policies

-- Profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Clients Info
CREATE POLICY "Coaches can view their clients info" ON public.clients_info FOR SELECT
USING (
  coach_id = auth.uid() OR 
  public.is_coach_of_client(id)
);

CREATE POLICY "Coaches can insert new clients" ON public.clients_info FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their clients info" ON public.clients_info FOR UPDATE
USING (auth.uid() = coach_id);

-- Content Library
CREATE POLICY "Coaches can view their own content" ON public.content_library FOR SELECT
USING (public.is_coach());

CREATE POLICY "Coaches can insert content" ON public.content_library FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update content" ON public.content_library FOR UPDATE
USING (auth.uid() = coach_id);

CREATE POLICY "Coaches can delete content" ON public.content_library FOR DELETE
USING (auth.uid() = coach_id);

-- Assignments
CREATE POLICY "Clients can view their own assignments" ON public.assignments FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Clients can update completion status" ON public.assignments FOR UPDATE
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Coaches can manage assignments" ON public.assignments FOR ALL
USING (
  coach_id = auth.uid() OR 
  public.is_coach_of_client(client_id)
);

-- Board Posts
CREATE POLICY "Everyone can view board posts" ON public.board_posts FOR SELECT USING (true);
CREATE POLICY "Coaches can manage posts" ON public.board_posts FOR ALL USING (coach_id = auth.uid());

-- Subscription Plans
CREATE POLICY "Coaches can view their clients plans" ON public.subscription_plans FOR SELECT
USING (coach_id = auth.uid() OR public.is_coach_of_client(client_id));

CREATE POLICY "Coaches can manage plans" ON public.subscription_plans FOR ALL
USING (coach_id = auth.uid());

CREATE POLICY "Clients can view their own plans" ON public.subscription_plans FOR SELECT
USING (client_id = auth.uid());

-- Client Coaches
CREATE POLICY "Coaches can view their correlations" ON public.client_coaches FOR SELECT 
USING (coach_id = auth.uid() OR public.is_coach_of_client(client_id));

CREATE POLICY "Coaches can insert correlations" ON public.client_coaches FOR INSERT
WITH CHECK (coach_id = auth.uid());

-- 13. Create Client RPC Function
CREATE OR REPLACE FUNCTION public.create_client_user(
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
  -- 1. Check if the executing user is a coach
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coach') THEN
    RAISE EXCEPTION 'Only coaches can create clients.';
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
    jsonb_build_object('full_name', full_name, 'role', 'client'),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO new_user_id;

  -- 3. Create the profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new_user_id, email, full_name, 'client')
  ON CONFLICT (id) DO UPDATE SET
    role = 'client',
    updated_at = NOW();

  -- 4. Link to the coach
  INSERT INTO public.clients_info (id, coach_id)
  VALUES (new_user_id, auth.uid());

  -- 5. Link in client_coaches
  INSERT INTO public.client_coaches (client_id, coach_id)
  VALUES (new_user_id, auth.uid());

  RETURN new_user_id;
END;
$$;
