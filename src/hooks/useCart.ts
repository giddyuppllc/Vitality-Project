'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useRef } from 'react'
import type { CartState, CartItem } from '@/types'

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId
          )
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          const id = `${item.productId}-${item.variantId ?? 'default'}-${Date.now()}`
          return { items: [...state.items, { ...item, id }] }
        })
      },

      removeItem: (productId, variantId) => {
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId)
          ),
        }))
      },

      updateQuantity: (productId, quantity, variantId) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity }
              : i
          ),
        }))
      },

      setItemPrice: (productId, newPrice, variantId) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, price: newPrice }
              : i
          ),
        }))
      },

      clearCart: () => set({ items: [] }),

      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },

      get itemCount() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    {
      name: 'vitality-cart',
    }
  )
)

/**
 * Subscribe-style hook that saves cart state to the API when cart changes.
 * Debounced 30s. Skips empty carts. If user has no session email it will still
 * post; the API will silently skip when it can't attribute the cart.
 */
export function useCartAutoSave(email?: string | null) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastHash = useRef<string>('')

  useEffect(() => {
    const unsubscribe = useCart.subscribe((state) => {
      if (!state.items || state.items.length === 0) return
      const snapshot = JSON.stringify(
        state.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? null,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          slug: i.slug,
        }))
      )
      if (snapshot === lastHash.current) return
      lastHash.current = snapshot

      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void fetch('/api/cart/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: state.items,
            email: email ?? undefined,
          }),
        }).catch(() => {
          /* silent */
        })
      }, 30_000)
    })

    return () => {
      if (timer.current) clearTimeout(timer.current)
      unsubscribe()
    }
  }, [email])
}
