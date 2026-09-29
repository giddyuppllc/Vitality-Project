import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Circle, Lock } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getCourse } from '@/lib/vip/classroom'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { TierBadge } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Course' }

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const data = await getCourse(slug, viewer.userId, viewer.accessTier)
  if (!data) notFound()
  const { course, modules, allowed } = data

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/classroom" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Classroom
      </Link>
      <header className="vip-surface-strong p-5 sm:p-6">
        <h1 className="text-2xl font-bold">{course.title}</h1>
        {course.summary && <p className="mt-2 text-white/65">{course.summary}</p>}
        <p className="mt-3 text-sm text-white/50">
          {data.completedCount}/{data.lessonCount} lessons complete
        </p>
      </header>

      {!allowed && (
        <div className="vip-surface mt-4 flex flex-wrap items-center gap-3 p-4 text-sm">
          <Lock className="h-4 w-4 text-white/50" aria-hidden="true" />
          <span className="text-white/70">
            This course requires <TierBadge tier={course.minTier} className="mx-1" /> or higher.
          </span>
          <a href={GLOBAL_LINKS.manageMembership()} className="ml-auto font-semibold text-brand-300 hover:text-brand-200">
            Membership options →
          </a>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {modules.map((m, i) => (
          <section key={m.id} className="vip-surface overflow-hidden" aria-labelledby={`m-${m.id}`}>
            <h2 id={`m-${m.id}`} className="border-b border-white/[0.06] px-5 py-3.5 text-sm font-semibold">
              <span className="mr-2 text-white/40">Module {i + 1}</span>
              {m.title}
            </h2>
            {m.lessons.length === 0 ? (
              <p className="px-5 py-4 text-sm text-white/45">No lessons published yet.</p>
            ) : (
              <ol className="divide-y divide-white/[0.05]">
                {m.lessons.map((l) => (
                  <li key={l.id}>
                    {l.allowed ? (
                      <Link href={`/classroom/lessons/${l.id}`} className="vip-focus flex items-center gap-3 px-5 py-3 text-sm hover:bg-white/[0.03]">
                        {l.completed ? (
                          <CheckCircle2 className="h-[18px] w-[18px] text-emerald-300" aria-label="Completed" />
                        ) : (
                          <Circle className="h-[18px] w-[18px] text-white/30" aria-label="Not completed" />
                        )}
                        <span className="flex-1">{l.title}</span>
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-3 text-sm text-white/45">
                        <Lock className="h-[18px] w-[18px]" aria-label="Locked" />
                        <span className="flex-1">{l.title}</span>
                        <TierBadge tier={l.minTier} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}
        {modules.length === 0 && <p className="text-sm text-white/45">No modules yet.</p>}
      </div>
    </div>
  )
}
