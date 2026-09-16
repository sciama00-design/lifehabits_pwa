-- Migration: Add archived_at column to clients_info
-- This allows coaches to archive clients without deleting them.

-- 1. Add the archived_at column (NULL = active, timestamp = archived)
ALTER TABLE public.clients_info
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL DEFAULT NULL;

-- 2. Update the RPC function to support archiving
-- The frontend will use a direct UPDATE on clients_info (covered by existing RLS policy).

-- NOTE: No policy changes needed — the existing policies already allow coaches to
-- UPDATE their clients_info rows. The frontend hook will filter by archived_at IS NULL
-- for the active list and archived_at IS NOT NULL for the archived list.
