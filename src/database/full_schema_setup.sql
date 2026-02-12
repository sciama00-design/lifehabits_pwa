-- ==========================================
-- LIFE HABITS - COMPLETE DATABASE SCHEMA
-- ==========================================

-- RESET SCHEMA (Use for ex novo setup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_client_user(text,text,text) CASCADE;

DROP TABLE IF EXISTS public.board_posts CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.clients_info CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.content_library CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.client_coaches CASCADE;

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFILES Table
CREATE TABLE public.profiles (
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

-- 1.1 CLIENTS_INFO Table
CREATE TABLE public.clients_info (
  id uuid NOT NULL,
  coach_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_info_pkey PRIMARY KEY (id),
  CONSTRAINT clients_info_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT clients_info_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 2. CONTENT LIBRARY Table
CREATE TABLE public.content_library (
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

-- 3. SUBSCRIPTION PLANS Table
CREATE TABLE public.subscription_plans (
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

-- 5. CLIENT_COACHES Table (Many-to-Many)
CREATE TABLE public.client_coaches (
  client_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  CONSTRAINT client_coaches_pkey PRIMARY KEY (client_id, coach_id),
  CONSTRAINT client_coaches_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT client_coaches_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 6. ASSIGNMENTS Table
CREATE TABLE public.assignments (
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
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT assignments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT assignments_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.content_library(id) ON DELETE SET NULL
);

-- 7. BOARD POSTS Table
CREATE TABLE public.board_posts (
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

-- ==========================================
-- ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_coaches ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if user is a coach of a specific client (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_coach_of_client(client_uuid uuid) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_coaches WHERE coach_id = auth.uid() AND client_id = client_uuid);
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

-- Clients Info Policies
CREATE POLICY "Coaches can manage their clients info" ON public.clients_info FOR ALL USING (public.is_coach_of_client(id));
CREATE POLICY "Clients can view their own client info" ON public.clients_info FOR SELECT USING (id = auth.uid());

-- Content Library Policies
CREATE POLICY "Coaches can manage their own content" ON public.content_library FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "Coaches can view all content" ON public.content_library FOR SELECT USING (public.is_coach());
CREATE POLICY "Clients can view content linked to them" ON public.content_library FOR SELECT USING (EXISTS (SELECT 1 FROM public.assignments WHERE client_id = auth.uid() AND content_id = id));

-- Subscription Plans Policies
CREATE POLICY "Coaches can manage their own plans" ON public.subscription_plans FOR ALL USING (public.is_coach_of_client(client_id));
CREATE POLICY "Clients can view their assigned plan" ON public.subscription_plans FOR SELECT USING (client_id = auth.uid());

-- Assignments Policies
CREATE POLICY "Coaches can manage their assignments" ON public.assignments FOR ALL 
USING (
  public.is_coach_of_client(client_id) OR
  EXISTS (
    SELECT 1 FROM public.subscription_plans 
    WHERE id = plan_id AND (coach_id = auth.uid() OR public.is_coach_of_client(client_id))
  )
);
CREATE POLICY "Clients can update their own assignments (completion)" ON public.assignments FOR UPDATE USING (client_id = auth.uid());
CREATE POLICY "Clients can view their assignments" ON public.assignments FOR SELECT USING (client_id = auth.uid());

-- Board Posts Policies
CREATE POLICY "Coaches can manage their own board posts" ON public.board_posts FOR ALL USING (coach_id = auth.uid());
CREATE POLICY "Clients can view their coach posts" ON public.board_posts 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.client_coaches WHERE client_id = auth.uid() AND coach_id = coach_id)
  AND (target_client_ids IS NULL OR auth.uid() = ANY(target_client_ids))
);

-- Client Coaches Policies
CREATE POLICY "Coaches can view their collaborations" ON public.client_coaches FOR SELECT 
USING (coach_id = auth.uid() OR public.is_coach_of_client(client_id));

CREATE POLICY "Coaches can add collaborations" ON public.client_coaches FOR INSERT 
WITH CHECK (coach_id = auth.uid() OR public.is_coach_of_client(client_id));

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'coach')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    role = COALESCE(EXCLUDED.role, public.profiles.role),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile after signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RPC Function to create a client user
CREATE OR REPLACE FUNCTION public.create_client_user(
  email TEXT,
  password TEXT,
  full_name TEXT
) RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- 1. Check if the executing user is a coach
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coach') THEN
    RAISE EXCEPTION 'Only coaches can create clients.';
  END IF;

  -- 2. Insert into auth.users (Direct bypass for simplified management)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, 
    created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 
    email, crypt(password, gen_salt('bf')), NOW(), 
    '{"provider": "email", "providers": ["email"]}', 
    jsonb_build_object('full_name', full_name, 'role', 'client'),
    NOW(), NOW(), '', '', '', ''
  ) RETURNING id INTO new_user_id;

  -- 3. Create the profile (explicitly mark as client)
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new_user_id, email, full_name, 'client')
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- 4. Create clients_info record
  INSERT INTO public.clients_info (id, coach_id)
  VALUES (new_user_id, auth.uid());

  -- 5. Link in client_coaches
  INSERT INTO public.client_coaches (client_id, coach_id)
  VALUES (new_user_id, auth.uid());

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- STORAGE SETUP
-- ==========================================
-- Manual step: Create 'media' bucket, set to public.
