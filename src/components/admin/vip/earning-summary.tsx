import Link from 'next/link'
import { EARNING_RULES, getEarningRules, type EarningGroup } from '@/lib/vip/earning'

/**
 * Read-only list of the points a feature pays, straight from the earning-rules
 * registry, with a link to the ONE page where they are edited
 * (/admin/vip/rewards/earning). Feature admin pages show this instead of
 * keeping their own copy of the amounts.
 */
export async function EarningRulesSummary({ groups, title = 'Points' }: { groups: EarningGroup[]; title?: string }) {
  const rules = await getEarningRules()
  const rows = EARNING_RULES.filter((r) => (groups as string[]).includes(r.group))
  return (
    <section className="glass space-y-3 rounded-2xl p-5 text-sm" aria-labelledby="earning-summary">
      <h2 id="earning-summary" className="font-semibold">{title}</h2>
      <ul className="divide-y divide-white/[0.06]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2">
            <span className="text-white/75">{r.label}</span>
            <span className="shrink-0 font-semibold">
              {rules[r.key].toLocaleString('en-US')} {r.unit}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-white/50">
        Every points amount is set in one place:{' '}
        <Link href="/admin/vip/rewards/earning" className="text-brand-300 underline hover:text-brand-200">
          Rewards → Earning rules
        </Link>
        . 0 turns an award off.
      </p>
    </section>
  )
}
