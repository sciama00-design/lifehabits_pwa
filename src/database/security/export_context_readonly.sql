-- Run this single SELECT in the SQL Editor of the Life Habits project.
-- Exports metadata only: no user rows, passwords, auth tokens or cron headers.
-- Always returns one row; an empty section is explicitly [].
-- Function definitions may contain embedded secrets in an existing deployment:
-- inspect and redact such literals before sharing the exported result.
WITH target_tables AS (
  SELECT c.oid, n.nspname AS schema_name, c.relname AS table_name,
         c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
  FROM pg_catalog.pg_class c
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p')
    AND (
      (n.nspname = 'public' AND c.relname IN (
        'profiles', 'clients_info', 'client_coaches', 'content_library',
        'subscription_plans', 'assignments', 'board_posts', 'appointments',
        'daily_completions', 'daily_feedbacks', 'coach_notifications',
        'push_subscriptions', 'alert_settings', 'notification_rules',
        'notification_sent_log', 'daily_alert_sent_log', 'push_delivery_receipts'
      ))
      OR (n.nspname = 'storage' AND c.relname IN ('objects', 'buckets'))
    )
), trigger_rows AS (
  SELECT t.oid, t.tgfoid, n.nspname AS schema_name, c.relname AS table_name,
         t.tgname AS trigger_name, t.tgenabled AS enabled,
         pg_catalog.pg_get_triggerdef(t.oid) AS definition
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
    AND (c.oid IN (SELECT oid FROM target_tables)
         OR (n.nspname = 'auth' AND c.relname = 'users'))
), routine_rows AS (
  SELECT n.nspname AS schema_name, p.proname AS function_name,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
         p.prosecdef AS security_definer, p.proconfig AS settings,
         pg_get_userbyid(p.proowner) AS owner, p.proacl::text AS acl,
         pg_catalog.pg_get_functiondef(p.oid) AS definition
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE p.prokind = 'f'
    AND n.nspname = 'public'
    AND (p.proname IN (
           'handle_new_user', 'create_client_user', 'create_coach_user',
           'is_admin', 'is_coach', 'is_coach_of_client',
           'is_admin_actor', 'is_coach_actor', 'can_manage_client',
           'is_client_of_coach', 'can_read_profile', 'can_manage_shared_media',
           'is_trusted_maintenance_actor', 'claim_push_delivery'
         ) OR p.oid IN (SELECT tgfoid FROM trigger_rows))
), column_rows AS (
  SELECT tt.schema_name, tt.table_name, a.attname AS column_name,
         pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
         a.attnotnull AS not_null,
         pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expression,
         a.attnum AS position
  FROM target_tables tt
  JOIN pg_catalog.pg_attribute a ON a.attrelid = tt.oid
  LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
), constraint_rows AS (
  SELECT tt.schema_name, tt.table_name, con.conname AS constraint_name,
         pg_catalog.pg_get_constraintdef(con.oid) AS definition
  FROM target_tables tt
  JOIN pg_catalog.pg_constraint con ON con.conrelid = tt.oid
)
SELECT jsonb_build_object(
  'database_version', current_setting('server_version'),
  'tables', COALESCE((SELECT jsonb_agg(to_jsonb(t) - 'oid' ORDER BY schema_name, table_name) FROM target_tables t), '[]'::jsonb),
  'columns', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY schema_name, table_name, position) FROM column_rows c), '[]'::jsonb),
  'constraints', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY schema_name, table_name, constraint_name) FROM constraint_rows c), '[]'::jsonb),
  'policies', COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname, tablename, policyname)
    FROM pg_catalog.pg_policies p JOIN target_tables t ON t.schema_name=p.schemaname AND t.table_name=p.tablename), '[]'::jsonb),
  'table_grants', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_schema, g.table_name, g.grantee, g.privilege_type)
    FROM information_schema.table_privileges g JOIN target_tables t ON t.schema_name=g.table_schema AND t.table_name=g.table_name), '[]'::jsonb),
  'column_grants', COALESCE((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_schema, g.table_name, g.column_name, g.grantee, g.privilege_type)
    FROM information_schema.column_privileges g JOIN target_tables t ON t.schema_name=g.table_schema AND t.table_name=g.table_name), '[]'::jsonb),
  'indexes', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY schemaname, tablename, indexname)
    FROM pg_catalog.pg_indexes i JOIN target_tables t ON t.schema_name=i.schemaname AND t.table_name=i.tablename), '[]'::jsonb),
  'triggers', COALESCE((SELECT jsonb_agg(to_jsonb(t) - 'oid' - 'tgfoid' ORDER BY schema_name, table_name, trigger_name) FROM trigger_rows t), '[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY schema_name, function_name, arguments) FROM routine_rows f), '[]'::jsonb)
) AS live_context;
