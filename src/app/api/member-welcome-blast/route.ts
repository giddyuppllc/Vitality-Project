import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { membershipActivated, membershipInvoice } from '@/lib/email-templates'
import { TIER_BENEFITS } from '@/lib/membership'
import { getZelleIdentity } from '@/lib/zelle'

// ONE-OFF. Welcomes current ACTIVE members ("thank you + how it works") and
// nudges the stuck PENDING_PAYMENT signups — the people who got the old wrong
// Zelle address and couldn't pay — with the CORRECT Zelle. Guarded by an admin
// session OR the existing CRON_SECRET (no secret stored in source). Remove this
// route after running it once.
const TIER_LABELS: Record<string, string> = {
  CLUB: 'The Club',
  PLUS: 'Plus',
  PREMIUM: 'Premium Stacks',
}
const EXCLUDE = new Set(['flowtest@example.com'])

export const dynamic = 'force-dynamic'

async function run(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const secret = new URL(req.url).searchParams.get('secret')
  const authed =
    session?.user?.role === 'ADMIN' ||
    (!!process.env.CRON_SECRET && secret === process.env.CRON_SECRET)
  if (!authed) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const sent: { email: string; type: 'welcome' | 'recovery'; ok: boolean }[] = []

  // 1. Active members → welcome / how-it-works.
  const active = await prisma.membership.findMany({
    where: { status: 'ACTIVE', tier: { not: 'NONE' } },
    select: { tier: true, user: { select: { name: true, email: true } } },
  })
  for (const m of active) {
    const email = m.user?.email
    if (!email || EXCLUDE.has(email)) continue
    const tierKey = m.tier as 'CLUB' | 'PLUS' | 'PREMIUM'
    const b = TIER_BENEFITS[tierKey] ?? TIER_BENEFITS.NONE
    const tpl = membershipActivated({
      name: m.user?.name ?? 'there',
      plan: TIER_LABELS[m.tier] ?? 'Membership',
      discountPct: b.permanentDiscountPct,
      peptideCredits: b.freePeptideCreditsPerPeriod,
      includesSupplies: b.freeBacAndSyringes,
      freeShipping: b.freeShipping,
    })
    try {
      await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text })
      sent.push({ email, type: 'welcome', ok: true })
    } catch {
      sent.push({ email, type: 'welcome', ok: false })
    }
  }

  // 2. Pending signups → "complete your membership" with the CORRECT Zelle.
  const zelle = await getZelleIdentity()
  const pending = await prisma.membership.findMany({
    where: { status: 'PENDING_PAYMENT', tier: { not: 'NONE' } },
    select: {
      tier: true,
      monthlyPriceCents: true,
      pendingInvoiceOrderId: true,
      user: { select: { name: true, email: true } },
    },
  })
  for (const m of pending) {
    const email = m.user?.email
    if (!email || EXCLUDE.has(email)) continue
    let invoiceNumber = 'your invoice'
    let amountCents = m.monthlyPriceCents
    if (m.pendingInvoiceOrderId) {
      const ord = await prisma.order.findUnique({
        where: { id: m.pendingInvoiceOrderId },
        select: { orderNumber: true, total: true },
      })
      if (ord) {
        invoiceNumber = ord.orderNumber
        amountCents = ord.total
      }
    }
    const planLabel = TIER_LABELS[m.tier] ?? 'Membership'
    const html = membershipInvoice({
      name: m.user?.name ?? null,
      planLabel,
      amountCents,
      invoiceNumber,
      zelle,
    })
    const amount = `$${(amountCents / 100).toFixed(2)}`
    try {
      await sendEmail({
        to: email,
        subject: `Complete your ${planLabel} membership — Zelle ${amount} to ${zelle.primary}`,
        html,
        text: `Hi ${m.user?.name?.split(' ')[0] ?? 'there'}, your ${planLabel} membership is one step away. Send ${amount} via Zelle to ${zelle.primary}${zelle.displayName ? ` (${zelle.displayName})` : ''} with memo ${invoiceNumber} and we'll activate it the moment funds clear.`,
      })
      sent.push({ email, type: 'recovery', ok: true })
    } catch {
      sent.push({ email, type: 'recovery', ok: false })
    }
  }

  return NextResponse.json({ ok: true, count: sent.length, sent })
}

export async function GET(req: NextRequest) {
  return run(req)
}
export async function POST(req: NextRequest) {
  return run(req)
}
