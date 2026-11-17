import { notFound } from 'next/navigation'
import { CheckCircle2, EyeOff } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { requireVipPage } from '@/lib/vip/page-gate'
import { tierAllows } from '@/lib/vip/access'
import { getFitnessPrefs, todayIn } from '@/lib/vip/fitness/profile'
import { challengeScores, challengeStatus, evaluateChallengesFor, getChallenge, leaderboard, METRIC_LABEL } from '@/lib/vip/fitness/challenges'
import { fmtDate } from '@/lib/vip/fitness/dates'
import { fmtNum } from '@/lib/vip/fitness/units'
import { renderLessonMarkdown } from '@/lib/vip/text'
import { cn } from '@/lib/utils'
import { Avatar, TierBadge } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { BackLink, LockedNotice, SectionTitle, Tag } from '@/components/vip/fitness/bits'
import { ChallengeJoinButton, LeaderboardVisibility } from '@/components/vip/fitness/actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Challenge' }

const HOW: Record<string, string> = {
  WORKOUTS: 'Every workout you finish between the start and end dates counts.',
  STEPS: 'Steps from your daily check-ins between the start and end dates add up.',
  CHECKIN_STREAK: 'Your longest run of daily check-ins inside the dates counts.',
  CUSTOM_POINTS: 'The coaches score this one and enter your points.',
}

export default async function ChallengePage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const c = await getChallenge(slug)
  if (!c) notFound()
  const prefs = await getFitnessPrefs(viewer.userId)
  const today = todayIn(prefs.timeZone)
  const status = challengeStatus(c, today)
  const allowed = tierAllows(viewer.accessTier, c.minTier)
  let me = await prisma.vipChallengeParticipant.findUnique({ where: { challengeId_userId: { challengeId: c.id, userId: viewer.userId } } })
  if (me && !me.completedAt && status !== 'upcoming') {
    // Pick up anything that finished the challenge since the last check.
    if ((await evaluateChallengesFor(viewer.userId)).length) {
      me = await prisma.vipChallengeParticipant.findUnique({ where: { id: me.id } })
    }
  }
  const myScore = me ? ((await challengeScores(c, [viewer.userId])).get(viewer.userId) ?? 0) : 0
  const board = await leaderboard(c.id, { viewerId: viewer.userId, take: 100 })
  const metric = METRIC_LABEL[c.metric]
  const pct = Math.min(100, Math.round((myScore / c.target) * 100))

  return (
    <div className="mx-auto max-w-3xl">
      <FitnessTabs />
      <BackLink href="/fitness/challenges">All challenges</BackLink>
      <article className="vip-surface-strong overflow-hidden">
        {c.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
          <img src={c.coverImage} alt="" className="h-44 w-full object-cover" />
        )}
        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag>{status === 'active' ? 'Running now' : status === 'upcoming' ? 'Starts soon' : 'Ended'}</Tag>
            {c.minTier !== 'CLUB' && <TierBadge tier={c.minTier} />}
          </div>
          <h1 className="mt-2 text-2xl font-bold">{c.title}</h1>
          <p className="mt-1 text-sm text-white/65">
            {fmtDate(c.startDate, { weekday: 'short', month: 'short', day: 'numeric' })} – {fmtDate(c.endDate, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white/[0.04] p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Goal</dt>
              <dd className="mt-0.5 font-semibold">
                {fmtNum(c.target, 0)} {metric.unit(c.target)}
              </dd>
            </div>
            <div className="rounded-xl bg-white/[0.04] p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Reward</dt>
              <dd className="mt-0.5 font-semibold">{c.pointsReward > 0 ? `${fmtNum(c.pointsReward, 0)} points` : 'Badge'}</dd>
            </div>
            <div className="col-span-2 rounded-xl bg-white/[0.04] p-3 sm:col-span-1">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Badge</dt>
              <dd className="mt-0.5 font-semibold">{c.badgeLabel || c.title}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-white/70">{HOW[c.metric]}</p>
          {c.description.trim() && <div className="vip-prose mt-3" dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(c.description) }} />}

          <div className="mt-5">
            {!allowed ? (
              <LockedNotice minTier={c.minTier} what="challenge" />
            ) : me ? (
              <div className="rounded-xl border border-brand-400/25 bg-brand-500/[0.08] p-4">
                {me.completedAt ? (
                  <p className="flex items-center gap-2 font-semibold text-emerald-100">
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" /> You completed this challenge
                  </p>
                ) : (
                  <p className="font-semibold">You&apos;re in</p>
                )}
                <p className="mt-1 text-sm tabular-nums text-white/70">
                  {fmtNum(myScore, 0)} / {fmtNum(c.target, 0)} {metric.unit(c.target)}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Your progress">
                  <div className={me.completedAt ? 'h-full rounded-full bg-emerald-300' : 'h-full rounded-full bg-brand-400'} style={{ width: `${pct}%` }} />
                </div>
                {status !== 'ended' && !me.completedAt && (
                  <div className="mt-3">
                    <ChallengeJoinButton challengeId={c.id} joined completed={false} />
                  </div>
                )}
              </div>
            ) : status === 'ended' ? (
              <p className="text-sm text-white/60">This challenge has ended.</p>
            ) : (
              <ChallengeJoinButton challengeId={c.id} joined={false} completed={false} />
            )}
          </div>
        </div>
      </article>

      <SectionTitle>Leaderboard</SectionTitle>
      {board.length === 0 ? (
        <p className="vip-surface p-5 text-sm text-white/60">{status === 'ended' ? 'Nobody took part.' : 'Be the first to join.'}</p>
      ) : (
        <ol className="vip-surface divide-y divide-white/[0.06]">
          {board.map((r) => (
            <li key={r.userId} className={cn('flex items-center gap-3 px-4 py-3', r.isViewer && 'bg-brand-500/[0.08]')}>
              <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums text-white/70">{r.rank}</span>
              <Avatar name={r.name} src={r.avatarUrl} size={32} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {r.name}
                  {r.isViewer && <span className="text-white/55"> (you)</span>}
                </span>
                {r.isViewer && r.hidden && (
                  <span className="flex items-center gap-1 text-xs text-white/55">
                    <EyeOff className="h-3 w-3" aria-hidden="true" /> Hidden from other members
                  </span>
                )}
              </span>
              {r.completed && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-label="Completed" />}
              <span className="shrink-0 font-semibold tabular-nums">{fmtNum(r.score, 0)}</span>
            </li>
          ))}
        </ol>
      )}
      <section className="vip-surface mt-4 p-5">
        <LeaderboardVisibility hidden={prefs.hideFromLeaderboards} />
      </section>
    </div>
  )
}
