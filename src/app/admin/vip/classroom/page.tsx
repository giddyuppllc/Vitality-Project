import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { CourseForm } from '@/components/admin/vip/forms'

export const dynamic = 'force-dynamic'

export default async function AdminVipClassroomPage() {
  const courses = await prisma.vipCourse.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { modules: { select: { _count: { select: { lessons: true } } } } },
  })
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-1 font-semibold">Courses</h2>
        <p className="mb-4 text-sm text-white/40">Courses → modules → lessons. Nothing is visible to members until published.</p>
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
                    {c.published ? 'Published' : 'Draft'} · {TIER_BENEFITS[c.minTier].label} and up · {c.modules.length} modules ·{' '}
                    {c.modules.reduce((n, m) => n + m._count.lessons, 0)} lessons
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
      <CourseForm />
    </div>
  )
}
