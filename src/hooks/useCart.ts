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
 * The badge count is NOT stored. It used to be a getter on the store:
 *
 *     get itemCount() { return get().items.reduce(...) }
 *
 * which zustand destroys. setState does Object.assign({}, state, partial),
 * and Object.assign reads an accessor and copies its VALUE — so the first
 * write flattened the getter into a frozen number. persist's own rehydrate
 * counts as a write, so on every page load the badge froze at 0 and never
 * moved again, however full the cart was. It was even serialised into
 * localStorage as "itemCount":0.
 *
 * Derive it with the selector below instead, which recomputes on every change
 * and cannot go stale.
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
      version: 3,
      // Only `items` is real state. Without this, anything else on the store
      // (like the old flattened itemCount) gets written to localStorage too.
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        useCartHydrated.setState({ hydrated: true })
        void state
      },
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

/**
 * Live item count for the navbar badge and the cart heading.
 *
 * A selector, not stored state — it recomputes from `items` on every change,
 * so it cannot drift from what is actually in the cart.
 */
export function useCartItemCount(): number {
  return useCart((state) => state.items.reduce((sum, i) => sum + i.quantity, 0))
}

/**
 * Whether the persisted cart has been read back from localStorage yet.
 *
 * The server renders with an empty cart because localStorage does not exist
 * there. Without this flag the first client paint also shows empty, then the
 * cart appears a moment later — which reads as "my cart vanished". Components
 * can hold the badge back until this is true instead of rendering a wrong
 * number and correcting it.
 */
export const useCartHydrated = create<{ hydrated: boolean }>(() => ({
  hydrated: false,
}))
