import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Route } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listCourses } from '@/lib/vip/classroom'
import { listTracks, trackCategoryLabel } from '@/lib/vip/tracks'
import { Pill, ProgressRing } from '@/components/vip/academy-ui'
import { CourseTile } from '@/components/vip/course-card'
import { VIP_COPY } from '@/lib/vip/copy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Learning path' }

export default async function LearningPathPage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const courses = await listCourses(viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin })
  const track = (await listTracks(courses)).find((t) => t.slug === slug)
  if (!track) notFound()
  const pct = track.lessonCount ? (track.completedCount / track.lessonCount) * 100 : 0

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/classroom" className="vip-focus mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Academy
      </Link>
      <header className="vip-surface-strong flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <div className="min-w-0 flex-1">
          <Pill tone={track.category === 'RESEARCH' ? 'gold' : 'blue'}>
            <Route className="h-3 w-3" aria-hidden="true" /> {trackCategoryLabel(track.category)} path
          </Pill>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{track.title}</h1>
          {track.summary && <p className="mt-2 max-w-2xl text-white/70">{track.summary}</p>}
          <p className="mt-3 text-sm text-white/60">
            {track.courses.length} {track.courses.length === 1 ? 'course' : 'courses'} · {track.lessonCount} lessons · take them in order or jump in anywhere
          </p>
        </div>
        <ProgressRing pct={pct} size={84} stroke={7} label={`${track.title} progress`} />
      </header>

      <ol className="mt-6 space-y-4">
        {track.courses.map((c, i) => (
          <li key={c.id} className="flex gap-4">
            <div className="hidden flex-col items-center sm:flex" aria-hidden="true">
              <span className={c.certificateCode ? 'grid h-9 w-9 place-items-center rounded-full bg-emerald-300/15 text-sm font-bold text-emerald-200' : 'grid h-9 w-9 place-items-center rounded-full border border-white/15 text-sm font-bold text-white/70'}>
                {i + 1}
              </span>
              {i < track.courses.length - 1 && <span className="mt-1 w-px flex-1 bg-white/10" />}
            </div>
            <div className="min-w-0 flex-1">
              <CourseTile c={c} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-xs leading-relaxed text-white/60">{VIP_COPY.classroom.wellnessNote}</p>
    </div>
  )
}
