import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Lock } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getLesson } from '@/lib/vip/classroom'
import { renderLessonMarkdown, videoEmbed } from '@/lib/vip/text'
import { TierBadge } from '@/components/vip/ui'
import { LessonCompleteButton } from '@/components/vip/lesson-complete'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lesson' }

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('member')
  const { id } = await params
  const data = await getLesson(id, viewer.userId, viewer.accessTier)
  if (!data) notFound()
  const { lesson, allowed, minTier, completed } = data
  const course = lesson.module.course

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/classroom/${course.slug}`} className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {course.title}
      </Link>
      <article className="vip-surface-strong p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">{lesson.module.title}</p>
        <h1 className="mt-1 text-2xl font-bold">{lesson.title}</h1>

        {!allowed ? (
          // The body and video are NOT sent to members below the tier.
          <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-white/70">
            <Lock className="h-4 w-4" aria-hidden="true" /> This lesson requires <TierBadge tier={minTier} /> or higher.
          </div>
        ) : (
          <>
            {(() => {
              const v = videoEmbed(lesson.videoUrl)
              if (!v) return null
              if (v.kind === 'iframe') {
                return (
                  <div className="mt-5 aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
                    <iframe
                      src={v.src}
                      title={`Video: ${lesson.title}`}
                      className="h-full w-full"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      referrerPolicy="strict-origin-when-cross-origin"
                      loading="lazy"
                    />
                  </div>
                )
              }
              return (
                <a href={v.href} target="_blank" rel="noopener noreferrer" className="mt-5 inline-block text-sm font-semibold text-brand-300 hover:text-brand-200">
                  Watch the video →
                </a>
              )
            })()}
            <div className="vip-prose mt-5" dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(lesson.body) }} />
            <div className="mt-8 border-t border-white/[0.07] pt-5">
              <LessonCompleteButton lessonId={lesson.id} initial={completed} />
            </div>
          </>
        )}
      </article>
    </div>
  )
}
