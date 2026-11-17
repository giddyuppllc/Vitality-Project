import crypto from 'node:crypto'

/**
 * One-click marketing unsubscribe for registered customers (campaign emails).
 * Token = base64url(userId) + "." + HMAC — no login, no schema change, and a
 * forged/edited token is refused. Signed with NEXTAUTH_SECRET.
 */
function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is not set')
  return s
}

function mac(id: string): string {
  return crypto.createHmac('sha256', secret()).update(`unsubscribe:${id}`).digest('base64url')
}

export function unsubscribeToken(userId: string): string {
  return `${Buffer.from(userId).toString('base64url')}.${mac(userId)}`
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [idPart, sig] = token.split('.')
  if (!idPart || !sig) return null
  let userId: string
  try {
    userId = Buffer.from(idPart, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const expected = Buffer.from(mac(userId))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null
  return userId
}

export function unsubscribeUrl(appUrl: string, userId: string): string {
  return `${appUrl.replace(/\/$/, '')}/api/unsubscribe/${unsubscribeToken(userId)}`
}
