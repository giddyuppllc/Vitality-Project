import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { getVipSetting } from '@/lib/vip/settings'
import { getEarningRule } from '@/lib/vip/earning'
import { METRIC_LABEL, challengeStatus } from '@/lib/vip/fitness/challenges'
import { localDate } from '@/lib/vip/fitness/dates'
import { ChallengeForm, FitnessSubNav } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

const METRICS = (Object.keys(METRIC_LABEL) as (keyof typeof METRIC_LABEL)[]).map((m) => ({ value: m, label: METRIC_LABEL[m].name }))
const STATUS_STYLE = { upcoming: 'text-sky-200', active: 'text-emerald-200', ended: 'text-white/40' } as const

export default async function AdminVipChallengesPage() {
  await requireAdminPage()
  const today = localDate(new Date(), await getVipSetting('vip.timeZone'))
  const challenges = await prisma.vipChallenge.findMany({
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    include: { participants: { select: { completedAt: true } } },
  })
  return (
    <div>
      <FitnessSubNav />
      <div className="grid gap-6 lg:grid-cols-[1fr_28rem]">
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="mb-1 font-semibold">Challenges</h2>
          <p className="mb-4 text-sm text-white/40">Dates are the member&apos;s own calendar days. Completing awards the badge and the points once.</p>
          {challenges.length === 0 ? (
            <p className="text-sm text-white/40">No challenges yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {challenges.map((c) => {
                const status = challengeStatus(c, today)
                const done = c.participants.filter((p) => p.completedAt).length
                return (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/admin/vip/fitness/challenges/${c.id}`} className="font-medium hover:underline">{c.title}</Link>
                      <p className="text-xs text-white/40">
                        {c.published ? 'Published' : 'Draft'} · <span className={STATUS_STYLE[status]}>{status}</span> · {c.startDate} → {c.endDate} ·{' '}
                        {METRIC_LABEL[c.metric].name}: {c.target.toLocaleString('en-US')} · {TIER_BENEFITS[c.minTier].label} and up ·{' '}
                        {c.participants.length} joined · {done} completed
                      </p>
                    </div>
                    <Link href={`/admin/vip/fitness/challenges/${c.id}`} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
                      Edit · leaderboard
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <ChallengeForm metrics={METRICS} defaultPoints={await getEarningRule('vip.points.challengeDefault')} />
      </div>
    </div>
  )
}
