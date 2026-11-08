-- Candidate hardening for F01, F02, F04, F06, F07 and F08.
-- Review the preflight queries in README.md before applying to any database.
-- This is intentionally not a numbered Supabase migration.

BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $preflight$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.client_coaches') IS NULL
     OR to_regclass('public.clients_info') IS NULL
     OR to_regclass('public.assignments') IS NULL
     OR to_regclass('public.subscription_plans') IS NULL
     OR to_regclass('public.content_library') IS NULL
     OR to_regclass('storage.objects') IS NULL THEN
    RAISE EXCEPTION 'Security candidate requires profiles, client_coaches, clients_info, assignments, subscription_plans, content_library and storage.objects';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE role NOT IN ('coach', 'client', 'admin')
  ) THEN
    RAISE EXCEPTION 'profiles contains an unknown role; review existing rows before applying';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.client_coaches cc
    LEFT JOIN public.profiles client ON client.id = cc.client_id
    LEFT JOIN public.profiles coach ON coach.id = cc.coach_id
    WHERE client.role IS DISTINCT FROM 'client'
       OR coach.role IS DISTINCT FROM 'coach'
  ) OR EXISTS (
    SELECT 1
    FROM public.clients_info ci
    LEFT JOIN public.profiles client ON client.id = ci.id
    LEFT JOIN public.profiles coach ON coach.id = ci.coach_id
    WHERE client.role IS DISTINCT FROM 'client'
       OR coach.role IS DISTINCT FROM 'coach'
  ) THEN
    RAISE EXCEPTION 'client relationship tables contain rows with non-client or non-coach roles; inspect before applying (no rows were changed)';
  END IF;

  IF to_regclass('public.notification_rules') IS NOT NULL THEN
    IF EXISTS (
       SELECT 1
       FROM public.notification_rules nr
       LEFT JOIN public.profiles cp ON cp.id = nr.coach_id
       LEFT JOIN public.profiles cl ON cl.id = nr.client_id
       WHERE cp.role IS DISTINCT FROM 'coach'
          OR (nr.client_id IS NOT NULL AND (
            cl.role IS DISTINCT FROM 'client'
            OR NOT EXISTS (
              SELECT 1 FROM public.client_coaches cc
              WHERE cc.coach_id = nr.coach_id AND cc.client_id = nr.client_id
            ) AND NOT EXISTS (
              SELECT 1 FROM public.clients_info ci
              WHERE ci.coach_id = nr.coach_id AND ci.id = nr.client_id
            )
          ))
     ) THEN
      RAISE EXCEPTION 'notification_rules has rows outside coach/client relationships; inspect before applying (no rows were changed)';
    END IF;
  END IF;
END
$preflight$;

-- The app directory and assignment checks use these helpers. Definer functions
-- avoid recursive RLS when they inspect profiles and relationship tables.
CREATE OR REPLACE FUNCTION public.is_admin_actor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_coach_actor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'coach'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT public.is_admin_actor(); $$;

CREATE OR REPLACE FUNCTION public.is_coach()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$ SELECT public.is_coach_actor(); $$;

CREATE OR REPLACE FUNCTION public.is_coach_of_client(client_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_coach_actor() AND EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.coach_id = auth.uid() AND cc.client_id = client_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_client(client_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin_actor() OR (
    public.is_coach_actor()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = client_uuid AND p.role = 'client'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.client_coaches cc
        WHERE cc.coach_id = auth.uid() AND cc.client_id = client_uuid
      )
      OR EXISTS (
        SELECT 1 FROM public.clients_info ci
        WHERE ci.coach_id = auth.uid() AND ci.id = client_uuid
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_client_of_coach(coach_uuid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'client'
  ) AND (
    EXISTS (
    SELECT 1 FROM public.client_coaches cc
    WHERE cc.client_id = auth.uid() AND cc.coach_id = coach_uuid
    ) OR EXISTS (
    SELECT 1 FROM public.clients_info ci
    WHERE ci.id = auth.uid() AND ci.coach_id = coach_uuid
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_profile(target_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_id = auth.uid()
    OR public.is_admin_actor()
    OR (
      public.is_coach_actor()
      AND EXISTS (
        SELECT 1 FROM public.profiles target
        WHERE target.id = target_id AND target.role = 'coach'
      )
    )
    OR public.can_manage_client(target_id)
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles target
        WHERE target.id = target_id AND target.role = 'coach'
      )
      AND EXISTS (
        SELECT 1 FROM public.client_coaches cc
        WHERE cc.client_id = auth.uid() AND cc.coach_id = target_id
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles target
        WHERE target.id = target_id AND target.role = 'coach'
      )
      AND EXISTS (
        SELECT 1 FROM public.clients_info ci
        WHERE ci.id = auth.uid() AND ci.coach_id = target_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_shared_media()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin_actor() OR public.is_coach_actor();
$$;

REVOKE ALL ON FUNCTION public.is_admin_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_coach_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_coach() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_coach_of_client(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_client(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_client_of_coach(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_shared_media() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_actor(), public.is_coach_actor(), public.is_admin(), public.is_coach(), public.is_coach_of_client(uuid), public.can_manage_client(uuid), public.is_client_of_coach(uuid), public.can_read_profile(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_actor(), public.is_coach_actor(), public.is_admin(), public.is_coach(), public.is_coach_of_client(uuid), public.can_manage_client(uuid), public.is_client_of_coach(uuid), public.can_read_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_shared_media() TO anon, authenticated;

-- Role assignment is never accepted from user metadata or ordinary profile writes.
-- session_user identifies the connection, while role identifies SET ROLE. Do not
-- use current_user here: inside a definer function it is always the function owner.
CREATE OR REPLACE FUNCTION public.is_trusted_maintenance_actor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', '') = 'service_role'
    OR (session_user IN ('postgres', 'supabase_admin')
        AND current_setting('role', true) IN ('none', 'postgres', 'supabase_admin'));
$$;
REVOKE ALL ON FUNCTION public.is_trusted_maintenance_actor() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'client'
       AND NOT public.is_admin_actor() AND NOT public.is_trusted_maintenance_actor() THEN
      RAISE EXCEPTION 'Only an administrator or trusted server may create privileged profiles';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role
        AND NOT public.is_admin_actor() AND NOT public.is_trusted_maintenance_actor() THEN
    RAISE EXCEPTION 'Profile role cannot be changed by this user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_role ON public.profiles;
CREATE TRIGGER profiles_guard_role
BEFORE INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();
REVOKE ALL ON FUNCTION public.guard_profile_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_profile_role() FROM anon, authenticated;

-- User-controlled metadata may set a display name, never an authorization role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    'client'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- Keep existing admin profiles representable without changing any profile data.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('coach', 'client', 'admin'));

-- Replace policies on these tables as a controlled policy set. This removes
-- older permissive policies whose OR semantics would bypass the new boundary.
DO $drop_policies$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'clients_info', 'client_coaches', 'assignments',
        'subscription_plans', 'content_library', 'daily_completions',
        'notification_rules', 'board_posts'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END
$drop_policies$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY security_profiles_select ON public.profiles FOR SELECT TO authenticated
USING (public.can_read_profile(id));
CREATE POLICY security_profiles_self_insert ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() AND role = 'client');
CREATE POLICY security_profiles_admin_insert ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.is_admin_actor());
CREATE POLICY security_profiles_self_update ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY security_profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin_actor()) WITH CHECK (public.is_admin_actor());
CREATE POLICY security_profiles_admin_delete ON public.profiles FOR DELETE TO authenticated
USING (public.is_admin_actor());

CREATE POLICY security_clients_info_select ON public.clients_info FOR SELECT TO authenticated
USING (id = auth.uid() OR public.can_manage_client(id));
CREATE POLICY security_clients_info_update ON public.clients_info FOR UPDATE TO authenticated
USING (public.can_manage_client(id)) WITH CHECK (public.can_manage_client(id));
CREATE POLICY security_clients_info_admin_insert ON public.clients_info FOR INSERT TO authenticated
WITH CHECK (public.is_admin_actor());
CREATE POLICY security_clients_info_admin_delete ON public.clients_info FOR DELETE TO authenticated
USING (public.is_admin_actor());

CREATE OR REPLACE FUNCTION public.guard_client_info_identity()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.coach_id IS DISTINCT FROM OLD.coach_id)
     AND NOT public.is_admin_actor()
     AND NOT public.is_trusted_maintenance_actor() THEN
    RAISE EXCEPTION 'Client relationship identity cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS clients_info_guard_identity ON public.clients_info;
CREATE TRIGGER clients_info_guard_identity
BEFORE UPDATE ON public.clients_info
FOR EACH ROW EXECUTE FUNCTION public.guard_client_info_identity();
REVOKE ALL ON FUNCTION public.guard_client_info_identity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_client_info_identity() FROM anon, authenticated;

CREATE POLICY security_client_coaches_select ON public.client_coaches FOR SELECT TO authenticated
USING (
  client_id = auth.uid()
  OR coach_id = auth.uid()
  OR public.can_manage_client(client_id)
);
CREATE POLICY security_client_coaches_insert ON public.client_coaches FOR INSERT TO authenticated
WITH CHECK (
  (public.is_admin_actor()
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = coach_id AND p.role = 'coach')
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = client_id AND p.role = 'client'))
  OR
  (public.is_coach_actor() AND public.can_manage_client(client_id)
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = coach_id AND p.role = 'coach'))
);
CREATE POLICY security_client_coaches_delete ON public.client_coaches FOR DELETE TO authenticated
USING (public.can_manage_client(client_id));

CREATE POLICY security_assignments_select ON public.assignments FOR SELECT TO authenticated
USING (client_id = auth.uid() OR public.can_manage_client(client_id));
CREATE POLICY security_assignments_coach_insert ON public.assignments FOR INSERT TO authenticated
WITH CHECK (
  public.is_coach_actor() AND coach_id = auth.uid() AND public.can_manage_client(client_id)
);
CREATE POLICY security_assignments_admin_insert ON public.assignments FOR INSERT TO authenticated
WITH CHECK (public.is_admin_actor());
CREATE POLICY security_assignments_client_update ON public.assignments FOR UPDATE TO authenticated
USING (client_id = auth.uid()) WITH CHECK (client_id = auth.uid());
CREATE POLICY security_assignments_coach_update ON public.assignments FOR UPDATE TO authenticated
USING (public.can_manage_client(client_id)) WITH CHECK (public.can_manage_client(client_id));
CREATE POLICY security_assignments_admin_update ON public.assignments FOR UPDATE TO authenticated
USING (public.is_admin_actor()) WITH CHECK (public.is_admin_actor());
CREATE POLICY security_assignments_coach_delete ON public.assignments FOR DELETE TO authenticated
USING (public.can_manage_client(client_id));

CREATE OR REPLACE FUNCTION public.guard_client_assignment_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE actor_role text;
BEGIN
  IF public.is_trusted_maintenance_actor() THEN
    RETURN NEW;
  END IF;
  SELECT p.role INTO actor_role FROM public.profiles p WHERE p.id = auth.uid();
  IF actor_role = 'client'
     AND (to_jsonb(NEW) - 'completed') IS DISTINCT FROM (to_jsonb(OLD) - 'completed') THEN
    RAISE EXCEPTION 'Clients may only update assignment completion';
  ELSIF actor_role IS NULL THEN
    RAISE EXCEPTION 'A profile is required to update assignments';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS assignments_guard_client_update ON public.assignments;
CREATE TRIGGER assignments_guard_client_update
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.guard_client_assignment_update();
REVOKE ALL ON FUNCTION public.guard_client_assignment_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_client_assignment_update() FROM anon, authenticated;

CREATE POLICY security_plans_select ON public.subscription_plans FOR SELECT TO authenticated
USING (client_id = auth.uid() OR public.can_manage_client(client_id));
CREATE POLICY security_plans_coach_insert ON public.subscription_plans FOR INSERT TO authenticated
WITH CHECK (public.is_coach_actor() AND coach_id = auth.uid() AND public.can_manage_client(client_id));
CREATE POLICY security_plans_admin_insert ON public.subscription_plans FOR INSERT TO authenticated
WITH CHECK (public.is_admin_actor());
CREATE POLICY security_plans_coach_update ON public.subscription_plans FOR UPDATE TO authenticated
USING (public.can_manage_client(client_id)) WITH CHECK (public.can_manage_client(client_id));
CREATE POLICY security_plans_admin_update ON public.subscription_plans FOR UPDATE TO authenticated
USING (public.is_admin_actor()) WITH CHECK (public.is_admin_actor());
CREATE POLICY security_plans_coach_delete ON public.subscription_plans FOR DELETE TO authenticated
USING (public.can_manage_client(client_id));

-- The library is intentionally shared for coach reads; writes stay with the
-- owning coach or admins. Storage is similarly shared across coaches because
-- legacy file paths do not encode reliable ownership.
CREATE POLICY security_library_coach_select ON public.content_library FOR SELECT TO authenticated
USING (public.is_coach_actor() OR public.is_admin_actor());
CREATE POLICY security_library_coach_insert ON public.content_library FOR INSERT TO authenticated
WITH CHECK (public.is_coach_actor() AND coach_id = auth.uid());
CREATE POLICY security_library_admin_insert ON public.content_library FOR INSERT TO authenticated
WITH CHECK (public.is_admin_actor());
CREATE POLICY security_library_coach_update ON public.content_library FOR UPDATE TO authenticated
USING (public.is_coach_actor() AND coach_id = auth.uid())
WITH CHECK (public.is_coach_actor() AND coach_id = auth.uid());
CREATE POLICY security_library_admin_update ON public.content_library FOR UPDATE TO authenticated
USING (public.is_admin_actor()) WITH CHECK (public.is_admin_actor());
CREATE POLICY security_library_coach_delete ON public.content_library FOR DELETE TO authenticated
USING (public.is_coach_actor() AND coach_id = auth.uid());
CREATE POLICY security_library_admin_delete ON public.content_library FOR DELETE TO authenticated
USING (public.is_admin_actor());

CREATE POLICY security_board_posts_select ON public.board_posts FOR SELECT TO authenticated
USING (
  public.is_admin_actor()
  OR (public.is_coach_actor() AND coach_id = auth.uid())
  OR (
    public.is_client_of_coach(coach_id)
    AND (
      target_client_ids IS NULL
      OR cardinality(target_client_ids) = 0
      OR auth.uid() = ANY(target_client_ids)
    )
  )
);
CREATE POLICY security_board_posts_coach_insert ON public.board_posts FOR INSERT TO authenticated
WITH CHECK (public.is_coach_actor() AND coach_id = auth.uid());
CREATE POLICY security_board_posts_admin_insert ON public.board_posts FOR INSERT TO authenticated
WITH CHECK (public.is_admin_actor());
CREATE POLICY security_board_posts_coach_update ON public.board_posts FOR UPDATE TO authenticated
USING (public.is_coach_actor() AND coach_id = auth.uid())
WITH CHECK (public.is_coach_actor() AND coach_id = auth.uid());
CREATE POLICY security_board_posts_admin_update ON public.board_posts FOR UPDATE TO authenticated
USING (public.is_admin_actor()) WITH CHECK (public.is_admin_actor());
CREATE POLICY security_board_posts_coach_delete ON public.board_posts FOR DELETE TO authenticated
USING (public.is_coach_actor() AND coach_id = auth.uid());
CREATE POLICY security_board_posts_admin_delete ON public.board_posts FOR DELETE TO authenticated
USING (public.is_admin_actor());

-- Daily completions are the current client-facing completion flow. Restrict
-- inserts to assignments owned by the same client.
DO $daily_completions$
BEGIN
  IF to_regclass('public.daily_completions') IS NOT NULL THEN
    ALTER TABLE public.daily_completions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY security_daily_completions_select ON public.daily_completions FOR SELECT TO authenticated
      USING (client_id = auth.uid() OR public.can_manage_client(client_id));
    CREATE POLICY security_daily_completions_insert ON public.daily_completions FOR INSERT TO authenticated
      WITH CHECK (
        client_id = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'client')
        AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND a.client_id = auth.uid())
      );
    CREATE POLICY security_daily_completions_delete ON public.daily_completions FOR DELETE TO authenticated
      USING (client_id = auth.uid());
  END IF;
END
$daily_completions$;

-- Coach push rules must belong to coaches and can target only their clients.
DO $notification_rules$
BEGIN
  IF to_regclass('public.notification_rules') IS NOT NULL THEN
    CREATE POLICY security_notification_rules_select ON public.notification_rules FOR SELECT TO authenticated
    USING (
      public.is_admin_actor()
      OR (public.is_coach_actor() AND coach_id = auth.uid())
      OR (
        EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'client')
        AND (
          client_id = auth.uid()
          OR (client_id IS NULL AND (
            EXISTS (SELECT 1 FROM public.client_coaches cc WHERE cc.client_id = auth.uid() AND cc.coach_id = notification_rules.coach_id)
            OR EXISTS (SELECT 1 FROM public.clients_info ci WHERE ci.id = auth.uid() AND ci.coach_id = notification_rules.coach_id)
          ))
        )
      )
    );
    CREATE POLICY security_notification_rules_coach_insert ON public.notification_rules FOR INSERT TO authenticated
    WITH CHECK (
      public.is_admin_actor()
      OR (public.is_coach_actor() AND coach_id = auth.uid()
          AND (client_id IS NULL OR public.can_manage_client(client_id)))
    );
    CREATE POLICY security_notification_rules_coach_update ON public.notification_rules FOR UPDATE TO authenticated
    USING (public.is_admin_actor() OR (public.is_coach_actor() AND coach_id = auth.uid()))
    WITH CHECK (
      public.is_admin_actor()
      OR (public.is_coach_actor() AND coach_id = auth.uid()
          AND (client_id IS NULL OR public.can_manage_client(client_id)))
    );
    CREATE POLICY security_notification_rules_coach_delete ON public.notification_rules FOR DELETE TO authenticated
    USING (public.is_admin_actor() OR (public.is_coach_actor() AND coach_id = auth.uid()));
  END IF;
END
$notification_rules$;

CREATE OR REPLACE FUNCTION public.guard_notification_rule_relationship()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.is_admin_actor()
     OR public.is_trusted_maintenance_actor() THEN
    RETURN NEW;
  END IF;
  IF NOT public.is_coach_actor() OR NEW.coach_id <> auth.uid()
     OR (NEW.client_id IS NOT NULL AND NOT public.can_manage_client(NEW.client_id)) THEN
    RAISE EXCEPTION 'Notification rules must belong to a coach and an assigned client';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_notification_rule_relationship() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_notification_rule_relationship() FROM anon, authenticated;
DO $notification_rule_trigger$
BEGIN
  IF to_regclass('public.notification_rules') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS notification_rules_guard_relationship ON public.notification_rules;
    CREATE TRIGGER notification_rules_guard_relationship
    BEFORE INSERT OR UPDATE ON public.notification_rules
    FOR EACH ROW EXECUTE FUNCTION public.guard_notification_rule_relationship();
  END IF;
END
$notification_rule_trigger$;

-- Public reads are intentionally retained for the public media bucket. The
-- restrictive policy gates mutations even if an older permissive policy remains.
DROP POLICY IF EXISTS security_media_coach_insert ON storage.objects;
DROP POLICY IF EXISTS security_media_coach_update ON storage.objects;
DROP POLICY IF EXISTS security_media_coach_delete ON storage.objects;
CREATE POLICY security_media_coach_insert ON storage.objects
AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (bucket_id <> 'media' OR public.can_manage_shared_media());
CREATE POLICY security_media_coach_update ON storage.objects
AS RESTRICTIVE FOR UPDATE TO public
USING (bucket_id <> 'media' OR public.can_manage_shared_media())
WITH CHECK (bucket_id <> 'media' OR public.can_manage_shared_media());
CREATE POLICY security_media_coach_delete ON storage.objects
AS RESTRICTIVE FOR DELETE TO public
USING (bucket_id <> 'media' OR public.can_manage_shared_media());

-- Internal delivery logs are accessed by service_role Edge Functions, never by
-- the frontend. The live metadata export showed RLS disabled on both tables.
-- Preserve rows and trusted server access; deny ordinary client credentials.
DO $internal_logs$
DECLARE log_table text;
BEGIN
  FOREACH log_table IN ARRAY ARRAY['notification_sent_log', 'daily_alert_sent_log']
  LOOP
    IF to_regclass(format('public.%I', log_table)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', log_table);
      EXECUTE format('DROP POLICY IF EXISTS security_internal_log_clients ON public.%I', log_table);
      EXECUTE format(
        'CREATE POLICY security_internal_log_clients ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        log_table
      );
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', log_table);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO service_role', log_table);
    END IF;
  END LOOP;
END
$internal_logs$;

-- The RPCs remain available to authenticated callers; their own role checks
-- and the profile role trigger enforce who may provision each account type.
DO $rpc_grants$
BEGIN
  IF to_regprocedure('public.create_client_user(text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_client_user(text,text,text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.create_client_user(text,text,text) FROM anon;
    GRANT EXECUTE ON FUNCTION public.create_client_user(text,text,text) TO authenticated, service_role;
  END IF;
  IF to_regprocedure('public.create_coach_user(text,text,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.create_coach_user(text,text,text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.create_coach_user(text,text,text) FROM anon;
    GRANT EXECUTE ON FUNCTION public.create_coach_user(text,text,text) TO authenticated, service_role;
  END IF;
END
$rpc_grants$;

COMMIT;
