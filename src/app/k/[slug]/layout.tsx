export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { KioskExitButton } from '@/app/kiosk/kiosk-exit-button'

/**
 * Path-based kiosk layout: `vitalityproject.global/k/<slug>/*`.
 *
 * Same look as the subdomain-based /kiosk layout, but the org slug
 * comes from the URL params instead of the host header. This is the
 * default for new gyms — no DNS work, no wildcard cert.
 */
export default async function PathBasedKioskLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { name: true, status: true, kioskPin: true },
  })
  if (!org || org.status !== 'ACTIVE') notFound()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0f0f12', color: '#fff' }}
    >
      <header className="shrink-0 px-6 py-4 border-b border-white/5 bg-dark-800/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-0.5">Powered by</p>
            <h1 className="text-lg font-bold text-gradient">THE VITALITY PROJECT</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-white/80">{org.name}</p>
            <KioskExitButton pin={org.kioskPin} />
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
