import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { createPushPolicy, isValidTime, resolvePushCaller, romeSlot } from '../_shared/push-policy.js'
import { sendScheduledPush } from '../_shared/push-delivery.js'
import { createServiceTokenVerifier } from '../_shared/service-auth.js'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const verifyServiceToken = createServiceTokenVerifier(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'))
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails('mailto:admin@lifehabits.app', vapidPublicKey, vapidPrivateKey)
} else {
    console.error('VAPID keys not set!')
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function createResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    if (req.method !== 'POST') return createResponse({ error: 'Method not allowed' }, 405)

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })
        const body = await req.json().catch(() => null)
        if (!body || typeof body !== 'object' || Array.isArray(body)) return createResponse({ error: 'Invalid request' }, 400)

        const caller = await resolvePushCaller(req, supabaseServiceKey, supabase.auth, verifyServiceToken)
        if (!caller) return createResponse({ error: 'Unauthorized' }, 401)

        if (body.type === 'cron') {
            if (caller.kind !== 'service') return createResponse({ error: 'Forbidden' }, 403)
            return await dispatchCron(supabase, body.simulated_time)
        }
        if (caller.kind !== 'user') return createResponse({ error: 'Forbidden' }, 403)

        const policy = createPushPolicy({
            getProfile: async (id) => {
                const { data, error } = await supabase.from('profiles').select('id, role, full_name').eq('id', id).maybeSingle()
                if (error) throw error
                return data
            },
            isLinked: async (actorId, targetId, direction) => {
                const coachId = direction === 'client-to-coach' ? targetId : actorId
                const clientId = direction === 'client-to-coach' ? actorId : targetId
                const { data, error } = await supabase.from('client_coaches')
                    .select('client_id').eq('coach_id', coachId).eq('client_id', clientId).maybeSingle()
                if (error) throw error
                if (data) return true

                const { data: directLink, error: directError } = await supabase.from('clients_info')
                    .select('id').eq('coach_id', coachId).eq('id', clientId).maybeSingle()
                if (directError) throw directError
                return Boolean(directLink)
            },
            hasRecentFeedback: async (clientId) => {
                const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
                const { data, error } = await supabase.from('daily_feedbacks')
                    .select('id').eq('client_id', clientId).gte('created_at', since)
                    .order('created_at', { ascending: false }).limit(1).maybeSingle()
                if (error) throw error
                return data
            },
            getCoachClientIds: async (coachId) => {
                const { data: links, error } = await supabase.from('client_coaches').select('client_id').eq('coach_id', coachId)
                if (error) throw error
                const { data: direct, error: directError } = await supabase.from('clients_info').select('id').eq('coach_id', coachId)
                if (directError) throw directError
                return [...new Set([...(links ?? []).map(row => row.client_id), ...(direct ?? []).map(row => row.id)])]
            }
        })
        const decision = await policy(caller.id, body, req.headers.get('origin') ?? undefined)
        if (!decision.allowed) return createResponse({ error: 'Forbidden' }, decision.status)

        const subscriptions = await getSubscriptions(supabase, decision.recipients)
        const results = await Promise.allSettled(subscriptions.map(async sub => {
            if (!decision.deliveryKey) return sendToSubscription(supabase, sub, decision.payload)
            const result = await sendScheduledPush(supabase, sub, JSON.stringify(decision.payload),
                `${decision.deliveryKey}:${sub.id}`,
                (subscription, data) => webpush.sendNotification(subscription, data, { timeout: 15000 }))
            if (result.retryable) throw new Error('Push provider unavailable')
            return result.success
        }))
        const sent = results.filter(result => result.status === 'fulfilled' && result.value).length
        const failed = results.filter(result => result.status === 'rejected').length
        return createResponse({ message: 'Notification processed', sent, failed }, failed ? 502 : 200)
    } catch (error) {
        console.error('Push Dispatcher Error:', error)
        return createResponse({ error: 'Notification processing failed' }, 500)
    }
})

async function getSubscriptions(supabase, userIds: string[] | null) {
    if (userIds === null) {
        const { data, error } = await supabase.from('push_subscriptions').select('id, user_id, subscription')
        if (error) throw error
        return data ?? []
    }
    const subscriptions = []
    for (let start = 0; start < userIds.length; start += 500) {
        const { data, error } = await supabase.from('push_subscriptions')
            .select('id, user_id, subscription').in('user_id', userIds.slice(start, start + 500))
        if (error) throw error
        subscriptions.push(...(data ?? []))
    }
    return subscriptions
}

async function sendToSubscription(supabase, sub, payload) {
    try {
        await webpush.sendNotification(sub.subscription, JSON.stringify(payload))
        return true
    } catch (error: any) {
        if (error?.statusCode === 410 || error?.statusCode === 404) {
            const { error: deleteError } = await supabase.from('push_subscriptions').delete()
                .eq('id', sub.id).eq('subscription', JSON.stringify(sub.subscription))
            if (deleteError) throw deleteError
            return false
        } else {
            throw error
        }
    }
}

async function dispatchCron(supabase, simulatedTime?: unknown) {
    if (simulatedTime !== undefined && !isValidTime(simulatedTime)) {
        return createResponse({ error: 'Invalid simulated_time' }, 400)
    }
    const now = new Date()
    const local = romeSlot(now)
    const timeStr = typeof simulatedTime === 'string' ? simulatedTime : local.time
    const hour = timeStr.slice(0, 2)
    const today = local.date

    const { data: settings, error: settingsError } = await supabase.from('alert_settings').select('user_id, alert_times').eq('is_enabled', true)
    if (settingsError) throw settingsError
    let sent = 0
    let failed = 0
    for (const setting of settings ?? []) {
        // Keep the deployed hourly dispatch semantics, including stored HH:mm:ss slots.
        const slots = setting.alert_times?.filter((time: string) =>
            typeof time === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(time) && time.startsWith(hour)) ?? []
        for (const slot of slots) {
            const { data: exists, error: existsError } = await supabase.from('daily_alert_sent_log')
                .select('sent_at').eq('user_id', setting.user_id).eq('alert_time', slot).eq('sent_date', today).maybeSingle()
            if (existsError) throw existsError
            if (exists) continue

            const subscriptions = await getSubscriptions(supabase, [setting.user_id])
            if (!subscriptions.length) continue
            const payload = JSON.stringify({
                title: 'È ora della tua attività! 💪',
                body: 'Ricordati di completare le tue abitudini oggi.',
                url: '/dashboard'
            })
            const results = await Promise.all(subscriptions.map(sub => sendScheduledPush(supabase, sub, payload,
                `daily:${setting.user_id}:${slot}:${today}:${sub.id}`,
                (subscription, data) => webpush.sendNotification(subscription, data, { timeout: 15000 }))))
            failed += results.filter(result => result.retryable).length
            if (results.some(result => result.retryable || result.pending)) continue
            const { error: insertError } = await supabase.from('daily_alert_sent_log').upsert({
                user_id: setting.user_id, alert_time: slot, sent_date: today
            }, { onConflict: 'user_id,alert_time,sent_date', ignoreDuplicates: true })
            if (insertError) throw insertError
            sent++
        }
    }
    return createResponse({ sent, failed }, failed ? 502 : 200)
}
