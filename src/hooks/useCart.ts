'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useRef } from 'react'
import type { CartState } from '@/types'

/**
 * Client-side cart state.
 *
 * Important: this store deliberately does NOT track prices. Cart items
 * are { productId, variantId, quantity, name, slug, image }. The price
 * for any line — and the cart total — is always derived from the server
 * by POSTing the refs to /api/cart and rendering the response.
 *
 * `itemCount` is a sum of quantities (for the navbar badge) — no price
 * info needed for that.
 */
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

      clearCart: () => set({ items: [] }),

      get itemCount() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    {
      name: 'vitality-cart',
      // Defensive migration: cart entries from before the 2026-05-19 refactor
      // had a `price` field. We strip it on rehydrate so no stale price
      // can ever sneak into the UI. Re-read /api/cart for live prices.
      // Zustand's persist middleware only restores the data fields; methods
      // come from the store factory. So we only need to return the data
      // shape — the cast through `unknown` satisfies TS without runtime cost.
      migrate: (persistedState) => {
        const state = persistedState as { items?: Array<Record<string, unknown>> }
        if (state?.items && Array.isArray(state.items)) {
          state.items = state.items.map((i) => {
            const { price: _price, ...rest } = i
            return rest
          })
        }
        return state as unknown as CartState
      },
      version: 2,
    }
  )
)

/**
 * Mirror cart state to the server (`/api/cart/save`) on change.
 * Debounced 30s. Used for abandoned-cart recovery emails — NOT the source
 * of truth for pricing.
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
