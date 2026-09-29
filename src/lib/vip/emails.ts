/**
 * Clubhouse email templates (vitalityproject.vip).
 *
 * Sent through .global's existing email module (lib/email.ts → Resend, from
 * noreply@vitalityproject.global) with Reply-To from the `vip.emailReplyTo`
 * setting (default vital@vitalityproject.global). Same server-rendered,
 * inline-styled approach as lib/email-templates.ts, in the clubhouse palette.
 * Each builder returns { subject, html, text }.
 */
import { prefLink, vipBaseUrl, type EmailKind } from './email-prefs'

export const VIP_EMAIL_COLORS = {
  page: '#070b14',
  card: '#0f1729',
  line: 'rgba(255,255,255,0.08)',
  text: '#e6ebf5',
  muted: '#9aa7bd',
  faint: '#6b778c',
  accent: '#1d6fd6',
  accentSoft: '#82c3ff',
  gold: '#d4b26a',
}
const C = VIP_EMAIL_COLORS

export function esc(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

const h1 = (t: string) => `<h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;font-weight:800;color:#ffffff;letter-spacing:-0.01em;">${t}</h1>`
const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${C.text};">${t}</p>`
const small = (t: string) => `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${C.muted};">${t}</p>`
const button = (label: string, href: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 8px;"><tr><td style="border-radius:12px;background-color:${C.accent};">
  <a href="${href}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">${esc(label)}</a>
</td></tr></table>`
const panel = (inner: string) => `<div style="background:#0b1322;border:1px solid ${C.line};border-radius:14px;padding:16px 18px;margin:16px 0;">${inner}</div>`

function layout(inner: string, opts: { preheader: string; userId: string; kind: EmailKind | null }): string {
  const prefs = prefLink(opts.userId, 'all')
  const one = opts.kind && opts.kind !== 'all'
    ? ` · <a href="${prefLink(opts.userId, opts.kind)}" style="color:${C.accentSoft};text-decoration:underline;">Turn off this kind of email</a>`
    : ''
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>The Vitality Project Clubhouse</title>
</head>
<body style="margin:0;padding:0;background-color:${C.page};color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page};">${esc(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;">
<tr><td style="padding:24px 32px;border-bottom:1px solid ${C.line};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:40px;height:40px;border-radius:11px;background-color:#101c33;border:1px solid rgba(130,195,255,0.35);text-align:center;vertical-align:middle;font-size:15px;font-weight:900;color:#ffffff;letter-spacing:-0.02em;">V<span style="color:${C.gold};">P</span></td>
    <td style="padding-left:12px;">
      <div style="font-size:11px;letter-spacing:0.22em;color:${C.muted};font-weight:700;">THE VITALITY PROJECT</div>
      <div style="font-size:15px;font-weight:800;color:#ffffff;">Clubhouse</div>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:30px 32px 26px;">${inner}</td></tr>
<tr><td style="padding:20px 32px 24px;border-top:1px solid ${C.line};background-color:#0b1120;">
  <p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:${C.faint};">You're receiving this as a member of The Vitality Project Clubhouse. Replies reach the Vitality team.</p>
  <p style="margin:0;font-size:12px;line-height:1.6;color:${C.faint};"><a href="${prefs}" style="color:${C.accentSoft};text-decoration:underline;">Email preferences</a>${one} · <a href="${vipBaseUrl()}/privacy" style="color:${C.accentSoft};text-decoration:underline;">Privacy</a></p>
</td></tr>
</table>
<p style="margin:16px 0 0;font-size:11px;color:#475569;">© ${new Date().getUTCFullYear()} The Vitality Project</p>
</td></tr></table>
</body></html>`
}

function textFooter(userId: string, kind: EmailKind | null): string {
  const lines = ['', '—', 'The Vitality Project Clubhouse', `Email preferences: ${prefLink(userId, 'all')}`]
  if (kind && kind !== 'all') lines.push(`Turn off this kind of email: ${prefLink(userId, kind)}`)
  return lines.join('\n')
}

const firstName = (name: string | null | undefined) => (name || '').trim().split(/\s+/)[0] || 'there'

export interface Rendered {
  subject: string
  html: string
  text: string
}

// ─── Welcome ────────────────────────────────────────────────────────────────
export function clubhouseWelcomeEmail(a: { userId: string; name: string | null; tierLabel: string }): Rendered {
  const name = firstName(a.name)
  const base = vipBaseUrl()
  const steps: Array<[string, string]> = [
    ['Say hello in Introductions', 'Tell us what you are training for and what a great year looks like.'],
    ['Open Clubhouse Orientation', 'Ten minutes that make the rest of the Clubhouse easier to use.'],
    ['RSVP to the next live session', 'We send a reminder a day before and an hour before.'],
    ['Watch for your credit on the 1st', 'Your monthly store credit applies at vitalityproject.global checkout.'],
  ]
  const html = layout(
    `${h1(`You're in, ${esc(name)}.`)}
     ${p(`Your ${esc(a.tierLabel)} membership is active and the Clubhouse is open to you. This is where Vitality members train, learn and check in with each other — and where Kevin and the team answer questions live every month.`)}
     ${panel(steps
       .map(([t, d], i) => `<div style="margin:${i ? '12px' : '0'} 0 0;"><div style="font-size:14px;font-weight:700;color:#ffffff;"><span style="color:${C.gold};">${i + 1}.</span> ${esc(t)}</div><div style="font-size:13px;line-height:1.55;color:${C.muted};">${esc(d)}</div></div>`)
       .join(''))}
     ${button('Open the Clubhouse', `${base}/feed`)}
     ${small('Sign in with the same email and password you use at vitalityproject.global.')}
     ${p('See you inside,<br/>The Vitality Team')}`,
    { preheader: 'Your Clubhouse is open — four quick steps for your first week.', userId: a.userId, kind: null },
  )
  const text = `You're in, ${name}.

Your ${a.tierLabel} membership is active and the Clubhouse is open to you. This is where Vitality members train, learn and check in with each other — and where Kevin and the team answer questions live every month.

${steps.map(([t, d], i) => `${i + 1}. ${t} — ${d}`).join('\n')}

Open the Clubhouse: ${base}/feed
Sign in with the same email and password you use at vitalityproject.global.

See you inside,
The Vitality Team
${textFooter(a.userId, null)}`
  return { subject: `Welcome to the Clubhouse, ${name}`, html, text }
}

// ─── Daily reply / mention digest ───────────────────────────────────────────
export interface DigestItem {
  type: 'REPLY' | 'COMMENT' | 'MENTION'
  actor: string
  snippet: string
  postId: string
}

const DIGEST_VERB: Record<DigestItem['type'], string> = {
  REPLY: 'replied to your comment',
  COMMENT: 'commented on your post',
  MENTION: 'mentioned you',
}

export function clubhouseDigestEmail(a: { userId: string; name: string | null; items: DigestItem[]; total: number }): Rendered {
  const base = vipBaseUrl()
  const n = a.total
  const subject = n === 1 ? `${a.items[0].actor} ${DIGEST_VERB[a.items[0].type]} in the Clubhouse` : `${n} new replies and mentions in the Clubhouse`
  const rows = a.items
    .map(
      (it, i) => `<div style="padding:${i ? '12px' : '0'} 0 0;${i ? `border-top:1px solid ${C.line};margin-top:12px;` : ''}">
        <div style="font-size:14px;color:#ffffff;"><strong>${esc(it.actor)}</strong> <span style="color:${C.muted};">${DIGEST_VERB[it.type]}</span></div>
        <div style="font-size:13px;line-height:1.55;color:${C.text};margin:4px 0 6px;">“${esc(it.snippet)}”</div>
        <a href="${base}/posts/${encodeURIComponent(it.postId)}" style="font-size:13px;font-weight:700;color:${C.accentSoft};text-decoration:none;">Open the thread →</a>
      </div>`,
    )
    .join('')
  const more = n > a.items.length ? small(`Plus ${n - a.items.length} more in your notifications.`) : ''
  const html = layout(
    `${h1(`Hi ${esc(firstName(a.name))}, the conversation kept going.`)}
     ${p('Here is what members said to you since your last digest.')}
     ${panel(rows)}
     ${more}
     ${button('Open notifications', `${base}/notifications`)}`,
    { preheader: subject, userId: a.userId, kind: 'digest' },
  )
  const text = `Hi ${firstName(a.name)}, the conversation kept going.

${a.items.map((it) => `• ${it.actor} ${DIGEST_VERB[it.type]}: "${it.snippet}"\n  ${base}/posts/${it.postId}`).join('\n')}
${n > a.items.length ? `\nPlus ${n - a.items.length} more in your notifications.` : ''}
Open notifications: ${base}/notifications
${textFooter(a.userId, 'digest')}`
  return { subject, html, text }
}

// ─── Event reminders (24h + 1h) ─────────────────────────────────────────────
export function formatEventTime(d: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  return fmt.format(d)
}

export function eventReminderEmail(a: {
  userId: string
  name: string | null
  when: '24h' | '1h'
  title: string
  description: string | null
  startsAt: Date
  timeZone: string
}): Rendered {
  const base = vipBaseUrl()
  const time = formatEventTime(a.startsAt, a.timeZone)
  const subject = a.when === '24h' ? `Tomorrow: ${a.title}` : `Starting in an hour: ${a.title}`
  const lead = a.when === '24h'
    ? `You're on the list for ${esc(a.title)}. Here are the details for tomorrow.`
    : `${esc(a.title)} starts in about an hour. Grab a notebook and your questions.`
  const desc = a.description ? a.description.split(/\n+/)[0].slice(0, 400) : ''
  const html = layout(
    `${h1(esc(a.title))}
     ${p(lead)}
     ${panel(`<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.muted};margin-bottom:6px;">When</div>
              <div style="font-size:16px;font-weight:700;color:#ffffff;">${esc(time)}</div>
              ${desc ? `<div style="font-size:13px;line-height:1.6;color:${C.text};margin-top:12px;">${esc(desc)}</div>` : ''}`)}
     ${button(a.when === '24h' ? 'View the event' : 'Get the join link', `${base}/events`)}
     ${small('The join link sits on the event card in the Clubhouse, visible to signed-in members.')}`,
    { preheader: `${time} — ${a.title}`, userId: a.userId, kind: 'events' },
  )
  const text = `${a.title}

${a.when === '24h' ? `You're on the list for ${a.title}. Here are the details for tomorrow.` : `${a.title} starts in about an hour.`}

When: ${time}
${desc ? `\n${desc}\n` : ''}
Join link: on the event card at ${base}/events (signed-in members)
${textFooter(a.userId, 'events')}`
  return { subject, html, text }
}

// ─── Monthly reward issued ──────────────────────────────────────────────────
export function rewardIssuedEmail(a: {
  userId: string
  name: string | null
  tierLabel: string
  amountCents: number
  monthLabel: string
  balanceCents: number
  expiresLabel: string | null
  shopUrl: string
}): Rendered {
  const amt = money(a.amountCents)
  const subject = `Your ${amt} Clubhouse credit just landed`
  const lasts = a.expiresLabel ? ` It stays good through ${esc(a.expiresLabel)}.` : ''
  const html = layout(
    `${h1(`${amt} is in your account, ${esc(firstName(a.name))}.`)}
     ${p(`Your ${esc(a.tierLabel)} reward for ${esc(a.monthLabel)} is now in your Vitality store credit. It applies at vitalityproject.global checkout, on top of your member pricing.${lasts}`)}
     ${panel(`<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:${C.muted};margin-bottom:6px;">Available credit</div>
              <div style="font-size:26px;font-weight:800;color:${C.gold};">${money(a.balanceCents)}</div>`)}
     ${button('Use it at vitalityproject.global', a.shopUrl)}
     ${small('Credit comes off your order total at checkout — shipping and tax included — and returns to your balance if an order is cancelled.')}`,
    { preheader: `${a.tierLabel} reward for ${a.monthLabel}: ${amt}`, userId: a.userId, kind: 'rewards' },
  )
  const text = `${amt} is in your account, ${firstName(a.name)}.

Your ${a.tierLabel} reward for ${a.monthLabel} is now in your Vitality store credit. It applies at vitalityproject.global checkout, on top of your member pricing.${a.expiresLabel ? ` It stays good through ${a.expiresLabel}.` : ''}

Available credit: ${money(a.balanceCents)}
Use it: ${a.shopUrl}
${textFooter(a.userId, 'rewards')}`
  return { subject, html, text }
}
