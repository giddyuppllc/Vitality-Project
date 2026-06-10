import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { VitalityVeins } from '@/components/vitality-veins'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'
import { ExitIntentModal } from '@/components/store/exit-intent-modal'

// Marketing pixels — env-gated. Set the IDs in production to enable; dev
// stays clean. Public-prefixed because they need to land in the bundle.
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'The Vitality Project — Premium Peptides',
    template: '%s | The Vitality Project',
  },
  description:
    'Premium quality peptides and performance compounds. Private label, direct to you.',
  keywords: ['peptides', 'BPC-157', 'TB-500', 'performance', 'vitality', 'health'],
  openGraph: {
    type: 'website',
    siteName: 'The Vitality Project',
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Vitality Project — Premium Peptides',
    description:
      'Premium quality peptides and performance compounds. Private label, direct to you.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vitality',
  },
}

// Explicit, correct mobile viewport. width=device-width + initial-scale=1 is
// what makes the responsive breakpoints actually apply on real devices;
// viewportFit:'cover' lets the dark UI extend under notches/safe areas.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#141828',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'The Vitality Project',
    url: APP_URL,
    logo: `${APP_URL}/logo-white.png`,
    description:
      'Premium quality peptides and performance compounds for qualified research use.',
    sameAs: [] as string[],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@vitalityproject.global',
      availableLanguage: ['English'],
    },
  }

  return (
    <html lang="en" className="dark">
      <head>
        {/* Google Analytics 4 — fires on every page; conversion events fire
            from /checkout/confirmation client-side once the store goes live. */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}',{send_page_view:true});`}
            </Script>
          </>
        )}

        {/* Meta (Facebook) Pixel — base PageView. Conversion events
            (AddToCart, InitiateCheckout, Purchase) fire from the matching
            pages once the store opens. */}
        {META_PIXEL_ID && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}

        {/* TikTok Pixel */}
        {TIKTOK_PIXEL_ID && (
          <Script id="tiktok-pixel" strategy="afterInteractive">
            {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${TIKTOK_PIXEL_ID}');ttq.page();}(window,document,'ttq');`}
          </Script>
        )}
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <Providers>
          <VitalityVeins />
          {children}
          <ExitIntentModal />
        </Providers>
        <ServiceWorkerRegistration />
      </body>
    </html>
  )
}
