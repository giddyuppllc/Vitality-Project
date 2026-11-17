import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { PROGRAM_TREE } from '@/lib/vip/fitness/programs'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { DayForm, FitnessSubNav, PrescriptionForm, ProgramForm, WeekForm, WorkoutForm } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/fitness/programs'

function prescriptionLine(p: { sets: number; reps: string | null; durationSec: number | null }) {
  const parts = [`${p.sets} ${p.sets === 1 ? 'set' : 'sets'}`]
  if (p.reps) parts.push(`× ${p.reps}`)
  if (p.durationSec) parts.push(`× ${p.durationSec}s`)
  return parts.join(' ')
}

/** The program builder. */
export default async function AdminVipProgramBuilder({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const [program, exercises, enrollments] = await Promise.all([
    prisma.vipProgram.findUnique({ where: { id }, include: PROGRAM_TREE }),
    prisma.vipExercise.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, published: true } }),
    prisma.vipProgramEnrollment.groupBy({ by: ['status'], where: { programId: id }, _count: { _all: true } }),
  ])
  if (!program) notFound()
  const minTier = program.minTier === 'NONE' ? 'CLUB' : program.minTier
  const count = (s: string) => enrollments.find((e) => e.status === s)?._count._all ?? 0
  const totalDays = program.weeks.reduce((n, w) => n + w.days.length, 0)

  return (
    <div>
      <FitnessSubNav />
      <Link href="/admin/vip/fitness/programs" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All programs
      </Link>
      <div className="grid gap-6 xl:grid-cols-[24rem_1fr]">
        <div className="space-y-3">
          <ProgramForm
            program={{
              id: program.id,
              title: program.title,
              slug: program.slug,
              summary: program.summary,
              description: program.description,
              coverImage: program.coverImage,
              level: program.level,
              minTier,
              published: program.published,
              sortOrder: program.sortOrder,
            }}
          />
          <p className="px-1 text-xs text-white/40">
            {program.weeks.length} weeks · {totalDays} days · {count('ACTIVE')} members active · {count('PAUSED')} paused · {count('COMPLETED')} completed
          </p>
          <AdminActionButton
            endpoint={API}
            tone="danger"
            label="Delete program"
            confirmText="Delete this program permanently, with every week, day and workout, and all member progress on it? Members' logged workouts stay in their history."
            body={{ op: 'program.delete', id: program.id }}
          />
        </div>

        <div className="min-w-0 space-y-4">
          <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4">
            <p className="text-sm text-white/60">Weeks run in order; members move to the next day when they finish the current one.</p>
            <WeekForm programId={program.id} />
          </div>

          {program.weeks.length === 0 && <p className="glass rounded-2xl p-5 text-sm text-white/40">No weeks yet. Add week 1 to start building.</p>}

          {program.weeks.map((w, wi) => (
            <details key={w.id} className="glass group rounded-2xl" open={wi === 0 && program.weeks.length <= 2}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                <span className="font-semibold">
                  Week {w.weekNumber}
                  {w.title && <span className="font-normal text-white/60"> · {w.title}</span>}
                  <span className="ml-2 text-xs font-normal text-white/40">
                    {w.days.length} {w.days.length === 1 ? 'day' : 'days'} · {w.days.filter((d) => d.isRest).length} rest
                  </span>
                </span>
                <span className="text-xs text-white/40 group-open:hidden">Expand</span>
                <span className="hidden text-xs text-white/40 group-open:inline">Collapse</span>
              </summary>
              <div className="space-y-4 border-t border-white/5 p-4">
                {w.notes && <p className="whitespace-pre-line text-sm text-white/60">{w.notes}</p>}
                <div className="flex flex-wrap items-start gap-2">
                  <WeekForm programId={program.id} week={w} />
                  <AdminActionButton endpoint={API} label="Duplicate week" body={{ op: 'week.duplicate', id: w.id }} />
                  <AdminActionButton
                    endpoint={API}
                    tone="danger"
                    label="Delete week"
                    confirmText={`Delete week ${w.weekNumber} with all its days and workouts?`}
                    body={{ op: 'week.delete', id: w.id }}
                  />
                </div>

                {w.days.length === 0 && <p className="text-sm text-white/40">No days in this week yet.</p>}

                {w.days.map((d) => (
                  <section key={d.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-medium">
                        <span className="text-white/40">Day {d.dayNumber} ·</span> {d.title}
                        {d.isRest && <span className="ml-2 rounded bg-emerald-400/15 px-1.5 py-0.5 text-[11px] text-emerald-200">rest day</span>}
                      </h3>
                      <div className="flex flex-wrap items-start gap-2">
                        <DayForm weekId={w.id} day={d} />
                        <AdminActionButton
                          endpoint={API}
                          tone="danger"
                          label="Delete day"
                          confirmText={`Delete day ${d.dayNumber} and its workouts?`}
                          body={{ op: 'day.delete', id: d.id }}
                        />
                      </div>
                    </div>
                    {d.notes && <p className="mt-1 whitespace-pre-line text-sm text-white/55">{d.notes}</p>}

                    {!d.isRest && (
                      <div className="mt-3 space-y-3">
                        {d.workouts.length === 0 && <p className="text-sm text-white/40">No workouts on this day yet.</p>}
                        {d.workouts.map((wo) => (
                          <div key={wo.id} className="rounded-xl bg-white/[0.03] p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-semibold">{wo.title}</p>
                              <div className="flex flex-wrap items-start gap-2">
                                <WorkoutForm dayId={d.id} workout={wo} />
                                <AdminActionButton
                                  endpoint={API}
                                  tone="danger"
                                  label="Delete workout"
                                  confirmText="Delete this workout and its exercises?"
                                  body={{ op: 'workout.delete', id: wo.id }}
                                />
                              </div>
                            </div>
                            {wo.notes && <p className="mt-1 whitespace-pre-line text-xs text-white/55">{wo.notes}</p>}

                            {wo.prescriptions.length === 0 ? (
                              <p className="mt-2 text-xs text-white/40">No exercises yet.</p>
                            ) : (
                              <div className="mt-2 overflow-x-auto">
                                <table className="w-full min-w-[560px] text-sm">
                                  <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wider text-white/40">
                                      <th className="py-1.5 pr-2">#</th>
                                      <th className="py-1.5 pr-2">Exercise</th>
                                      <th className="py-1.5 pr-2">Prescription</th>
                                      <th className="py-1.5 pr-2">Rest</th>
                                      <th className="py-1.5">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5">
                                    {wo.prescriptions.map((p, pi) => (
                                      <tr key={p.id} className="align-top">
                                        <td className="py-2 pr-2 text-white/40">{pi + 1}</td>
                                        <td className="py-2 pr-2">
                                          {p.exercise.name}
                                          {!p.exercise.published && <span className="ml-1 text-[11px] text-amber-200">(unpublished)</span>}
                                          {p.notes && <p className="text-xs text-white/45">{p.notes}</p>}
                                        </td>
                                        <td className="py-2 pr-2 text-white/70">{prescriptionLine(p)}</td>
                                        <td className="py-2 pr-2 text-white/70">{p.restSec != null ? `${p.restSec}s` : '—'}</td>
                                        <td className="py-2">
                                          <div className="flex flex-wrap items-start gap-1">
                                            {pi > 0 && <AdminActionButton endpoint={API} label="↑" body={{ op: 'prescription.move', id: p.id, dir: 'up' }} />}
                                            {pi < wo.prescriptions.length - 1 && (
                                              <AdminActionButton endpoint={API} label="↓" body={{ op: 'prescription.move', id: p.id, dir: 'down' }} />
                                            )}
                                            <AdminActionButton
                                              endpoint={API}
                                              tone="danger"
                                              label="Remove"
                                              confirmText={`Remove ${p.exercise.name} from this workout?`}
                                              body={{ op: 'prescription.delete', id: p.id }}
                                            />
                                            <PrescriptionForm workoutId={wo.id} exercises={exercises} prescription={p} />
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            <div className="mt-2">
                              <PrescriptionForm workoutId={wo.id} exercises={exercises} />
                            </div>
                          </div>
                        ))}
                        <WorkoutForm dayId={d.id} />
                      </div>
                    )}
                  </section>
                ))}
                <DayForm weekId={w.id} />
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
