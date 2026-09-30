import type { NextRequest } from 'next/server'

/**
 * Absolute URL on the host the visitor actually used.
 *
 * Inside Docker `req.url` resolves to `http://0.0.0.0:3000`, so
 * `new URL(path, req.url)` sends the browser to an address it can't reach.
 * Build from the public proxy headers instead (nginx / Cloudflare set them).
 * Absolute destinations pass through unchanged.
 *
 * The scheme comes from Cloudflare's CF-Visitor first: the origin nginx
 * listens on :80 and sets X-Forwarded-Proto to its own `http`, while the
 * visitor was on https.
 */
export function publicUrl(req: NextRequest, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const proto = visitorScheme(req) ?? req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'vitalityproject.global'
  return new URL(pathOrUrl, `${proto}://${host}`).toString()
}

function visitorScheme(req: NextRequest): string | null {
  const raw = req.headers.get('cf-visitor')
  if (!raw) return null
  try {
    const scheme = (JSON.parse(raw) as { scheme?: unknown }).scheme
    return scheme === 'https' || scheme === 'http' ? scheme : null
  } catch {
    return null
  }
}
