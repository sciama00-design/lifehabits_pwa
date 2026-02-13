-- Migration: Remove content_id from assignments table

-- 1. Remove the foreign key constraint
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_content_id_fkey;

-- 2. Remove the content_id column
ALTER TABLE public.assignments DROP COLUMN IF EXISTS content_id;

-- 3. Remove the RLS policy on content_library that depended on assignments.content_id
-- Previous policy: CREATE POLICY "Clients can view content linked to them" ON public.content_library FOR SELECT USING (EXISTS (SELECT 1 FROM public.assignments WHERE client_id = auth.uid() AND content_id = id));
DROP POLICY IF EXISTS "Clients can view content linked to them" ON public.content_library;
