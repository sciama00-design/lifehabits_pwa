-- Attempt to fix missing profiles for existing Auth users
-- This script will look for users in auth.users that do not have a corresponding entry in public.profiles

INSERT INTO public.profiles (id, email, full_name, role)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'full_name', ''), 
  'coach' -- Default role as requested
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.users.id
);

-- Note: Ensure you have permissions to read from auth.users when running this script.
-- In Supabase Dashboard SQL Editor, you generally have superuser privileges so this will work.
