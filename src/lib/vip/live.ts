import { Resolver } from 'node:dns/promises'
import { vipBaseUrl } from './email-prefs'

/**
 * Is the clubhouse domain reachable by members yet?
 *
 * Every clubhouse email links to vitalityproject.vip (feed, threads, email
 * preferences, privacy). Until the domain has public DNS those links are dead,
 * so clubhouse mail is held (see sendVipEmail) rather than sent broken.
 *
 * Checked against public resolvers, not the box's own resolver or /etc/hosts.
 * A "live" answer is remembered for the life of the process; a "not live"
 * answer is re-checked after five minutes. `VIP_MAIL_REQUIRE_DNS=0` turns the
 * check off.
 */

const RECHECK_MS = 5 * 60_000
let live = false
let checkedAt = Number.NEGATIVE_INFINITY

export async function vipDomainLive(now = Date.now()): Promise<boolean> {
  if (process.env.VIP_MAIL_REQUIRE_DNS === '0') return true
  if (live) return true
  if (now - checkedAt < RECHECK_MS) return false
  checkedAt = now
  const host = new URL(vipBaseUrl()).hostname
  const resolver = new Resolver({ timeout: 4000, tries: 2 })
  resolver.setServers(['1.1.1.1', '8.8.8.8'])
  const answers = await Promise.allSettled([resolver.resolve4(host), resolver.resolve6(host)])
  live = answers.some((a) => a.status === 'fulfilled' && a.value.length > 0)
  return live
}

/** Test hook: forget the cached answer. */
export function resetVipDomainLive(): void {
  live = false
  checkedAt = Number.NEGATIVE_INFINITY
}
