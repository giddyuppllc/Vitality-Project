import Link from 'next/link'
import { ArrowRight, Award, PlayCircle, Route } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { continueLearning, listCourses } from '@/lib/vip/classroom'
import { listTracks, trackCategoryLabel } from '@/lib/vip/tracks'
import { prisma } from '@/lib/prisma'
import { EmptyState, PageHeader } from '@/components/vip/ui'
import { Bar, Pill, SectionHead } from '@/components/vip/academy-ui'
import { CourseTile } from '@/components/vip/course-card'
import { VIP_COPY } from '@/lib/vip/copy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Academy' }

/**
 * The Academy (was "Classroom"): learning paths, every course, resume and
 * certificates. URL stays /classroom so existing links keep working.
 */
export default async function AcademyPage() {
  const viewer = await requireVipPage('member')
  const opts = { isAdmin: viewer.isAdmin }
  const [courses, resume, certs] = await Promise.all([
    listCourses(viewer.userId, viewer.accessTier, opts),
    continueLearning(viewer.userId, viewer.accessTier, { ...opts, take: 2 }),
    prisma.vipCertificate.findMany({ where: { userId: viewer.userId }, orderBy: { issuedAt: 'desc' }, select: { code: true, courseTitle: true, issuedAt: true } }),
  ])
  const tracks = await listTracks(courses)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Academy" intro="Learning paths, short lessons and a certificate for every course you finish. Your progress saves as you go." />

      {courses.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.classroom.title}>{VIP_COPY.empty.classroom.body}</EmptyState>
      ) : (
        <div className="space-y-10">
          {resume.length > 0 && (
            <section aria-labelledby="resume-h">
              <SectionHead id="resume-h" title="Pick up where you left off" />
              <ul className="grid gap-3 sm:grid-cols-2">
                {resume.map((r) => (
                  <li key={r.courseSlug}>
                    <Link href={`/classroom/lessons/${r.lessonId}`} className="vip-focus vip-surface-strong flex items-center gap-4 p-4 hover:bg-white/[0.05]">
                      <PlayCircle className="h-8 w-8 shrink-0 text-brand-300" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold uppercase tracking-wider text-white/60">{r.courseTitle}</span>
                        <span className="block truncate font-semibold">{r.lessonTitle}</span>
                        <Bar pct={r.total ? (r.done / r.total) * 100 : 0} label={`${r.courseTitle} progress`} className="mt-2" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {tracks.length > 0 && (
            <section aria-labelledby="paths-h">
              <SectionHead id="paths-h" title="Learning paths" />
              <ul className="grid gap-3 md:grid-cols-2">
                {tracks.map((t) => {
                  const pct = t.lessonCount ? (t.completedCount / t.lessonCount) * 100 : 0
                  return (
                    <li key={t.id}>
                      <Link href={`/classroom/paths/${t.slug}`} className="vip-focus vip-surface group flex h-full flex-col p-5 hover:bg-white/[0.04]" data-testid={`path-${t.slug}`}>
                        <div className="flex items-center justify-between gap-2">
                          <Pill tone={t.category === 'RESEARCH' ? 'gold' : 'blue'}>
                            <Route className="h-3 w-3" aria-hidden="true" /> {trackCategoryLabel(t.category)}
                          </Pill>
                          <span className="text-xs text-white/60">
                            {t.courses.length} {t.courses.length === 1 ? 'course' : 'courses'}
                          </span>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{t.title}</h3>
                        {t.summary && <p className="mt-1 line-clamp-2 text-sm text-white/65">{t.summary}</p>}
                        <div className="mt-auto pt-4">
                          <Bar pct={pct} label={`${t.title} progress`} />
                          <p className="mt-1.5 flex items-center justify-between text-xs text-white/60">
                            <span>
                              {t.completedCount}/{t.lessonCount} lessons
                              {t.certificates > 0 && ` · ${t.certificates} certificate${t.certificates === 1 ? '' : 's'}`}
                            </span>
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                          </p>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby="courses-h">
            <SectionHead id="courses-h" title="All courses" />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c, i) => (
                <li key={c.id}>
                  <CourseTile c={c} index={i} />
                </li>
              ))}
            </ul>
          </section>

          <section id="certificates" aria-labelledby="certs-h" className="scroll-mt-24">
            <SectionHead id="certs-h" title="Your certificates" />
            {certs.length === 0 ? (
              <p className="vip-surface p-5 text-sm text-white/65">Finish every lesson and module check in a course and its certificate appears here.</p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {certs.map((c) => (
                  <li key={c.code}>
                    <Link href={`/certificate/${c.code}`} className="vip-focus vip-surface vip-premium flex items-center gap-4 p-4 hover:bg-white/[0.04]">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#d4b26a]/15" aria-hidden="true">
                        <Award className="vip-gold h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{c.courseTitle}</span>
                        <span className="block text-xs text-white/60">
                          {c.issuedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })} · {c.code}
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/60" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      <p className="mt-8 text-xs leading-relaxed text-white/60">{VIP_COPY.classroom.wellnessNote}</p>
    </div>
  )
}
