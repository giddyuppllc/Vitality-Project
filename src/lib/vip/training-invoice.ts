import { prisma } from '@/lib/prisma'
import { generateOrderNumber } from '@/lib/utils'
import { setProductStatus } from '@/lib/products'
import { getZelleIdentity } from '@/lib/zelle'
import { grantTrainingAccess, hasCourseGrant } from './course-grants'
import { sendVipEmail } from './mailer'
import { trainingInvoiceEmail, trainingUnlockedEmail } from './academy-emails'

/**
 * Paid trainings bought with money: the same Zelle invoice flow memberships
 * use on vitalityproject.global, in parallel.
 *
 *   membership invoice  Order.notes = "MEMBERSHIP:<membershipId>:<tier>"
 *   training invoice    Order.notes = "TRAINING:<courseId>:<userId>"
 *
 * The invoice is an ordinary unpaid Zelle Order (it shows in the member's
 * .global order history and the admin order list). When an admin marks it
 * paid — api/admin/orders/[id]/mark-paid, or the order-detail PATCH — the
 * paid pipeline calls grantTrainingFromOrder() INSTEAD of fulfilment, stock,
 * loyalty points and affiliate commission, which writes the VipCourseGrant.
 * The grant's unique (userId, courseId) makes it exactly-once.
 */

export const TRAINING_NOTE_PREFIX = 'TRAINING:'
const TRAINING_PRODUCT_SLUG = 'vitality-clubhouse-training'

export function trainingNote(courseId: string, userId: string): string {
  return `${TRAINING_NOTE_PREFIX}${courseId}:${userId}`
}

export function isTrainingInvoice(notes: string | null | undefined): boolean {
  return !!notes && notes.startsWith(TRAINING_NOTE_PREFIX)
}

export function parseTrainingNote(notes: string | null | undefined): { courseId: string; userId: string } | null {
  if (!isTrainingInvoice(notes)) return null
  const [, courseId, userId] = notes!.split(':')
  if (!courseId || !userId) return null
  return { courseId, userId }
}

/** The hidden line-item product every training invoice uses. Never on the storefront. */
async function ensureTrainingProduct() {
  const product = await prisma.product.upsert({
    where: { slug: TRAINING_PRODUCT_SLUG },
    update: {},
    create: {
      slug: TRAINING_PRODUCT_SLUG,
      name: 'Clubhouse Training',
      shortDesc: 'Clubhouse training — billed via Zelle',
      description: 'Training billing line item. Not for direct purchase — placed from the Clubhouse Academy.',
      price: 0,
      status: 'ARCHIVED',
      trackInventory: false,
      sku: 'VP-TRAINING',
    },
  })
  if (product.status === 'ACTIVE') {
    await setProductStatus(product.id, 'ARCHIVED', { source: 'vip training invoice (auto-correct)' })
  }
  return product
}

export class TrainingInvoiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export interface TrainingInvoiceView {
  orderNumber: string
  total: number
  createdAt: string
  zelle: { primary: string; altHandle?: string; displayName?: string }
}

/** The member's open (unpaid, not cancelled) invoice for this course, if any. */
export async function openTrainingInvoice(userId: string, courseId: string) {
  return prisma.order.findFirst({
    where: { userId, notes: trainingNote(courseId, userId), paymentStatus: 'UNPAID', status: { not: 'CANCELLED' } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, orderNumber: true, total: true, createdAt: true },
  })
}

export async function createTrainingInvoice(
  user: { id: string; email: string; name: string | null },
  courseId: string,
): Promise<{ already: true } | { already: false; reused: boolean; invoice: TrainingInvoiceView }> {
  const course = await prisma.vipCourse.findUnique({ where: { id: courseId } })
  if (!course || !course.published) throw new TrainingInvoiceError('Not found', 404)
  const price = course.priceCents ?? 0
  if (price <= 0) throw new TrainingInvoiceError('This training is not for sale', 400)
  if (await hasCourseGrant(user.id, courseId)) return { already: true }

  const zelle = await getZelleIdentity()
  if (!zelle.primary) throw new TrainingInvoiceError('Zelle payments are not available right now. Please try again later.', 503)

  const open = await openTrainingInvoice(user.id, courseId)
  if (open) {
    return {
      already: false,
      reused: true,
      invoice: { orderNumber: open.orderNumber, total: open.total, createdAt: open.createdAt.toISOString(), zelle },
    }
  }

  const product = await ensureTrainingProduct()
  const order = await prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      userId: user.id,
      email: user.email,
      subtotal: price,
      total: price,
      paymentMethod: 'zelle',
      paymentStatus: 'UNPAID',
      status: 'PENDING',
      notes: trainingNote(courseId, user.id),
      items: {
        create: [{ productId: product.id, name: `Clubhouse training — ${course.title}`, sku: 'VP-TRAINING', price, quantity: 1, total: price }],
      },
    },
  })

  void sendVipEmail(
    user.email,
    trainingInvoiceEmail({
      userId: user.id,
      name: user.name,
      courseTitle: course.title,
      amountCents: price,
      invoiceNumber: order.orderNumber,
      zellePrimary: zelle.primary,
      zelleAlt: zelle.altHandle,
      zelleName: zelle.displayName,
    }),
  ).catch((err) => console.error('[vip/training] invoice email failed:', err))

  return {
    already: false,
    reused: false,
    invoice: { orderNumber: order.orderNumber, total: order.total, createdAt: order.createdAt.toISOString(), zelle },
  }
}

/**
 * Called by the paid pipeline for a TRAINING: invoice. Writes the grant
 * exactly once and tells the member. Returns what happened.
 */
export async function grantTrainingFromOrder(order: {
  id: string
  notes: string | null
  userId: string | null
}): Promise<'granted' | 'already' | 'invalid'> {
  const parsed = parseTrainingNote(order.notes)
  if (!parsed || !order.userId || parsed.userId !== order.userId) return 'invalid'
  const course = await prisma.vipCourse.findUnique({ where: { id: parsed.courseId }, select: { id: true, title: true, slug: true } })
  if (!course) return 'invalid'
  const { created } = await grantTrainingAccess(order.userId, course.id, 'purchase')
  if (!created) return 'already'
  const user = await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true, name: true } })
  if (user) {
    void sendVipEmail(
      user.email,
      trainingUnlockedEmail({ userId: order.userId, name: user.name, courseTitle: course.title, courseSlug: course.slug }),
    ).catch((err) => console.error('[vip/training] unlocked email failed:', err))
  }
  return 'granted'
}
