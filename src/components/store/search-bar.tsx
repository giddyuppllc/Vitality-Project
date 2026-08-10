'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { productImage, isFallbackImage } from '@/lib/product-image'

interface Suggestion {
  id: string
  name: string
  slug: string
  price: number
  images: { url: string }[]
  category?: { name: string } | null
}

export function SearchBar({
  autoFocus = false,
  onClose,
  variant = 'inline',
}: {
  autoFocus?: boolean
  onClose?: () => void
  variant?: 'inline' | 'full'
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setItems([])
      return
    }

    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(term)}&limit=6`,
        )
        if (res.ok) {
          const data = await res.json()
          setItems(Array.isArray(data) ? data : [])
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 200)

    return () => clearTimeout(t)
  }, [q])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    router.push(`/search?q=${encodeURIComponent(term)}`)
    onClose?.()
  }

  return (
    <div ref={ref} className={`relative ${variant === 'full' ? 'w-full' : 'w-full max-w-md'}`}>
      <form onSubmit={submit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q && setOpen(true)}
            placeholder="Search peptides, stacks, categories…"
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {loading ? (
            <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-white/40 animate-spin" />
          ) : q ? (
            <button
              type="button"
              onClick={() => {
                setQ('')
                setItems([])
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </form>

      {open && q && items.length > 0 && (
        <div className="absolute left-0 right-0 mt-2 glass rounded-xl shadow-xl overflow-hidden z-50">
          <ul>
            {items.map((p) => {
              const img = p.images?.[0]
              return (
                <li key={p.id}>
                  <Link
                    href={`/products/${p.slug}`}
                    onClick={() => {
                      setOpen(false)
                      onClose?.()
                    }}
                    className="flex items-center gap-3 p-3 hover:bg-white/5 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-dark-800 shrink-0 overflow-hidden">
                      {/* Rendered nothing at all without a photo — an empty
                          grey square. Falls back to the standard vial now. */}
                      <Image
                        src={productImage(p)}
                        alt=""
                        width={40}
                        height={40}
                        className={`w-full h-full ${isFallbackImage(p) ? 'object-contain p-1' : 'object-cover'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {p.name}
                      </p>
                      {p.category && (
                        <p className="text-xs text-white/40">
                          {p.category.name}
                        </p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {formatPrice(p.price)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <div className="p-3 border-t border-white/10">
            <button
              onClick={submit}
              className="text-xs text-brand-400 hover:text-brand-300"
            >
              See all results for &quot;{q}&quot; →
            </button>
          </div>
        </div>
      )}

      {open && q.length >= 2 && !loading && items.length === 0 && (
        <div className="absolute left-0 right-0 mt-2 glass rounded-xl shadow-xl p-4 text-center text-white/40 text-sm z-50">
          No matches for &quot;{q}&quot;
        </div>
      )}
    </div>
  )
}
