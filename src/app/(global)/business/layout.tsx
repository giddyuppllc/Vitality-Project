export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BusinessSidebar } from '@/components/business/sidebar'

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Check user has an OrgMember record
  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!membership) {
    redirect('/business/apply')
  }

  return (
    <div className="lg:flex min-h-screen" style={{ background: '#0f0f12', color: '#fff' }}>
      <BusinessSidebar orgName={membership.organization.name} />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="admin-scope p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
