-- Drop existing constraints
ALTER TABLE public.content_library DROP CONSTRAINT IF EXISTS content_library_coach_id_fkey;
ALTER TABLE public.board_posts DROP CONSTRAINT IF EXISTS board_posts_coach_id_fkey;

-- Re-add with ON DELETE CASCADE
ALTER TABLE public.content_library
ADD CONSTRAINT content_library_coach_id_fkey
FOREIGN KEY (coach_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;

ALTER TABLE public.board_posts
ADD CONSTRAINT board_posts_coach_id_fkey
FOREIGN KEY (coach_id) REFERENCES public.profiles(id)
ON DELETE CASCADE;
