import { Trophy } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { monthlyLeaderboard, myMonthlyPoints } from '@/lib/vip/badges'
import { monthLabel, periodFor } from '@/lib/vip/rewards'
import { REWARDS_COPY as C } from '@/lib/vip/rewards-copy'
import { cn } from '@/lib/utils'
import { Avatar, EmptyState } from '@/components/vip/ui'
import { LeaderboardToggle } from '@/components/vip/rewards/leaderboard-toggle'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Leaderboard' }

const MEDAL = ['text-[#ead7a8]', 'text-slate-200', 'text-amber-300']

export default async function LeaderboardPage() {
  const viewer = await requireVipPage('member')
  const period = periodFor(new Date())
  const [rows, mine, prefs] = await Promise.all([
    monthlyLeaderboard({ period, limit: 20 }),
    myMonthlyPoints(viewer.userId, period),
    prisma.vipProfile.findUnique({ where: { userId: viewer.userId }, select: { hideFromLeaderboards: true } }),
  ])
  const hidden = prefs?.hideFromLeaderboards ?? false
  const myRow = rows.find((r) => r.userId === viewer.userId)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{C.leaderboardTitle}</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/60">
          {monthLabel(period)} · {C.leaderboardIntro}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="vip-surface p-4">
          <p className="text-xs text-white/55">Your points this month</p>
          <p className="mt-1 text-2xl font-extrabold">{mine.toLocaleString('en-US')}</p>
          <p className="text-xs text-white/55">{hidden ? 'Hidden from the board' : myRow ? `Rank #${myRow.rank}` : 'Not in the top 20 yet'}</p>
        </div>
        <LeaderboardToggle initial={hidden} label={C.hideLabel} help={C.hideHelp} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title={C.leaderboardEmpty.title}>{C.leaderboardEmpty.body}</EmptyState>
      ) : (
        <ol className="vip-surface divide-y divide-white/[0.06]" data-testid="leaderboard">
          {rows.map((r) => (
            <li key={r.userId} className={cn('flex items-center gap-3 px-4 py-3', r.userId === viewer.userId && 'bg-brand-500/10')}>
              <span className={cn('w-8 shrink-0 text-center text-sm font-bold', MEDAL[r.rank - 1] ?? 'text-white/60')}>
                {r.rank <= 3 ? <Trophy className="mx-auto h-5 w-5" aria-label={`Rank ${r.rank}`} /> : `#${r.rank}`}
              </span>
              <Avatar name={r.displayName} src={r.avatarUrl} size={34} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {r.displayName}
                {r.userId === viewer.userId && <span className="text-white/55"> (you)</span>}
              </span>
              <span className="shrink-0 text-sm font-semibold text-emerald-300">{r.points.toLocaleString('en-US')} pts</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
