import Link from 'next/link'
import { CheckCircle2, Lock, Users } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getFitnessPrefs, todayIn } from '@/lib/vip/fitness/profile'
import { listChallenges, METRIC_LABEL } from '@/lib/vip/fitness/challenges'
import { listBadges } from '@/lib/vip/fitness/badges'
import { fmtDate } from '@/lib/vip/fitness/dates'
import { fmtNum } from '@/lib/vip/fitness/units'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { SectionTitle, Tag } from '@/components/vip/fitness/bits'
import { LeaderboardVisibility } from '@/components/vip/fitness/actions'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Challenges' }

const STATUS_LABEL = { active: 'Running now', upcoming: 'Starts soon', ended: 'Ended' } as const

export default async function ChallengesPage() {
  const viewer = await requireVipPage('member')
  const prefs = await getFitnessPrefs(viewer.userId)
  const today = todayIn(prefs.timeZone)
  const [all, badges] = await Promise.all([listChallenges(viewer.userId, viewer.accessTier, today), listBadges(viewer.userId)])
  const visible = all.filter((c) => c.status !== 'ended' || c.joined)
  const order = { active: 0, upcoming: 1, ended: 2 }
  visible.sort((a, b) => order[a.status] - order[b.status])

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.challenges.title} intro={FIT_COPY.challenges.intro} />
      <FitnessTabs />
      {visible.length === 0 ? (
        <EmptyState title={FIT_COPY.challenges.empty.title}>{FIT_COPY.challenges.empty.body}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {visible.map((c) => {
            const pct = c.score != null ? Math.min(100, Math.round((c.score / c.target) * 100)) : 0
            return (
              <li key={c.id}>
                <Link href={`/fitness/challenges/${c.slug}`} className="vip-surface vip-focus block h-full overflow-hidden hover:bg-white/[0.04]">
                  {c.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
                    <img src={c.coverImage} alt="" className="h-32 w-full object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Tag>{STATUS_LABEL[c.status]}</Tag>
                      {c.minTier !== 'CLUB' && <TierBadge tier={c.minTier} />}
                      {c.completed && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Completed
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <h2 className="font-semibold leading-snug">{c.title}</h2>
                      {!c.allowed && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-label="Locked" />}
                    </div>
                    <p className="mt-1 text-sm text-white/65">
                      {METRIC_LABEL[c.metric].name}: {fmtNum(c.target, 0)} {METRIC_LABEL[c.metric].unit(c.target)}
                    </p>
                    <p className="mt-0.5 text-xs text-white/55">
                      {fmtDate(c.startDate, { month: 'short', day: 'numeric' })} – {fmtDate(c.endDate, { month: 'short', day: 'numeric' })}
                      {c.pointsReward > 0 && ` · ${fmtNum(c.pointsReward, 0)} points`}
                      <span className="ml-2 inline-flex items-center gap-1">
                        <Users className="h-3 w-3" aria-hidden="true" /> {c.participants}
                      </span>
                    </p>
                    {c.joined && (
                      <>
                        <p className="mt-3 text-sm font-medium tabular-nums">
                          {fmtNum(c.score ?? 0, 0)} / {fmtNum(c.target, 0)}
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${c.title} progress`}>
                          <div className={c.completed ? 'h-full rounded-full bg-emerald-300' : 'h-full rounded-full bg-brand-400'} style={{ width: `${pct}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <SectionTitle>Your badges</SectionTitle>
      {badges.length === 0 ? (
        <p className="vip-surface p-5 text-sm text-white/60">Complete a challenge to earn your first badge.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {badges.map((b) => (
            <li key={b.id} className="inline-flex items-center gap-2 rounded-full border border-[#d4b26a]/40 bg-[#d4b26a]/10 px-3 py-1.5 text-sm text-[#ead7a8]">
              <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full bg-[#d4b26a] text-[10px] font-bold text-[#1a1406]">
                ★
              </span>
              {b.label}
            </li>
          ))}
        </ul>
      )}

      <section className="vip-surface mt-6 p-5">
        <LeaderboardVisibility hidden={prefs.hideFromLeaderboards} />
      </section>
    </div>
  )
}
