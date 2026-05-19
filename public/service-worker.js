/* The Vitality Project — basic service worker
 * - Cache-first for static assets & images
 * - Network-first for API calls (no caching of personalized data)
 * - NETWORK-ONLY for navigation requests (so admin product/price edits
 *   propagate to every visitor immediately — v1 cached HTML on the device
 *   which caused "old products / wrong prices keep coming back" reports).
 * - Offline fallback only when network actually fails (no cached HTML).
 *
 * Version bump from v1 → v2 forces the activate handler below to delete
 * every vp-sw-v1-* cache on every returning customer's device the moment
 * the new SW activates. No customer action required.
 */

const VERSION = 'vp-sw-v2'
const STATIC_CACHE = `${VERSION}-static`
const IMAGE_CACHE = `${VERSION}-images`
const RUNTIME_CACHE = `${VERSION}-runtime`

const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/logo-white.png',
  '/logo-dark.png',
  '/logo.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

function isImageRequest(request) {
  return (
    request.destination === 'image' ||
    /\.(png|jpg|jpeg|gif|webp|avif|svg|ico)$/i.test(new URL(request.url).pathname)
  )
}

function isStaticAsset(request) {
  return (
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    /\/_next\/static\//.test(new URL(request.url).pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API calls — network-first, no caching of personalized data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({ error: 'offline' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          )
      )
    )
    return
  }

  // Navigation — NETWORK-ONLY. Do NOT cache product/listing/checkout/admin
  // HTML on the device. Caching navigation responses was the root cause of
  // "old prices / archived products kept resurfacing" — admin edits would
  // update the DB and the server response, but the customer's browser kept
  // serving the cached HTML from a previous visit.
  //
  // On a real network failure (offline / 5xx), fall back to the static
  // `/offline` page from STATIC_CACHE. We do NOT consult RUNTIME_CACHE at
  // all on navigation, and RUNTIME_CACHE is dropped entirely on activate
  // (caches.delete sweep removes the v1 leftover).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline'))
    )
    return
  }

  // Images — cache-first
  if (isImageRequest(request)) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request)
            .then((response) => {
              if (response.ok) cache.put(request, response.clone()).catch(() => null)
              return response
            })
            .catch(() => cached || Response.error())
        })
      )
    )
    return
  }

  // Static assets — cache-first
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone()).catch(() => null)
            return response
          })
        })
      )
    )
    return
  }
})
