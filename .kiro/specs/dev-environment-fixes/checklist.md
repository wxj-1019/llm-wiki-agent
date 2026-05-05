# Dev Environment Fixes — Checklist

## CSP `frame-ancestors`
- [x] `frame-ancestors` removed from source `index.html` `<meta>` tag
- [x] `frame-ancestors` removed from `dist/index.html` `<meta>` tag
- [x] `X-Frame-Options: DENY` header set via middleware
- [x] `Content-Security-Policy: frame-ancestors 'none'` header set via middleware
- [x] `form-action 'self'` closing quote fixed (was `'self;` → `'self'`)

## MIME type / SPA fallback
- [x] Static asset extensions excluded from SPA fallback (404 instead of HTML)
- [x] `Cache-Control: no-cache` on SPA fallback `index.html` responses
- [x] No old hash filenames referenced in current `dist/index.html`

## PWA Service Worker
- [x] `clientsClaim: true` in VitePWA config
- [x] `skipWaiting: true` in VitePWA config
- [x] `cleanupOutdatedCaches: true` in VitePWA config
- [x] `navigateFallback: '/index.html'` configured
- [x] `navigateFallbackDenylist` excludes `/api/` routes
- [x] `main.tsx` uses `registerSW()` from `virtual:pwa-register` (not manual `navigator.serviceWorker.register`)
- [x] `vite-env.d.ts` includes `vite-plugin-pwa/client` type reference

## CSP Content Improvements
- [x] `connect-src` includes `http://127.0.0.1:8000` and `http://localhost:8000` for API calls
- [x] `img-src` includes `https:` for external image references
- [x] All CSP directives use properly closed quotes

## Build Verification
- [x] `npx tsc --noEmit` — 0 errors
- [x] `npx vite build` — successful output
- [x] `dist/index.html` contains correct `<meta>` CSP (no `frame-ancestors`)
- [x] `dist/sw.js` and `dist/workbox-*.js` generated
- [x] `dist/assets/index-*.js` has new hash (not `CSaayr2D`)

## Runtime Verification
- [x] Backend starts: `uvicorn tools.api_server:app --host 127.0.0.1 --port 8000`
- [x] Frontend starts: `vite --host 0.0.0.0 --port 3000`
- [x] SPA index returns `Cache-Control: no-cache` header (no stale HTML caching)
- [x] Old JS file `/assets/index-CSaayr2D.js` returns 404 (not HTML)
- [x] Current JS file `/assets/index-wFYCAR-Z.js` returns 200 + `text/javascript`
- [x] SPA route `/dashboard` returns 200 + `text/html` + `no-cache`
- [x] Security headers present on all responses: `X-Frame-Options: DENY`, `CSP: frame-ancestors 'none'`
- [x] API endpoints unaffected: `/api/health` returns 200 with correct body
- [x] Vite dev server at localhost:3000 responds correctly
