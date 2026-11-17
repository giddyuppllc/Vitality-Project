/**
 * Academy emails (paid trainings), in the clubhouse email layout.
 */
import { VIP_EMAIL_COLORS as C, emailParts, esc, money, type Rendered } from './emails'
import { vipBaseUrl } from './email-prefs'

const { h1, p, small, button, panel, layout, textFooter, firstName } = emailParts

export function trainingInvoiceEmail(a: {
  userId: string
  name: string | null
  courseTitle: string
  amountCents: number
  invoiceNumber: string
  zellePrimary: string
  zelleAlt?: string
  zelleName?: string
}): Rendered {
  const name = firstName(a.name)
  const amount = money(a.amountCents)
  const to = `${esc(a.zellePrimary)}${a.zelleAlt ? ` <span style="color:${C.muted};">or ${esc(a.zelleAlt)}</span>` : ''}`
  const row = (k: string, v: string) =>
    `<tr><td style="padding:4px 0;font-size:13px;color:${C.muted};">${k}</td><td align="right" style="padding:4px 0;font-size:14px;color:#ffffff;font-weight:700;">${v}</td></tr>`
  const html = layout(
    `${h1(`Your training is reserved, ${esc(name)}.`)}
     ${p(`Send one Zelle payment and <strong>${esc(a.courseTitle)}</strong> opens in your Clubhouse the moment it is confirmed — usually the same day.`)}
     ${panel(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
       ${row('Send to', to)}
       ${a.zelleName ? row('Account name', esc(a.zelleName)) : ''}
       ${row('Amount', amount)}
       ${row('Memo', esc(a.invoiceNumber))}
     </table>`)}
     ${small('Put the invoice number in the Zelle memo so we can match your payment.')}
     ${button('View the training', `${vipBaseUrl()}/classroom`)}
     ${p('Thank you,<br/>The Vitality Team')}`,
    { preheader: `Zelle ${amount} with memo ${a.invoiceNumber} to open ${a.courseTitle}.`, userId: a.userId, kind: null },
  )
  const text = `Your training is reserved, ${name}.

Send one Zelle payment and "${a.courseTitle}" opens in your Clubhouse the moment it is confirmed — usually the same day.

Send to: ${a.zellePrimary}${a.zelleAlt ? ` (or ${a.zelleAlt})` : ''}${a.zelleName ? `\nAccount name: ${a.zelleName}` : ''}
Amount: ${amount}
Memo: ${a.invoiceNumber}

View the training: ${vipBaseUrl()}/classroom

Thank you,
The Vitality Team
${textFooter(a.userId, null)}`
  return { subject: `Zelle ${amount} to open ${a.courseTitle}`, html, text }
}

export function trainingUnlockedEmail(a: { userId: string; name: string | null; courseTitle: string; courseSlug: string }): Rendered {
  const name = firstName(a.name)
  const url = `${vipBaseUrl()}/classroom/${encodeURIComponent(a.courseSlug)}`
  const html = layout(
    `${h1(`It's open, ${esc(name)}.`)}
     ${p(`Your payment is confirmed and <strong>${esc(a.courseTitle)}</strong> is now in your Academy. Your progress saves as you go, and finishing it earns a certificate.`)}
     ${button('Start the training', url)}
     ${p('Enjoy it,<br/>The Vitality Team')}`,
    { preheader: `${a.courseTitle} is open in your Clubhouse.`, userId: a.userId, kind: null },
  )
  const text = `It's open, ${name}.

Your payment is confirmed and "${a.courseTitle}" is now in your Academy. Your progress saves as you go, and finishing it earns a certificate.

Start the training: ${url}

Enjoy it,
The Vitality Team
${textFooter(a.userId, null)}`
  return { subject: `${a.courseTitle} is open`, html, text }
}
