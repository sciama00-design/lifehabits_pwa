// Synthetic browser profile, local builds only; all HTTPS requests are blocked.
// Usage: CHROME_BINARY=/path/to/chrome node scripts/test-pwa-update.mjs OLD_DIST NEW_DIST
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { resolve, join, extname } from 'node:path'

const [oldDist, newDist] = process.argv.slice(2).map(path => resolve(path))
if (!oldDist || !newDist || !process.env.CHROME_BINARY) throw new Error('Provide OLD_DIST, NEW_DIST and CHROME_BINARY')
let serving = oldDist
const headersFile = await readFile(join(newDist, '_headers'), 'utf8')
const csp = headersFile.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1]
assert.ok(csp, 'Cloudflare CSP fixture present')
const newEntry = (await readFile(join(newDist, 'index.html'), 'utf8')).match(/<script[^>]+src="([^"]+)"[^>]*>/g)
    ?.find(script => script.includes('type="module"'))?.match(/src="([^"]+)"/)?.[1]
assert.ok(newEntry, 'new entry module present')
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
const server = createServer(async (req, res) => {
    try {
        const pathname = new URL(req.url, 'http://localhost').pathname
        const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
        let file = resolve(serving, relative)
        if (!file.startsWith(serving + '/')) { res.writeHead(403).end(); return }
        let body
        try { body = await readFile(file) } catch {
            if (extname(pathname)) { res.writeHead(404).end(); return }
            file = join(serving, 'index.html')
            body = await readFile(file)
        }
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Security-Policy': csp })
        res.end(body)
    } catch { res.writeHead(500).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const profile = await mkdtemp('/tmp/lifehabits-pwa-browser-')
const browser = spawn(process.env.CHROME_BINARY, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'] })
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const pending = new Map()
let ws, sequence = 0
const exceptions = []
try {
    let port
    for (let i = 0; i < 100; i++) {
        try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]) } catch {}
        if (port) break
        if (browser.exitCode !== null) throw new Error('Browser failed to start')
        await pause(100)
    }
    assert.ok(port, 'browser debugging port available')
    const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    ws = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
    ws.onmessage = event => {
        const message = JSON.parse(event.data)
        if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.text)
        if (!pending.has(message.id)) return
        const { resolve, reject, timer } = pending.get(message.id)
        clearTimeout(timer)
        pending.delete(message.id)
        message.error ? reject(new Error(message.error.message)) : resolve(message.result)
    }
    const send = (method, params = {}) => new Promise((resolve, reject) => {
        const id = ++sequence
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)) }, 20000)
        pending.set(id, { resolve, reject, timer })
        ws.send(JSON.stringify({ id, method, params }))
    })
    const evaluate = async expression => {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
        return result.result.value
    }
    const until = async expression => {
        for (let i = 0; i < 150; i++) {
            if (await evaluate(expression)) return
            await pause(100)
        }
        throw new Error(`Browser condition timed out: ${expression}`)
    }
    await send('Page.enable')
    await send('Runtime.enable')
    await send('Network.enable')
    await send('Network.setBlockedURLs', { urls: ['https://*', 'wss://*'] })
    await send('Page.navigate', { url: origin + '/login' })
    await until(`!!document.querySelector('input[type="email"]') && !!navigator.serviceWorker.controller`)
    const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }
    const online = { ...offline, offline: false, downloadThroughput: -1, uploadThroughput: -1 }
    await send('Network.emulateNetworkConditions', offline)
    const oldDeepLink = await send('Page.navigate', { url: origin + '/login' })
    await send('Page.navigate', { url: origin + '/' })
    await until(`document.readyState === 'complete' && !!document.querySelector('input[type="email"]')`)
    await send('Network.emulateNetworkConditions', online)
    console.log('Baseline PWA renders its cached start URL offline.')
    await evaluate(`(async () => {
        window.__unsavedDraft = 'Draft must survive the worker update';
        localStorage.setItem('continuity-fixture', 'persisted');
        const input = document.querySelector('input[type="email"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'unsaved@example.test');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        window.__workerChanges = 0;
        navigator.serviceWorker.addEventListener('controllerchange', () => window.__workerChanges++);
        return true;
    })()`)
    serving = newDist
    await evaluate(`navigator.serviceWorker.getRegistration().then(registration => registration.update()).then(() => true)`)
    await until('window.__workerChanges > 0')
    assert.equal(await evaluate('window.__unsavedDraft'), 'Draft must survive the worker update', 'worker update must not reload the open document')
    assert.equal(await evaluate(`document.querySelector('input[type="email"]').value`), 'unsaved@example.test')
    assert.equal(await evaluate(`localStorage.getItem('continuity-fixture')`), 'persisted')
    console.log('Same-origin worker update preserves open document, unsaved input and local storage.')
    await evaluate(`window.__reloadMarker = true`)
    await send('Page.reload')
    await until(`window.__reloadMarker === undefined && document.readyState === 'complete' && !!document.querySelector('input[type="email"]')`)
    assert.equal(await evaluate(`document.querySelector('script[type="module"]').getAttribute('src')`), newEntry)
    assert.equal(await evaluate(`localStorage.getItem('continuity-fixture')`), 'persisted')
    // Offline navigation must be served by the newly installed worker/cache.
    await send('Network.emulateNetworkConditions', offline)
    const newDeepLink = await send('Page.navigate', { url: origin + '/login' })
    assert.equal(newDeepLink.errorText, oldDeepLink.errorText, 'offline deep-link behavior must match the baseline')
    console.log(`Offline /login baseline and candidate: ${newDeepLink.errorText || 'navigation succeeded'}.`)
    await evaluate(`window.__reloadMarker = true`)
    await send('Page.navigate', { url: origin + '/' })
    await until(`window.__reloadMarker === undefined && document.readyState === 'complete' && !!document.querySelector('input[type="email"]')`)
    assert.equal(await evaluate(`document.querySelector('script[type="module"]').getAttribute('src')`), newEntry)
    assert.deepEqual(exceptions, [])
    console.log('Updated PWA renders its cached start URL offline. No live login, DB access or push delivery was exercised.')
} finally {
    ws?.close()
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('Browser closed')) }
    const exited = new Promise(resolve => browser.once('exit', resolve))
    if (browser.exitCode === null) { browser.kill('SIGTERM'); await exited }
    await new Promise(resolve => server.close(resolve))
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
