import type { User, Product, Order, Affiliate } from '@prisma/client'

export type { User, Product, Order, Affiliate }

export interface CartItem {
  id: string
  productId: string
  variantId?: string
  /** Display name with variant suffix (e.g., "Retatrutide — 20 mg"). Cached
   *  locally so the cart icon can render an item name without a network
   *  call. Authoritative name comes from the server on /api/cart. */
  name: string
  image?: string
  quantity: number
  slug: string
  // NOTE: there is no `price` field. Prices live ONLY on the server, in the
  // Product/ProductVariant tables, and are computed at /api/cart and at
  // checkout time. Storing a price client-side was the root cause of the
  // 2026-05-18 "stale price" incident. See plan: eventual-floating-beaver.
}

export interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void
  clearCart: () => void
  itemCount: number
}

export interface ProductWithImages extends Product {
  images: { url: string; alt?: string | null; position: number }[]
  category?: { name: string; slug: string } | null
  variants: { id: string; name: string; price: number; inventory: number }[]
  _count?: { reviews: number }
}

export interface OrderWithItems extends Order {
  items: {
    id: string
    name: string
    sku?: string | null
    price: number
    quantity: number
    total: number
  }[]
  shippingAddress?: {
    name: string
    line1: string
    line2?: string | null
    city: string
    state: string
    zip: string
    country: string
  } | null
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
    }
  }
}
