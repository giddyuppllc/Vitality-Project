import { requireAdminPage } from '@/lib/vip/page-gate'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { formatPrice } from '@/lib/utils'
import { trackCategoryLabel } from '@/lib/vip/tracks'
import { CourseForm } from '@/components/admin/vip/forms'
import { TrackForm } from '@/components/admin/vip/academy-forms'
import { EarningRulesSummary } from '@/components/admin/vip/earning-summary'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

export default async function AdminVipClassroomPage() {
  await requireAdminPage()
  const [courses, tracks, certCount, grantCount] = await Promise.all([
    prisma.vipCourse.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { track: { select: { title: true } }, modules: { select: { _count: { select: { lessons: true } }, quiz: { select: { id: true } } } } },
    }),
    prisma.vipTrack.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { _count: { select: { courses: true } } } }),
    prisma.vipCertificate.count(),
    prisma.vipCourseGrant.count(),
  ])
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-1 font-semibold">Courses</h2>
          <p className="mb-4 text-sm text-white/40">
            Courses → modules → lessons (+ a quiz per module). Nothing is visible to members until published. {certCount} certificates issued ·{' '}
            {grantCount} course grants.
          </p>
          {courses.length === 0 ? (
            <p className="text-sm text-white/40">No courses yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {courses.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/admin/vip/classroom/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <p className="text-xs text-white/40">
                      {c.published ? 'Published' : 'Draft'} · {c.purchaseOnly ? 'Purchase only' : `${TIER_BENEFITS[c.minTier].label} and up`}
                      {c.track && ` · ${c.track.title}`} · {c.modules.length} modules · {c.modules.reduce((n, m) => n + m._count.lessons, 0)} lessons ·{' '}
                      {c.modules.filter((m) => m.quiz).length} quizzes
                      {c.priceCents ? ` · ${formatPrice(c.priceCents)}` : ''}
                      {c.pointsPrice ? ` · ${c.pointsPrice.toLocaleString('en-US')} pts` : ''}
                    </p>
                  </div>
                  <Link href={`/admin/vip/classroom/${c.id}`} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <CourseForm tracks={tracks.map((t) => ({ id: t.id, title: t.title }))} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-1 font-semibold">Learning paths</h2>
          <p className="mb-4 text-sm text-white/40">Group courses into paths (set a course’s path on its page). A path shows to members once it has a published course.</p>
          {tracks.length === 0 ? (
            <p className="text-sm text-white/40">No learning paths yet.</p>
          ) : (
            <ul className="space-y-2">
              {tracks.map((t) => (
                <li key={t.id} className="rounded-xl bg-white/[0.03] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm">
                      <span className="font-medium">{t.title}</span>{' '}
                      <span className="text-xs text-white/40">
                        · {trackCategoryLabel(t.category)} · {t.published ? 'published' : 'draft'} · {t._count.courses} courses
                      </span>
                    </p>
                    <AdminActionButton endpoint="/api/admin/vip/classroom" tone="danger" label="Delete" confirmText="Delete this learning path? Its courses stay." body={{ op: 'track.delete', id: t.id }} />
                  </div>
                  <TrackForm track={t} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <TrackForm />
          </div>
          <EarningRulesSummary groups={['Academy']} title="Academy points" />
        </div>
      </div>
    </div>
  )
}
