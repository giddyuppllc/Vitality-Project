import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { TIER_BENEFITS } from '@/lib/membership'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

const M = '/api/admin/vip/moderation'

/**
 * Community suspensions. Membership itself (tier, status, billing) is managed
 * where it always was — /admin/members. Suspension here only removes the
 * community (feed, comments, directory); classroom/events/rewards remain.
 */
export default async function AdminVipMembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const term = q?.trim()
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { OR: [{ membership: { tier: { not: 'NONE' } } }, { vipProfile: { isNot: null } }] },
        term
          ? {
              OR: [
                { email: { contains: term, mode: 'insensitive' } },
                { name: { contains: term, mode: 'insensitive' } },
                { username: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      email: true,
      name: true,
      membership: { select: { tier: true, status: true } },
      vipProfile: { select: { displayName: true, suspendedAt: true, suspendedReason: true } },
      _count: { select: { vipPosts: true, vipComments: true } },
    },
  })

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <form method="get" className="border-b border-white/5 p-4">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search by email, name or username..."
          className="w-full rounded-xl border border-white/10 bg-dark-700 px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Membership</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3">Community</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-white/30">No members match.</td>
              </tr>
            )}
            {users.map((u) => {
              const suspended = !!u.vipProfile?.suspendedAt
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{u.vipProfile?.displayName || u.name || '—'}</p>
                    <p className="text-xs text-white/40">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {u.membership ? `${TIER_BENEFITS[u.membership.tier].label} · ${u.membership.status}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">
                    {u._count.vipPosts} posts · {u._count.vipComments} comments
                  </td>
                  <td className="px-4 py-3">
                    {suspended ? (
                      <div className="space-y-1">
                        <p className="text-xs text-amber-300">
                          Suspended {formatDate(u.vipProfile!.suspendedAt!)}
                          {u.vipProfile?.suspendedReason ? ` — ${u.vipProfile.suspendedReason}` : ''}
                        </p>
                        <AdminActionButton endpoint={M} tone="primary" label="Lift suspension" body={{ action: 'unsuspend_member', userId: u.id }} />
                      </div>
                    ) : (
                      <AdminActionButton
                        endpoint={M}
                        tone="danger"
                        label="Suspend"
                        confirmText="Suspend this member from the community? They keep classroom, events and rewards."
                        prompt={{ field: 'reason', question: 'Internal reason (optional)' }}
                        body={{ action: 'suspend_member', userId: u.id }}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
