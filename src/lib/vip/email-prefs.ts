import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * One-click email preference links for clubhouse mail.
 *
 * Every clubhouse email carries a signed link to /email on the .vip host
 * (`?u=<userId>&k=<kind>&t=<sig>`). The page shows a confirm button that
 * POSTs to /api/vip/email-prefs — a GET never changes anything, so link
 * scanners in mail clients cannot unsubscribe a member by prefetching.
 *
 * Signed with NEXTAUTH_SECRET (already on the box); no new secret.
 */
export const EMAIL_KINDS = ['digest', 'events', 'rewards', 'all'] as const
export type EmailKind = (typeof EMAIL_KINDS)[number]

export const KIND_FIELDS: Record<Exclude<EmailKind, 'all'>, 'emailDigest' | 'emailEvents' | 'emailRewards'> = {
  digest: 'emailDigest',
  events: 'emailEvents',
  rewards: 'emailRewards',
}

export const KIND_LABELS: Record<EmailKind, string> = {
  digest: 'the daily reply & mention digest',
  events: 'event reminders',
  rewards: 'monthly reward notices',
  all: 'all Clubhouse emails',
}

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET
  if (!s) throw new Error('NEXTAUTH_SECRET is not set')
  return s
}

export function signPrefToken(userId: string, kind: EmailKind): string {
  return createHmac('sha256', secret()).update(`vip-email-pref:${userId}:${kind}`).digest('base64url')
}

export function verifyPrefToken(userId: string, kind: string, token: string): kind is EmailKind {
  if (!(EMAIL_KINDS as readonly string[]).includes(kind)) return false
  const expected = Buffer.from(signPrefToken(userId, kind as EmailKind))
  const got = Buffer.from(String(token))
  return expected.length === got.length && timingSafeEqual(expected, got)
}

export function vipBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_VIP_URL || 'https://vitalityproject.vip').replace(/\/+$/, '')
}

export function prefLink(userId: string, kind: EmailKind): string {
  const q = new URLSearchParams({ u: userId, k: kind, t: signPrefToken(userId, kind) })
  return `${vipBaseUrl()}/email?${q.toString()}`
}
