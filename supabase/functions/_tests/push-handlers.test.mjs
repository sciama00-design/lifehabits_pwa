import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { romeSlot, notificationWindow } from '../_shared/push-policy.js'
import { sendScheduledPush } from '../_shared/push-delivery.js'
import { createClient as createRealClient } from '@supabase/supabase-js'

const here = dirname(fileURLToPath(import.meta.url))
const serviceKey = 'service-role-test-key'
const clientId = '11111111-1111-4111-8111-111111111111'
const coachId = '22222222-2222-4222-8222-222222222222'
const rogueCoachId = '33333333-3333-4333-8333-333333333333'
const moduleSources = new Map([
    ['push-supabase', `export const createClient = (...args) => globalThis.__pushCreateClient(...args)`],
    ['push-webpush', `const webpush = { setVapidDetails() {}, sendNotification: (...args) => globalThis.__pushSend(...args) }; export default webpush`],
])

async function loadHandler(name, harness) {
    const entry = resolve(here, `../${name}/index.ts`)
    const { outputFiles } = await build({
        entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', write: false,
        plugins: [{
            name: 'edge-stubs',
            setup(buildApi) {
                buildApi.onResolve({ filter: /^(jsr:@supabase\/supabase-js@2|npm:web-push@3\.6\.7)$/ }, ({ path }) => ({
                    path: path.startsWith('jsr:') ? 'push-supabase' : 'push-webpush', namespace: 'push-test',
                }))
                buildApi.onLoad({ filter: /.*/, namespace: 'push-test' }, ({ path }) => ({ contents: moduleSources.get(path), loader: 'js' }))
            },
        }],
    })
    globalThis.Deno = {
        env: { get: (key) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? serviceKey : 'test-value' },
        serve: (handler) => { globalThis.__pushHandler = handler },
    }
    globalThis.__pushCreateClient = harness.createClient
    globalThis.__pushSend = harness.send
    const module = { exports: {} }
    const Clock = harness.now ? class extends Date {
        constructor(...args) { super(...(args.length ? args : [harness.now])) }
        static now() { return new Date(harness.now).getTime() }
    } : Date
    new Function('module', 'exports', 'Date', outputFiles[0].text)(module, module.exports, Clock)
    return globalThis.__pushHandler
}

function harness({ profiles = [], links = [], directClients = [], rules = [], alertSettings = [], subscriptions = [],
    feedbacks = [{ id: 'feedback', client_id: clientId, created_at: new Date().toISOString() }],
    now, sendError = () => null, dbError = () => null } = {}) {
    const sent = []
    const queries = []
    subscriptions = subscriptions.map((sub, i) => ({ id: `device-${i}`, ...sub }))
    const tables = { profiles, client_coaches: links, clients_info: directClients, notification_rules: rules,
        alert_settings: alertSettings, push_subscriptions: subscriptions, notification_sent_log: [],
        daily_feedbacks: feedbacks, daily_alert_sent_log: [], push_delivery_receipts: [] }
    const createClient = () => ({
        async rpc(name, { delivery_key }) {
            assert.equal(name, 'claim_push_delivery')
            const error = dbError({ table: 'push_delivery_receipts', operation: 'claim' })
            if (error) return { data: null, error }
            if (tables.push_delivery_receipts.some(row => row.delivery_key === delivery_key)) return { data: null, error: null }
            const token = `claim-${tables.push_delivery_receipts.length}`
            tables.push_delivery_receipts.push({ delivery_key, claim_token: token, delivered: false })
            return { data: token, error: null }
        },
        auth: { getUser: async token => token === 'client-token'
            ? { data: { user: { id: clientId } }, error: null }
            : token === 'coach-token'
                ? { data: { user: { id: coachId } }, error: null }
                : token === 'admin-token'
                    ? { data: { user: { id: rogueCoachId } }, error: null }
                : { data: { user: null }, error: new Error('invalid token') } },
        from(table) {
            const state = { table, filters: [], operation: 'select', inserted: null }
            queries.push(state)
            const query = {
                select() { return query },
                eq(column, value) { state.filters.push([column, value]); return query },
                gte(column, value) { state.filters.push([column, value, 'gte']); return query },
                in(column, value) { state.filters.push([column, value]); return query },
                limit(value) { state.limit = value; return query },
                order(column, { ascending }) { state.order = { column, ascending }; return query },
                insert(value) { state.operation = 'insert'; state.inserted = value; return query },
                upsert(value) { state.operation = 'insert'; state.inserted = value; state.ignoreDuplicates = true; return query },
                update(value) { state.operation = 'update'; state.updated = value; return query },
                delete() { state.operation = 'delete'; return query },
                maybeSingle: async () => {
                    const { data, error } = result(state)
                    if (data?.length > 1) return { data: null, error: { code: 'PGRST116' } }
                    return { data: data?.[0] ?? null, error }
                },
                then(resolve, reject) { return Promise.resolve(result(state)).then(resolve, reject) },
            }
            return query
        },
    })
    function result(state) {
        const error = dbError(state)
        if (error) return { data: null, error }
        const source = tables[state.table] ?? []
        if (state.operation === 'insert') {
            if (state.table === 'daily_alert_sent_log' && source.some(row =>
                row.user_id === state.inserted.user_id && row.alert_time === state.inserted.alert_time && row.sent_date === state.inserted.sent_date)) {
                return { data: null, error: state.ignoreDuplicates ? null : { code: '23505' } }
            }
            if (state.table === 'notification_sent_log' && source.some(row => row.rule_id === state.inserted.rule_id && row.sent_date === state.inserted.sent_date)) {
                if (state.ignoreDuplicates) return { data: null, error: null }
                return { data: null, error: { code: '23505' } }
            }
            source.push(state.inserted)
            return { data: state.inserted, error: null }
        }
        let filtered = source.filter(row => state.filters.every(([column, expected, operator]) => {
            let value = row[column]
            if (column === 'subscription') return JSON.stringify(value) === expected
            if (operator === 'gte') return Date.parse(value) >= Date.parse(expected)
            // PostgreSQL TIME compares HH:mm and HH:mm:00 equally.
            if (column === 'scheduled_time') value = value.slice(0, 5)
            if (expected && typeof expected === 'object' && !Array.isArray(expected)) return JSON.stringify(value) === JSON.stringify(expected)
            return Array.isArray(expected) ? expected.includes(value) : value === expected
        }))
        if (state.operation === 'delete') tables[state.table] = source.filter(row => !filtered.includes(row))
        if (state.operation === 'update') filtered.forEach(row => Object.assign(row, state.updated))
        if (state.order) filtered.sort((a, b) => String(a[state.order.column]).localeCompare(String(b[state.order.column])) * (state.order.ascending ? 1 : -1))
        if (state.limit) filtered = filtered.slice(0, state.limit)
        return { data: filtered, error: null }
    }
    return { createClient, sent, queries, tables, now, send: async (...args) => {
        sent.push(args)
        const error = sendError(...args)
        if (error) throw error
    } }
}

const post = (body, token) => new Request('https://project.functions.supabase.co/function', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, origin: 'https://app.test' },
    body: JSON.stringify(body),
})

test('dispatcher rejects anon credentials, preserves self tests and authorizes linked announcements', async () => {
    const state = harness({
        profiles: [{ id: clientId, role: 'client', full_name: 'Ada Lovelace' }, { id: coachId, role: 'coach' }, { id: rogueCoachId, role: 'admin' }],
        links: [{ coach_id: coachId, client_id: clientId }],
        subscriptions: [{ user_id: clientId, subscription: { endpoint: 'https://push.test/client' } }, { user_id: coachId, subscription: { endpoint: 'https://push.test/coach' } }],
    })
    const handler = await loadHandler('push-dispatcher', state)
    const anon = await handler(post({ type: 'broadcast', title: 'x', body: 'x' }, 'anon-token'))
    assert.equal(anon.status, 401)
    assert.equal(state.sent.length, 0)

    const self = await handler(post({ type: 'direct', user_id: clientId, title: 'Test', body: 'Ping', url: '/profile' }, 'client-token'))
    assert.equal(self.status, 200)
    assert.equal(state.sent.length, 1)

    const feedback = await handler(post({ type: 'direct', user_id: coachId, title: 'forged', body: 'forged', url: '/coach/clients/' + clientId }, 'client-token'))
    assert.equal(feedback.status, 200)
    assert.equal(JSON.parse(state.sent[1][1]).body, 'Hai ricevuto un feedback da Ada')

    const announcement = await handler(post({ type: 'announcement', coach_id: coachId, target_client_ids: [clientId], title: 'Update', body: 'News', url: '/client/board' }, 'coach-token'))
    assert.equal(announcement.status, 200)
    assert.equal(state.sent.length, 3)
    assert.equal(state.sent[2][0].endpoint, 'https://push.test/client')

    const broadcast = await handler(post({ type: 'broadcast', title: 'Admin', body: 'Service update' }, 'admin-token'))
    assert.equal(broadcast.status, 200)
    assert.equal(state.sent.length, 5)

    const serviceCron = await handler(new Request('https://project.functions.supabase.co/function', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ type: 'cron', simulated_time: '13:00' }),
    }))
    assert.equal(serviceCron.status, 200)

    const forgedTarget = await handler(post({ type: 'announcement', coach_id: coachId, target_client_ids: [rogueCoachId], title: 'Update', body: 'News' }, 'coach-token'))
    assert.equal(forgedTarget.status, 403)
    assert.equal(state.sent.length, 5)
})

test('scheduler accepts service credential, rejects user JWT, and sends only rules owned by a current coach', async () => {
    const state = harness({
        profiles: [{ id: coachId, role: 'coach' }, { id: rogueCoachId, role: 'client' }],
        links: [{ coach_id: coachId, client_id: clientId }],
        rules: [
            { id: 'valid-rule', coach_id: coachId, client_id: clientId, message: 'Valid', scheduled_time: '13:00' },
            { id: 'stale-rule', coach_id: rogueCoachId, client_id: clientId, message: 'Stale', scheduled_time: '13:00' },
        ],
        alertSettings: [{ user_id: clientId, is_enabled: true }],
        subscriptions: [{ user_id: clientId, subscription: { endpoint: 'https://push.test/client' } }],
    })
    const handler = await loadHandler('push-scheduler', state)
    const user = await handler(post({ timeOverride: '13:00' }, 'client-token'))
    assert.equal(user.status, 401)
    assert.equal(state.sent.length, 0)

    const serviceRequest = new Request('https://project.functions.supabase.co/function', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ timeOverride: '13:00' }),
    })
    const service = await handler(serviceRequest)
    assert.equal(service.status, 200)
    assert.equal(state.sent.length, 1)
    assert.deepEqual(JSON.parse(state.sent[0][1]), { title: 'LifeHabits', body: 'Valid' })
    assert.equal(state.queries.some(query => query.table === 'notification_sent_log' && query.inserted?.rule_id === 'stale-rule'), false)
})

const servicePost = body => post(body, serviceKey)
const schedulerFixture = options => harness({
    profiles: [{ id: coachId, role: 'coach' }],
    directClients: [{ id: clientId, coach_id: coachId }],
    rules: [{ id: 'rule', coach_id: coachId, client_id: clientId, message: 'Reminder', scheduled_time: '13:00:00' }],
    alertSettings: [{ user_id: clientId, is_enabled: true }],
    subscriptions: [{ user_id: clientId, subscription: { endpoint: 'https://push.test/valid' } }],
    ...options,
})

test('expired device cleanup preserves the other device for dispatcher and scheduler', async () => {
    for (const name of ['push-dispatcher', 'push-scheduler']) {
        const state = schedulerFixture({
            profiles: [{ id: clientId, role: 'client' }, { id: coachId, role: 'coach' }],
            subscriptions: ['expired', 'valid'].map(device => ({ user_id: clientId, subscription: { endpoint: `https://push.test/${device}` } })),
            sendError: sub => sub.endpoint.endsWith('/expired') ? { statusCode: 410 } : null,
        })
        const handler = await loadHandler(name, state)
        const request = () => name === 'push-dispatcher'
            ? post({ type: 'direct', user_id: clientId, title: 'Test', body: 'Ping' }, 'client-token')
            : servicePost({ timeOverride: '13:00' })
        const response = await handler(request())
        assert.equal(response.status, 200)
        assert.equal((await response.json()).sent, 1)
        assert.deepEqual(state.tables.push_subscriptions.map(sub => sub.subscription.endpoint), ['https://push.test/valid'])
        await handler(request())
        assert.equal(state.sent.length, name === 'push-dispatcher' ? 3 : 2, 'scheduler persists its log across ticks')
    }
})

test('feedback existence lookup accepts two recent days; cleanup failures and partial sends are reported', async () => {
    const state = harness({
        profiles: [{ id: clientId, role: 'client' }], links: [{ client_id: clientId, coach_id: coachId }],
        feedbacks: [1, 2].map(id => ({ id, client_id: clientId, created_at: new Date().toISOString() })),
        subscriptions: ['expired', 'valid'].map(device => ({ user_id: coachId, subscription: { endpoint: `https://push.test/${device}` } })),
        sendError: sub => sub.endpoint.endsWith('/expired') ? { statusCode: 404 } : null,
        dbError: query => query.operation === 'delete' ? { code: 'database unavailable' } : null,
    })
    const handler = await loadHandler('push-dispatcher', state)
    const response = await handler(post({ type: 'direct', user_id: coachId }, 'client-token'))
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { message: 'Notification processed', sent: 1, failed: 1 })
    assert.equal(state.tables.push_subscriptions.length, 2)
})

test('scheduler tolerates legacy cron bodies after authentication and obeys disabled preferences', async () => {
    const state = schedulerFixture({ now: '2026-11-07T12:00:00Z', alertSettings: [{ user_id: clientId, is_enabled: false }] })
    const handler = await loadHandler('push-scheduler', state)
    for (const token of [serviceKey, 'client-token']) {
        const response = await handler(new Request('https://functions.test', { method: 'POST',
            headers: { authorization: `Bearer ${token}` }, body: 'legacy non-json body' }))
        assert.equal(response.status, token === serviceKey ? 200 : 401)
    }
    assert.equal(state.sent.length, 0)
    assert.equal(state.tables.notification_sent_log.length, 0)
    assert.equal((await handler(servicePost({ timeOverride: '25:00' }))).status, 400)
})

test('scheduler retries a complete transient outage and never sends after a DB read failure', async () => {
    let failing = true
    const state = schedulerFixture({ sendError: () => failing ? { statusCode: 503 } : null })
    const handler = await loadHandler('push-scheduler', state)
    const first = await handler(servicePost({ timeOverride: '13:00' }))
    assert.equal((await first.json()).failed, 1)
    assert.equal(state.tables.notification_sent_log.length, 0)
    failing = false
    assert.equal((await handler(servicePost({ timeOverride: '13:00' }))).status, 200)
    assert.equal(state.tables.notification_sent_log.length, 1)
    assert.equal(state.sent.length, 2)
    const broken = schedulerFixture({ dbError: query => query.table === 'alert_settings' ? { code: 'offline' } : null })
    const brokenHandler = await loadHandler('push-scheduler', broken)
    assert.equal((await brokenHandler(servicePost({ timeOverride: '13:00' }))).status, 500)
    assert.equal(broken.sent.length, 0)
    assert.equal(broken.tables.notification_sent_log.length, 0)
})

test('Rome midnight, DST jumps and repeated hours retain the date of each slot', () => {
    assert.deepEqual(romeSlot(new Date('2026-11-07T23:05:00Z')), { date: '2026-11-08', time: '00:05' })
    const midnight = notificationWindow(new Date('2026-11-07T23:05:00Z'))
    assert.ok(midnight.some(slot => slot.date === '2026-11-07' && slot.time === '23:55'))
    assert.ok(midnight.some(slot => slot.date === '2026-11-08' && slot.time === '00:05'))
    assert.equal(romeSlot(new Date('2026-03-29T00:59:00Z')).time, '01:59')
    assert.equal(romeSlot(new Date('2026-03-29T01:00:00Z')).time, '03:00')
    assert.deepEqual(romeSlot(new Date('2026-10-25T00:15:00Z')), romeSlot(new Date('2026-10-25T01:15:00Z')))
})

test('scheduler logs the matching slot date across midnight and deduplicates repeated ticks', async () => {
    const state = schedulerFixture({ now: '2026-11-07T23:05:00Z', rules: [
        { id: 'previous', coach_id: coachId, client_id: clientId, message: 'Previous', scheduled_time: '23:55:00' },
        { id: 'today', coach_id: coachId, client_id: clientId, message: 'Today', scheduled_time: '00:05:00' },
    ] })
    const handler = await loadHandler('push-scheduler', state)
    await handler(servicePost({}))
    assert.deepEqual(state.tables.notification_sent_log.map(row => [row.rule_id, row.sent_date]), [
        ['previous', '2026-11-07'], ['today', '2026-11-08'],
    ])
    await handler(servicePost({}))
    assert.equal(state.sent.length, 2)
})

test('overlapping cron calls send each device only once', async () => {
    const state = schedulerFixture()
    const handler = await loadHandler('push-scheduler', state)
    await Promise.all([handler(servicePost({ timeOverride: '13:00' })), handler(servicePost({ timeOverride: '13:00' }))])
    assert.equal(state.sent.length, 1)
})

test('partial transient failure retries only the failed device', async () => {
    let failing = true
    const state = schedulerFixture({
        subscriptions: ['valid', 'retry'].map(device => ({ user_id: clientId, subscription: { endpoint: `https://push.test/${device}` } })),
        sendError: sub => failing && sub.endpoint.endsWith('/retry') ? { statusCode: 503 } : null,
    })
    const handler = await loadHandler('push-scheduler', state)
    await handler(servicePost({ timeOverride: '13:00' }))
    failing = false
    await handler(servicePost({ timeOverride: '13:00' }))
    assert.equal(state.sent.filter(([sub]) => sub.endpoint.endsWith('/retry')).length, 2)
    assert.equal(state.sent.filter(([sub]) => sub.endpoint.endsWith('/valid')).length, 1)
})

test('daily cron preserves second-bearing slots and Rome date across simultaneous ticks', async () => {
    const state = harness({ now: '2026-11-07T23:05:00Z',
        alertSettings: [{ user_id: clientId, is_enabled: true, alert_times: ['00:05:00'] }],
        subscriptions: [{ user_id: clientId, subscription: { endpoint: 'https://push.test/device' } }],
    })
    const handler = await loadHandler('push-dispatcher', state)
    await Promise.all([handler(servicePost({ type: 'cron' })), handler(servicePost({ type: 'cron' }))])
    assert.equal(state.sent.length, 1)
    assert.equal(state.tables.daily_alert_sent_log.length, 1)
    assert.equal(state.tables.daily_alert_sent_log[0].sent_date, '2026-11-08')
    assert.equal(state.tables.daily_alert_sent_log[0].alert_time, '00:05:00')
})

test('feedback replay sends once per device, while a new feedback remains deliverable', async () => {
    const feedbacks = [{ id: 'feedback-1', client_id: clientId, created_at: new Date(Date.now() - 60000).toISOString() }]
    const state = harness({ profiles: [{ id: clientId, role: 'client' }],
        links: [{ client_id: clientId, coach_id: coachId }], feedbacks,
        subscriptions: [{ user_id: coachId, subscription: { endpoint: 'https://push.test/coach' } }],
    })
    const handler = await loadHandler('push-dispatcher', state)
    const request = () => post({ type: 'direct', user_id: coachId }, 'client-token')
    await Promise.all([handler(request()), handler(request())])
    await handler(request())
    assert.equal(state.sent.length, 1)
    feedbacks.push({ id: 'feedback-2', client_id: clientId, created_at: new Date().toISOString() })
    await handler(request())
    assert.equal(state.sent.length, 2)
})

test('receipt DB failures stop sending; log failures retry without re-sending delivered devices', async () => {
    const broken = schedulerFixture({ dbError: query => query.operation === 'claim' ? { code: 'offline' } : null })
    const brokenHandler = await loadHandler('push-scheduler', broken)
    assert.equal((await brokenHandler(servicePost({ timeOverride: '13:00' }))).status, 500)
    assert.equal(broken.sent.length, 0)
    let failLog = true
    const state = schedulerFixture({ dbError: query => failLog && query.table === 'notification_sent_log' && query.operation === 'insert' ? { code: 'offline' } : null })
    const handler = await loadHandler('push-scheduler', state)
    assert.equal((await handler(servicePost({ timeOverride: '13:00' }))).status, 500)
    failLog = false
    assert.equal((await handler(servicePost({ timeOverride: '13:00' }))).status, 200)
    assert.equal(state.sent.length, 1)
    assert.equal(state.tables.notification_sent_log.length, 1)
})

test('real Supabase client serializes expired-device JSON filter and claim acknowledgment correctly', async () => {
    const requests = []
    const subscription = { endpoint: 'https://push.test/expired', keys: { auth: 'a', p256dh: 'b' } }
    const db = createRealClient('https://db.test', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: async (input, init) => {
            const url = new URL(input)
            requests.push({ url, method: init.method, body: init.body })
            const value = url.pathname.includes('/rpc/') ? 'claim-token'
                : init.method === 'PATCH' ? { delivery_key: 'test-key' } : null
            return new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
        } },
    })
    const result = await sendScheduledPush(db, { id: 'device-id', subscription }, '{}', 'test-key',
        async () => { throw { statusCode: 410 } })
    assert.equal(result.success, false)
    const deletion = requests.find(req => req.method === 'DELETE')
    assert.equal(deletion.url.searchParams.get('id'), 'eq.device-id')
    assert.equal(deletion.url.searchParams.get('subscription'), `eq.${JSON.stringify(subscription)}`)
    assert.equal(requests.find(req => req.method === 'PATCH').url.searchParams.get('claim_token'), 'eq.claim-token')
})

test('both service workers keep push clicks on their own origin', async () => {
    for (const worker of ['src/sw.ts', 'public/custom-sw.js']) {
        const listeners = new Map()
        const shown = []
        const opened = []
        globalThis.self = {
            __WB_MANIFEST: [],
            location: { origin: 'https://app.test' },
            addEventListener: (name, listener) => listeners.set(name, listener),
            skipWaiting() {},
            registration: { showNotification: async (_title, options) => shown.push(options) },
            clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
        }

        if (worker.endsWith('.ts')) {
            const { outputFiles } = await build({
                entryPoints: [resolve(here, '../../..', worker)], bundle: true, platform: 'node', format: 'cjs', write: false,
                plugins: [{ name: 'workbox-stubs', setup(api) {
                    api.onResolve({ filter: /^workbox-(?:core|precaching)$/ }, ({ path }) => ({ path, namespace: 'workbox-test' }))
                    api.onLoad({ filter: /.*/, namespace: 'workbox-test' }, ({ path }) => ({
                        contents: path === 'workbox-core' ? 'export const clientsClaim = () => {}' : 'export const cleanupOutdatedCaches = () => {}; export const precacheAndRoute = () => {}',
                        loader: 'js',
                    }))
                } }],
            })
            const module = { exports: {} }
            new Function('module', 'exports', outputFiles[0].text)(module, module.exports)
        } else {
            const source = await readFile(resolve(here, '../../..', worker), 'utf8')
            new Function(source)()
        }

        const dispatch = async (name, event) => {
            let pending
            event.waitUntil = promise => { pending = promise }
            listeners.get(name)(event)
            await pending
        }
        await dispatch('push', { data: { json: () => ({ title: 'Notice', body: 'Hello', url: 'https://evil.test/phish' }) } })
        assert.equal(shown[0].data.url, '/')
        await dispatch('push', { data: { json: () => ({ title: 'Notice', body: 'Hello', url: 'https://app.test/profile?q=1' }) } })
        assert.equal(shown[1].data.url, 'https://app.test/profile?q=1')

        await dispatch('notificationclick', { notification: { close() {}, data: { url: 'https://evil.test/phish' } } })
        assert.equal(opened[0], '/')
        await dispatch('notificationclick', { notification: { close() {}, data: { url: 'https://app.test/profile?q=1' } } })
        assert.equal(opened[1], 'https://app.test/profile?q=1')
    }
})
