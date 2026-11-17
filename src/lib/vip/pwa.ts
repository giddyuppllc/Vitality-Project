import sharp from 'sharp'
import { MONOGRAM_PATHS } from '@/components/vip/monogram'

/**
 * The clubhouse PWA (vitalityproject.vip): web manifest, icons drawn from the
 * VP monogram, and a deliberately small service worker. Served under the
 * names in lib/vip/host.ts VIP_PWA_FILES — never the store's files.
 */

export const VIP_THEME = { background: '#070b14', theme: '#070b14' }

export function clubhouseManifest() {
  return {
    id: '/dashboard',
    name: 'The Vitality Project Clubhouse',
    short_name: 'Clubhouse',
    description: 'The members’ clubhouse of The Vitality Project.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: VIP_THEME.background,
    theme_color: VIP_THEME.theme,
    categories: ['health', 'fitness', 'education', 'lifestyle'],
    icons: [
      { src: '/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Home', url: '/dashboard' },
      { name: 'Academy', url: '/classroom' },
      { name: 'Events', url: '/events' },
      { name: 'Community', url: '/feed' },
    ],
  }
}

/** Monogram SVG. `full` = edge-to-edge navy (maskable / apple-touch), mark inside the safe zone. */
export function monogramSvg(size: number, opts: { full?: boolean } = {}): string {
  const mark = `<path d="${MONOGRAM_PATHS.v}" fill="none" stroke="#ffffff" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${MONOGRAM_PATHS.p}" fill="none" stroke="#d4b26a" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`
  if (opts.full) {
    // 64-unit mark scaled to ~62% of the tile, centred (inside the 80% maskable safe zone).
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b1322"/><g transform="translate(19 19) scale(0.97)">${mark}</g></svg>`
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="16" fill="#0b1322" stroke="#82c3ff" stroke-opacity="0.35" stroke-width="1.5"/>${mark}</svg>`
}

const cache = new Map<string, Buffer>()

export async function iconPng(name: string): Promise<Buffer | null> {
  const spec: Record<string, { size: number; full: boolean }> = {
    'app-icon-192.png': { size: 192, full: false },
    'app-icon-512.png': { size: 512, full: false },
    'app-icon-maskable-512.png': { size: 512, full: true },
    'apple-touch-icon.png': { size: 180, full: true },
  }
  const s = spec[name]
  if (!s) return null
  const hit = cache.get(name)
  if (hit) return hit
  const png = await sharp(Buffer.from(monogramSvg(s.size, { full: s.full }))).png().toBuffer()
  cache.set(name, png)
  return png
}

/**
 * Service worker. Members-only pages and APIs are NEVER cached (they are
 * private and change constantly); the worker only keeps the offline page and
 * the app icons, and shows the offline page when a navigation fails.
 */
export const SERVICE_WORKER = `/* The Vitality Project Clubhouse — service worker */
const CACHE = 'vp-clubhouse-v1';
const OFFLINE = '/offline';
const PRECACHE = [OFFLINE, '/app-icon-192.png', '/app-icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE.map((u) => new Request(u, { cache: 'reload', credentials: 'same-origin' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('vp-clubhouse-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())));
    return;
  }
  if (PRECACHE.includes(url.pathname) && url.pathname !== OFFLINE) {
    event.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
`
