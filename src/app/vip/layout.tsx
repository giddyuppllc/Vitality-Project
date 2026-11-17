import type { Metadata, Viewport } from 'next'
import './vip.css'
import { ClubhouseServiceWorker } from '@/components/vip/sw-register'
import { VIP_THEME } from '@/lib/vip/pwa'

/**
 * Clubhouse segment (everything served on VIP_HOST — src/proxy.ts rewrites
 * .vip requests here and flags them with the x-vp-site header, so the root
 * layout renders a bare document with none of the store's pieces).
 *
 * The metadata below replaces every store value inherited from the root:
 * private, never indexed, no store keywords / OpenGraph / Twitter card.
 * vip/opengraph-image.tsx replaces the store's og image file. The manifest,
 * icons and service worker are the CLUBHOUSE's own (lib/vip/pwa.ts, served
 * under names the store does not use — lib/vip/host.ts VIP_PWA_FILES).
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
  manifest: '/manifest.webmanifest',
  openGraph: null,
  // The store layout sets canonical './'; here that would name the internal
  // rewritten /vip/… path. The clubhouse is noindex — no canonical at all.
  alternates: null,
  twitter: null,
  appleWebApp: { capable: true, title: 'Clubhouse', statusBarStyle: 'black-translucent' },
  // Setting `icons` replaces the icon.svg file convention, so the monogram is
  // listed here too — without it browsers fall back to /favicon.ico, which is
  // the store's file and answers 404 on .vip.
  icons: { icon: [{ url: '/vip/icon.svg', type: 'image/svg+xml' }], apple: '/apple-touch-icon.png' },
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
  themeColor: VIP_THEME.theme,
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
      <ClubhouseServiceWorker />
    </>
  )
}
