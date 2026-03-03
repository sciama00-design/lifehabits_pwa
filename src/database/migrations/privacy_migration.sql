-- Migration: Add privacy_accepted_at to profiles
-- Run this in the Supabase SQL Editor
-- Safe to run on existing data: column is nullable (no existing rows are affected)

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamp with time zone DEFAULT NULL;
