-- Enable the pgcrypto extension for password hashing (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a new user (client)
-- This function should be called by a coach. It creates a user in auth.users and a profile.
CREATE OR REPLACE FUNCTION public.create_client_user(
  email TEXT,
  password TEXT,
  full_name TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the privileges of the creator (postgres/admin), bypassing RLS
AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- 1. Check if the executing user is a coach (security check)
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
    '00000000-0000-0000-0000-000000000000', -- Default instance_id
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    email,
    crypt(password, gen_salt('bf')), -- Hash the password
    NOW(), -- Auto-confirm email
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

  -- 4. Create the clients_info record
  INSERT INTO public.clients_info (id, coach_id)
  VALUES (new_user_id, auth.uid());

  -- 5. Link in client_coaches
  INSERT INTO public.client_coaches (client_id, coach_id)
  VALUES (new_user_id, auth.uid());

  RETURN new_user_id;
END;
$$;
