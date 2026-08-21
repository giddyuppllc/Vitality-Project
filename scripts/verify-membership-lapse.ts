/**
 * verify:lapse — walk the unpaid-renewal policy day by day and assert it does
 * what it claims.
 *
 * assessMembership is pure precisely so this can run against fixed dates
 * instead of waiting two weeks to find out. Every case below is an assertion:
 * the script exits non-zero if the policy stops behaving, and it prints the
 * timeline so the behaviour is readable rather than implied.
 *
 *   npx tsx scripts/verify-membership-lapse.ts
 */
import {
  assessMembership,
  GRACE_DAYS,
  REMINDER_DAYS_OVERDUE,
  type LapseInput,
} from '../src/lib/membershipLapse'

const RENEWS = new Date('2026-07-01T00:00:00Z')
const day = (n: number) => new Date(RENEWS.getTime() + n * 86400000)

let failures = 0
function check(label: string, actual: string, expected: string) {
  const ok = actual === expected
  if (!ok) failures++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label.padEnd(52)} ${actual}${ok ? '' : `   (expected ${expected})`}`)
}

const base: LapseInput = {
  status: 'ACTIVE',
  tier: 'PLUS',
  renewsAt: RENEWS,
  invoiceUnpaid: true,
  lastOverdueNoticeAt: null,
}

console.log(`\n— unpaid renewal policy (grace ${GRACE_DAYS}d, reminders on day ${REMINDER_DAYS_OVERDUE.join('/')}) —\n`)

console.log('  never notified, walking forward:')
for (const d of [0, 1, 3, 5, 9, 13, 14, 20]) {
  const r = assessMembership(base, day(d))
  const expected = d < 1 ? 'none' : d >= GRACE_DAYS ? 'suspend' : 'remind'
  check(`day ${String(d).padStart(2)} past renewal`, r.action, expected)
}

console.log('\n  rate limiting and scheduling:')
check(
  'reminded 2h ago -> silent',
  assessMembership({ ...base, lastOverdueNoticeAt: new Date(day(5).getTime() - 2 * 3600000) }, day(5)).action,
  'none',
)
check(
  'reminded on day 1, now day 2 -> wait for day 5',
  assessMembership({ ...base, lastOverdueNoticeAt: day(1) }, day(2)).action,
  'none',
)
check(
  'reminded on day 1, now day 5 -> remind again',
  assessMembership({ ...base, lastOverdueNoticeAt: day(1) }, day(5)).action,
  'remind',
)
check(
  'reminded on day 10, now day 14 -> suspend regardless',
  assessMembership({ ...base, lastOverdueNoticeAt: day(10) }, day(14)).action,
  'suspend',
)

console.log('\n  who is out of scope entirely:')
check('free tier is never chased', assessMembership({ ...base, tier: 'NONE' }, day(20)).action, 'none')
check('already PAST_DUE is not re-suspended', assessMembership({ ...base, status: 'PAST_DUE' }, day(20)).action, 'none')
check('CANCELLED is left alone', assessMembership({ ...base, status: 'CANCELLED' }, day(20)).action, 'none')
check('paid invoice is not chased', assessMembership({ ...base, invoiceUnpaid: false }, day(20)).action, 'none')
check('no renewal date -> nothing to judge', assessMembership({ ...base, renewsAt: null }, day(20)).action, 'none')

// Positive control. If the happy path stopped producing actions, every
// assertion above could pass by returning 'none' forever and this file would
// look green while enforcing nothing.
console.log('\n  positive control:')
const acted = [1, 5, 10, 14, 30].filter(d => assessMembership(base, day(d)).action !== 'none').length
check('the policy still acts on overdue members', acted === 5 ? 'acts' : `only ${acted}/5`, 'acts')

console.log('')
if (failures > 0) {
  console.log(`✗ ${failures} assertion(s) failed — the lapse policy does not behave as documented.\n`)
  process.exit(1)
}
console.log('✓ unpaid-renewal policy behaves as documented.\n')
