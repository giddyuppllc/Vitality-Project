import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listSpaces } from '@/lib/vip/feed'
import { GLOBAL_LINKS, globalUrl } from '@/lib/vip/links'
import { VipShell } from '@/components/vip/shell'

export const dynamic = 'force-dynamic'

/**
 * Members-only shell. Every page below ALSO calls requireVipPage itself —
 * a layout alone is not an access check (it does not re-run on every client
 * navigation), so it only provides chrome here.
 */
export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireVipPage('member')
  const [unread, spaces] = await Promise.all([
    viewer.suspended
      ? Promise.resolve(0)
      : prisma.vipNotification.count({ where: { userId: viewer.userId, readAt: null } }),
    viewer.suspended ? Promise.resolve([]) : listSpaces(),
  ])
  return (
    <VipShell
      viewer={{
        displayName: viewer.displayName,
        avatarUrl: viewer.avatarUrl,
        tier: viewer.tier,
        isAdmin: viewer.isAdmin,
        suspended: viewer.suspended,
      }}
      unread={unread}
      spaces={spaces.map((s) => ({ slug: s.slug, name: s.name }))}
      shopUrl={GLOBAL_LINKS.shop()}
      adminUrl={viewer.isAdmin ? globalUrl('/admin/vip') : null}
    >
      {children}
    </VipShell>
  )
}
