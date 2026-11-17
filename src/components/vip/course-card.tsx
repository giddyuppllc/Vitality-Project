import Link from 'next/link'
import { Award, Clock, Gift, Lock } from 'lucide-react'
import type { CourseCard } from '@/lib/vip/classroom'
import { formatPrice } from '@/lib/utils'
import { TierBadge } from './ui'
import { Bar, LEVEL_LABEL, Pill, formatPoints, minutesLabel } from './academy-ui'

/** Course tile for the Academy hub and learning-path pages. */
export function CourseTile({ c, index }: { c: CourseCard; index?: number }) {
  const pct = c.lessonCount ? Math.round((c.completedCount / c.lessonCount) * 100) : 0
  const mins = minutesLabel(c.estimatedMinutes)
  return (
    <Link
      href={`/classroom/${c.slug}`}
      className="vip-surface vip-focus group flex h-full flex-col overflow-hidden transition-colors hover:bg-white/[0.04]"
      data-testid={`course-${c.slug}`}
    >
      {c.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
        <img src={c.coverImage} alt="" className="h-32 w-full object-cover" loading="lazy" />
      ) : (
        <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-brand-900/80 via-dark-700/50 to-transparent" aria-hidden="true">
          <span className="absolute -right-3 -top-6 text-[88px] font-black leading-none text-white/[0.05]">{index !== undefined ? String(index + 1).padStart(2, '0') : ''}</span>
          <span className="vip-kicker absolute bottom-3 left-5">{c.lessonCount} lessons{mins ? ` · ${mins}` : ''}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {c.level && <Pill>{LEVEL_LABEL[c.level] ?? c.level}</Pill>}
          {c.certificateCode && (
            <Pill tone="green">
              <Award className="h-3 w-3" aria-hidden="true" /> Completed
            </Pill>
          )}
          {c.granted && !c.certificateCode && <Pill tone="gold">Unlocked</Pill>}
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <h3 className="font-semibold leading-snug">{c.title}</h3>
          {!c.allowed && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/60" aria-label="Locked" />}
        </div>
        {c.summary && <p className="mt-1.5 line-clamp-2 text-sm text-white/65">{c.summary}</p>}
        <div className="mt-auto pt-4">
          {c.allowed ? (
            <>
              <div className="flex items-center justify-between text-xs text-white/60">
                <span>
                  {c.completedCount}/{c.lessonCount} lessons
                </span>
                {mins && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden="true" /> {mins}
                  </span>
                )}
              </div>
              {c.lessonCount > 0 && <Bar pct={pct} label={`${c.title} progress`} className="mt-2" />}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
              {c.purchaseOnly ? (
                <span>Training</span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  Included from <TierBadge tier={c.minTier} />
                </span>
              )}
              {(c.priceCents || c.pointsPrice) && (
                <span className="inline-flex items-center gap-1 font-semibold text-[#ead7a8]">
                  <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                  {[c.priceCents ? formatPrice(c.priceCents) : null, c.pointsPrice ? `${formatPoints(c.pointsPrice)} pts` : null].filter(Boolean).join(' or ')}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
