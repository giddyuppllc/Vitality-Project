import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Award, CheckCircle2, Circle, ClipboardList, Clock, Lock, PlayCircle } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { getCourse } from '@/lib/vip/classroom'
import { pointsBalance } from '@/lib/vip/points'
import { openTrainingInvoice } from '@/lib/vip/training-invoice'
import { getZelleIdentity } from '@/lib/zelle'
import { GLOBAL_LINKS, globalUrl } from '@/lib/vip/links'
import { TierBadge } from '@/components/vip/ui'
import { LEVEL_LABEL, Pill, ProgressRing, minutesLabel } from '@/components/vip/academy-ui'
import { TrainingPurchase } from '@/components/vip/training-purchase'
import { VIP_COPY, tierName } from '@/lib/vip/copy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Course' }

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const viewer = await requireVipPage('member')
  const { slug } = await params
  const data = await getCourse(slug, viewer.userId, viewer.accessTier, { isAdmin: viewer.isAdmin })
  if (!data) notFound()
  const { course, modules, allowed } = data
  const showPurchase = !allowed && data.purchasable
  const [balance, invoice] = showPurchase
    ? await Promise.all([pointsBalance(viewer.userId), data.priceCents ? openTrainingInvoice(viewer.userId, course.id) : null])
    : [0, null]
  const zelle = invoice ? await getZelleIdentity() : null
  const totalMinutes = course.estimatedMinutes ?? (modules.flatMap((m) => m.lessons).reduce((n, l) => n + (l.durationMinutes ?? 0), 0) || null)
  const started = data.doneSteps > 0
  const cta = data.certificate
    ? { href: `/certificate/${data.certificate.code}`, label: 'View certificate', icon: Award }
    : data.resumeLesson && allowed
      ? { href: `/classroom/lessons/${data.resumeLesson.id}`, label: started ? 'Resume' : 'Start course', icon: PlayCircle }
      : null

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={data.track ? `/classroom/paths/${data.track.slug}` : '/classroom'}
        className="vip-focus mb-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg text-sm text-white/65 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {data.track ? data.track.title : 'Academy'}
      </Link>

      <header className="vip-surface-strong p-5 sm:p-7">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              {course.level && <Pill>{LEVEL_LABEL[course.level] ?? course.level}</Pill>}
              {data.granted && <Pill tone="gold">Unlocked</Pill>}
              {!data.purchaseOnly && course.minTier !== 'CLUB' && <TierBadge tier={course.minTier} />}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{course.title}</h1>
            {course.summary && <p className="mt-2 text-white/70">{course.summary}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/60">
              <span>{data.lessonCount} lessons</span>
              {modules.some((m) => m.quiz) && <span>{modules.filter((m) => m.quiz).length} module checks</span>}
              {minutesLabel(totalMinutes) && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {minutesLabel(totalMinutes)}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Award className="h-3.5 w-3.5" aria-hidden="true" /> Certificate
              </span>
            </p>
          </div>
          {allowed && <ProgressRing pct={data.progressPct} size={76} stroke={6} label="Course progress" />}
        </div>
        {cta && (
          <Link href={cta.href} className="vip-focus mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600" data-testid="course-cta">
            <cta.icon className="h-4 w-4" aria-hidden="true" /> {cta.label}
            {data.resumeLesson && !data.certificate && <span className="hidden font-normal text-white/80 sm:inline">· {data.resumeLesson.title}</span>}
          </Link>
        )}
      </header>

      {data.certificate && (
        <div className="vip-surface vip-premium mt-4 flex flex-wrap items-center gap-3 p-4" role="status">
          <Award className="vip-gold h-5 w-5" aria-hidden="true" />
          <span className="flex-1 text-sm">
            Completed {new Date(data.certificate.issuedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}. Your certificate is ready.
          </span>
          <Link href={`/certificate/${data.certificate.code}`} className="vip-focus rounded-lg text-sm font-semibold text-[#ead7a8] hover:text-white">
            Open certificate →
          </Link>
        </div>
      )}

      {!allowed && !data.purchaseOnly && (
        <div className="vip-surface mt-4 flex flex-wrap items-center gap-3 p-4 text-sm">
          <Lock className="h-4 w-4 text-white/60" aria-hidden="true" />
          <span className="flex-1 text-white/75">{VIP_COPY.classroom.lockedLesson(tierName(course.minTier)).replace('This lesson', 'This course')}</span>
          <a href={GLOBAL_LINKS.manageMembership()} className="vip-focus rounded font-semibold text-brand-300 hover:text-brand-200">
            {VIP_COPY.classroom.upgrade} →
          </a>
        </div>
      )}
      {showPurchase && (
        <TrainingPurchase
          courseId={course.id}
          courseTitle={course.title}
          priceCents={data.priceCents}
          pointsPrice={data.pointsPrice}
          balance={balance}
          openInvoice={invoice && zelle ? { orderNumber: invoice.orderNumber, total: invoice.total, zelle } : null}
          globalOrdersUrl={globalUrl('/account/orders')}
        />
      )}

      <section className="mt-6" aria-labelledby="syllabus-h">
        <h2 id="syllabus-h" className="mb-3 text-base font-semibold">Syllabus</h2>
        <div className="space-y-4">
          {modules.filter((m) => m.lessons.length > 0 || m.quiz).map((m, i) => {
            const done = m.lessons.filter((l) => l.completed).length
            return (
              <section key={m.id} className="vip-surface overflow-hidden" aria-labelledby={`m-${m.id}`}>
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
                  <h3 id={`m-${m.id}`} className="text-sm font-semibold">
                    <span className="mr-2 text-white/60">Module {i + 1}</span>
                    {m.title}
                  </h3>
                  {m.lessons.length > 0 && (
                    <span className="shrink-0 text-xs text-white/60">
                      {done}/{m.lessons.length}
                    </span>
                  )}
                </div>
                <ol className="divide-y divide-white/[0.05]">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      {l.allowed ? (
                        <Link href={`/classroom/lessons/${l.id}`} className="vip-focus flex min-h-[48px] items-center gap-3 px-5 py-3 text-sm hover:bg-white/[0.03]">
                          {l.completed ? (
                            <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-300" aria-label="Completed" />
                          ) : (
                            <Circle className="h-[18px] w-[18px] shrink-0 text-white/40" aria-label="Not completed" />
                          )}
                          <span className="flex-1">{l.title}</span>
                          {l.hasVideo && <PlayCircle className="h-4 w-4 shrink-0 text-white/50" aria-label="Video" />}
                          {l.durationMinutes ? <span className="shrink-0 text-xs text-white/60">{l.durationMinutes} min</span> : null}
                        </Link>
                      ) : (
                        <div className="flex min-h-[48px] items-center gap-3 px-5 py-3 text-sm text-white/60">
                          <Lock className="h-[18px] w-[18px] shrink-0" aria-label="Locked" />
                          <span className="flex-1">{l.title}</span>
                          {!data.purchaseOnly && <TierBadge tier={l.minTier} />}
                        </div>
                      )}
                    </li>
                  ))}
                  {m.quiz && (
                    <li>
                      {m.quiz.allowed ? (
                        <Link href={`/classroom/quizzes/${m.quiz.id}`} className="vip-focus flex min-h-[48px] items-center gap-3 bg-white/[0.02] px-5 py-3 text-sm hover:bg-white/[0.04]">
                          {m.quiz.passed ? (
                            <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-300" aria-label="Passed" />
                          ) : (
                            <ClipboardList className="h-[18px] w-[18px] shrink-0 text-brand-300" aria-hidden="true" />
                          )}
                          <span className="flex-1">
                            <span className="font-medium">Module check:</span> {m.quiz.title}
                          </span>
                          <span className="shrink-0 text-xs text-white/60">
                            {m.quiz.passed ? `Passed · ${m.quiz.bestPct}%` : m.quiz.bestPct !== null ? `Best ${m.quiz.bestPct}% · pass ${m.quiz.passPct}%` : `${m.quiz.questionCount} questions`}
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-white/50" aria-hidden="true" />
                        </Link>
                      ) : (
                        <div className="flex min-h-[48px] items-center gap-3 px-5 py-3 text-sm text-white/60">
                          <Lock className="h-[18px] w-[18px] shrink-0" aria-label="Locked" />
                          <span className="flex-1">Module check: {m.quiz.title}</span>
                        </div>
                      )}
                    </li>
                  )}
                </ol>
              </section>
            )
          })}
        </div>
      </section>
      <p className="mt-6 text-xs leading-relaxed text-white/60">{VIP_COPY.classroom.wellnessNote}</p>
    </div>
  )
}
