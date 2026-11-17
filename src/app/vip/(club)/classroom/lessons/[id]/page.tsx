import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, ClipboardList, Download, ExternalLink, FileText, Lock, PlayCircle } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getCourse, getLesson, recordResume } from '@/lib/vip/classroom'
import { renderLessonMarkdown, videoEmbed } from '@/lib/vip/text'
import { formatBytes } from '@/lib/vip/files'
import { TierBadge } from '@/components/vip/ui'
import { LessonCompleteButton } from '@/components/vip/lesson-complete'
import { LessonNotes } from '@/components/vip/lesson-notes'
import { ProgressRing } from '@/components/vip/academy-ui'
import { GLOBAL_LINKS } from '@/lib/vip/links'
import { VIP_COPY, tierName } from '@/lib/vip/copy'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Lesson' }

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireVipPage('member')
  const { id } = await params
  const opts = { isAdmin: viewer.isAdmin }
  const data = await getLesson(id, viewer.userId, viewer.accessTier, opts)
  if (!data) notFound()
  const { lesson, allowed, minTier, completed, prev, next, position, resources, note, moduleQuiz } = data
  const course = lesson.module.course
  const [outline] = await Promise.all([
    getCourse(course.slug, viewer.userId, viewer.accessTier, opts),
    allowed ? recordResume(viewer.userId, course.id, lesson.id) : null,
  ])
  const video = allowed ? videoEmbed(lesson.videoUrl) : null

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0">
        <Link href={`/classroom/${course.slug}`} className="vip-focus mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {course.title}
        </Link>

        {video?.kind === 'iframe' && (
          <div className="mb-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/40">
            <iframe
              src={video.src}
              title={`Video: ${lesson.title}`}
              className="h-full w-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              loading="lazy"
            />
          </div>
        )}

        <article className="vip-surface-strong p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
            {lesson.module.title}
            {position && <span className="ml-2">· Lesson {position.index} of {position.total}</span>}
            {lesson.durationMinutes ? <span className="ml-2">· {lesson.durationMinutes} min</span> : null}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{lesson.title}</h1>

          {!allowed ? (
            // The body, video, resources and notes are NOT sent to members who can't open the lesson.
            <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-4 text-sm text-white/75">
              <Lock className="h-4 w-4" aria-hidden="true" />
              {course.purchaseOnly ? (
                <>
                  <span>This lesson is part of a training you can unlock.</span>
                  <Link href={`/classroom/${course.slug}`} className="font-semibold text-brand-300 hover:text-brand-200">
                    See how to unlock it →
                  </Link>
                </>
              ) : (
                <>
                  <TierBadge tier={minTier} />
                  <span>{VIP_COPY.classroom.lockedLesson(tierName(minTier))}</span>
                  <a href={GLOBAL_LINKS.manageMembership()} className="font-semibold text-brand-300 hover:text-brand-200">
                    {VIP_COPY.classroom.upgrade} →
                  </a>
                </>
              )}
            </div>
          ) : (
            <>
              {video?.kind === 'link' && (
                <a href={video.href} target="_blank" rel="noopener noreferrer" className="vip-focus mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06]">
                  <PlayCircle className="h-4 w-4 text-brand-300" aria-hidden="true" /> Watch the video
                </a>
              )}
              <div className="vip-prose mt-5" dangerouslySetInnerHTML={{ __html: renderLessonMarkdown(lesson.body) }} />

              {resources.length > 0 && (
                <section className="mt-7" aria-labelledby="res-h">
                  <h2 id="res-h" className="text-sm font-semibold">Resources</h2>
                  <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {resources.map((r) => (
                      <li key={r.id}>
                        <a
                          href={r.kind === 'FILE' ? `${r.href}?download=1` : r.href!}
                          {...(r.kind === 'LINK' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          className="vip-focus flex min-h-[56px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 hover:bg-white/[0.06]"
                        >
                          {r.kind === 'FILE' ? <FileText className="h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" /> : <ExternalLink className="h-5 w-5 shrink-0 text-brand-300" aria-hidden="true" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.title}</span>
                            <span className="block truncate text-xs text-white/60">
                              {r.kind === 'FILE' ? [r.fileName, r.sizeBytes ? formatBytes(r.sizeBytes) : null].filter(Boolean).join(' · ') : 'Opens in a new tab'}
                            </span>
                          </span>
                          {r.kind === 'FILE' && <Download className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-8 flex flex-wrap items-start justify-between gap-3 border-t border-white/[0.07] pt-5">
                <LessonCompleteButton lessonId={lesson.id} initial={completed} />
                {moduleQuiz ? (
                  <Link href={`/classroom/quizzes/${moduleQuiz.id}`} className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 px-3.5 text-sm font-medium hover:bg-white/[0.06]">
                    <ClipboardList className="h-4 w-4 text-brand-300" aria-hidden="true" /> Module check <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  next && (
                    <Link href={`/classroom/lessons/${next.id}`} className="vip-focus inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-xl border border-white/15 px-3.5 text-sm font-medium hover:bg-white/[0.06]">
                      <span className="truncate">Next: {next.title}</span> <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </Link>
                  )
                )}
              </div>
            </>
          )}
        </article>

        {allowed && <LessonNotes lessonId={lesson.id} initial={note?.body ?? ''} updatedAt={note?.updatedAt ?? null} />}

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          {prev ? (
            <Link href={`/classroom/lessons/${prev.id}`} className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Previous: {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {moduleQuiz && next && (
            <Link href={`/classroom/lessons/${next.id}`} className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white">
              Next: {next.title} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
        <p className="mt-6 text-xs leading-relaxed text-white/60">{VIP_COPY.classroom.wellnessNote}</p>
      </div>

      {/* Course outline (desktop) */}
      {outline && (
        <aside className="hidden lg:block" aria-label="Course outline">
          <div className="vip-surface sticky top-[5.25rem] max-h-[calc(100vh-7rem)] overflow-y-auto p-4">
            <div className="flex items-center gap-3">
              <ProgressRing pct={outline.progressPct} size={44} stroke={4} label="Course progress" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{course.title}</p>
                <p className="text-xs text-white/60">
                  {outline.doneSteps}/{outline.totalSteps} steps
                </p>
              </div>
            </div>
            <ol className="mt-4 space-y-4">
              {outline.modules.filter((m) => m.lessons.length > 0 || m.quiz).map((m) => (
                <li key={m.id}>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">{m.title}</p>
                  <ol className="mt-1 space-y-0.5">
                    {m.lessons.map((l) => (
                      <li key={l.id}>
                        {l.allowed ? (
                          <Link
                            href={`/classroom/lessons/${l.id}`}
                            aria-current={l.id === lesson.id ? 'page' : undefined}
                            className={cn('vip-focus flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]', l.id === lesson.id ? 'bg-brand-500/15 text-white' : 'text-white/70 hover:bg-white/[0.04] hover:text-white')}
                          >
                            {l.completed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="Completed" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-white/40" aria-label="Not completed" />}
                            <span className="truncate">{l.title}</span>
                          </Link>
                        ) : (
                          <span className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-white/60">
                            <Lock className="h-3.5 w-3.5 shrink-0" aria-label="Locked" />
                            <span className="truncate">{l.title}</span>
                          </span>
                        )}
                      </li>
                    ))}
                    {m.quiz && m.quiz.allowed && (
                      <li>
                        <Link href={`/classroom/quizzes/${m.quiz.id}`} className="vip-focus flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-white/70 hover:bg-white/[0.04] hover:text-white">
                          {m.quiz.passed ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-label="Passed" /> : <ClipboardList className="h-3.5 w-3.5 shrink-0 text-brand-300" aria-hidden="true" />}
                          <span className="truncate">Module check</span>
                        </Link>
                      </li>
                    )}
                  </ol>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      )}
    </div>
  )
}
