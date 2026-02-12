-- Database Schema Life Habits v2

-- 1. Profiles (Common for Coaches and Clients)
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

-- 2. Clients Info (Extra data for clients)
CREATE TABLE public.clients_info (
  id uuid NOT NULL,
  coach_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT clients_info_pkey PRIMARY KEY (id),
  CONSTRAINT clients_info_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT clients_info_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 3. Client Coaches (Collaboration junction)
CREATE TABLE public.client_coaches (
  client_id uuid NOT NULL,
  coach_id uuid NOT NULL,
  CONSTRAINT client_coaches_pkey PRIMARY KEY (client_id, coach_id),
  CONSTRAINT client_coaches_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT client_coaches_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- 4. Content Library (Base repository)
CREATE TABLE public.content_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['habit'::text, 'video'::text, 'pdf'::text, 'post'::text])),
  title text NOT NULL,
  description text,
  link text,
  thumbnail_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT content_library_pkey PRIMARY KEY (id),
  CONSTRAINT content_library_coach_id_fkey FOREIGN KEY (coach_id) REFERENCES public.profiles(id)
);

-- 5. Subscription Plans
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

-- 6. Assignments (Customized per client)
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL,
  client_id uuid NOT NULL,
  content_id uuid,
  title text NOT NULL,
  description text,
  link text,
  thumbnail_url text,
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

-- 7. Board Posts
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

-- RLS POLICIES

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check if user is a coach
CREATE OR REPLACE FUNCTION public.is_coach() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'coach');
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper Function: Check if user is a coach of a specific client (prevents recursion)
CREATE OR REPLACE FUNCTION public.is_coach_of_client(client_uuid uuid) RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.client_coaches WHERE coach_id = auth.uid() AND client_id = client_uuid);
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: Everyone can view all profiles (facilitates search and collaboration)
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Client Coaches:
CREATE POLICY "Coaches can view their correlations" ON public.client_coaches FOR SELECT 
USING (coach_id = auth.uid() OR public.is_coach_of_client(client_id));

CREATE POLICY "Coaches can insert correlations" ON public.client_coaches FOR INSERT
WITH CHECK (coach_id = auth.uid() OR public.is_coach_of_client(client_id));

-- Clients Info: 
CREATE POLICY "Coaches can view their clients info" ON public.clients_info FOR SELECT
USING (
  coach_id = auth.uid() OR 
  public.is_coach_of_client(id)
);

CREATE POLICY "Coaches can insert new clients" ON public.clients_info FOR INSERT
WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coaches can update their clients info" ON public.clients_info FOR UPDATE
USING (auth.uid() = coach_id);


-- Assignments:
CREATE POLICY "Clients can view their own assignments" ON public.assignments FOR SELECT
USING (client_id = auth.uid());

CREATE POLICY "Clients can update completion status" ON public.assignments FOR UPDATE
USING (client_id = auth.uid())
WITH CHECK (client_id = auth.uid());

CREATE POLICY "Coaches can manage assignments" ON public.assignments FOR ALL
USING (
  coach_id = auth.uid() OR 
  public.is_coach_of_client(client_id) OR
  EXISTS (
    SELECT 1 FROM public.subscription_plans 
    WHERE id = plan_id AND (coach_id = auth.uid() OR public.is_coach_of_client(client_id))
  )
);
