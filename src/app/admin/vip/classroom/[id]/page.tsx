import { requireAdminPage } from '@/lib/vip/page-gate'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { formatDate } from '@/lib/utils'
import { quizOptions } from '@/lib/vip/academy'
import { CourseForm, LessonForm, ModuleForm } from '@/components/admin/vip/forms'
import { GrantForm, QuestionForm, QuizSettingsForm, ResourceAddForm } from '@/components/admin/vip/academy-forms'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

const C = '/api/admin/vip/classroom'

export default async function AdminVipCourseEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const [course, tracks] = await Promise.all([
    prisma.vipCourse.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            lessons: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              include: { resources: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { file: { select: { fileName: true, sizeBytes: true } } } } },
            },
            quiz: { include: { questions: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }, _count: { select: { attempts: true } } } },
          },
        },
      },
    }),
    prisma.vipTrack.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, title: true } }),
  ])
  if (!course) notFound()
  const minTier = course.minTier === 'NONE' ? 'CLUB' : course.minTier
  const grants = await prisma.vipCourseGrant.findMany({ where: { courseId: course.id }, orderBy: { createdAt: 'desc' }, take: 200 })
  const grantUsers = new Map(
    (await prisma.user.findMany({ where: { id: { in: grants.map((g) => g.userId) } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]),
  )

  return (
    <div className="space-y-6">
      <Link href="/admin/vip/classroom" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <div className="space-y-3">
          <CourseForm course={{ ...course, minTier }} tracks={tracks} />
          <div className="glass space-y-3 rounded-2xl p-5">
            <h2 className="font-semibold">Members with access by grant</h2>
            <p className="text-sm text-white/45">Bought with points or Zelle, or granted here. A grant opens the course regardless of level.</p>
            <GrantForm courseId={course.id} />
            {grants.length > 0 && (
              <ul className="divide-y divide-white/5 text-sm">
                {grants.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate">
                      {grantUsers.get(g.userId) ?? g.userId} <span className="text-xs text-white/40">· {g.source} · {formatDate(g.createdAt)}</span>
                    </span>
                    <AdminActionButton endpoint={C} tone="danger" label="Revoke" confirmText="Remove this member’s access?" body={{ op: 'grant.revoke', courseId: course.id, userId: g.userId }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <AdminActionButton
            endpoint={C}
            tone="danger"
            label="Delete course (and all its modules + lessons)"
            confirmText="Delete this course permanently, with all modules, lessons and member progress?"
            body={{ op: 'course.delete', id: course.id }}
          />
        </div>
        <div className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <ModuleForm courseId={course.id} />
          </div>
          {course.modules.map((m, i) => (
            <section key={m.id} className="glass space-y-4 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                  <span className="text-white/40">Module {i + 1} ·</span> {m.title}
                </h3>
                <AdminActionButton endpoint={C} tone="danger" label="Delete module" confirmText="Delete this module and its lessons?" body={{ op: 'module.delete', id: m.id }} />
              </div>
              <ModuleForm courseId={course.id} module={m} />
              <ul className="space-y-2">
                {m.lessons.map((l) => (
                  <li key={l.id} className="rounded-xl bg-white/[0.03] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm">
                        {l.title}{' '}
                        <span className="text-xs text-white/40">
                          · {l.published ? 'published' : 'draft'}
                          {l.minTier && ` · ${TIER_BENEFITS[l.minTier].label} and up`}
                          {l.resources.length > 0 && ` · ${l.resources.length} resources`}
                        </span>
                      </p>
                      <AdminActionButton endpoint={C} tone="danger" label="Delete" confirmText="Delete this lesson?" body={{ op: 'lesson.delete', id: l.id }} />
                    </div>
                    <LessonForm moduleId={m.id} lesson={{ ...l, minTier: l.minTier === 'NONE' ? null : l.minTier }} />
                    {l.resources.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {l.resources.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-3 py-1.5 text-xs">
                            <span className="min-w-0 truncate">
                              {r.title} <span className="text-white/40">· {r.kind === 'FILE' ? r.file?.fileName : r.url}</span>
                            </span>
                            <AdminActionButton endpoint={C} tone="danger" label="Remove" body={{ op: 'resource.delete', id: r.id }} />
                          </li>
                        ))}
                      </ul>
                    )}
                    <ResourceAddForm lessonId={l.id} />
                  </li>
                ))}
              </ul>
              <LessonForm moduleId={m.id} />

              <div className="rounded-xl border border-white/10 p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold">
                    Module quiz{' '}
                    {m.quiz && (
                      <span className="text-xs font-normal text-white/40">
                        · {m.quiz.published ? 'published' : 'draft'} · {m.quiz.questions.length} questions · {m.quiz._count.attempts} attempts
                      </span>
                    )}
                  </h4>
                  {m.quiz && <AdminActionButton endpoint={C} tone="danger" label="Delete quiz" confirmText="Delete this quiz and its attempts?" body={{ op: 'quiz.delete', id: m.quiz.id }} />}
                </div>
                <QuizSettingsForm moduleId={m.id} quiz={m.quiz} />
                {m.quiz && (
                  <div className="mt-3 space-y-2">
                    {m.quiz.questions.map((q, qi) => (
                      <div key={q.id} className="rounded-lg bg-white/[0.03] p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p>
                            <span className="text-white/40">{qi + 1}.</span> {q.prompt}{' '}
                            <span className="text-xs text-emerald-300">✓ {quizOptions(q.options)[q.correctIndex]}</span>
                          </p>
                          <AdminActionButton endpoint={C} tone="danger" label="Delete" body={{ op: 'question.delete', id: q.id }} />
                        </div>
                        <QuestionForm
                          quizId={m.quiz!.id}
                          question={{ id: q.id, prompt: q.prompt, options: quizOptions(q.options), correctIndex: q.correctIndex, explanation: q.explanation, sortOrder: q.sortOrder }}
                        />
                      </div>
                    ))}
                    <QuestionForm quizId={m.quiz.id} />
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
