// A read of zero rows authenticates separately issued service JWTs through the
// project's Data API. This table has no grants for PUBLIC/anon/authenticated.
// Use the public API key so it cannot override the caller's Authorization role.
export function createServiceTokenVerifier(origin, anonKey, fetcher = fetch) {
    return async token => {
        if (!origin || !anonKey) return false
        try {
            const response = await fetcher(new URL('/rest/v1/push_delivery_receipts?select=delivery_key&limit=0', origin), {
                method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(5000),
                headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
            })
            return response.ok
        } catch {
            return false
        }
    }
}
