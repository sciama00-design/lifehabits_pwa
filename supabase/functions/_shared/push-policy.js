const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isValidTime(value) {
    return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function romeSlot(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map(part => [part.type, part.value]))
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

export function notificationWindow(now, override) {
    if (override) return [{ ...romeSlot(now), time: override }]
    const slots = Array.from({ length: 31 }, (_, i) => romeSlot(new Date(now.getTime() - i * 60000)))
    return slots.filter((slot, i) => slots.findIndex(other => other.date === slot.date && other.time === slot.time) === i)
}

export function safePushUrl(value, origin) {
    if (typeof value !== 'string' || value.length > 2048) return null
    try {
        if (!origin) {
            if (!value.startsWith('/') || value.startsWith('//')) return null
            const url = new URL(value || '/', 'https://lifehabits.invalid')
            return `${url.pathname}${url.search}${url.hash}`
        }
        const base = new URL(origin)
        if (base.origin !== origin) return null
        const url = new URL(value || '/', base.origin)
        if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) return null
        if (url.username || url.password) return null
        return /^[a-z][a-z\d+.-]*:/i.test(value) ? url.href : `${url.pathname}${url.search}${url.hash}`
    } catch {
        return null
    }
}

export async function resolvePushCaller(req, serviceRoleKey, auth, verifyServiceToken) {
    const match = /^Bearer\s+(.+)$/i.exec(req.headers.get('authorization') ?? '')
    if (!match) return null
    const token = match[1]
    if (serviceRoleKey && token === serviceRoleKey) return { kind: 'service' }
    if (verifyServiceToken) {
        try {
            const parts = token.split('.')
            // This untrusted claim only selects a verification path. The project
            // must authenticate and authorize the JWT before it grants service access.
            const claims = parts.length === 3 ? JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) : null
            if (claims?.role === 'service_role') {
                return await verifyServiceToken(token) ? { kind: 'service' } : null
            }
        } catch {
            return null
        }
    }
    try {
        const { data, error } = await auth.getUser(token)
        if (error || !data?.user?.id) return null
        return { kind: 'user', id: data.user.id }
    } catch {
        return null
    }
}

export function createPushPolicy({ getProfile, isLinked, hasRecentFeedback, getCoachClientIds }) {
    return async function authorize(actorId, request, origin) {
        try {
            const actor = await getProfile(actorId)
            if (!actor) return denied()

            if (request.type === 'direct') {
                if (!UUID.test(request.user_id ?? '')) return denied()

                if (request.user_id === actorId) {
                    const payload = makePayload(request.title, request.body, safePushUrl(request.url || '/', origin))
                    return payload ? allowed([actorId], payload) : denied()
                }

                if (actor.role === 'client' && await isLinked(actorId, request.user_id, 'client-to-coach')) {
                    const feedback = await hasRecentFeedback(actorId)
                    if (!feedback?.id) return denied()
                    const firstName = actor.full_name?.trim().split(/\s+/)[0] || 'un cliente'
                    return { ...allowed([request.user_id], {
                        title: 'Nuovo Feedback! 📝',
                        body: `Hai ricevuto un feedback da ${firstName}`,
                        url: `/coach/clients/${actorId}`,
                    }), deliveryKey: `feedback:${actorId}:${feedback.id}` }
                }

                if (actor.role === 'coach' && await isLinked(actorId, request.user_id, 'coach-to-client')) {
                    const payload = makePayload(request.title, request.body, safePushUrl(request.url || '/', origin))
                    return payload ? allowed([request.user_id], payload) : denied()
                }
                return denied()
            }

            if (request.type === 'announcement') {
                if (actor.role !== 'coach' || request.coach_id !== actorId) return denied()
                const linkedIds = await getCoachClientIds(actorId)
                if (request.target_client_ids != null && !Array.isArray(request.target_client_ids)) return denied()
                const requested = request.target_client_ids == null || request.target_client_ids.length === 0
                    ? linkedIds
                    : request.target_client_ids
                if (!Array.isArray(requested) || requested.some(id => !UUID.test(id) || !linkedIds.includes(id))) return denied()
                const payload = makePayload(request.title, request.body, safePushUrl(request.url || '/', origin))
                return payload ? allowed([...new Set(requested)], payload) : denied()
            }

            if (request.type === 'broadcast' && actor.role === 'admin') {
                const payload = makePayload(request.title, request.body, safePushUrl(request.url || '/', origin))
                return payload ? allowed(null, payload) : denied()
            }

            return denied()
        } catch {
            return { allowed: false, status: 503 }
        }
    }
}

function makePayload(title, body, url) {
    if (typeof title !== 'string' || !title.trim()) return null
    if (typeof body !== 'string' || !body.trim() || !url) return null
    return { title: title.trim().slice(0, 120), body: body.trim().slice(0, 1000), url }
}

function allowed(recipients, payload) {
    return { allowed: true, recipients, payload }
}

function denied() {
    return { allowed: false, status: 403 }
}
