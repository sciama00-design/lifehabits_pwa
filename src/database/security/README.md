# Security SQL candidate

`apply_security_fixes_candidate.sql` is a local review candidate for F01, F02, F04, F06, F07 and F08, and folds in the existing board-post policy repair so a legacy `USING (true)` policy cannot remain effective. It is not a numbered Supabase migration and has not been applied to any Supabase project. There is no confirmed staging database; review the target project's live schema and policy state before deciding whether to adapt or apply it.

The supplied live metadata also shows RLS disabled on the two notification delivery logs. The candidate now protects these internal tables while preserving service_role read/write access; no frontend callers were found. Their actual grants and deployed server callers still require verification before rollout. See `project_docs/SECURITY_LIVE_CONTEXT_REVIEW_2026-11-07.md` for the snapshot-based test results and remaining limits.

## Read-only preflight

For a single supplementary export with explicit empty arrays, run `export_context_readonly.sql`. It reads metadata only and always returns one JSON row containing table structure, RLS flags, constraints, triggers and relevant function definitions. Inspect function definitions for embedded secrets before sharing. Export review: `project_docs/SECURITY_LIVE_CONTEXT_REVIEW_2026-11-07.md`.

Run these queries against the intended database first. Inspect results for unexpected policies, grants, triggers, media setup and legacy notification rules. Do not paste credentials or keys into the audit notes.

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN (
  'profiles', 'clients_info', 'client_coaches', 'assignments',
  'subscription_plans', 'content_library', 'daily_completions', 'notification_rules', 'board_posts'
)) OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'storage')
  AND table_name IN (
    'profiles', 'clients_info', 'client_coaches', 'assignments',
    'subscription_plans', 'content_library', 'daily_completions', 'notification_rules', 'objects', 'board_posts'
  )
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_schema, table_name, grantee, privilege_type;

SELECT p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef,
       p.proconfig, p.proacl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user', 'create_client_user', 'create_coach_user',
    'is_admin', 'is_coach', 'is_coach_of_client'
  )
ORDER BY p.proname;

SELECT t.tgname, pg_get_triggerdef(t.oid)
FROM pg_trigger t
WHERE t.tgrelid IN ('auth.users'::regclass, 'public.profiles'::regclass)
  AND NOT t.tgisinternal
ORDER BY t.tgname;

SELECT n.nspname AS schema_name, c.relname AS table_name,
       t.tgname, pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('assignments', 'clients_info', 'notification_rules')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'media';

SELECT 'client_coaches' AS source, cc.client_id AS client_id, cc.coach_id AS coach_id,
       client.role AS client_role, coach.role AS coach_role
FROM public.client_coaches cc
LEFT JOIN public.profiles client ON client.id = cc.client_id
LEFT JOIN public.profiles coach ON coach.id = cc.coach_id
WHERE client.role IS DISTINCT FROM 'client' OR coach.role IS DISTINCT FROM 'coach'
UNION ALL
SELECT 'clients_info', ci.id, ci.coach_id, client.role, coach.role
FROM public.clients_info ci
LEFT JOIN public.profiles client ON client.id = ci.id
LEFT JOIN public.profiles coach ON coach.id = ci.coach_id
WHERE client.role IS DISTINCT FROM 'client' OR coach.role IS DISTINCT FROM 'coach';

SELECT nr.coach_id, nr.client_id, count(*) AS rule_count
FROM public.notification_rules nr
LEFT JOIN public.profiles coach ON coach.id = nr.coach_id
LEFT JOIN public.profiles client ON client.id = nr.client_id
WHERE coach.role IS DISTINCT FROM 'coach'
   OR (nr.client_id IS NOT NULL AND (
     client.role IS DISTINCT FROM 'client'
     OR NOT EXISTS (
       SELECT 1 FROM public.client_coaches cc
       WHERE cc.coach_id = nr.coach_id AND cc.client_id = nr.client_id
     ) AND NOT EXISTS (
       SELECT 1 FROM public.clients_info ci
       WHERE ci.coach_id = nr.coach_id AND ci.id = nr.client_id
     )
   ))
GROUP BY nr.coach_id, nr.client_id;
```

The notification query is optional if `notification_rules` does not exist. Any rows either relationship query returns need review before applying; the candidate deliberately aborts rather than rewriting or deleting historical rows. A valid coach-to-client relationship may still have been created without client consent by an old permissive policy. That intent cannot be inferred from the row, so compare the current links with an independently verified roster before applying.

## Update: 8 November continuity review

See [the current verification and release decision](../../../project_docs/SECURITY_VERIFICATION_2026-11-08.md). No candidate has been applied remotely. The separate `prepare_push_delivery_candidate.sql` adds a private per-device receipt table and a service-only atomic claim RPC; it must precede the candidate Edge Functions and can be reviewed independently of RLS hardening. Keep receipts when rolling Edge Functions back. Crash recovery uses a five-minute lease; provider acceptance followed by a worker crash before acknowledgment can still duplicate, so this is not an exactly-once guarantee.

The context export now includes policies, table/column grants, indexes and function ACLs/owners, including internal logs. It still is not a restorable backup. Direct SQL maintenance by an administrative connection is allowed by the role guards; `SET ROLE authenticated` must remain restricted even when the connection's session owner is administrative. The test suite covers both cases without trusting `current_user` inside a definer function.

## What the candidate changes

- Role metadata is ignored by `handle_new_user`; ordinary new profiles start as `client`. Profile role changes are rejected unless the caller is an existing admin or a trusted `service_role` request. The admin RPC can still create coach profiles because it writes as an admin. Existing `create_client_user` provisioning remains available to authenticated callers and continues to link its newly created client through its definer context.
- Replaces policies on profiles, client relationships, client info, assignments, plans, content library and daily completions as one controlled set, removing old permissive policies that would otherwise combine with `OR`. Collaborators can manage clients they are already linked to; a client cannot create that first link. Only the definer client-creation RPC can insert the initial client relationship (admins retain global access). Existing relationship rows with invalid roles stop preflight; valid-looking but unauthorized historical coach-client links need a human roster review because SQL cannot distinguish them from intentional collaboration.
- Replaces board-post policies too, removing legacy universal SELECT policies and the ambiguous `coach_id = coach_id` predicate. Coaches retain CRUD for their posts, admins retain global access, and clients see only untargeted or individually targeted posts from assigned coaches.
- Coach users retain the coach directory query (`role = 'coach'` with name/email/avatar), while clients can read only themselves and their assigned coaches. Coaches can read only their assigned clients and coach directory entries. Admins can read globally.
- Media remains publicly readable because the bucket is configured public. Mutations to `media` are restricted to coach/admin profiles. Every coach can still manage files in this shared bucket to preserve legacy paths and deletion of existing files whose ownership cannot be inferred. This deliberately does not provide coach-to-coach file isolation; changing that requires a verified ownership/path inventory or a migration plan.
- A client may update only `assignments.completed`; the current UI records daily completion through `daily_completions`, so its normal completion flow remains. Daily completion inserts must reference an assignment owned by that client.
- Push rules can be managed by coaches only for their own rows and assigned clients (or globally with `client_id IS NULL`). The candidate validates existing rules before applying and adds a write trigger for ordinary callers. The trusted `service_role` remains able to bypass RLS and this trigger; the scheduler separately revalidates persisted coach/client relationships before sending.

## Verification and limits

The exported public schema and function bodies can be reconstructed in the disposable test database with:

```sh
python3 scripts/build-live-security-fixture.py /tmp/lifehabits-live-schema.sql
LIFEHABITS_SCHEMA_SQL=/tmp/lifehabits-live-schema.sql npm run test:database
```

The current results are recorded in the verification report. The runner uses synthetic users and reproduces exported public columns/defaults/constraints and function bodies, but not the Auth/Storage services, Storage platform triggers, live data, or policies absent from the first policy CSV. Never apply the generated fixture DDL to a live project. Run the PGlite suites sequentially in this environment to avoid memory-related termination.

The candidate sets a 2-second lock timeout and 30-second statement timeout within its transaction. It is being exercised by a local transactional PGlite test runner with fixture personas. Those checks are not a substitute for a backup, read-only preflight, review of live grants/triggers, and staged deployment. The candidate does not rewrite existing profile roles, relationship rows, assignments, storage objects or push rules. It does not change bucket visibility, set MIME/size quotas, or attempt to infer ownership of legacy media. The lock/statement limits reduce risk of waiting but do not establish compatibility with the unknown live schema or guarantee zero interruption.

The SQL uses schema-qualified `SECURITY DEFINER` functions with an empty `search_path`, and narrows helper/RPC execution grants where needed. Table grants are otherwise left intact; RLS policies still require the existing Data API grants. Confirm grants separately using the query above.
