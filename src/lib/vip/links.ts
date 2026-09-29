/**
 * Hand-off links from the clubhouse to vitalityproject.global. The clubhouse
 * has no store of its own: joining, paying, shopping and spending rewards all
 * happen on .global through its existing flows.
 */
export function globalUrl(path = '/'): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global').replace(/\/+$/, '')
  return `${base}${path}`
}

export const GLOBAL_LINKS = {
  /** Existing membership signup (Zelle invoice flow, api/membership/subscribe). */
  join: () => globalUrl('/membership?from=vip'),
  /** Same flow with the tier chosen on .vip preselected (membership page reads ?tier=). */
  joinTier: (tier: 'CLUB' | 'PLUS' | 'PREMIUM') => globalUrl(`/membership?tier=${tier.toLowerCase()}&from=vip`),
  /** Where rewards (store credit) are spent. */
  shop: () => globalUrl('/shop'),
  /** Existing store-credit + loyalty history page. */
  credits: () => globalUrl('/account/credits'),
  /** Existing membership management page. */
  manageMembership: () => globalUrl('/account/membership'),
  resetPassword: () => globalUrl('/auth/reset-password'),
  register: () => globalUrl('/auth/register'),
}
