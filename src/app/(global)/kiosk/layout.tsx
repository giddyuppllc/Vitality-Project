export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getTenantFromRequest } from '@/lib/tenant'
import { notFound } from 'next/navigation'
import { KioskExitButton } from './kiosk-exit-button'

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const { tenantSlug } = await getTenantFromRequest()

  let orgName = 'The Vitality Project'
  let kioskPin: string | null = null

  if (tenantSlug) {
    const org = await prisma.organization.findUnique({
      where: { slug: tenantSlug },
      select: { name: true, status: true, kioskPin: true },
    })

    if (!org || org.status !== 'ACTIVE') {
      notFound()
    }

    orgName = org.name
    kioskPin = org.kioskPin
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0f0f12', color: '#fff' }}
    >
      {/* Kiosk Header */}
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-dark-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-0.5">Powered by</p>
            <h1 className="text-lg font-bold text-gradient">THE VITALITY PROJECT</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-white/80">{orgName}</p>
            <KioskExitButton pin={kioskPin} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
