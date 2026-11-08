
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'
import { isValidTime, notificationWindow, resolvePushCaller } from '../_shared/push-policy.js'
import { sendScheduledPush } from '../_shared/push-delivery.js'
import { createServiceTokenVerifier } from '../_shared/service-auth.js'

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
const verifyServiceToken = createServiceTokenVerifier(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'))

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

    if (req.method !== 'POST') return createResponse({ error: 'Method not allowed' }, 405)

    try {
        const caller = await resolvePushCaller(req, supabaseServiceRoleKey, supabase.auth, verifyServiceToken)
        if (caller?.kind !== 'service') return createResponse({ error: 'Unauthorized' }, 401)
        // Existing cron jobs may have no JSON body. Authentication above still applies.
        const body = await req.json().catch(() => ({}))
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return createResponse({ error: 'Invalid request' }, 400)
        }
        const timeOverride = body?.timeOverride
        if (timeOverride !== undefined && !isValidTime(timeOverride)) {
            return createResponse({ error: 'Invalid timeOverride' }, 400)
        }

        const now = new Date()
        const window = notificationWindow(now, timeOverride)
        const checkTimes = [...new Set(window.map(slot => slot.time))]

        console.log(`Processing notifications for window: ${checkTimes[checkTimes.length-1]} to ${checkTimes[0]}`)

        // 1. Fetch rules for the window
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

        // Validate persisted rules before service_role sends, including rules created before this check.
        const coachIds = [...new Set(rules.map(rule => rule.coach_id))]
        const { data: coaches, error: coachesError } = await supabase
            .from('profiles').select('id').in('id', coachIds).eq('role', 'coach')
        if (coachesError) throw coachesError
        const validCoachIds = new Set((coaches ?? []).map(coach => coach.id))
        const candidateRules = rules.filter(rule => validCoachIds.has(rule.coach_id))
        const validRelationships = new Set<string>()
        if (candidateRules.length) {
            const { data: links, error: linksError } = await supabase
                .from('client_coaches').select('client_id, coach_id').in('coach_id', [...validCoachIds])
            if (linksError) throw linksError
            for (const link of links ?? []) validRelationships.add(`${link.coach_id}:${link.client_id}`)

            const { data: directClients, error: directClientsError } = await supabase
                .from('clients_info').select('id, coach_id').in('coach_id', [...validCoachIds])
            if (directClientsError) throw directClientsError
            for (const client of directClients ?? []) validRelationships.add(`${client.coach_id}:${client.id}`)
        }
        const authorizedRules = candidateRules.filter(rule => rule.client_id
            ? validRelationships.has(`${rule.coach_id}:${rule.client_id}`)
            : [...validRelationships].some(link => link.startsWith(`${rule.coach_id}:`)))
        if (authorizedRules.length === 0) {
            return createResponse({ message: 'No authorized rules in this window' })
        }

        // A catch-up window can cross midnight: deduplicate by the slot's Rome date.
        const ruleIds = authorizedRules.map(r => r.id)
        
        const { data: sentLogs, error: sentLogsError } = await supabase
            .from('notification_sent_log')
            .select('rule_id, sent_date')
            .in('rule_id', ruleIds)
            .in('sent_date', [...new Set(window.map(slot => slot.date))])

        if (sentLogsError) throw sentLogsError
        const sentRuleIds = new Set(sentLogs?.map(l => `${l.rule_id}:${l.sent_date}`) || [])
        const rulesToSend = authorizedRules.flatMap(rule => window
            .filter(slot => slot.time === rule.scheduled_time.slice(0, 5) && !sentRuleIds.has(`${rule.id}:${slot.date}`))
            .map(slot => ({ rule, sentDate: slot.date })))

        if (rulesToSend.length === 0) {
            return new Response(JSON.stringify({ message: 'All rules in window already sent today' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`Found ${rulesToSend.length} rules to send (out of ${rules.length} total in window).`)

        let notificationsSent = 0
        let failures = 0

        // 3. Process each rule
        for (const { rule, sentDate } of rulesToSend) {
            let targetUserIds: string[] = []

            // If Personal Rule
            if (rule.client_id) {
                targetUserIds = [rule.client_id]
            } else {
                targetUserIds = [...new Set([...validRelationships]
                    .filter(link => link.startsWith(`${rule.coach_id}:`))
                    .map(link => link.slice(rule.coach_id.length + 1)))]
            }

            if (targetUserIds.length === 0) continue

            // Filter targets who have notifications enabled
            const { data: enabledSettings, error: settingsError } = await supabase
                .from('alert_settings')
                .select('user_id')
                .in('user_id', targetUserIds)
                .eq('is_enabled', true)

            if (settingsError) throw settingsError

            const finalTargetIds = enabledSettings?.map(s => s.user_id) || []
            if (finalTargetIds.length === 0) continue

            // Fetch Subscriptions for these users
            const { data: subscriptions, error: subscriptionsError } = await supabase
                .from('push_subscriptions')
                .select('id, user_id, subscription')
                .in('user_id', finalTargetIds)

            if (subscriptionsError) throw subscriptionsError

            if (!subscriptions || subscriptions.length === 0) continue

            // Send Notifications
            const payload = JSON.stringify({
                title: 'LifeHabits',
                body: rule.message,
            })

            const promises = subscriptions.map(sub => sendScheduledPush(supabase, sub, payload,
                `rule:${rule.id}:${sentDate}:${sub.id}`,
                (subscription, data) => webpush.sendNotification(subscription, data, { timeout: 15000 })))

            const results = await Promise.all(promises)
            const sentCount = results.filter(r => r.success).length
            notificationsSent += sentCount
            failures += results.filter(r => r.retryable).length

            // Pending claims or transient errors remain retryable; delivered
            // devices retain their receipt and are skipped by subsequent ticks.
            if (results.some(result => result.retryable || result.pending)) continue

            // 4. Record the rule processed, preserving the existing per-rule behavior.
            const { error: logError } = await supabase
                .from('notification_sent_log')
                .upsert({
                    rule_id: rule.id,
                    sent_date: sentDate
                }, { onConflict: 'rule_id,sent_date', ignoreDuplicates: true })
            if (logError) throw logError
        }

        return createResponse({
            message: 'Notifications processed',
            timesChecked: checkTimes,
            sent: notificationsSent,
            failed: failures
        }, failures ? 502 : 200)

    } catch (err) {
        console.error('Push Scheduler Error:', err)
        return createResponse({ error: 'Notification processing failed' }, 500)
    }
})
