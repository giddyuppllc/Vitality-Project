/**
 * Cloudflare edge-cache purge.
 *
 * When an admin saves a product (status, price, name, image, …), we call
 * this helper with the product's slug. Cloudflare immediately drops its
 * cached HTML for that product's listing + detail URLs at every edge
 * worldwide. The next visitor anywhere gets fresh HTML from our server.
 *
 * Requires env vars on Hetzner:
 *   CLOUDFLARE_API_TOKEN   — API token with "Zone.Cache Purge" perm only
 *   CLOUDFLARE_ZONE_ID     — the zone id for vitalityproject.global
 *
 * If either env var is missing, this function is a silent no-op — admin
 * saves still work, but the edge will eventually flush on its own TTL.
 * That keeps local dev + half-configured prod from breaking.
 *
 * Fire-and-forget. We never block an admin save on the purge call. If
 * the purge fails (network blip, Cloudflare 5xx), we log and move on.
 */

export type PurgeResult = {
  attempted: boolean
  ok: boolean
  status?: number
  error?: string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

/**
 * Build the list of URLs that should be flushed when a product changes.
 * Includes the product detail page + the storefront listing + any obvious
 * category page (admin-supplied) the product appears on.
 */
export function urlsForProduct(opts: {
  slug: string
  categorySlug?: string | null
}): string[] {
  const urls = [
    `${APP_URL}/products`,
    `${APP_URL}/products/${opts.slug}`,
  ]
  if (opts.categorySlug) {
    urls.push(`${APP_URL}/products?category=${encodeURIComponent(opts.categorySlug)}`)
  }
  return urls
}

/**
 * Purge by URL list. Cloudflare's free plan accepts up to 30 URLs per
 * call; 1,200 calls per 5-min window per zone. We're nowhere near either
 * limit at this site's edit frequency.
 *
 * Docs: https://developers.cloudflare.com/api/operations/zone-purge
 */
export async function purgeCloudflareCache(urls: string[]): Promise<PurgeResult> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zoneId) {
    return { attempted: false, ok: false, error: 'CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID not set' }
  }
  if (urls.length === 0) {
    return { attempted: false, ok: true }
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ files: urls.slice(0, 30) }),
        signal: AbortSignal.timeout(4000),
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error('[cloudflare-purge] HTTP', res.status, data)
      return { attempted: true, ok: false, status: res.status, error: JSON.stringify(data).slice(0, 300) }
    }
    return { attempted: true, ok: true, status: res.status }
  } catch (err) {
    console.error('[cloudflare-purge] fetch failed:', err)
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Convenience: purge the URLs derived from a product's slug. Caller
 * passes the slug only; we build the URL list internally.
 */
export async function purgeProductCache(opts: {
  slug: string
  categorySlug?: string | null
}): Promise<PurgeResult> {
  return purgeCloudflareCache(urlsForProduct(opts))
}
