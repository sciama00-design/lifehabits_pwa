// Real PostgreSQL (WASM), synthetic users only; no network or production access.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const db = new PGlite({ extensions: { pgcrypto } });
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const ids = Object.fromEntries(['admin', 'coachA', 'coachB', 'clientA', 'clientB', 'newUser']
    .map((name, index) => [name, `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`]));
let checks = 0;

async function as(name, callback) {
    const role = name ? 'authenticated' : 'anon';
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({
        sub: name ? ids[name] : null, role,
    })]);
    await db.exec(`SET ROLE ${role}`);
    try { return await callback(); } finally { await db.exec('RESET ROLE'); }
}
async function denied(name, sql, params = []) {
    let rejected = false;
    try {
        const result = await as(name, () => db.query(sql, params));
        // RLS UPDATE/DELETE can silently affect zero rows instead of throwing.
        rejected = /^(UPDATE|DELETE)/i.test(sql) && result.affectedRows === 0;
    } catch (error) {
        if (!['42501', 'P0001'].includes(error.code)) throw error;
        rejected = true;
    }
    assert.ok(rejected, `${name || 'anon'} must be denied: ${sql}`);
    checks++;
}
async function allowed(name, sql, params = []) {
    const result = await as(name, () => db.query(sql, params));
    assert.ok(result.affectedRows > 0 || result.rows.length > 0, `${name}: ${sql}`);
    checks++;
    return result;
}

try {
    await db.exec(`
        CREATE EXTENSION pgcrypto;
        CREATE ROLE anon NOLOGIN;
        CREATE ROLE authenticated NOLOGIN;
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
        CREATE SCHEMA auth;
        CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
          $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
          $$ SELECT nullif(auth.jwt()->>'sub', '')::uuid $$;
        CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
          $$ SELECT auth.jwt()->>'role' $$;
        CREATE TABLE auth.users (
          id uuid PRIMARY KEY, instance_id uuid, aud text, role text, email text,
          encrypted_password text, email_confirmed_at timestamptz,
          raw_app_meta_data jsonb, raw_user_meta_data jsonb,
          created_at timestamptz, updated_at timestamptz,
          confirmation_token text, email_change text, email_change_token_new text, recovery_token text
        );
        CREATE SCHEMA storage;
        CREATE TABLE storage.buckets (
          id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
        );
        CREATE TABLE storage.objects (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text,
          owner uuid, owner_id text, metadata jsonb
        );
        ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
        GRANT USAGE ON SCHEMA auth, public, storage TO anon, authenticated, service_role;
    `);
    if (process.env.LIFEHABITS_SCHEMA_SQL) {
        await db.exec(await readFile(process.env.LIFEHABITS_SCHEMA_SQL, 'utf8'));
        console.log('Testing exported public tables, constraints, RLS flags, functions and policies with synthetic data. Auth/Storage services and unexported policies are not replicated.');
    } else {
        await db.exec(await source('src/database/schema.sql'));
        await db.exec(await source('src/database/migration_admin_role.sql'));
        await db.exec(await source('src/database/create_client_rpc.sql'));
        await db.exec(await source('src/database/automation_trigger.sql'));
        await db.exec(await source('src/database/appointments.sql'));
        await db.exec(await source('src/database/push_schema.sql'));
        await db.exec(await source('src/database/storage_setup.sql'));
        await db.exec(await source('supabase/migrations/20240313000000_daily_feedback.sql'));
        await db.exec(await source('supabase/migrations/20240313000001_fix_notifications.sql'));
        await db.exec(await source('src/database/migrations/privacy_migration.sql'));
        await db.exec(await source('supabase/migrations/20260916_archive_clients.sql'));
        await db.exec(`
            DROP TABLE public.daily_completions;
            CREATE POLICY "Coaches can view all content" ON public.content_library
              FOR SELECT USING (public.is_coach());
            CREATE POLICY "Coaches can manage their own content" ON public.content_library
              FOR ALL USING (coach_id = auth.uid());
            CREATE POLICY "Everyone can view board posts" ON public.board_posts FOR SELECT USING (true);
            CREATE POLICY "Coaches can manage posts" ON public.board_posts FOR ALL USING (coach_id = auth.uid());
            CREATE POLICY "Clients can view their own plans" ON public.subscription_plans
              FOR SELECT USING (client_id = auth.uid());
            CREATE POLICY "Coaches can manage plans" ON public.subscription_plans
              FOR ALL USING (coach_id = auth.uid());
        `);
        await db.exec(await source('src/database/daily_completions_migration.sql'));
        await db.exec(await source('supabase/sent_log.sql'));
    }
    await db.exec('GRANT ALL ON ALL TABLES IN SCHEMA public, storage TO anon, authenticated, service_role');
    // Optional policy-only snapshot reconstructed from exported pg_policies.
    // This runs solely in the disposable database, never against Supabase.
    if (process.env.LIFEHABITS_POLICY_SQL) {
        await db.exec(await readFile(process.env.LIFEHABITS_POLICY_SQL, 'utf8'));
        console.log('Testing exported policies on the repository schema with synthetic data; live function bodies/schema are not yet available.');
    }
    for (const [name, id] of Object.entries(ids)) {
        await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [id, `${name}@example.test`]);
        await db.query('UPDATE public.profiles SET role=$1 WHERE id=$2', [
            name === 'admin' ? 'admin' : name.startsWith('coach') ? 'coach' : 'client', id,
        ]);
    }
    await db.query('INSERT INTO public.clients_info(id, coach_id) VALUES ($1,$2),($3,$4)',
        [ids.clientA, ids.coachA, ids.clientB, ids.coachB]);
    await db.query('INSERT INTO public.client_coaches(client_id,coach_id) VALUES($1,$2),($3,$4)',
        [ids.clientA, ids.coachA, ids.clientB, ids.coachB]);
    await db.query(`INSERT INTO public.assignments(id,client_id,coach_id,title,type,scheduled_date)
        VALUES ('10000000-0000-4000-8000-000000000001',$1,$2,'Original program','habit',CURRENT_DATE)`,
        [ids.clientA, ids.coachA]);
    await db.query(`INSERT INTO public.assignments(id,client_id,coach_id,title,type,scheduled_date)
        VALUES ('10000000-0000-4000-8000-000000000002',$1,$2,'Foreign program','habit',CURRENT_DATE)`,
        [ids.clientB, ids.coachB]);
    await db.query(`INSERT INTO storage.objects(bucket_id,name,owner,owner_id)
        VALUES('media','uploads/legacy.jpg',$1::uuid,$1::uuid::text)`, [ids.coachB]);
    await db.query(`INSERT INTO public.board_posts(coach_id,title,content,target_client_ids)
        VALUES($1,'Private announcement','<p>For client A</p>',ARRAY[$2::uuid]),
              ($1,'Coach broadcast','<p>For assigned clients</p>',NULL)`, [ids.coachA, ids.clientA]);
    await db.query(`INSERT INTO public.subscription_plans(coach_id,client_id,name)
        VALUES($1,$2,'Foreign private plan')`, [ids.coachB, ids.clientB]);
    if (process.env.LIFEHABITS_POLICY_SQL || process.env.LIFEHABITS_SCHEMA_SQL) {
        // The export contains allow_all_read_test; verify its actual effect locally.
        await allowed(null, "SELECT id FROM public.subscription_plans WHERE name='Foreign private plan'");
    }

    // Demonstrate the vulnerable baseline, then restore the synthetic fixtures.
    await allowed('clientA', "UPDATE public.profiles SET role='admin' WHERE id=$1 RETURNING id", [ids.clientA]);
    await db.query("UPDATE public.profiles SET role='client' WHERE id=$1", [ids.clientA]);
    await allowed('clientA', 'INSERT INTO public.client_coaches VALUES($1,$2) RETURNING client_id', [ids.clientB, ids.clientA]);
    await db.query('DELETE FROM public.client_coaches WHERE coach_id=$1', [ids.clientA]);
    if (process.env.LIFEHABITS_SCHEMA_SQL) {
        // Exercise the exported trigger and role helper, without invoking real signup.
        ids.metadataAdmin = '00000000-0000-4000-8000-000000000099';
        await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'metadata-test@example.test','{\"role\":\"admin\"}')", [ids.metadataAdmin]);
        assert.equal((await as('metadataAdmin', () => db.query('SELECT public.is_admin() AS elevated'))).rows[0].elevated, true);
        await db.query('DELETE FROM public.profiles WHERE id=$1', [ids.metadataAdmin]);
        await db.query('DELETE FROM auth.users WHERE id=$1', [ids.metadataAdmin]);
        checks++;
    }

    const deliveryPatch = await source('src/database/security/prepare_push_delivery_candidate.sql');
    await db.exec(deliveryPatch);
    await db.exec(deliveryPatch);
    const patch = await source('src/database/security/apply_security_fixes_candidate.sql');
    await db.exec(patch);
    await db.exec(patch); // Must be safely repeatable.

    // F01: ordinary profile edits and consent work, privilege changes do not.
    await allowed('clientA', "UPDATE public.profiles SET full_name='Updated name', privacy_accepted_at=now() WHERE id=$1 RETURNING id", [ids.clientA]);
    await denied('clientA', "UPDATE public.profiles SET role='admin' WHERE id=$1 RETURNING id", [ids.clientA]);
    await denied('clientA', "UPDATE public.profiles SET role='coach' WHERE id=$1 RETURNING id", [ids.clientA]);
    await denied('coachA', "UPDATE public.profiles SET role='admin' WHERE id=$1 RETURNING id", [ids.coachA]);
    // A signup controlled by untrusted user_metadata must not become a coach/admin.
    await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES(gen_random_uuid(),'signup@example.test','{\"role\":\"admin\"}')");
    assert.equal((await db.query("SELECT role FROM public.profiles WHERE email='signup@example.test'")).rows[0].role, 'client');
    checks++;
    // Provisioning still uses the original public RPC signatures.
    await allowed('coachA', "SELECT public.create_client_user('created@example.test','Strong-test-password-123!','Created client') AS id");
    const newClient = (await db.query("SELECT id FROM public.profiles WHERE email='created@example.test'")).rows[0].id;
    assert.equal((await db.query('SELECT coach_id FROM public.client_coaches WHERE client_id=$1', [newClient])).rows[0].coach_id, ids.coachA);
    await allowed('admin', "SELECT public.create_coach_user('created-coach@example.test','Strong-test-password-123!','Created coach') AS id");
    assert.equal((await db.query("SELECT role FROM public.profiles WHERE email='created-coach@example.test'")).rows[0].role, 'coach');
    checks += 2;
    await denied('clientA', "SELECT public.create_client_user('denied@example.test','Strong-test-password-123!','Denied')");
    await denied('clientA', "SELECT public.create_coach_user('denied-coach@example.test','Strong-test-password-123!','Denied')");
    // A direct SQL maintenance connection has no JWT/profile. SET ROLE clients
    // above must stay denied even though session_user is the same database owner.
    await db.query("SELECT set_config('request.jwt.claims', '{}', false)");
    await db.query("UPDATE public.profiles SET role='coach' WHERE id=$1", [ids.newUser]);
    assert.equal((await db.query('SELECT role FROM public.profiles WHERE id=$1', [ids.newUser])).rows[0].role, 'coach');
    await db.query("UPDATE public.profiles SET role='client' WHERE id=$1", [ids.newUser]);
    await db.query("UPDATE public.assignments SET description='SQL maintenance' WHERE title='Original program'");
    checks += 2;

    // F02: only someone already managing a client can add a valid colleague.
    await denied('clientA', 'INSERT INTO public.client_coaches VALUES($1,$2)', [ids.clientB, ids.clientA]);
    await denied('coachA', 'INSERT INTO public.client_coaches VALUES($1,$2)', [ids.clientB, ids.coachA]);
    await denied('coachA', 'INSERT INTO public.client_coaches VALUES($1,$2)', [ids.clientA, ids.clientB]);
    await allowed('coachA', 'INSERT INTO public.client_coaches VALUES($1,$2) RETURNING client_id', [ids.clientA, ids.coachB]);
    const colleagues = await as('coachA', () => db.query('SELECT coach_id FROM public.client_coaches WHERE client_id=$1', [ids.clientA]));
    assert.equal(colleagues.rows.length, 2, 'coach must still see all colleagues of their client');
    checks++;
    await allowed('coachA', 'UPDATE public.clients_info SET archived_at=now() WHERE id=$1 RETURNING id', [ids.clientA]);
    await allowed('coachA', 'UPDATE public.clients_info SET archived_at=NULL WHERE id=$1 RETURNING id', [ids.clientA]);
    await denied('clientB', 'INSERT INTO public.clients_info(id,coach_id) VALUES($1,$2)', [ids.newUser, ids.clientB]);

    // F04: preserve shared coach media and legacy paths; clients cannot mutate.
    await denied('clientA', "INSERT INTO storage.objects(bucket_id,name) VALUES('media','uploads/client.jpg')");
    await denied('clientA', "UPDATE storage.objects SET name='uploads/hijacked.jpg' WHERE name='uploads/legacy.jpg' RETURNING id");
    await denied('clientA', "DELETE FROM storage.objects WHERE name='uploads/legacy.jpg' RETURNING id");
    await allowed('coachA', "UPDATE storage.objects SET metadata='{}' WHERE name='uploads/legacy.jpg' RETURNING id");
    await allowed('coachA', "INSERT INTO storage.objects(bucket_id,name) VALUES('media','uploads/coach.jpg') RETURNING id");
    await allowed('coachA', "DELETE FROM storage.objects WHERE name='uploads/coach.jpg' RETURNING id");
    await allowed(null, "SELECT id FROM storage.objects WHERE name='uploads/legacy.jpg'");
    await allowed('clientA', "SELECT id FROM storage.objects WHERE name='uploads/legacy.jpg'");

    // F06: self, assigned coach, colleague directory and admin stay accessible.
    assert.equal((await as(null, () => db.query('SELECT id FROM public.profiles'))).rows.length, 0);
    assert.equal((await as('clientA', () => db.query('SELECT id FROM public.profiles WHERE id=$1', [ids.clientB]))).rows.length, 0);
    await allowed('clientA', 'SELECT id FROM public.profiles WHERE id=$1', [ids.coachA]);
    await allowed('coachA', "SELECT id FROM public.profiles WHERE role='coach' AND full_name ILIKE '%' LIMIT 10");
    await allowed('admin', 'SELECT id FROM public.profiles WHERE id=$1', [ids.clientB]);
    checks += 2;
    // Plans continue to support creation, renewal, and client-side selection.
    const plan = await allowed('coachA', `INSERT INTO public.subscription_plans(coach_id,client_id,name,start_date,end_date)
        VALUES($1,$2,'Test plan',CURRENT_DATE,CURRENT_DATE+30) RETURNING id`, [ids.coachA, ids.clientA]);
    await allowed('clientA', 'SELECT id FROM public.subscription_plans WHERE id=$1', [plan.rows[0].id]);
    await allowed('coachA', 'UPDATE public.subscription_plans SET end_date=CURRENT_DATE+60 WHERE id=$1 RETURNING id', [plan.rows[0].id]);
    assert.equal((await as(null, () => db.query('SELECT id FROM public.subscription_plans'))).rows.length, 0);
    assert.equal((await as('clientA', () => db.query("SELECT id FROM public.subscription_plans WHERE name='Foreign private plan'"))).rows.length, 0);
    checks += 2;
    // Old permissive board policies must not override targeting.
    assert.equal((await as(null, () => db.query('SELECT id FROM public.board_posts'))).rows.length, 0);
    assert.equal((await as('clientB', () => db.query('SELECT id FROM public.board_posts'))).rows.length, 0);
    assert.equal((await as('clientA', () => db.query('SELECT id FROM public.board_posts'))).rows.length, 2);
    await allowed('coachA', "UPDATE public.board_posts SET title='Updated private announcement' WHERE title='Private announcement' RETURNING id");
    checks += 3;

    // F07: compatibility for completion; prescriptions remain coach-controlled.
    await allowed('clientA', "UPDATE public.assignments SET completed=true WHERE title='Original program' RETURNING id");
    await denied('clientA', "UPDATE public.assignments SET description='Injected content' WHERE title='Original program' RETURNING id");
    await denied('clientA', "UPDATE public.assignments SET coach_id=$1 WHERE title='Original program' RETURNING id", [ids.coachB]);
    await allowed('clientA', `INSERT INTO public.daily_completions(client_id,assignment_id)
        VALUES($1,'10000000-0000-4000-8000-000000000001') RETURNING id`, [ids.clientA]);
    await denied('clientA', `INSERT INTO public.daily_completions(client_id,assignment_id)
        VALUES($1,'10000000-0000-4000-8000-000000000002')`, [ids.clientA]);
    await allowed('coachA', "UPDATE public.assignments SET description='Coach update' WHERE title='Original program' RETURNING id");

    // F08: prevent a client masquerading as coach and reject foreign recipients.
    await denied('clientA', "INSERT INTO public.notification_rules(coach_id,client_id,scheduled_time,message) VALUES($1,$2,'09:00','Forbidden')", [ids.clientA, ids.clientB]);
    await denied('coachA', "INSERT INTO public.notification_rules(coach_id,client_id,scheduled_time,message) VALUES($1,$2,'09:00','Forbidden')", [ids.coachA, ids.clientB]);
    const rule = await allowed('coachA', "INSERT INTO public.notification_rules(coach_id,client_id,scheduled_time,message) VALUES($1,$2,'09:00','Allowed') RETURNING id", [ids.coachA, ids.clientA]);
    await allowed('coachA', "INSERT INTO public.notification_rules(coach_id,scheduled_time,message) VALUES($1,'10:00','Global') RETURNING id", [ids.coachA]);
    await allowed('coachB', "INSERT INTO public.notification_rules(coach_id,scheduled_time,message) VALUES($1,'10:30','Foreign global') RETURNING id", [ids.coachB]);
    await denied('coachA', 'UPDATE public.notification_rules SET client_id=$1 WHERE id=$2 RETURNING id', [ids.clientB, rule.rows[0].id]);
    // Removing a collaborator must retain the manager's ability to list/unlink.
    await allowed('coachA', 'DELETE FROM public.client_coaches WHERE client_id=$1 AND coach_id=$2 RETURNING client_id', [ids.clientA, ids.coachB]);
    const visibleRules = await as('clientA', () => db.query('SELECT message FROM public.notification_rules'));
    assert.ok(visibleRules.rows.some(row => row.message === 'Global'));
    assert.ok(!visibleRules.rows.some(row => row.message === 'Foreign global'));
    checks += 2;
    // Legacy clients_info-only relationships are used by the app as a fallback.
    await allowed('coachA', 'DELETE FROM public.client_coaches WHERE client_id=$1 AND coach_id=$2 RETURNING client_id', [ids.clientA, ids.coachA]);
    await allowed('coachA', 'SELECT id FROM public.profiles WHERE id=$1', [ids.clientA]);
    await allowed('coachA', "UPDATE public.assignments SET description='Primary coach fallback' WHERE title='Original program' RETURNING id");
    await allowed('clientA', 'SELECT id FROM public.profiles WHERE id=$1', [ids.coachA]);
    await allowed('clientA', "SELECT title FROM public.board_posts WHERE title='Coach broadcast'");
    await allowed('coachA', 'INSERT INTO public.client_coaches VALUES($1,$2) RETURNING client_id', [ids.clientA, ids.coachA]);
    // Maintenance through the trusted server remains possible without a profile.
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ role: 'service_role' })]);
    await db.exec('SET ROLE service_role');
    try {
        const maintenance = await db.query("UPDATE public.assignments SET description='Trusted server update' WHERE title='Original program' RETURNING id");
        assert.equal(maintenance.rows.length, 1);
        checks++;
        // Scheduler log operations remain functional after the client grants change.
        await db.query('INSERT INTO public.notification_sent_log(rule_id) VALUES($1)', [rule.rows[0].id]);
        await db.query("INSERT INTO public.daily_alert_sent_log(user_id,alert_time) VALUES($1,'09:00')", [ids.clientA]);
        assert.equal((await db.query('SELECT * FROM public.notification_sent_log')).rows.length, 1);
        assert.equal((await db.query('SELECT * FROM public.daily_alert_sent_log')).rows.length, 1);
        checks += 4;
        const claim = (await db.query("SELECT public.claim_push_delivery('test:device') AS token")).rows[0].token;
        assert.ok(claim);
        assert.equal((await db.query("SELECT public.claim_push_delivery('test:device') AS token")).rows[0].token, null,
            'an active lease cannot be claimed again');
        await db.query("UPDATE public.push_delivery_receipts SET lease_until=now()-interval '1 second' WHERE delivery_key='test:device'");
        const replacement = (await db.query("SELECT public.claim_push_delivery('test:device') AS token")).rows[0].token;
        assert.ok(replacement && replacement !== claim, 'an expired lease can be reclaimed after a worker crash');
        assert.equal((await db.query("UPDATE public.push_delivery_receipts SET delivered=true WHERE delivery_key='test:device' AND claim_token=$1 RETURNING delivery_key", [claim])).rows.length, 0,
            'the previous claimant cannot acknowledge a new claim');
        await db.query("UPDATE public.push_delivery_receipts SET delivered=true, lease_until=now()-interval '1 second' WHERE delivery_key='test:device' AND claim_token=$1", [replacement]);
        assert.equal((await db.query("SELECT public.claim_push_delivery('test:device') AS token")).rows[0].token, null,
            'a delivered receipt cannot be reclaimed even after expiry');
        checks += 5;
    } finally { await db.exec('RESET ROLE'); }
    for (const actor of [null, 'clientA', 'coachA', 'admin']) {
        await denied(actor, 'SELECT * FROM public.notification_sent_log');
        await denied(actor, 'SELECT * FROM public.daily_alert_sent_log');
        await denied(actor, 'SELECT * FROM public.push_delivery_receipts');
        await denied(actor, "SELECT public.claim_push_delivery('test:device')");
    }
    await denied('clientA', 'INSERT INTO public.notification_sent_log(rule_id) VALUES($1)', [rule.rows[0].id]);
    await denied('clientA', "INSERT INTO public.daily_alert_sent_log(user_id,alert_time) VALUES($1,'10:00')", [ids.clientA]);
    await denied('clientA', 'DELETE FROM public.notification_sent_log RETURNING rule_id');
    await denied('clientA', 'TRUNCATE public.daily_alert_sent_log');
    // Refuse suspicious historical relationships atomically; never auto-delete them.
    await db.query('INSERT INTO public.client_coaches VALUES($1,$2)', [ids.clientB, ids.clientA]);
    await assert.rejects(db.exec(patch), error => error.code === 'P0001' && /relationship/.test(error.message));
    await db.exec('ROLLBACK');
    assert.equal((await db.query('SELECT count(*)::int AS count FROM public.client_coaches WHERE client_id=$1 AND coach_id=$2', [ids.clientB, ids.clientA])).rows[0].count, 1);
    await db.query('DELETE FROM public.client_coaches WHERE client_id=$1 AND coach_id=$2', [ids.clientB, ids.clientA]);
    checks += 2;
    // Optional feature tables can be absent on older installations.
    await db.exec('DROP TABLE public.notification_rules CASCADE; DROP TABLE public.daily_completions');
    await db.exec(patch);
    checks++;
    // The supplementary export remains executable inside a read-only transaction
    // and returns explicit empty arrays instead of an ambiguous empty result.
    await db.exec('BEGIN READ ONLY');
    try {
        const exported = await db.query(await source('src/database/security/export_context_readonly.sql'));
        assert.equal(exported.rows.length, 1);
        const context = exported.rows[0].live_context;
        for (const section of ['tables', 'columns', 'constraints', 'triggers', 'functions', 'policies', 'table_grants', 'column_grants', 'indexes']) {
            assert.ok(Array.isArray(context[section]), section);
        }
        assert.ok(context.tables.some(table => table.table_name === 'profiles' && table.rls_enabled));
        assert.ok(context.functions.some(fn => fn.function_name === 'create_client_user' && fn.definition));
        assert.ok(context.table_grants.some(grant => grant.table_name === 'notification_sent_log' && grant.grantee === 'service_role'));
        assert.ok(!context.table_grants.some(grant => grant.table_name === 'notification_sent_log' && grant.grantee === 'authenticated'));
        checks += 3;
    } finally { await db.exec('ROLLBACK'); }
    console.log(`Database security: ${checks} positive/negative checks passed; PostgreSQL RLS/triggers/RPC and patch idempotency verified.`);
} catch (error) {
    console.error('Database security test failed:', error.message, error.code || '', error.query || '');
    process.exitCode = 1;
} finally {
    await db.close();
}
