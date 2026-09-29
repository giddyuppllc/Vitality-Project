import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Two root layouts ((global) store + vip clubhouse) → unmatched URLs are
  // rendered by src/app/global-not-found.tsx (the store's 404, unchanged).
  experimental: {
    globalNotFound: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  // The service worker must never be cached by the browser or CDN, otherwise
  // browsers keep running an old worker and never pick up fixes — which is how
  // admins ended up seeing stale dashboard content after saves. Force a
  // revalidate on every fetch of the worker (and its manifest).
  async headers() {
    return [
      {
        source: '/service-worker.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ]
  },
}

export default nextConfig
