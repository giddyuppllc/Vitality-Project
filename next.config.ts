import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // src/proxy.ts (host routing for vitalityproject.vip) runs in front of every
    // request, and Next then buffers at most 10MB of a request body — the rest
    // is cut off silently, so a 10–25MB admin product/COA upload or a 10–12MB
    // clubhouse photo arrived truncated ("No file provided"). Match nginx's
    // client_max_body_size (docker/nginx/nginx.conf).
    proxyClientMaxBodySize: '25mb',
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
