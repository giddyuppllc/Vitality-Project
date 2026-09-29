import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

/**
 * Cross-TLD SSO hand-off (docs/VIP_CLUBHOUSE.md §SSO).
 *
 * `.vip` and `.global` are different registrable domains, so a shared session
 * cookie can't span them. Instead `.global` mints a SHORT-LIVED signed token
 * (this module, signed with the shared VIP_SSO_SECRET) and links the member to
 *   https://vitalityproject.vip/api/sso?token=<jwt>
 * The `.vip` /api/sso route verifies it and materialises a next-auth session
 * for that user against the shared user table.
 *
 * Both hosts are served by this one app, so mint + verify share THIS file.
 * Replay protection (single use per jti) lives in lib/vip/sso-consume.ts.
 */

// Read per call (not at import) so a rotated secret or a test env applies.
const ssoSecret = () => process.env.VIP_SSO_SECRET || ''
const ISSUER = 'vitalityproject'
const TTL_SECONDS = 120 // hand-off tokens are single-use in spirit and expire fast

export interface SsoClaims {
  sub: string // user id
  email?: string
  jti: string // unique token id — the receiving side records it to block replay
  exp?: number // expiry (unix seconds) — used to bound the replay-guard row
}

/** Mint a single-use hand-off token. Used on the `.global` side to build the
 *  clubhouse link. Each carries a random jti the `.vip` side consumes once. */
export function mintSsoToken(claims: { sub: string; email?: string }): string {
  const secret = ssoSecret()
  if (!secret) throw new Error('VIP_SSO_SECRET is not set')
  return jwt.sign({ email: claims.email }, secret, {
    algorithm: 'HS256',
    subject: claims.sub,
    issuer: ISSUER,
    expiresIn: TTL_SECONDS,
    jwtid: randomUUID(),
  })
}

/** Verify a hand-off token. Returns null on any failure (bad sig, expired, etc.). */
export function verifySsoToken(token: string): SsoClaims | null {
  const secret = ssoSecret()
  if (!secret) return null
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: ISSUER,
      algorithms: ['HS256'],
    }) as jwt.JwtPayload
    if (!decoded.sub || !decoded.jti) return null
    return {
      sub: String(decoded.sub),
      email: decoded.email as string | undefined,
      jti: String(decoded.jti),
      exp: decoded.exp,
    }
  } catch {
    return null
  }
}
