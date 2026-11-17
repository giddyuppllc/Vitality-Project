import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { METRIC_LABEL, leaderboard } from '@/lib/vip/fitness/challenges'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'
import { ChallengeForm, FitnessSubNav, ScoreInput } from '@/components/admin/vip/fitness-forms'

export const dynamic = 'force-dynamic'

const API = '/api/admin/vip/fitness/challenges'
const METRICS = (Object.keys(METRIC_LABEL) as (keyof typeof METRIC_LABEL)[]).map((m) => ({ value: m, label: METRIC_LABEL[m].name }))

export default async function AdminVipChallengeEditor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage()
  const { id } = await params
  const challenge = await prisma.vipChallenge.findUnique({ where: { id }, include: { _count: { select: { participants: true } } } })
  if (!challenge) notFound()
  const rows = await leaderboard(id, { all: true })
  const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, email: true } })
  const emailOf = new Map(users.map((u) => [u.id, u.email]))
  const minTier = challenge.minTier === 'NONE' ? 'CLUB' : challenge.minTier
  const custom = challenge.metric === 'CUSTOM_POINTS'
  const unit = METRIC_LABEL[challenge.metric].unit

  return (
    <div>
      <FitnessSubNav />
      <Link href="/admin/vip/fitness/challenges" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All challenges
      </Link>
      <div className="grid gap-6 xl:grid-cols-[28rem_1fr]">
        <div className="space-y-3">
          <ChallengeForm
            metrics={METRICS}
            metricLocked={challenge._count.participants > 0}
            challenge={{
              id: challenge.id,
              title: challenge.title,
              slug: challenge.slug,
              description: challenge.description,
              coverImage: challenge.coverImage,
              metric: challenge.metric,
              target: challenge.target,
              startDate: challenge.startDate,
              endDate: challenge.endDate,
              minTier,
              pointsReward: challenge.pointsReward,
              badgeLabel: challenge.badgeLabel,
              published: challenge.published,
            }}
          />
          <div className="flex flex-wrap gap-2">
            <AdminActionButton endpoint={API} tone="primary" label="Re-check completions" body={{ op: 'challenge.evaluate', id: challenge.id }} />
            <AdminActionButton
              endpoint={API}
              tone="danger"
              label="Delete challenge"
              confirmText="Delete this challenge and its participant list? Badges and points already earned stay with the members."
              body={{ op: 'challenge.delete', id: challenge.id }}
            />
          </div>
        </div>

        <section className="glass min-w-0 rounded-2xl p-5">
          <h2 className="mb-1 font-semibold">
            Leaderboard <span className="text-white/40">({rows.length})</span>
          </h2>
          <p className="mb-4 text-sm text-white/40">
            Everyone who joined, including members who hide themselves from leaderboards (tagged) — members never see them.
            {custom && ' Enter each member’s score; reaching the target completes the challenge.'}
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-white/40">No one has joined yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
                    <th className="px-2 py-2">Rank</th>
                    <th className="px-2 py-2">Member</th>
                    <th className="px-2 py-2">Score</th>
                    <th className="px-2 py-2">Status</th>
                    {custom && <th className="px-2 py-2">Set score</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((r) => (
                    <tr key={r.userId} className="align-top">
                      <td className="px-2 py-2 text-white/60">{r.rank}</td>
                      <td className="px-2 py-2">
                        {r.name}
                        {r.hidden && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-white/60">hidden from members</span>}
                        <p className="text-xs text-white/40">{emailOf.get(r.userId)}</p>
                      </td>
                      <td className="px-2 py-2">
                        {r.score.toLocaleString('en-US')} <span className="text-xs text-white/40">/ {challenge.target.toLocaleString('en-US')} {unit(challenge.target)}</span>
                      </td>
                      <td className="px-2 py-2">
                        {r.completed ? <span className="text-emerald-300">Completed</span> : <span className="text-white/50">In progress</span>}
                      </td>
                      {custom && (
                        <td className="px-2 py-2">
                          <ScoreInput challengeId={challenge.id} userId={r.userId} score={r.score} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
