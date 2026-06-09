import { prisma } from '@/lib/prisma'

export interface ZelleIdentity {
  /** The main send-to handle shown to customers (this account receives by phone). */
  primary: string
  /** Account-holder name, e.g. "Vertex Research Supply LLC". */
  displayName?: string
  /** Optional secondary handle, only set when both a phone and an email exist. */
  altHandle?: string
}

/**
 * Single source of truth for the Zelle destination, read from siteSetting
 * (admin → Settings → Payment · Zelle). Phone-first, because this account
 * receives Zelle by phone number — NOT by email.
 *
 * Critically, this NEVER falls back to a hardcoded personal/placeholder email.
 * Three email templates previously did (process.env.ZELLE_RECIPIENT_EMAIL ??
 * "billing@…"), so every membership invoice told customers to Zelle the wrong
 * address — which is why memberships weren't converting. If settings are
 * somehow blank, `primary` comes back empty and the caller can guard, rather
 * than silently leaking a wrong destination.
 */
export async function getZelleIdentity(): Promise<ZelleIdentity> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: ['zelleEmail', 'zelleDisplayName', 'zellePhone'] } },
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value?.trim() || '']))
  const phone = map.zellePhone || ''
  const email = map.zelleEmail || ''
  const primary = phone || email // phone-first
  return {
    primary,
    displayName: map.zelleDisplayName || undefined,
    // Show a secondary line only when both handles are configured.
    altHandle: phone && email ? (primary === phone ? email : phone) : undefined,
  }
}
