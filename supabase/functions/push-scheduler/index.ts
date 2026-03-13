
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Set VAPID keys from environment variables
const vapidEmail = Deno.env.get('VAPID_EMAIL') || 'admin@example.com'
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        `mailto:${vapidEmail}`,
        vapidPublicKey,
        vapidPrivateKey
    )
} else {
    console.warn('VAPID keys missing! Notifications will fail.')
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

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
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { timeOverride } = await req.json().catch(() => ({}))

        // Using Intl to get HH:MM in Rome time
        const formatTime = (d: Date) => new Intl.DateTimeFormat('it-IT', {
            timeZone: 'Europe/Rome',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23'
        }).format(d)
        
        const now = new Date()
        const checkTimes = []
        if (timeOverride) {
            checkTimes.push(timeOverride)
        } else {
            // Check last 30 minutes to be safe with a 15-min cron
            for (let i = 0; i < 31; i++) {
                const pastTime = new Date(now.getTime() - i * 60000)
                checkTimes.push(formatTime(pastTime))
            }
        }

        console.log(`Processing notifications for window: ${checkTimes[checkTimes.length-1]} to ${checkTimes[0]}`)

        // 1. Fetch Rules matching any time in the window
        const { data: rules, error: rulesError } = await supabase
            .from('notification_rules')
            .select('id, coach_id, client_id, message, scheduled_time')
            .in('scheduled_time', checkTimes)

        if (rulesError) throw rulesError
        if (!rules || rules.length === 0) {
            return new Response(JSON.stringify({ message: 'No rules in this window', window: checkTimes.length }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 2. Filter out already sent rules TODAY
        const todayStr = now.toISOString().split('T')[0]
        const ruleIds = rules.map(r => r.id)
        
        const { data: sentLogs } = await supabase
            .from('notification_sent_log')
            .select('rule_id')
            .in('rule_id', ruleIds)
            .eq('sent_date', todayStr)

        const sentRuleIds = new Set(sentLogs?.map(l => l.rule_id) || [])
        const rulesToSend = rules.filter(r => !sentRuleIds.has(r.id))

        if (rulesToSend.length === 0) {
            return new Response(JSON.stringify({ message: 'All rules in window already sent today' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`Found ${rulesToSend.length} rules to send (out of ${rules.length} total in window).`)

        let notificationsSent = 0
        let failures = 0

        // 3. Process each rule
        for (const rule of rulesToSend) {
            let targetUserIds: string[] = []

            // If Personal Rule
            if (rule.client_id) {
                targetUserIds = [rule.client_id]
            } else {
                // If Global Rule: Find all clients of this coach
                const { data: directClients } = await supabase
                    .from('clients_info')
                    .select('id')
                    .eq('coach_id', rule.coach_id)

                const { data: linkedClients } = await supabase
                    .from('client_coaches')
                    .select('client_id')
                    .eq('coach_id', rule.coach_id)

                const directIds = directClients?.map(c => c.id) || []
                const linkedIds = linkedClients?.map(c => c.client_id) || []
                targetUserIds = [...new Set([...directIds, ...linkedIds])]
            }

            if (targetUserIds.length === 0) continue

            // Filter targets who have notifications enabled
            const { data: enabledSettings } = await supabase
                .from('alert_settings')
                .select('user_id')
                .in('user_id', targetUserIds)
                .eq('is_enabled', true)

            const finalTargetIds = enabledSettings?.map(s => s.user_id) || []
            if (finalTargetIds.length === 0) continue

            // Fetch Subscriptions for these users
            const { data: subscriptions } = await supabase
                .from('push_subscriptions')
                .select('user_id, subscription')
                .in('user_id', finalTargetIds)

            if (!subscriptions || subscriptions.length === 0) continue

            // Send Notifications
            const payload = JSON.stringify({
                title: 'LifeHabits',
                body: rule.message,
            })

            const promises = subscriptions.map(async (sub) => {
                try {
                    await webpush.sendNotification(
                        sub.subscription,
                        payload
                    )
                    return { success: true }
                } catch (err: any) {
                    if (err.statusCode === 410 || err.statusCode === 404) {
                        await supabase
                            .from('push_subscriptions')
                            .delete()
                            .eq('user_id', sub.user_id)
                    }
                    return { success: false, error: err }
                }
            })

            const results = await Promise.all(promises)
            const sentCount = results.filter(r => r.success).length
            notificationsSent += sentCount
            failures += results.filter(r => !r.success).length

            // 4. Log as sent for today (even if some devices failed, we consider the rule "processed")
            await supabase
                .from('notification_sent_log')
                .insert({
                    rule_id: rule.id,
                    sent_date: todayStr
                })
        }

        return createResponse({
            message: 'Notifications processed',
            timesChecked: checkTimes,
            sent: notificationsSent,
            failed: failures
        })

    } catch (err: any) {
        console.error('Push Scheduler Error:', err)
        return createResponse({ error: err.message }, 500)
    }
})
