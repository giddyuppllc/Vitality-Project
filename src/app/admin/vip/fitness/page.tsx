import Link from 'next/link'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { FitnessSubNav } from '@/components/admin/vip/fitness-forms'
import { EarningRulesSummary } from '@/components/admin/vip/earning-summary'

export const dynamic = 'force-dynamic'

/** Fitness, health & lifestyle — overview + the points it pays (edited under Rewards → Earning rules). */
export default async function AdminVipFitnessPage() {
  await requireAdminPage()
  const weekAgo = new Date(Date.now() - 7 * 86400e3)
  const [exercises, programs, enrollments, challenges, articles, workouts, checkins] = await Promise.all([
    prisma.vipExercise.count(),
    prisma.vipProgram.count(),
    prisma.vipProgramEnrollment.count({ where: { status: 'ACTIVE' } }),
    prisma.vipChallenge.count(),
    prisma.vipArticle.count(),
    prisma.vipWorkoutLog.count({ where: { finishedAt: { gte: weekAgo } } }),
    prisma.vipCheckin.count({ where: { createdAt: { gte: weekAgo } } }),
  ])
  const stats = [
    { label: 'Exercises', value: exercises, href: '/admin/vip/fitness/exercises' },
    { label: 'Programs', value: programs, href: '/admin/vip/fitness/programs' },
    { label: 'Members on a program', value: enrollments, href: '/admin/vip/fitness/programs' },
    { label: 'Challenges', value: challenges, href: '/admin/vip/fitness/challenges' },
    { label: 'Lifestyle articles', value: articles, href: '/admin/vip/fitness/articles' },
    { label: 'Workouts logged (7 days)', value: workouts },
    { label: 'Check-ins (7 days)', value: checkins },
  ]
  return (
    <div>
      <FitnessSubNav />
      <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
        <section className="space-y-4">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => {
              const inner = (
                <>
                  <p className="text-2xl font-bold">{s.value.toLocaleString('en-US')}</p>
                  <p className="mt-0.5 text-xs text-white/50">{s.label}</p>
                </>
              )
              return (
                <li key={s.label}>
                  {s.href ? (
                    <Link href={s.href} className="glass block rounded-2xl p-4 hover:bg-white/[0.06]">{inner}</Link>
                  ) : (
                    <div className="glass rounded-2xl p-4">{inner}</div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="glass rounded-2xl p-5 text-sm leading-relaxed text-white/60">
            <h2 className="mb-2 font-semibold text-white">How it fits together</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong className="text-white/80">Exercises</strong> are the library every program and every member&apos;s workout log draws from.</li>
              <li><strong className="text-white/80">Programs</strong> are built week → day → workout → exercises, gated by tier like courses. Members progress day by day.</li>
              <li><strong className="text-white/80">Challenges</strong> run between two dates and count workouts, steps, check-in streaks, or scores you enter.</li>
              <li><strong className="text-white/80">Lifestyle</strong> holds nutrition, recovery, sleep, mindset and recipe guides.</li>
              <li>Members&apos; check-ins, body metrics and progress photos are private to them and are not shown here.</li>
            </ul>
          </div>
        </section>
        <EarningRulesSummary groups={['Fitness']} title="Fitness points" />
      </div>
    </div>
  )
}
