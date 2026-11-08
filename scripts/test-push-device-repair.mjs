// Run the actual hook with a synthetic browser and subscription database. No network.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { JSDOM } from 'jsdom'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const dom = new JSDOM('<div id="root"></div>', { url: 'https://app.test' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
delete dom.window.Notification // Mount without triggering auto-sync; exercise repair directly.
const { outputFiles } = await build({
    entryPoints: [new URL('../src/hooks/usePushNotifications.ts', import.meta.url).pathname],
    bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react'],
    define: { 'import.meta.env.VITE_VAPID_PUBLIC_KEY': '"test-key"' },
    plugins: [{ name: 'repair-dependencies', setup(api) {
        api.onResolve({ filter: /^(?:@\/lib\/(?:supabase|pushUtils)|\.\/useAuth)$/ }, ({ path }) => ({ path, namespace: 'repair-test' }))
        api.onLoad({ filter: /.*/, namespace: 'repair-test' }, ({ path }) => ({ contents:
            path.endsWith('supabase') ? 'export const supabase = { from: (...args) => globalThis.__repairFrom(...args) }'
                : path.endsWith('useAuth') ? 'export const useAuth = () => ({ user: { id: "test-user" } })'
                    : 'export const isIOS = () => false; export const isStandalone = () => true; export const urlBase64ToUint8Array = x => x;',
        }))
    } }],
})
const loaded = { exports: {} }
new Function('require', 'module', 'exports', outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports)
const { usePushNotifications } = loaded.exports

for (const hasLocalSubscription of [true, false]) {
    test(`repair preserves other devices when local subscription ${hasLocalSubscription ? 'exists' : 'is absent'}`, async () => {
        let rows = [
            { user_id: 'test-user', endpoint: 'https://push.test/phone' },
            { user_id: 'test-user', endpoint: 'https://push.test/desktop' },
            { user_id: 'other-user', endpoint: 'https://push.test/other' },
        ]
        const endpoint = 'https://push.test/desktop'
        let unsubscribed = 0
        const sub = { endpoint, unsubscribe: async () => { unsubscribed++ } }
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { serviceWorker: {
            ready: Promise.resolve({ pushManager: { getSubscription: async () => hasLocalSubscription ? sub : null } }),
            getRegistrations: async () => [{ unregister: async () => true }],
        } } })
        globalThis.__repairFrom = table => {
            assert.equal(table, 'push_subscriptions')
            const filters = []
            const query = {
                delete() { return query },
                eq(column, value) { filters.push([column, value]); return query },
                contains(_column, value) { filters.push(['endpoint', value.endpoint]); return query },
                then(resolve) {
                    rows = rows.filter(row => !filters.every(([column, value]) => row[column === 'subscription->>endpoint' ? 'endpoint' : column] === value))
                    return Promise.resolve({ error: null }).then(resolve)
                },
            }
            return query
        }
        let hook
        function Probe() { hook = usePushNotifications(); return null }
        const root = createRoot(document.getElementById('root'))
        const originalTimeout = globalThis.setTimeout
        try {
            await act(async () => root.render(React.createElement(Probe)))
            // Capture the scheduled reload instead of navigating jsdom. Other timers remain native.
            globalThis.setTimeout = (fn, ms, ...args) => ms === 1000 ? 0 : originalTimeout(fn, ms, ...args)
            await act(async () => hook.repairNotifications())
            assert.equal(unsubscribed, hasLocalSubscription ? 1 : 0)
            assert.deepEqual(rows.map(row => row.endpoint), hasLocalSubscription
                ? ['https://push.test/phone', 'https://push.test/other']
                : ['https://push.test/phone', 'https://push.test/desktop', 'https://push.test/other'])
        } finally {
            globalThis.setTimeout = originalTimeout
            await act(async () => root.unmount())
        }
    })
}
