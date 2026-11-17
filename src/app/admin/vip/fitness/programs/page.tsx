import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { FitnessSubNav, ProgramForm } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

export default async function AdminVipProgramsPage() {
  await requireAdminPage()
  const programs = await prisma.vipProgram.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      weeks: { select: { _count: { select: { days: true } } } },
      enrollments: { select: { status: true } },
    },
  })
  return (
    <div>
      <FitnessSubNav />
      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="mb-1 font-semibold">Programs</h2>
          <p className="mb-4 text-sm text-white/40">Program → weeks → days → workouts → exercises. Nothing is visible to members until published.</p>
          {programs.length === 0 ? (
            <p className="text-sm text-white/40">No programs yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {programs.map((p) => {
                const days = p.weeks.reduce((n, w) => n + w._count.days, 0)
                const active = p.enrollments.filter((e) => e.status === 'ACTIVE').length
                const done = p.enrollments.filter((e) => e.status === 'COMPLETED').length
                return (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/admin/vip/fitness/programs/${p.id}`} className="font-medium hover:underline">{p.title}</Link>
                      <p className="text-xs text-white/40">
                        {p.published ? 'Published' : 'Draft'} · {TIER_BENEFITS[p.minTier].label} and up · {p.weeks.length} weeks · {days} days ·{' '}
                        {active} active · {done} completed
                      </p>
                    </div>
                    <Link href={`/admin/vip/fitness/programs/${p.id}`} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
                      Open builder
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <ProgramForm />
      </div>
    </div>
  )
}
