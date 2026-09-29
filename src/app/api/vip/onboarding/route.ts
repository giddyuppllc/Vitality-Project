import { prisma } from '@/lib/prisma'
import { requireVipApi, vipJson } from '@/lib/vip/access'

export const dynamic = 'force-dynamic'

/** POST /api/vip/onboarding — hide the "Start here" checklist for this member. */
export async function POST() {
  const gate = await requireVipApi('member')
  if (gate.response) return gate.response
  const now = new Date()
  await prisma.vipProfile.upsert({
    where: { userId: gate.viewer.userId },
    update: { onboardedAt: now },
    create: { userId: gate.viewer.userId, onboardedAt: now },
  })
  return vipJson({ ok: true })
}
