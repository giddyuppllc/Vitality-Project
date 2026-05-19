import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminNotification } from '@/lib/notifications'
import { trackCronRun } from '@/lib/cron-tracker'
import { setProductStatus } from '@/lib/products'

// Daily storefront sanity scan.
//
// On 2026-05-18 we hit a scenario where:
//   - `Retatrutide` had been silently flipped to status=ARCHIVED, making its
//     /products/retatrutide page 404 and removing it from the listing.
//   - `vitality-membership` (internal Zelle-invoice placeholder, supposed
//     to be ARCHIVED) had drifted to status=ACTIVE, leaking onto the public
//     /products listing as a $25 card.
//
// Both with ZERO AuditLog rows — they slipped past every existing safeguard.
//
// This cron runs daily and:
//   1. Auto-archives any product whose slug starts with `vitality-` that is
//      currently ACTIVE (these are internal placeholders that must never
//      surface on the storefront). Auto-correction runs through
//      `setProductStatus` so the fix itself is audit-logged.
//   2. Creates an AdminNotification listing every ACTIVE catalog product
//      that DROPPED to ARCHIVED or DRAFT since the previous run — admin
//      sees it in /admin/notifications and can revert if unintended.
//
// Idempotent: stores the last-seen snapshot in SiteSetting and only fires
// notifications on deltas.
//
// Auth: ?secret=<CRON_SECRET> or Authorization: Bearer <CRON_SECRET>.

const SNAPSHOT_KEY = 'storefront_sanity_snapshot'

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
    'Storefront sanity',
    () => doRun(),
    (r) =>
      `internalAutoArchived=${r.internalAutoArchived} newlyHidden=${r.newlyHidden.length} totalActive=${r.totalActive}`,
  )
}

async function doRun() {
  // 1. Auto-archive any internal placeholder products that drifted to ACTIVE.
  const internalActives = await prisma.product.findMany({
    where: {
      slug: { startsWith: 'vitality-' },
      status: 'ACTIVE',
    },
    select: { id: true, slug: true, name: true },
  })
  let internalAutoArchived = 0
  for (const p of internalActives) {
    await setProductStatus(p.id, 'ARCHIVED', {
      source: 'cron:storefront-sanity (auto-archive internal)',
    })
    internalAutoArchived++
    await createAdminNotification({
      type: 'SYSTEM',
      title: `Auto-archived internal product: ${p.name}`,
      body: `${p.name} (slug "${p.slug}") was marked ACTIVE and would have leaked onto the public /products listing. The sanity cron has flipped it back to ARCHIVED. Investigate how it became ACTIVE — AuditLog will show the prior change source.`,
      link: `/admin/products`,
      entityType: 'Product',
      entityId: p.id,
    })
  }

  // 2. Detect catalog products that went ACTIVE → ARCHIVED/DRAFT since last run.
  const allProducts = await prisma.product.findMany({
    select: { id: true, slug: true, name: true, status: true },
  })
  const totalActive = allProducts.filter((p) => p.status === 'ACTIVE').length
  const currentStatusBySlug: Record<string, string> = {}
  for (const p of allProducts) currentStatusBySlug[p.slug] = p.status

  const snap = await prisma.siteSetting.findUnique({
    where: { key: SNAPSHOT_KEY },
  })
  let prevStatusBySlug: Record<string, string> = {}
  if (snap?.value) {
    try {
      prevStatusBySlug = JSON.parse(snap.value)
    } catch {
      /* corrupted snapshot — treat as empty, will rebuild this run */
    }
  }

  const newlyHidden: Array<{ slug: string; name: string; was: string; now: string }> = []
  for (const p of allProducts) {
    const prev = prevStatusBySlug[p.slug]
    if (prev === 'ACTIVE' && p.status !== 'ACTIVE' && !p.slug.startsWith('vitality-')) {
      newlyHidden.push({ slug: p.slug, name: p.name, was: prev, now: p.status })
    }
  }

  if (newlyHidden.length > 0) {
    await createAdminNotification({
      type: 'SYSTEM',
      title: `${newlyHidden.length} catalog product${newlyHidden.length === 1 ? '' : 's'} dropped from the storefront`,
      body:
        `These products went from ACTIVE to non-ACTIVE in the last 24h and are no longer visible to customers:\n\n` +
        newlyHidden
          .map(
            (n) => `  • ${n.name} (slug "${n.slug}"): ${n.was} → ${n.now}`,
          )
          .join('\n') +
        `\n\nIf any of these were unintentional, revert in /admin/products. Check the AuditLog for the cause.`,
      link: `/admin/products`,
      entityType: 'Product',
    })
  }

  // 3. Save current snapshot for the next run.
  const serialized = JSON.stringify(currentStatusBySlug)
  await prisma.siteSetting.upsert({
    where: { key: SNAPSHOT_KEY },
    update: { value: serialized },
    create: { key: SNAPSHOT_KEY, value: serialized },
  })

  return {
    ok: true as const,
    totalProducts: allProducts.length,
    totalActive,
    internalAutoArchived,
    newlyHidden,
  }
}
