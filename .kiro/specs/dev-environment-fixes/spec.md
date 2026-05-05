# Dev Environment Fixes — Specification

## Overview

Fix two browser console errors that prevent the wiki-viewer frontend from loading correctly when served by the FastAPI backend (`api_server.py`):

1. **CSP `frame-ancestors` warning**: `<meta>` tag CSP cannot enforce `frame-ancestors`; must use HTTP response header
2. **JS MIME type error**: Browser requests old hashed JS filenames (e.g., `index-CSaayr2D.js`) that no longer exist in `dist/`; SPA fallback returns `index.html` with `text/html` MIME type, causing the browser to reject it as not a valid JS module

## Root Causes

### RC1 — `frame-ancestors` in `<meta>` CSP (informational warning)
- Both `index.html` (source) and `dist/index.html` contained `frame-ancestors 'none'` in a `<meta http-equiv="Content-Security-Policy">` tag
- Per HTML spec, `frame-ancestors` is ignored when delivered via `<meta>` — it only works as an HTTP header
- **Fix**: Remove from `<meta>` tag; deliver via `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'` HTTP headers through a new `security_headers_middleware` in `api_server.py`

### RC2 — Old hashed JS files served as `text/html` (blocking error)
- `index.html` referenced `index-CSaayr2D.js` (from a previous build), but `dist/assets/` only contains `index-B3kKDlfs.js` (current build)
- Browser cached old `index.html` or PWA service worker served stale version
- SPA fallback in `api_server.py` returned `index.html` (HTML) for **all** 404 requests, including missing `.js` files
- Browser received HTML with `Content-Type: text/html` for a `<script type="module">` request → rejected with MIME type error
- **Fixes** (multi-layer):
  1. SPA fallback now returns 404 JSON for static asset extensions (`.js`, `.css`, `.svg`, `.png`, `.jpg`, `.ico`, `.woff`, `.woff2`, `.map`)
  2. SPA fallback adds `Cache-Control: no-cache` header when serving `index.html` to prevent browser caching stale HTML
  3. PWA VitePWA config updated with `clientsClaim: true`, `skipWaiting: true`, `cleanupOutdatedCaches: true` to force new service worker take over immediately
  4. Service worker registration in `main.tsx` switched from manual `navigator.serviceWorker.register()` to VitePWA's `registerSW()` API
  5. `vite-env.d.ts` updated with `/// <reference types="vite-plugin-pwa/client" />` for proper typing

## Files Changed

| File | Changes |
|---|---|
| `wiki-viewer/index.html` | Removed `frame-ancestors 'none'` from `<meta>` CSP; added `connect-src` and `img-src https:` directives; fixed missing closing quote in `form-action` |
| `wiki-viewer/dist/index.html` | Same CSP fix (pre-built dist, rebuilt after all changes) |
| `wiki-viewer/vite.config.ts` | Added `clientsClaim`, `skipWaiting`, `cleanupOutdatedCaches`, `navigateFallback`, `navigateFallbackDenylist` to VitePWA workbox config |
| `wiki-viewer/src/main.tsx` | Replaced manual `navigator.serviceWorker.register('/sw.js')` with VitePWA's `registerSW({ immediate: true })` |
| `wiki-viewer/src/vite-env.d.ts` | Added `/// <reference types="vite-plugin-pwa/client" />` |
| `tools/api_server.py` | Added `security_headers_middleware` (X-Frame-Options + CSP frame-ancestors); updated `spa_fallback_handler` to skip static asset extensions and add no-cache header |

## Acceptance Criteria

1. Browser console shows **no** CSP `frame-ancestors` warning
2. Browser console shows **no** MIME type errors for JS module scripts
3. Frontend loads and renders correctly at `http://localhost:8000`
4. API endpoints continue to work at `http://localhost:8000/api/`
5. `tsc --noEmit` passes with zero errors
6. `vite build` produces working dist bundle
