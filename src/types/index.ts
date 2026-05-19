import type { User, Product, Order, Affiliate } from '@prisma/client'

export type { User, Product, Order, Affiliate }

export interface CartItem {
  id: string
  productId: string
  variantId?: string
  name: string
  price: number
  image?: string
  quantity: number
  slug: string
}

export interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  removeItem: (productId: string, variantId?: string) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string) => void
  /** Replace the cached price on a line item. Used by /cart when the
   *  server price has drifted from the localStorage-stored one. */
  setItemPrice: (productId: string, newPrice: number, variantId?: string) => void
  clearCart: () => void
  total: number
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
