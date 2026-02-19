-- Clean up previous definitions to avoid conflicts
drop function if exists get_system_stats();
drop type if exists system_stats;

-- Create a specific type for the return value
create type system_stats as (
  db_size bigint,
  storage_size bigint,
  user_count bigint
);

-- The function to get system stats
create or replace function get_system_stats()
returns system_stats
language plpgsql
security definer
as $$
declare
  result system_stats;
begin
  -- Get Database Size
  select pg_database_size(current_database()) into result.db_size;

  -- Get Storage Size (Sum of all objects in storage.objects)
  -- Note: specific schema 'storage' access required
  select sum((metadata->>'size')::bigint) 
  from storage.objects 
  into result.storage_size;
  
  -- Handle NULL if no objects exist
  if result.storage_size is null then
    result.storage_size := 0;
  end if;

  -- Get User Count
  select count(*) from auth.users into result.user_count;

  return result;
end;
$$;

-- Grant permissions explicitly
grant execute on function get_system_stats() to authenticated;
grant execute on function get_system_stats() to service_role;
grant execute on function get_system_stats() to anon;
