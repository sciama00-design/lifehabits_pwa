-- Create a function to get the database size
-- Run this in the Supabase SQL Editor

create or replace function get_db_size()
returns bigint
language sql
security definer
as $$
  select pg_database_size(current_database());
$$;
