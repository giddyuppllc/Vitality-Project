import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '../globals.css'
import './vip.css'

/**
 * ROOT layout of the clubhouse (everything served on VIP_HOST — src/proxy.ts
 * rewrites .vip requests into this segment).
 *
 * The app has two root layouts: src/app/(global)/layout.tsx for the store and
 * this one. Separate roots mean none of the store's document-level pieces —
 * marketing pixels, store JSON-LD, the newsletter exit modal, the store's
 * service worker / PWA manifest, SEO metadata — are rendered, serialised or
 * bundled into clubhouse pages. Shared: brand tokens (globals.css) and Inter.
 */

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const VIP_URL = process.env.NEXT_PUBLIC_VIP_URL || 'https://vitalityproject.vip'

export const metadata: Metadata = {
  metadataBase: new URL(VIP_URL),
  title: {
    default: 'Clubhouse · The Vitality Project',
    template: '%s · Clubhouse',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
  referrer: 'same-origin',
  formatDetection: { telephone: false, email: false, address: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#141828',
}

export default function VipRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to content
        </a>
        <div className="relative z-[2] min-h-screen">{children}</div>
      </body>
    </html>
  )
}
