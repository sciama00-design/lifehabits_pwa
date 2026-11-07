# Frontend security preview

This change sanitizes stored rich text before rendering and constrains push notification links to the app's own origin. Safe rich text, images, lists and links are preserved, including new-tab links protected with noopener/noreferrer. The editor avoids duplicate link extensions and artificial change callbacks during controlled updates.

The lockfile includes compatible security updates. This change does not alter frontend Supabase API calls, database policies or deployed Edge Functions. Database and backend vulnerabilities require a separate release; this frontend change does not close them.

Validation on Node 24:

```sh
npm ci --ignore-scripts
npm run test:html
npm run build
```

The HTML checks mount real React components and the editor in jsdom, exercise malicious markup and safe formatting, and cover all five HTML sinks. The build includes the PWA service worker. They do not replace a real browser/device check. Existing bundle size and mixed storage import warnings remain.

The frontend-only staged tree was exported to a separate temporary directory and passed a clean `npm ci --ignore-scripts`, the HTML checks and a production build independently of the remaining workspace changes. A local Chromium check of that compiled site also passed: desktop login and anonymous protected-route redirects on mobile/desktop, with HTTPS blocked and no credentials entered. This does not verify authenticated user flows or real notifications on the deployed site.

Cloudflare Pages publishes `main` automatically using `npm run build`, output `dist`, as confirmed by the owner. First use the separate `security/app-hardening-preview` branch for a preview deployment. Preview deployments must be enabled. The preview uses the same backend if configured with production Supabase variables; it is not an isolated database. Avoid modifying real users' records or sending notifications to others while checking it.

Inspect login, navigation, content formatting, new-tab links, media and calendar display in the preview before merging. A preview push does not itself authorize or apply any Supabase changes. Publication and production merge are separate actions.
