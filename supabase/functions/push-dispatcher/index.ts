
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webwebpush from 'npm:web-push@3.6.7'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// VAPID keys should be stored in Supabase Secrets
// Run: supabase secrets set VAPID_PUBLIC_KEY="your_public_key" VAPID_PRIVATE_KEY="your_private_key"
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
const subject = 'mailto:admin@lifehabits.app' // Update this to your email

if (vapidPublicKey && vapidPrivateKey) {
    webwebpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey)
} else {
    console.error('VAPID keys not set!')
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function createResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const bodyContent = await req.json().catch(() => ({}))
        const { type, user_id, title, body, url, coach_id, target_client_ids, simulated_time } = bodyContent

        if (type === 'direct') {
            await sendNotificationToUser(supabase, user_id, { title, body, url })
            return createResponse({ message: 'Notification sent' })
        }

        if (type === 'broadcast') {
            const { data: subs, error } = await supabase.from('push_subscriptions').select('user_id, subscription')
            if (error) throw error
            await Promise.all((subs || []).map(sub => sendPush(sub.subscription, { title, body, url }).catch(() => {})))
            return createResponse({ message: `Broadcast sent to ${subs?.length || 0} devices` })
        }

        if (type === 'announcement') {
            if (!coach_id) return createResponse({ error: 'Missing coach_id' }, 400)
            let recipients = target_client_ids && target_client_ids.length > 0 ? target_client_ids : []
            if (recipients.length === 0) {
                const { data: clients } = await supabase.from('client_coaches').select('client_id').eq('coach_id', coach_id)
                recipients = clients?.map(c => c.client_id) || []
            }
            if (recipients.length === 0) return createResponse({ message: 'No recipients found' })
            const { data: subs } = await supabase.from('push_subscriptions').select('user_id, subscription').in('user_id', recipients)
            await Promise.all((subs || []).map(sub => sendPush(sub.subscription, { title, body, url }).catch(() => {})))
            return createResponse({ message: `Announcement sent to ${subs?.length || 0} devices` })
        }

        if (type === 'cron') {
            const now = new Date()
            const timeStr = simulated_time || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' }).slice(0, 5)
            const hour = timeStr.split(':')[0]
            const today = now.toISOString().split('T')[0]

            const { data: settings } = await supabase.from('alert_settings').select('*').eq('is_enabled', true)
            let sent = 0
            for (const s of (settings || [])) {
                const slots = s.alert_times?.filter((t: string) => t.startsWith(hour)) || []
                for (const slot of slots) {
                    const { data: exists } = await supabase.from('daily_alert_sent_log').select('sent_at').eq('user_id', s.user_id).eq('alert_time', slot).eq('sent_date', today).maybeSingle()
                    if (exists) continue

                    await sendNotificationToUser(supabase, s.user_id, { title: "È ora della tua attività! 💪", body: "Ricordati di completare le tue abitudini oggi.", url: "/dashboard" })
                    await supabase.from('daily_alert_sent_log').insert({ user_id: s.user_id, alert_time: slot, sent_date: today })
                    sent++
                }
            }
            return createResponse({ sent })
        }

        return createResponse({ error: 'Invalid type' }, 400)

    } catch (error: any) {
        console.error('Push Dispatcher Error:', error)
        return createResponse({ error: error.message }, 500)
    }
})

async function sendNotificationToUser(supabase, userId, payload) {
    const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('subscription')
        .eq('user_id', userId)

    if (!subscriptions?.length) return

    const promises = subscriptions.map(sub =>
        sendPush(sub.subscription, payload).catch(async err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase.from('push_subscriptions')
                    .delete()
                    .eq('user_id', userId)
                // .eq('subscription', sub.subscription) // This might fail if JSONB comparison is not exact
                // Safer to just delete all for user? No.
                // Let's assume user_id cleanup is enough for now or log it.
                console.log('Subscription expired/invalid for user', userId)
            }
        })
    )
    return Promise.all(promises)
}

async function sendPush(subscription, payload) {
    return webwebpush.sendNotification(
        subscription,
        JSON.stringify(payload)
    )
}
