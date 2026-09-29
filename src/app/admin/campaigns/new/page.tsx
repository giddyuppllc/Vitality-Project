import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'
import { CampaignBuilder } from '@/components/admin/campaign-builder'

export const dynamic = 'force-dynamic'

export default async function NewCampaignPage() {
  const session = await getServerSession(authOptions)
  const segments = await prisma.savedSegment.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <div>
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/admin/campaigns"
          className="text-white/40 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New campaign</h1>
          <p className="text-white/40 text-sm mt-0.5">
            Compose, preview, and send a marketing email.
          </p>
        </div>
      </div>
      <CampaignBuilder
        mode="create"
        segments={segments}
        adminEmail={session?.user?.email ?? null}
      />
    </div>
  )
}
