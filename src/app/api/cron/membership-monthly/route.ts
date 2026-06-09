import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { membershipInvoice } from '@/lib/email-templates'
import { getZelleIdentity } from '@/lib/zelle'
import { TIER_BENEFITS } from '@/lib/membership'
import { generateOrderNumber } from '@/lib/utils'
import { trackCronRun } from '@/lib/cron-tracker'

// Cron — generates the next monthly invoice for any ACTIVE membership whose
// renewsAt window is within 3 days. Creates a Zelle invoice Order tagged
// MEMBERSHIP:<id>:<tier> in Order.notes so mark-paid bumps the renewal
// forward 30 days.
//
// Idempotent — won't create a second invoice if one is already pending for
// this billing cycle (renewsAt unchanged + pendingInvoiceOrderId still
// UNPAID).
//
// Schedule: daily. Auth: Bearer <CRON_SECRET> or ?secret=<CRON_SECRET>.

const TIER_LABELS = {
  CLUB: 'Vitality Club',
  PLUS: 'Vitality Plus',
  PREMIUM: 'Vitality Premium Stacks',
} as const

const MEMBERSHIP_PRODUCT_SLUG = 'vitality-membership'

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  const url = new URL(req.url)
  const querySecret = url.searchParams.get('secret')
  const headerSecret = req.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
  return querySecret === secret || headerSecret === secret
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return trackCronRun(
    'Membership monthly renewals',
    () => doRun(),
    (r) =>
      `examined=${r.examined} invoiced=${r.invoiced} skipped=${r.skipped} failed=${r.failed}`,
  )
}

async function doRun() {
  const dueWindow = new Date(Date.now() + 3 * 86400e3) // within 3 days
  const memberships = await prisma.membership.findMany({
    where: {
      status: 'ACTIVE',
      renewsAt: { lte: dueWindow },
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 200,
  })

  // Fetch the membership product once — needed for OrderItem.productId.
  const product = await prisma.product.findUnique({
    where: { slug: MEMBERSHIP_PRODUCT_SLUG },
    include: { variants: true },
  })
  if (!product) {
    return {
      ok: false as const,
      error: 'Membership product not seeded — first subscribe creates it',
      examined: memberships.length,
      invoiced: 0,
      skipped: 0,
      failed: 0,
      results: [] as unknown[],
    }
  }

  let invoiced = 0
  let skipped = 0
  let failed = 0
  const results: Array<{
    membershipId: string
    email: string
    status: 'invoiced' | 'skipped' | 'failed'
    error?: string
  }> = []

  const zelle = await getZelleIdentity()

  for (const m of memberships) {
    if (!m.user.email) {
      skipped += 1
      results.push({
        membershipId: m.id,
        email: '(no email)',
        status: 'skipped',
      })
      continue
    }

    // Already have an unpaid invoice for this cycle? Skip.
    if (m.pendingInvoiceOrderId) {
      const inv = await prisma.order.findUnique({
        where: { id: m.pendingInvoiceOrderId },
        select: { paymentStatus: true },
      })
      if (inv && inv.paymentStatus === 'UNPAID') {
        skipped += 1
        results.push({
          membershipId: m.id,
          email: m.user.email,
          status: 'skipped',
          error: 'invoice already pending',
        })
        continue
      }
    }

    const tierKey = m.tier as 'CLUB' | 'PLUS' | 'PREMIUM'
    const planLabel = TIER_LABELS[tierKey] ?? 'Membership'
    const amountCents =
      m.monthlyPriceCents > 0
        ? m.monthlyPriceCents
        : TIER_BENEFITS[tierKey]?.monthlyPriceCents ?? 0
    const variant = product.variants.find((v) => v.name === planLabel)
    if (!variant) {
      failed += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'failed',
        error: `no variant matching ${planLabel}`,
      })
      continue
    }

    try {
      const orderNumber = generateOrderNumber()
      const lineName = `${planLabel} — Monthly Membership`
      const order = await prisma.order.create({
        data: {
          orderNumber,
          userId: m.user.id,
          email: m.user.email,
          subtotal: amountCents,
          total: amountCents,
          paymentMethod: 'zelle',
          paymentStatus: 'UNPAID',
          status: 'PENDING',
          notes: `MEMBERSHIP:${m.id}:${m.tier}`,
          items: {
            create: [
              {
                productId: product.id,
                variantId: variant.id,
                name: lineName,
                sku: variant.sku,
                price: amountCents,
                quantity: 1,
                total: amountCents,
              },
            ],
          },
        },
      })

      await prisma.membership.update({
        where: { id: m.id },
        data: { pendingInvoiceOrderId: order.id },
      })

      const html = membershipInvoice({
        name: m.user.name,
        planLabel,
        amountCents,
        invoiceNumber: orderNumber,
        zelle,
      })
      const amountStr = `$${(amountCents / 100).toFixed(2)}`
      const text = `Hi ${m.user.name?.split(' ')[0] ?? 'there'},

Your monthly ${planLabel} membership renews soon. Send ${amountStr} via Zelle to keep benefits active.

Memo: ${orderNumber}
Amount: ${amountStr}

— The Vitality Project`

      await sendEmail({
        to: m.user.email,
        subject: `${planLabel} renewal — ${amountStr} via Zelle (memo ${orderNumber})`,
        html,
        text,
      })

      invoiced += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'invoiced',
      })
    } catch (err) {
      failed += 1
      results.push({
        membershipId: m.id,
        email: m.user.email,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return {
    ok: true as const,
    examined: memberships.length,
    invoiced,
    skipped,
    failed,
    results,
  }
}
