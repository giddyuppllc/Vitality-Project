import { prisma } from '@/lib/prisma'

/**
 * Decrement stock without ever going negative.
 *
 * WHY
 * Six call sites did this, in three files:
 *
 *     prisma.productVariant.update({ data: { inventory: { decrement: qty } } })
 *       .catch(() => null)
 *
 * Two problems, both live in production on 2026-08-10:
 *
 * 1. NOTHING STOPPED IT GOING BELOW ZERO. Five variants were negative —
 *    Insulin Syringes at -6, Alcohol Swabs at -3, GHK-Cu at -3, MOTS-c and
 *    SS-31 at -1. You cannot sell minus six syringes; those are oversells that
 *    already happened and were recorded as if they were fine.
 *
 * 2. `.catch(() => null)` SWALLOWED THE FAILURE. A decrement that never ran
 *    looked identical to one that did — the same silent-failure shape as the
 *    variants editor and the deploy pipeline.
 *
 * WHAT THIS DOES
 * The guarded updateMany only decrements when there is enough stock, and the
 * check + write are one statement, so two simultaneous orders cannot both pass
 * it. When stock is short it clamps to zero and reports the shortfall rather
 * than silently going negative.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * It never throws or fails the order. By the time this runs the customer has
 * already been charged and the order row exists — refusing here would take
 * money and leave no order. An oversell is a fulfilment problem; a missing paid
 * order is an accounting one. So it records and continues, loudly.
 */
export interface StockResult {
  ok: boolean
  /** Units that could NOT be taken from stock — 0 when fully satisfied. */
  shortfall: number
  /** Inventory left AFTER the take — callers use this for low-stock alerts. */
  remaining: number
}

async function take(
  model: 'productVariant' | 'product',
  id: string,
  quantity: number,
): Promise<StockResult> {
  const table = model === 'productVariant' ? prisma.productVariant : prisma.product

  // Guarded: only decrements when inventory >= quantity. Check and write in one
  // statement, so concurrent orders cannot both see "enough" and both take it.
  const enough = await (table as typeof prisma.product).updateMany({
    where: { id, inventory: { gte: quantity } },
    data: { inventory: { decrement: quantity } },
  })
  if (enough.count > 0) {
    const after = await (table as typeof prisma.product).findUnique({
      where: { id },
      select: { inventory: true },
    })
    return { ok: true, shortfall: 0, remaining: Math.max(0, after?.inventory ?? 0) }
  }

  // Not enough. Take what is there, floor at zero, and report the rest.
  const row = await (table as typeof prisma.product).findUnique({
    where: { id },
    select: { inventory: true },
  })
  const available = Math.max(0, row?.inventory ?? 0)
  if (available > 0) {
    await (table as typeof prisma.product).updateMany({
      where: { id, inventory: { gte: available } },
      data: { inventory: { decrement: available } },
    })
  }
  return { ok: false, shortfall: quantity - available, remaining: 0 }
}

/**
 * Take stock for one order line. Prefers the variant when the line has one,
 * matching how the catalog is priced.
 */
export async function decrementStock(item: {
  variantId?: string | null
  productId: string
  quantity: number
}, context = 'checkout'): Promise<StockResult> {
  try {
    const res = item.variantId
      ? await take('productVariant', item.variantId, item.quantity)
      : await take('product', item.productId, item.quantity)

    if (!res.ok) {
      // Visible on purpose. This is an oversell — somebody has paid for stock
      // that is not there, and fulfilment needs to know today, not at pick time.
      console.error(
        `[${context}] OVERSELL: ${item.variantId ? `variant ${item.variantId}` : `product ${item.productId}`}` +
          ` short by ${res.shortfall} of ${item.quantity}`,
      )
    }
    return res
  } catch (err) {
    // Was `.catch(() => null)`: a decrement that never ran was indistinguishable
    // from one that did.
    console.error(`[${context}] stock decrement FAILED for product ${item.productId}:`, err)
    return { ok: false, shortfall: item.quantity, remaining: 0 }
  }
}
