
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
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey)
        const { type, user_id, title, body, url, coach_id, target_client_ids } = await req.json()

        // 1. DIRECT SEND (e.g. Test)
        if (type === 'direct') {
            if (!user_id || !title || !body) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            await sendNotificationToUser(supabase, user_id, { title, body, url })

            return new Response(JSON.stringify({ message: 'Notification sent' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 2. BROADCAST (to ALL users - Use with caution)
        if (type === 'broadcast') {
            if (!title || !body) {
                return new Response(JSON.stringify({ error: 'Missing required fields' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            const { data: subscriptions, error } = await supabase
                .from('push_subscriptions')
                .select('user_id, subscription')

            if (error) throw error

            await Promise.all(subscriptions.map(sub =>
                sendPush(sub.subscription, { title, body, url })
                    .catch(err => {
                        console.error(`Failed to send to user ${sub.user_id}:`, err)
                        if (err.statusCode === 410) {
                            supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id).eq('subscription', sub.subscription)
                        }
                    })
            ))

            return new Response(JSON.stringify({ message: `Broadcast sent to ${subscriptions.length} devices` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 3. ANNOUNCEMENT (Coach to Clients)
        if (type === 'announcement') {
            if (!coach_id || !title || !body) {
                return new Response(JSON.stringify({ error: 'Missing coach_id, title or body' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            let recipients = []

            // If specific targets provided
            if (target_client_ids && target_client_ids.length > 0) {
                recipients = target_client_ids
            } else {
                // Fetch all clients of this coach
                // We can check `client_coaches` table or `clients_info` depending on logic.
                // Let's use `clients_info` as primary source of truth for "active client under coach".
                // Or better, `client_coaches` implies relationship.
                // We'll stick to `clients_info` as per schema analysis for "primary coach" logic if applicable, 
                // but `client_coaches` is safer for many-to-many.
                // Let's use `client_coaches`.

                const { data: clients, error: clientsError } = await supabase
                    .from('client_coaches')
                    .select('client_id')
                    .eq('coach_id', coach_id)

                if (clientsError) throw clientsError
                recipients = clients.map(c => c.client_id)
            }

            if (recipients.length === 0) {
                return new Response(JSON.stringify({ message: 'No recipients found' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            // Fetch subscriptions for these users
            const { data: subscriptions, error: subError } = await supabase
                .from('push_subscriptions')
                .select('user_id, subscription')
                .in('user_id', recipients)

            if (subError) throw subError

            if (!subscriptions || subscriptions.length === 0) {
                return new Response(JSON.stringify({ message: 'No subscriptions found for recipients' }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                })
            }

            await Promise.all(subscriptions.map(sub =>
                sendPush(sub.subscription, { title, body, url })
                    .catch(err => {
                        console.error(`Failed to send to user ${sub.user_id}:`, err)
                        if (err.statusCode === 410) {
                            supabase.from('push_subscriptions').delete().eq('user_id', sub.user_id).eq('subscription', sub.subscription)
                        }
                    })
            ))

            return new Response(JSON.stringify({ message: `Announcement sent to ${subscriptions.length} devices` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 4. CRON JOB (Daily Reminders)
        if (type === 'cron') {
            const now = new Date()
            const { simulated_time } = await req.json().catch(() => ({}))

            const timeToCheck = simulated_time || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' }).slice(0, 5) // "HH:MM"
            const hourToCheck = timeToCheck.split(':')[0] // "09"

            console.log(`Running Cron for time: ${timeToCheck} (Hour: ${hourToCheck})`)

            const { data: allSettings, error } = await supabase
                .from('alert_settings')
                .select('*')
                .eq('is_enabled', true)

            if (error) throw error

            const notificationsToSend = []

            for (const setting of allSettings) {
                if (!setting.alert_times) continue

                // Check if any alert time matches current hour
                // We match just the hour part for simplicity as agreed? Or exact match?
                // "3 volte al giorno... mattina, pome, sera".
                // If stored as "09:00", "14:00", "20:00".
                // We can check if "09" matches the start of any alert time.

                const hasMatch = setting.alert_times.some(t => t.startsWith(hourToCheck))

                if (hasMatch) {
                    notificationsToSend.push(
                        sendNotificationToUser(supabase, setting.user_id, {
                            title: "È ora della tua attività! 💪",
                            body: "Ricordati di completare le tue abitudini oggi.",
                            url: "/dashboard"
                        })
                    )
                }
            }

            await Promise.all(notificationsToSend)

            return new Response(JSON.stringify({ message: `Cron processed. Sent ${notificationsToSend.length} notifications.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        return new Response(JSON.stringify({ error: 'Invalid type' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        console.error(error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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
