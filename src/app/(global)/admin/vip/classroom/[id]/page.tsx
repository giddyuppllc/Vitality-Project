import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { CourseForm, LessonForm, ModuleForm } from '@/components/admin/vip/forms'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

const C = '/api/admin/vip/classroom'

export default async function AdminVipCourseEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const course = await prisma.vipCourse.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { lessons: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
      },
    },
  })
  if (!course) notFound()
  const minTier = course.minTier === 'NONE' ? 'CLUB' : course.minTier

  return (
    <div className="space-y-6">
      <Link href="/admin/vip/classroom" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All courses
      </Link>
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <div className="space-y-3">
          <CourseForm course={{ ...course, minTier }} />
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
                <AdminActionButton
                  endpoint={C}
                  tone="danger"
                  label="Delete module"
                  confirmText="Delete this module and its lessons?"
                  body={{ op: 'module.delete', id: m.id }}
                />
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
                        </span>
                      </p>
                      <AdminActionButton
                        endpoint={C}
                        tone="danger"
                        label="Delete"
                        confirmText="Delete this lesson?"
                        body={{ op: 'lesson.delete', id: l.id }}
                      />
                    </div>
                    <LessonForm
                      moduleId={m.id}
                      lesson={{ ...l, minTier: l.minTier === 'NONE' ? null : l.minTier }}
                    />
                  </li>
                ))}
              </ul>
              <LessonForm moduleId={m.id} />
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
