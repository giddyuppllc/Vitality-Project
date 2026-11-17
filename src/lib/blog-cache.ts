import { revalidatePath } from 'next/cache'
import { purgeCloudflareCache } from '@/lib/cloudflare-purge'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

/**
 * The public blog pages are ISR (revalidate = 3600), so an admin edit —
 * including UNPUBLISHING a post — stayed live for up to an hour. Call after
 * every admin post create/update/delete with the slug(s) involved.
 */
export function refreshBlogPages(slugs: Array<string | null | undefined>): void {
  const paths = ['/blog', ...Array.from(new Set(slugs.filter(Boolean))).map((s) => `/blog/${s}`)]
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch (err) {
      // Outside a Next request (scripts/tests) there is nothing to revalidate.
      console.warn('[blog-cache] revalidatePath skipped:', p, (err as Error).message)
    }
  }
  void purgeCloudflareCache(paths.map((p) => `${APP_URL}${p}`)).catch((err) =>
    console.error('[blog-cache] cloudflare purge failed:', err),
  )
}
