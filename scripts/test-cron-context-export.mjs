import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const query = await readFile(new URL('../src/database/security/export_cron_context_readonly.sql', import.meta.url), 'utf8');
const token = role => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.fake_signature`;
try {
    await db.exec('CREATE SCHEMA cron; CREATE TABLE cron.job(jobname text, schedule text, active boolean, command text)');
    for (const [command, expected] of [
        [`SELECT net.http_post(url := 'https://example.test/functions/v1/push-scheduler', headers := '{"Authorization":"Bearer ${token('service_role')}"}')`, 'service_role'],
        [`SELECT net.http_post(url := 'https://example.test/functions/v1/push-dispatcher', headers := '{"Authorization":"Bearer ${token('anon')}"}')`, 'anon'],
        ["SELECT net.http_post(headers := (SELECT secret FROM vault.decrypted_secrets))", 'riferimento Vault: tipo non determinato'],
        ['SELECT 1', 'credenziale non determinata'],
        ['Bearer e30.a.signature', 'JWT: ruolo non riconosciuto'],
        ['Bearer e30._w.signature', 'JWT: ruolo non riconosciuto'],
    ]) {
        await db.exec('TRUNCATE cron.job');
        await db.query('INSERT INTO cron.job VALUES ($1,$2,true,$3)', ['push-scheduler-job', '* * * * *', command]);
        await db.exec('BEGIN READ ONLY');
        const { rows } = await db.query(query);
        await db.exec('ROLLBACK');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].credential_type, expected);
        assert.equal(rows[0].jobname, 'push-scheduler-job');
        assert.equal(rows[0].schedule, '* * * * *');
        assert.equal(rows[0].active, true);
        assert.deepEqual(Object.keys(rows[0]).sort(), ['jobname', 'schedule', 'active', 'target_function', 'uses_http_post', 'credential_type'].sort());
        if (command.includes('/functions/v1/')) {
            assert.equal(rows[0].uses_http_post, true);
            assert.ok(['push-scheduler', 'push-dispatcher'].includes(rows[0].target_function));
        }
        assert.ok(!JSON.stringify(rows).includes('fake_signature'));
    }
    await db.exec('TRUNCATE cron.job');
    assert.equal((await db.query(query)).rows.length, 0);
    console.log('Cron metadata export: six configurations and missing job verified; read-only query and no token output.');
} finally {
    await db.close();
}
