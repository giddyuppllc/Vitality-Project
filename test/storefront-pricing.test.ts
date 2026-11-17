import { describe, expect, it } from 'vitest'
import { displayPrice, highestPrice, hasPriceRange, discountPercent, sellableVariants } from '@/lib/display-price'
import { parseLimit } from '@/lib/public-product'

// Shapes taken from live product pages on 2026-11-17.
describe('displayPrice — the shown price is the charged (variant) price', () => {
  it('ignores a stale Product.price when the product has variants', () => {
    // Selank: Product.price $45, only size 10 mg at $74 — the cart charges $74.
    expect(displayPrice({ price: 4500, variants: [{ price: 7400 }] })).toBe(7400)
    // BPC-157: Product.price $80, only size $64.
    expect(displayPrice({ price: 8000, variants: [{ price: 6400 }] })).toBe(6400)
  })

  it('uses the cheapest size and reports a range', () => {
    const reta = { price: 8800, variants: [{ price: 9500 }, { price: 8800 }] }
    expect(displayPrice(reta)).toBe(8800)
    expect(highestPrice(reta)).toBe(9500)
    expect(hasPriceRange(reta)).toBe(true)
    expect(hasPriceRange({ price: 100, variants: [{ price: 100 }] })).toBe(false)
  })

  it('a product whose only sizes are $0 is not sellable (cart refuses price-unset)', () => {
    // DSIP / Glutathione on live.
    expect(displayPrice({ price: 3600, variants: [{ price: 0 }] })).toBeNull()
    expect(sellableVariants([{ price: 0 }, { price: 500 }, { price: 300 }])).toEqual([{ price: 300 }, { price: 500 }])
  })

  it('no variants → product price; $0 product → not sellable', () => {
    expect(displayPrice({ price: 800, variants: [] })).toBe(800)
    expect(displayPrice({ price: 800 })).toBe(800)
    expect(displayPrice({ price: 0, variants: [] })).toBeNull()
  })

  it('discountPercent never shows a negative or zero-price badge', () => {
    expect(discountPercent(30000, 8800)).toBe(71)
    expect(discountPercent(5000, 6000)).toBeNull()
    expect(discountPercent(null, 6000)).toBeNull()
    expect(discountPercent(5000, null)).toBeNull()
  })
})

describe('parseLimit — public product endpoints', () => {
  it('garbage falls back instead of throwing (was a 500 on live)', () => {
    expect(parseLimit('abc', 20, 100)).toBe(20)
    expect(parseLimit(null, 20, 100)).toBe(20)
    expect(parseLimit('-5', 20, 100)).toBe(20)
    expect(parseLimit('5000', 20, 100)).toBe(100)
    expect(parseLimit('7', 20, 100)).toBe(7)
  })
})
