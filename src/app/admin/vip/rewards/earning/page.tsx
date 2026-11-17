import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { EARNING_RULES, formatBps, getEarningRules, purchaseRateBps } from '@/lib/vip/earning'
import { runPointsExpiry } from '@/lib/vip/points-expiry'
import { EarningRulesForm, type RuleField } from '@/components/admin/vip/rewards-forms'

export const dynamic = 'force-dynamic'

export default async function AdminEarningRulesPage() {
  await requireAdminPage()
  const [rules, expiry, lastExpiry, lastStatements] = await Promise.all([
    getEarningRules(),
    runPointsExpiry({ dryRun: true }),
    prisma.cronRun.findFirst({ where: { job: { startsWith: 'VIP points expiry' } }, orderBy: { startedAt: 'desc' } }),
    prisma.cronRun.findFirst({ where: { job: { startsWith: 'VIP partner statements' } }, orderBy: { startedAt: 'desc' } }),
  ])
  // The registry IS the form: every rule, grouped, in registry order.
  const fields: RuleField[] = EARNING_RULES.map((r) => ({ key: r.key, group: r.group, label: r.label, help: r.help, unit: r.unit, max: r.max }))
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
      <EarningRulesForm rules={rules} fields={fields} />
      <div className="space-y-4">
        <div className="glass space-y-2 rounded-2xl p-5 text-sm">
          <h2 className="font-semibold">Points-back on purchases</h2>
          <ul className="space-y-1 text-white/70">
            <li>The Club: {formatBps(purchaseRateBps('CLUB', rules))}</li>
            <li>Plus: {formatBps(purchaseRateBps('PLUS', rules))}</li>
            <li>Premium Stacks: {formatBps(purchaseRateBps('PREMIUM', rules))}</li>
            <li>Non-members: 1 point per $1</li>
          </ul>
          <p className="text-xs text-white/40">100 points = $1. Awarded once per order when it is paid.</p>
        </div>
        <div className="glass space-y-2 rounded-2xl p-5 text-sm">
          <h2 className="font-semibold">Expiry preview (dry run)</h2>
          {rules['vip.points.expiryMonths'] === 0 ? (
            <p className="text-white/60">Expiry is off.</p>
          ) : (
            <p className="text-white/70">
              A run now would expire <span className="font-semibold text-white">{expiry.wouldExpirePoints.toLocaleString('en-US')}</span> points across{' '}
              <span className="font-semibold text-white">{expiry.examined}</span> inactive account(s).
            </p>
          )}
          <p className="text-xs text-white/40">
            Daily job: <code>/api/cron/vip-points-expiry</code> (<code>&amp;dryRun=1</code> lists, writes nothing). Last run:{' '}
            {lastExpiry ? `${formatDate(lastExpiry.startedAt)} — ${lastExpiry.status} — ${lastExpiry.result ?? ''}` : 'never'}
          </p>
          <p className="text-xs text-white/40">
            Partner statements: <code>/api/cron/vip-partner-statements</code> (daily; acts on the 1st). Last run:{' '}
            {lastStatements ? `${formatDate(lastStatements.startedAt)} — ${lastStatements.status}` : 'never'}
          </p>
        </div>
      </div>
    </div>
  )
}
