import { prisma } from '@/lib/prisma'
import { verifySsoToken } from '@/lib/sso'

/**
 * Consume side of the .global → .vip SSO hand-off (the mint side is
 * src/app/clubhouse/route.ts + lib/sso.ts, shared by both).
 *
 *  - signature, issuer and expiry: verifySsoToken (120s TTL)
 *  - single use: the token's jti is inserted into vip_sso_consumed_tokens,
 *    whose primary key rejects a second insert → replay refused
 *  - the user must still exist, and the email claim (if present) must match
 */
export type SsoConsumeResult =
  | { ok: true; user: { id: string; email: string; name: string | null; role: string } }
  | { ok: false; reason: 'invalid' | 'replayed' | 'unknown_user' }

export async function consumeSsoToken(token: string | null | undefined): Promise<SsoConsumeResult> {
  if (!token || token.length > 4096) return { ok: false, reason: 'invalid' }
  const claims = verifySsoToken(token)
  if (!claims) return { ok: false, reason: 'invalid' }

  const expiresAt = new Date((claims.exp ?? Math.floor(Date.now() / 1000) + 120) * 1000)
  // INSERT … ON CONFLICT DO NOTHING on the jti primary key: 1 row = first use,
  // 0 rows = this token was already spent → replay refused.
  const { count } = await prisma.vipSsoConsumedToken.createMany({
    data: [{ jti: claims.jti, userId: claims.sub, expiresAt }],
    skipDuplicates: true,
  })
  if (count === 0) return { ok: false, reason: 'replayed' }

  // Housekeeping: spent jtis are only needed until their token would have
  // expired anyway. Keep a day of history for the audit trail.
  await prisma.vipSsoConsumedToken
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400e3) } } })
    .catch(() => {})

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, role: true },
  })
  if (!user) return { ok: false, reason: 'unknown_user' }
  if (claims.email && claims.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, user }
}

/** Only same-site relative paths; the mint side's /dashboard maps to the feed. */
export function safeCallbackPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/feed'
  if (raw === '/dashboard') return '/feed'
  return raw.slice(0, 512)
}
