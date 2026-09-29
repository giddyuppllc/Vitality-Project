export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { Navbar } from '@/components/store/navbar'
import { Footer } from '@/components/store/footer'
import { AiChat } from '@/components/store/ai-chat'
import { RuoBanner } from '@/components/store/ruo-banner'
import { AnalyticsTracker } from '@/components/analytics-tracker'
import { SessionSync } from '@/components/store/session-sync'
import { getTenantContextForRequest } from '@/lib/tenant-db'
import { notFound } from 'next/navigation'

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const { isTenantRequest, organization } = await getTenantContextForRequest()
  if (isTenantRequest && !organization) {
    notFound()
  }

  return (
    <div className="flex flex-col min-h-screen relative z-2">
      <RuoBanner />
      <Navbar />
      <main className="flex-1 pt-24 md:pt-44">{children}</main>
      <Footer />
      <AiChat />
      <SessionSync />
      <Suspense fallback={null}>
        <AnalyticsTracker />
      </Suspense>
    </div>
  )
}
