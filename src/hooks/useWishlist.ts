import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface WishlistItem {
  id: string // productId — kept as `id` to match existing localStorage items
  name: string
  slug: string
  price: number // cents
  image?: string
}

interface WishlistState {
  items: WishlistItem[]
  add: (item: WishlistItem) => void
  remove: (productId: string) => void
  toggle: (item: WishlistItem) => void
  clear: () => void
  has: (productId: string) => boolean
  mergeFromServer: (serverItems: WishlistItem[]) => void
}

/**
 * Wishlist store — persisted to localStorage under `vp_wishlist` to stay in
 * sync with the pre-existing WishlistButton component (which reads/writes the
 * same key directly). We also emit a `wishlist:change` CustomEvent on mutate
 * so that legacy listeners update instantly.
 */
export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        if (get().items.some((i) => i.id === item.id)) return
        set((state) => ({ items: [...state.items, item] }))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wishlist:change'))
          // Best-effort server-side persist for logged-in users. 401s are
          // silently ignored so anonymous sessions keep working off localStorage.
          void fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: item.id }),
            keepalive: true,
          }).catch(() => {})
        }
      },
      remove: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== productId),
        }))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wishlist:change'))
          void fetch(`/api/wishlist?productId=${encodeURIComponent(productId)}`, {
            method: 'DELETE',
            keepalive: true,
          }).catch(() => {})
        }
      },
      toggle: (item) => {
        const exists = get().items.some((i) => i.id === item.id)
        if (exists) get().remove(item.id)
        else get().add(item)
      },
      clear: () => {
        set({ items: [] })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wishlist:change'))
        }
      },
      has: (productId) => get().items.some((i) => i.id === productId),
      mergeFromServer: (serverItems: WishlistItem[]) => {
        const existing = get().items
        const seen = new Set(existing.map((i) => i.id))
        const additions = serverItems.filter((i) => !seen.has(i.id))
        if (additions.length === 0) return
        set({ items: [...existing, ...additions] })
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('wishlist:change'))
        }
      },
    }),
    {
      name: 'vp_wishlist',
      storage: createJSONStorage(() => {
        // Legacy WishlistButton stores an array directly (no zustand wrapper).
        // Provide a shim that reads/writes compatibly so both work.
        return {
          getItem: (key) => {
            if (typeof window === 'undefined') return null
            const raw = window.localStorage.getItem(key)
            if (!raw) return null
            try {
              const parsed = JSON.parse(raw)
              // Zustand's own format is { state, version }. If we detect a raw
              // array, wrap it.
              if (Array.isArray(parsed)) {
                return JSON.stringify({
                  state: { items: parsed },
                  version: 0,
                })
              }
              return raw
            } catch {
              return null
            }
          },
          setItem: (key, value) => {
            if (typeof window === 'undefined') return
            try {
              const parsed = JSON.parse(value)
              // Keep both formats in sync: write the raw array for legacy
              // consumers AND the wrapped zustand object under the same key.
              // Zustand only reads back what we give it via getItem, so we can
              // store the wrapped format while the legacy WishlistButton reads
              // an array. Prefer the legacy raw-array format so existing code
              // keeps working — our getItem above re-wraps it on read.
              const items = parsed?.state?.items ?? []
              window.localStorage.setItem(key, JSON.stringify(items))
            } catch {
              window.localStorage.setItem(key, value)
            }
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return
            window.localStorage.removeItem(key)
          },
        }
      }),
    },
  ),
)

/**
 * Two-way sync between localStorage wishlist and the server-side WishlistItem
 * table. Mount once at the top of the authenticated layout. On first run after
 * a sign-in:
 *   1. PUT any local items the server doesn't know about (preserves local
 *      adds made while logged out).
 *   2. GET the user's server-side wishlist and merge anything new into local
 *      (preserves additions made from another device).
 * Subsequent add/remove calls hit the API inline via the hook actions.
 */
export function useWishlistSync(isAuthenticated: boolean) {
  const ran = useRef(false)
  useEffect(() => {
    if (!isAuthenticated || ran.current) return
    ran.current = true
    const localItems = useWishlist.getState().items
    const merge = useWishlist.getState().mergeFromServer
    void (async () => {
      try {
        if (localItems.length > 0) {
          await fetch('/api/wishlist', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productIds: localItems.map((i) => i.id) }),
          })
        }
        const res = await fetch('/api/wishlist', { method: 'GET' })
        if (!res.ok) return
        const data = (await res.json()) as {
          items: Array<{
            productId: string
            product: { id: string; name: string; slug: string; price: number; images: Array<{ url: string }> }
          }>
        }
        merge(
          data.items.map((it) => ({
            id: it.productId,
            name: it.product.name,
            slug: it.product.slug,
            price: it.product.price,
            image: it.product.images?.[0]?.url,
          })),
        )
      } catch {
        // Best-effort. If sync fails the local wishlist still works.
      }
    })()
  }, [isAuthenticated])
}
