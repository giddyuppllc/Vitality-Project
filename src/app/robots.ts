import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        // The partner application is public; the rest of /business is the
        // signed-in partner dashboard.
        allow: ['/', '/business/apply'],
        disallow: ['/admin', '/account', '/business', '/kiosk', '/api'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  }
}
