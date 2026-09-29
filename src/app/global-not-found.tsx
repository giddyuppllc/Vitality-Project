import RootLayout, { metadata as storeMetadata } from './(global)/layout'
import NotFound from './(global)/not-found'

/**
 * 404 for URLs that match no route. Needed because the app now has two root
 * layouts ((global) for the store, vip for the clubhouse), so there is no
 * single root layout for Next to compose a 404 from.
 *
 * Renders exactly what an unknown .global URL rendered before the split: the
 * store's root layout around the store's not-found page. Clubhouse URLs never
 * get here — src/proxy.ts sends every .vip path into the vip segment, whose
 * catch-all renders the clubhouse's own 404.
 */
export const metadata = storeMetadata

export default function GlobalNotFound() {
  return (
    <RootLayout>
      <NotFound />
    </RootLayout>
  )
}
