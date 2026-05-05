# Dev Environment Fixes — Tasks

## Task 1: Fix CSP `frame-ancestors` delivery
- [x] Remove `frame-ancestors 'none'` from `wiki-viewer/index.html` `<meta>` tag
- [x] Remove `frame-ancestors 'none'` from `wiki-viewer/dist/index.html` `<meta>` tag
- [x] Add `security_headers_middleware` to `tools/api_server.py` with `X-Frame-Options: DENY` and `Content-Security-Policy: frame-ancestors 'none'`
- [x] Also fix missing closing quote on `form-action` directive in source `index.html`

## Task 2: Fix SPA fallback returning HTML for missing JS files
- [x] Add static asset extension check to `spa_fallback_handler` in `tools/api_server.py`
- [x] Return 404 JSON instead of `index.html` for `.js/.css/.svg/.png/.jpg/.ico/.woff/.woff2/.map` requests
- [x] Add `Cache-Control: no-cache` header when serving `index.html` via SPA fallback

## Task 3: Fix PWA service worker caching stale assets
- [x] Update VitePWA config in `vite.config.ts`:
  - [x] Add `clientsClaim: true` — new SW takes over immediately
  - [x] Add `skipWaiting: true` — don't wait for old SW to die
  - [x] Add `cleanupOutdatedCaches: true` — remove old cached assets
  - [x] Add `navigateFallback` and `navigateFallbackDenylist`
- [x] Replace manual SW registration in `main.tsx` with VitePWA's `registerSW()` API
- [x] Add `vite-plugin-pwa/client` type reference to `vite-env.d.ts`

## Task 4: CSP improvements
- [x] Add `connect-src` directive to allow backend API at `http://127.0.0.1:8000` and `http://localhost:8000`
- [x] Add `https:` to `img-src` for external images (wiki content may reference them)

## Task 5: Rebuild and verify
- [x] Run `npx tsc --noEmit` — zero errors
- [x] Run `npx vite build` — successful
- [x] Verify `dist/index.html` has correct CSP (no `frame-ancestors`)
- [x] Verify new JS filename differs from old cached `index-CSaayr2D.js`
- [x] Restart backend (`uvicorn`) and frontend (`vite dev`)
- [x] Both servers start successfully
