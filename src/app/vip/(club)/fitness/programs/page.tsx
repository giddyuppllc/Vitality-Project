import Link from 'next/link'
import { Lock } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listPrograms } from '@/lib/vip/fitness/programs'
import { FIT_COPY } from '@/lib/vip/fitness/copy'
import { VIP_COPY } from '@/lib/vip/copy'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { FitnessTabs } from '@/components/vip/fitness/tabs'
import { Tag, WellnessNote } from '@/components/vip/fitness/bits'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Programs' }

export default async function ProgramsPage() {
  const viewer = await requireVipPage('member')
  const programs = await listPrograms(viewer.userId, viewer.accessTier)
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={FIT_COPY.programs.title} intro={FIT_COPY.programs.intro} />
      <FitnessTabs />
      {programs.length === 0 ? (
        <EmptyState title={FIT_COPY.programs.empty.title}>{FIT_COPY.programs.empty.body}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const pct = p.enrollment && p.dayCount ? Math.round((p.enrollment.completed / p.dayCount) * 100) : 0
            return (
              <li key={p.id}>
                <Link href={`/fitness/programs/${p.slug}`} className="vip-surface vip-focus block h-full overflow-hidden transition-colors hover:bg-white/[0.04]">
                  {p.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
                    <img src={p.coverImage} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="relative h-24 w-full bg-gradient-to-br from-brand-900/70 via-dark-700/40 to-transparent" aria-hidden="true">
                      <span className="vip-kicker absolute bottom-3 left-5">
                        {p.weekCount} {p.weekCount === 1 ? 'week' : 'weeks'} · {p.trainingDays} sessions
                      </span>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold leading-snug">{p.title}</h2>
                      {!p.allowed && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-label="Locked" />}
                    </div>
                    {p.summary && <p className="mt-1.5 line-clamp-2 text-sm text-white/60">{p.summary}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      {p.level && <Tag>{p.level}</Tag>}
                      {p.minTier !== 'CLUB' && <TierBadge tier={p.minTier} />}
                      {p.enrollment?.status === 'ACTIVE' && <Tag>In progress</Tag>}
                      {p.enrollment?.status === 'PAUSED' && <Tag>Paused</Tag>}
                      {p.enrollment?.status === 'COMPLETED' && <Tag>Completed</Tag>}
                    </div>
                    {!p.allowed && <p className="mt-3 text-xs text-white/55">{VIP_COPY.events.requires} <TierBadge tier={p.minTier} /></p>}
                    {p.enrollment && p.allowed && (
                      <div
                        className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`${p.title} progress`}
                      >
                        <div className="h-full rounded-full bg-brand-400" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <WellnessNote />
    </div>
  )
}
