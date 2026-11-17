// Keeps this .global-only segment prerendered as it was before the root
// layout began reading the proxy's site header (headers() would otherwise make
// every route dynamic). force-static makes headers() empty here, so the root
// layout renders the store document — the clubhouse never serves this path.
export const dynamic = 'force-static'

// The page is a client component; without this it carried the homepage title.
export const metadata = { title: 'Affiliate Program' }

export default function StaticSegmentLayout({ children }: { children: React.ReactNode }) {
  return children
}
