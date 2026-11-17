// Keeps this .global-only segment prerendered as it was before the root
// layout began reading the proxy's site header (headers() would otherwise make
// every route dynamic). force-static makes headers() empty here, so the root
// layout renders the store document — the clubhouse never serves this path.
export const dynamic = 'force-static'

// Sign-in / registration screens are not search landing pages; they were
// indexable with the homepage's title and description.
export const metadata = {
  title: 'Account',
  robots: { index: false, follow: true },
}

export default function StaticSegmentLayout({ children }: { children: React.ReactNode }) {
  return children
}
