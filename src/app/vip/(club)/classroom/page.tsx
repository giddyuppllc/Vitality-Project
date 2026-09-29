import Link from 'next/link'
import { Lock } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listCourses } from '@/lib/vip/classroom'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { VIP_COPY } from '@/lib/vip/copy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Classroom' }

export default async function ClassroomPage() {
  const viewer = await requireVipPage('member')
  const courses = await listCourses(viewer.userId, viewer.accessTier)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={VIP_COPY.classroom.title} intro={VIP_COPY.classroom.intro} />
      {courses.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.classroom.title}>{VIP_COPY.empty.classroom.body}</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => {
            const pct = c.lessonCount ? Math.round((c.completedCount / c.lessonCount) * 100) : 0
            return (
              <li key={c.id}>
                <Link href={`/classroom/${c.slug}`} className="vip-surface vip-focus block h-full overflow-hidden transition-colors hover:bg-white/[0.04]">
                  {c.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-entered cover URL
                    <img src={c.coverImage} alt="" className="h-36 w-full object-cover" />
                  ) : (
                    <div className="relative h-24 w-full overflow-hidden bg-gradient-to-br from-brand-900/70 via-dark-700/40 to-transparent" aria-hidden="true">
                      <span className="vip-kicker absolute bottom-3 left-5">{c.lessonCount} lessons</span>
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold leading-snug">{c.title}</h2>
                      {!c.allowed && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-label="Locked" />}
                    </div>
                    {c.summary && <p className="mt-1.5 line-clamp-2 text-sm text-white/60">{c.summary}</p>}
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/50">
                      {c.allowed ? (
                        <span>
                          {c.completedCount}/{c.lessonCount} lessons
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          {VIP_COPY.events.requires} <TierBadge tier={c.minTier} />
                        </span>
                      )}
                    </div>
                    {c.allowed && c.lessonCount > 0 && (
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={pct}
                        aria-label={`${c.title} progress`}
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
      <p className="mt-6 text-xs leading-relaxed text-white/45">{VIP_COPY.classroom.wellnessNote}</p>
    </div>
  )
}
