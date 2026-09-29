import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

/**
 * Cross-TLD SSO hand-off (docs/VIP_ARCHITECTURE.md §3).
 *
 * `.vip` and `.global` are different registrable domains, so a shared session
 * cookie can't span them. Instead `.global` mints a SHORT-LIVED signed token
 * (this module, signed with the shared VIP_SSO_SECRET) and links the member to
 *   https://vitalityproject.vip/api/sso?token=<jwt>
 * The `.vip` /api/sso route verifies it and materialises a next-auth session
 * for that user against the shared user table.
 *
 * Both properties import THIS file so the mint + verify stay in lockstep.
 */

const SSO_SECRET = process.env.VIP_SSO_SECRET || ''
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
  if (!SSO_SECRET) throw new Error('VIP_SSO_SECRET is not set')
  return jwt.sign({ email: claims.email }, SSO_SECRET, {
    subject: claims.sub,
    issuer: ISSUER,
    expiresIn: TTL_SECONDS,
    jwtid: randomUUID(),
  })
}

/** Verify a hand-off token. Returns null on any failure (bad sig, expired, etc.). */
export function verifySsoToken(token: string): SsoClaims | null {
  if (!SSO_SECRET) return null
  try {
    const decoded = jwt.verify(token, SSO_SECRET, { issuer: ISSUER }) as jwt.JwtPayload
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
