import test from 'node:test'
import assert from 'node:assert/strict'
import { createPushPolicy, resolvePushCaller, safePushUrl, isValidTime } from '../_shared/push-policy.js'
import { createServiceTokenVerifier } from '../_shared/service-auth.js'

const client = '11111111-1111-4111-8111-111111111111'
const coach = '22222222-2222-4222-8222-222222222222'
const outsider = '33333333-3333-4333-8333-333333333333'

function policy({ role = 'client', linked = true, feedback = true, fail = false, clients = [client] } = {}) {
    return createPushPolicy({
        getProfile: async id => {
            if (fail) throw new Error('DB unavailable')
            return { id, role, full_name: 'Ada Lovelace' }
        },
        isLinked: async () => {
            if (fail) throw new Error('DB unavailable')
            return linked
        },
        hasRecentFeedback: async () => {
            if (fail) throw new Error('DB unavailable')
            return feedback ? { id: 'feedback-id' } : null
        },
        getCoachClientIds: async () => {
            if (fail) throw new Error('DB unavailable')
            return clients
        },
    })
}

test('caller resolution defaults to verified users or the configured service secret', async () => {
    const auth = { getUser: async token => token === 'valid-user-token'
        ? { data: { user: { id: client } }, error: null }
        : { data: { user: null }, error: new Error('invalid') } }
    assert.deepEqual(await resolvePushCaller(new Request('https://fn', { headers: { authorization: 'Bearer valid-user-token' } }), 'service-secret', auth), { kind: 'user', id: client })
    assert.deepEqual(await resolvePushCaller(new Request('https://fn', { headers: { authorization: 'Bearer service-secret' } }), 'service-secret', auth), { kind: 'service' })
    assert.equal(await resolvePushCaller(new Request('https://fn', { headers: { authorization: 'Bearer anon-key' } }), 'service-secret', auth), null)
    assert.equal(await resolvePushCaller(new Request('https://fn'), 'service-secret', auth), null)
})

test('a separately issued service JWT needs a successful project authorization check', async () => {
    const jwt = (role, signature) => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.${signature}`
    const legacy = jwt('service_role', 'valid-project-signature')
    const forged = jwt('service_role', 'forged-signature')
    const user = jwt('authenticated', 'user-signature')
    const auth = { getUser: async () => ({ data: { user: null }, error: new Error('not a user session') }) }
    const verified = []
    const verify = async token => { verified.push(token); return token === legacy }
    const request = token => new Request('https://fn', { headers: { authorization: `Bearer ${token}` } })
    assert.deepEqual(await resolvePushCaller(request(legacy), 'different-configured-key', auth, verify), { kind: 'service' })
    assert.equal(await resolvePushCaller(request(forged), 'different-configured-key', auth, verify), null)
    assert.equal(await resolvePushCaller(request(user), 'different-configured-key', auth, verify), null)
    assert.deepEqual(verified, [legacy, forged], 'an unverified role claim alone never grants access')
})

test('service verification uses only the public key and a zero-row private-table request', async () => {
    const requests = []
    const verify = createServiceTokenVerifier('https://project.test', 'public-anon-key', async (url, options) => {
        requests.push({ url: String(url), ...options })
        return new Response(null, { status: options.headers.Authorization === 'Bearer valid-service' ? 200 : 401 })
    })
    assert.equal(await verify('valid-service'), true)
    assert.equal(await verify('forged-service'), false)
    assert.equal(requests[0].method, 'HEAD')
    assert.match(requests[0].url, /push_delivery_receipts\?select=delivery_key&limit=0$/)
    assert.equal(requests[0].headers.apikey, 'public-anon-key')
    assert.equal(await createServiceTokenVerifier('https://project.test', null)('valid-service'), false)
    assert.equal(await createServiceTokenVerifier('https://project.test', 'public', async () => { throw Error('offline') })('valid-service'), false)
})

test('client can notify linked coach only after recent feedback; server owns message text', async () => {
    const result = await policy()(client, { type: 'direct', user_id: coach, title: 'forged', body: 'forged', url: 'https://evil.test' }, 'https://app.test')
    assert.deepEqual(result, { allowed: true, recipients: [coach], deliveryKey: `feedback:${client}:feedback-id`, payload: { title: 'Nuovo Feedback! 📝', body: 'Hai ricevuto un feedback da Ada', url: `/coach/clients/${client}` } })
    assert.equal((await policy({ linked: false })(client, { type: 'direct', user_id: coach, title: 'x', body: 'x' }, 'https://app.test')).allowed, false)
    assert.equal((await policy({ feedback: false })(client, { type: 'direct', user_id: coach, title: 'x', body: 'x' }, 'https://app.test')).allowed, false)
})

test('self test and coach-to-client direct notification remain available', async () => {
    assert.equal((await policy()(client, { type: 'direct', user_id: client, title: 'Test', body: 'OK', url: '/profile' }, 'https://app.test')).allowed, true)
    const result = await policy({ role: 'coach' })(coach, { type: 'direct', user_id: client, title: 'Coach', body: 'Your plan is ready', url: '/client/dashboard' }, 'https://app.test')
    assert.deepEqual(result.recipients, [client])
    assert.equal((await policy({ role: 'coach', linked: false })(coach, { type: 'direct', user_id: client, title: 'Coach', body: 'x', url: '/' }, 'https://app.test')).allowed, false)
})

test('announcements are limited to the coach own clients; broadcast requires admin', async () => {
    const announcement = await policy({ role: 'coach' })(coach, { type: 'announcement', coach_id: coach, target_client_ids: [client], title: 'Update', body: 'Hello', url: '/client/board' }, 'https://app.test')
    assert.deepEqual(announcement.recipients, [client])
    assert.equal((await policy({ role: 'coach' })(coach, { type: 'announcement', coach_id: coach, target_client_ids: [outsider], title: 'Update', body: 'Hello' }, 'https://app.test')).allowed, false)
    assert.equal((await policy({ role: 'coach' })(coach, { type: 'broadcast', title: 'All', body: 'Hello' }, 'https://app.test')).allowed, false)
    assert.equal((await policy({ role: 'admin' })(outsider, { type: 'broadcast', title: 'All', body: 'Hello' }, 'https://app.test')).allowed, true)
})

test('DB failures deny safely; notification URLs and time overrides are constrained', async () => {
    assert.deepEqual(await policy({ fail: true })(client, { type: 'direct', user_id: client, title: 'Test', body: 'OK' }, 'https://app.test'), { allowed: false, status: 503 })
    assert.equal(safePushUrl('//evil.test/x', 'https://app.test'), null)
    assert.equal(safePushUrl('javascript:alert(1)', 'https://app.test'), null)
    assert.equal(safePushUrl('https://evil.test/x', 'https://app.test'), null)
    assert.equal(safePushUrl('/profile?q=1#top', 'https://app.test'), '/profile?q=1#top')
    assert.equal(safePushUrl('/profile?q=1#top'), '/profile?q=1#top')
    assert.equal(safePushUrl('https://app.test/profile', 'https://app.test'), 'https://app.test/profile')
    assert.equal(isValidTime('23:59'), true)
    assert.equal(isValidTime('24:00'), false)
    assert.equal(isValidTime('7:00'), false)
})
