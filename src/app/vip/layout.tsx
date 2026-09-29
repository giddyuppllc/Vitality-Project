import type { Metadata } from 'next'
import './vip.css'

/**
 * Clubhouse root (everything served on VIP_HOST — see src/proxy.ts).
 * Overrides the store's metadata: private, never indexed, no store PWA
 * manifest, no store keywords/OpenGraph.
 */
export const metadata: Metadata = {
  title: {
    default: 'Clubhouse · The Vitality Project',
    template: '%s · Clubhouse',
  },
  description: null,
  keywords: null,
  manifest: null,
  openGraph: null,
  twitter: null,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  referrer: 'same-origin',
}

export default function VipRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="relative z-[2] min-h-screen">{children}</div>
}
