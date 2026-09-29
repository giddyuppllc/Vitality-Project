import type { Metadata } from 'next'
import './vip.css'

/**
 * Clubhouse segment (everything served on VIP_HOST — src/proxy.ts rewrites
 * .vip requests here and flags them with the x-vp-site header, so the root
 * layout renders a bare document with none of the store's pieces).
 *
 * The metadata below replaces every store value inherited from the root:
 * private, never indexed, no store manifest / keywords / OpenGraph / Twitter
 * card. vip/opengraph-image.tsx replaces the store's og image file.
 */
const VIP_URL = process.env.NEXT_PUBLIC_VIP_URL || 'https://vitalityproject.vip'

export const metadata: Metadata = {
  metadataBase: new URL(VIP_URL),
  title: {
    absolute: 'Clubhouse · The Vitality Project',
    template: '%s · Clubhouse',
  },
  description: null,
  keywords: null,
  manifest: null,
  openGraph: null,
  twitter: null,
  appleWebApp: null,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  referrer: 'same-origin',
  formatDetection: { telephone: false, email: false, address: false },
}

export default function VipLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Skip to content
      </a>
      <div className="relative z-[2] min-h-screen">{children}</div>
    </>
  )
}
