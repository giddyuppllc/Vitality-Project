import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { createAdminNotification } from '@/lib/notifications'
import type { ProductStatus } from '@prisma/client'

interface ChangedBy {
  userId?: string | null
  userEmail?: string | null
  /** Free-text label for non-user mutations (e.g., 'seed:catalog', 'cron:sanity'). */
  source?: string
}

/**
 * Single source of truth for Product.status changes.
 *
 * Why: today (2026-05-18) Retatrutide was found at status=ARCHIVED with ZERO
 * AuditLog rows — meaning something flipped it outside the audited admin
 * PATCH endpoint. Centralizing every status mutation here means:
 *   1. Every change writes an AuditLog row with before + after + by.
 *   2. ACTIVE → ARCHIVED transitions on a non-internal product (i.e., one
 *      previously surfaced on the storefront) fire an AdminNotification
 *      so the admin sees the change in /admin/notifications immediately.
 *   3. Anyone re-reading the code can grep for `setProductStatus` and find
 *      every status mutation in one shot.
 *
 * Idempotent: no-op when the product is already at the desired status.
 *
 * Returns the updated Product. Throws if the product doesn't exist.
 */
export async function setProductStatus(
  productId: string,
  newStatus: ProductStatus,
  by: ChangedBy = {},
): Promise<{ id: string; status: ProductStatus; changed: boolean }> {
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, name: true, status: true },
  })
  if (!existing) throw new Error(`Product ${productId} not found`)

  // Idempotent fast path.
  if (existing.status === newStatus) {
    return { id: existing.id, status: existing.status, changed: false }
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { status: newStatus },
    select: { id: true, status: true },
  })

  // Audit log — non-null userId means a human admin; source covers programmatic
  // callers (seed scripts, cron jobs, the membership-product upsert).
  await logAudit({
    userId: by.userId ?? null,
    userEmail: by.userEmail ?? null,
    action: 'product.status',
    entityType: 'Product',
    entityId: productId,
    metadata: {
      from: existing.status,
      to: newStatus,
      slug: existing.slug,
      name: existing.name,
      source: by.source ?? 'admin',
    },
  })

  // Surface ACTIVE → non-ACTIVE changes as an admin notification — those
  // are the silent ones that hide products from the storefront. Anything
  // going ACTIVE doesn't need a notification (it's the safe direction).
  // Internal placeholder products (slug starts with 'vitality-') are
  // excluded from notifications since their status changes are routine.
  const wasVisible = existing.status === 'ACTIVE'
  const becomesHidden = newStatus !== 'ACTIVE'
  const isInternal = existing.slug.startsWith('vitality-')
  if (wasVisible && becomesHidden && !isInternal) {
    await createAdminNotification({
      type: 'SYSTEM',
      title: `Product hidden from storefront: ${existing.name}`,
      body:
        `${existing.name} (slug "${existing.slug}") changed from ${existing.status} to ${newStatus}` +
        (by.source ? ` via ${by.source}` : '') +
        (by.userEmail ? ` by ${by.userEmail}` : '') +
        '. The product no longer appears in /products. Revert from /admin/products if unintended.',
      link: `/admin/products`,
      entityType: 'Product',
      entityId: productId,
    })
  }

  return { id: updated.id, status: updated.status, changed: true }
}
