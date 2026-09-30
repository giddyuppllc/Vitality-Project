import type { NextRequest } from 'next/server'

/**
 * Absolute URL on the host the visitor actually used.
 *
 * Inside Docker `req.url` resolves to `http://0.0.0.0:3000`, so
 * `new URL(path, req.url)` sends the browser to an address it can't reach.
 * Build from the public proxy headers instead (nginx / Cloudflare set them).
 * Absolute destinations pass through unchanged.
 */
export function publicUrl(req: NextRequest, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'vitalityproject.global'
  return new URL(pathOrUrl, `${proto}://${host}`).toString()
}
