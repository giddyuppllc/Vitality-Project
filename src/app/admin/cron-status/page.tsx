import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Each cron writes a CronRun row when it finishes (success or failure). This
// page surfaces the last run + outcome for each known job so admin can spot
// stalls without SSHing to Hetzner. Expected schedule comes from the
// crontab — if "last run" is older than the threshold, the job is stalled.
const JOBS: Array<{
  name: string
  endpoint: string
  scheduleHuman: string
  maxAgeMinutes: number
}> = [
  {
    name: 'Abandoned carts',
    endpoint: '/api/cron/abandoned-carts',
    scheduleHuman: 'Every 30 min',
    maxAgeMinutes: 60,
  },
  {
    name: 'Stale Zelle nudge',
    endpoint: '/api/cron/stale-zelle-orders',
    scheduleHuman: 'Hourly',
    maxAgeMinutes: 90,
  },
  {
    name: 'Payment reminders',
    endpoint: '/api/cron/payment-reminders',
    scheduleHuman: 'Every 6 hrs',
    maxAgeMinutes: 7 * 60,
  },
  {
    name: 'Membership reminders',
    endpoint: '/api/cron/membership-reminders',
    scheduleHuman: 'Daily 14:00 UTC',
    maxAgeMinutes: 26 * 60,
  },
  {
    name: 'Membership monthly renewals',
    endpoint: '/api/cron/membership-monthly',
    scheduleHuman: 'Daily 13:30 UTC',
    maxAgeMinutes: 26 * 60,
  },
  {
    // Not in the box's crontab until the clubhouse deploys — see
    // docs/VIP_CLUBHOUSE.md. Grants nothing while every tier is $0.
    name: 'VIP member rewards',
    endpoint: '/api/cron/vip-member-rewards',
    scheduleHuman: 'Daily',
    maxAgeMinutes: 26 * 60,
  },
]

export default async function AdminCronStatusPage() {
  const recent = await prisma.cronRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 200,
  })

  const lastByJob = new Map<string, (typeof recent)[number]>()
  for (const r of recent) {
    if (!lastByJob.has(r.job)) lastByJob.set(r.job, r)
  }

  const now = Date.now()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5" /> Cron Status
          </h1>
          <p className="text-white/40 mt-1">
            Last run + outcome per scheduled job. Recorded by each cron endpoint when it finishes.
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Job</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Schedule</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Last run</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Duration</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {JOBS.map((job) => {
              const run = lastByJob.get(job.name)
              const ageMinutes = run
                ? (now - new Date(run.startedAt).getTime()) / 60000
                : Infinity
              const stalled = ageMinutes > job.maxAgeMinutes
              const failed = run?.status === 'FAILED'
              return (
                <tr key={job.name} className="hover:bg-white/2">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium">{job.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      <code>{job.endpoint}</code>
                    </p>
                  </td>
                  <td className="px-5 py-3 text-sm text-white/60">{job.scheduleHuman}</td>
                  <td className="px-5 py-3 text-sm text-white/60">
                    {run ? (
                      <>
                        {formatDate(run.startedAt)}
                        <span className="text-xs text-white/30 ml-1">
                          ({Math.round(ageMinutes)} min ago)
                        </span>
                      </>
                    ) : (
                      <span className="text-white/30">never</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-sm text-white/60">
                    {run?.durationMs != null ? `${run.durationMs}ms` : '—'}
                  </td>
                  <td className="px-5 py-3">
                    {!run ? (
                      <Badge variant="warning">
                        <AlertTriangle className="w-3 h-3 mr-1" /> No data
                      </Badge>
                    ) : failed ? (
                      <Badge variant="danger">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Failed
                      </Badge>
                    ) : stalled ? (
                      <Badge variant="warning">
                        <Clock className="w-3 h-3 mr-1" /> Stalled
                      </Badge>
                    ) : (
                      <Badge variant="success">
                        <CheckCircle className="w-3 h-3 mr-1" /> Healthy
                      </Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-white/50 max-w-xs truncate" title={run?.result ?? ''}>
                    {run?.result ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <h2 className="text-lg font-semibold mb-3">Recent runs ({recent.length})</h2>
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">Job</th>
              <th className="px-5 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">Started</th>
              <th className="px-5 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">Duration</th>
              <th className="px-5 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">Status</th>
              <th className="px-5 py-2 text-xs font-medium text-white/40 uppercase tracking-wider">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-white/40">
                  No cron runs recorded yet. The first cron tick will populate this table.
                </td>
              </tr>
            ) : (
              recent.slice(0, 60).map((r) => (
                <tr key={r.id} className="hover:bg-white/2">
                  <td className="px-5 py-2 text-sm">{r.job}</td>
                  <td className="px-5 py-2 text-xs text-white/50">{formatDate(r.startedAt)}</td>
                  <td className="px-5 py-2 text-xs text-white/50">
                    {r.durationMs != null ? `${r.durationMs}ms` : '—'}
                  </td>
                  <td className="px-5 py-2">
                    <Badge variant={r.status === 'OK' ? 'success' : 'danger'}>{r.status}</Badge>
                  </td>
                  <td className="px-5 py-2 text-xs text-white/50 max-w-md truncate" title={r.result ?? ''}>
                    {r.result ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
