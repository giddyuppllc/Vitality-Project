import { prisma } from '@/lib/prisma'
import { formatDate, formatPrice } from '@/lib/utils'
import { TIER_BENEFITS } from '@/lib/membership'
import { getTierRewardSettings, periodFor, runMemberRewards } from '@/lib/vip/rewards'
import { ClubhouseSettingsForm, RewardsForm } from '@/components/admin/vip/forms'
import { getVipSettings } from '@/lib/vip/settings'

export const dynamic = 'force-dynamic'

export default async function AdminVipRewardsPage() {
  const [settings, grants, preview, lastRun, clubSettings] = await Promise.all([
    getTierRewardSettings(),
    prisma.vipRewardGrant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { user: { select: { email: true } } },
    }),
    // Dry run: what a grant run for this month would do (as if it were the
    // 1st); writes and sends nothing.
    runMemberRewards({ dryRun: true, catchUp: true }),
    prisma.cronRun.findFirst({ where: { job: 'VIP member rewards' }, orderBy: { startedAt: 'desc' } }),
    getVipSettings(),
  ])
  const wouldGrant = preview.decisions?.filter((d) => d.outcome === 'would_grant') ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <RewardsForm initial={settings} />
          <ClubhouseSettingsForm initial={clubSettings} />
        </div>
        <div className="glass space-y-2 rounded-2xl p-5 text-sm">
          <h2 className="font-semibold">This month ({periodFor(new Date())})</h2>
          <p className="text-white/60">
            Active paid members: <span className="text-white">{preview.examined}</span> · tiers set to $0 (off):{' '}
            <span className="text-white">{preview.off}</span> · suspended: <span className="text-white">{preview.suspended}</span> ·
            already granted: <span className="text-white">{preview.alreadyGranted}</span>
          </p>
          <p className="text-white/60">
            A grant run for this month would credit <span className="text-white">{wouldGrant.length}</span> member(s), totalling{' '}
            <span className="text-white">{formatPrice(wouldGrant.reduce((n, d) => n + d.amountCents, 0))}</span>. Grants run on the
            1st; reward credit older than {clubSettings['vip.rewardExpiryMonths'] || '∞'} months expires
            {preview.expiry?.expiredCents ? ` (${formatPrice(preview.expiry.expiredCents)} due now)` : ''}.
          </p>
          <p className="text-white/40">
            Job endpoints: <code>/api/cron/vip-member-rewards</code> (daily; <code>&amp;dryRun=1</code>, <code>&amp;catchUp=1</code>) and{' '}
            <code>/api/cron/vip-notify</code> (every 15 min; reminders, digest, monthly series).
            Last run:{' '}
            {lastRun ? `${formatDate(lastRun.startedAt)} — ${lastRun.status} — ${lastRun.result ?? ''}` : 'never'}
          </p>
        </div>
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Month</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Credit</th>
              <th className="px-4 py-3">Granted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {grants.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-white/30">No rewards granted yet.</td>
              </tr>
            )}
            {grants.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-3">{g.user.email}</td>
                <td className="px-4 py-3">{g.period}</td>
                <td className="px-4 py-3">{TIER_BENEFITS[g.tier].label}</td>
                <td className="px-4 py-3">{formatPrice(g.amountCents)}</td>
                <td className="px-4 py-3 text-white/50">{formatDate(g.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
