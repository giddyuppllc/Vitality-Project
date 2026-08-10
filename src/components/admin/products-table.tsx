'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Edit, Eye, Download, Loader2, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/utils'
import { productImage, isFallbackImage } from '@/lib/product-image'

interface Product {
  id: string
  name: string
  slug: string
  sku: string | null
  price: number
  inventory: number
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  featured: boolean
  category?: { name: string } | null
  images: { url: string }[]
  _count: { orderItems: number }
}

export function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState('')
  const [payload, setPayload] = useState('ACTIVE')

  /**
   * Search + filters. The catalog outgrew a plain list — finding one variant of
   * BPC meant scrolling. Everything is derived from `products` in memory: the
   * page already loads the full set server-side, so filtering here costs no
   * round-trip and keeps bulk-select working on what you can actually see.
   */
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | Product['status']>('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [sort, setSort] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'inventory-asc'>('name-asc')

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean) as string[])).sort(),
    [products],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = products.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (categoryFilter !== 'ALL' && (p.category?.name ?? '') !== categoryFilter) return false
      if (!q) return true
      // Match name, SKU and slug — SKU is how stock is looked up, and slug is
      // what a support link contains.
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q)
      )
    })
    const by: Record<typeof sort, (a: Product, b: Product) => number> = {
      'name-asc': (a, b) => a.name.localeCompare(b.name),
      'name-desc': (a, b) => b.name.localeCompare(a.name),
      'price-asc': (a, b) => a.price - b.price,
      'price-desc': (a, b) => b.price - a.price,
      'inventory-asc': (a, b) => a.inventory - b.inventory,
    }
    return [...out].sort(by[sort])
  }, [products, query, statusFilter, categoryFilter, sort])

  const allSelected = useMemo(
    () => visible.length > 0 && visible.every((p) => selected.has(p.id)),
    [visible, selected],
  )

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const toggleAll = () => {
    if (allSelected) setSelected(new Set())
    // Select-all must mean what is ON SCREEN; selecting hidden rows and then
    // bulk-archiving them is how you lose products you never looked at.
    else setSelected(new Set(visible.map((p) => p.id)))
  }

  const runBulk = async () => {
    if (!action || selected.size === 0) return
    const body: any = { ids: Array.from(selected), action }
    if (action === 'status') body.payload = { status: payload }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSelected(new Set())
        setAction('')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Bulk toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={selected.size === 0}
            className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm disabled:opacity-50"
          >
            <option value="">Bulk actions…</option>
            <option value="status">Change status</option>
            <option value="feature">Set featured</option>
            <option value="unfeature">Remove featured</option>
            <option value="delete">Archive</option>
          </select>
          {action === 'status' && (
            <select
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          )}
          <Button
            size="sm"
            onClick={runBulk}
            disabled={!action || selected.size === 0 || loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply ({selected.size})
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="/api/admin/products/export"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/10 text-sm text-white/70 hover:text-white transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>
      </div>

      {/* Search + filters. Sits above the table so the count below always
          describes what you are looking at. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU or slug…"
            aria-label="Search products"
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-brand-400/60"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          aria-label="Filter by status"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-brand-400/60"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-brand-400/60"
        >
          <option value="ALL">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort products"
          className="px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-sm text-white/80 focus:outline-none focus:border-brand-400/60"
        >
          <option value="name-asc">Name A–Z</option>
          <option value="name-desc">Name Z–A</option>
          <option value="price-asc">Price low → high</option>
          <option value="price-desc">Price high → low</option>
          <option value="inventory-asc">Inventory low → high</option>
        </select>

        <span className="text-sm text-white/40 tabular-nums">
          {visible.length === products.length
            ? `${products.length} products`
            : `${visible.length} of ${products.length}`}
        </span>

        {(query || statusFilter !== 'ALL' || categoryFilter !== 'ALL') && (
          <button
            type="button"
            onClick={() => { setQuery(''); setStatusFilter('ALL'); setCategoryFilter('ALL') }}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-white/40 py-6 text-center">
          No products match that search.
        </p>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              <th className="px-5 py-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-brand-500"
                />
              </th>
              {['Product', 'Category', 'Price', 'Stock', 'Status', 'Sold', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {visible.map((p) => (
              <tr
                key={p.id}
                className={`hover:bg-white/2 transition-colors ${
                  selected.has(p.id) ? 'bg-brand-500/5' : ''
                }`}
              >
                <td className="px-5 py-4">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggleOne(p.id)}
                    className="w-4 h-4 rounded accent-brand-500"
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-dark-700 shrink-0 flex items-center justify-center text-white/20 text-xs font-bold">
                      {/* Was a 'VP' text box when a product had no photo. Every
                          image-less product now shows the standard vial. */}
                      <img
                        src={productImage(p)}
                        alt=""
                        className={`w-full h-full rounded-xl ${isFallbackImage(p) ? 'object-contain p-1' : 'object-cover'}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      {p.sku && (
                        <p className="text-xs text-white/30">{p.sku}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {p.category?.name ?? '—'}
                </td>
                <td className="px-5 py-4 text-sm font-medium">
                  {formatPrice(p.price)}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`text-sm font-medium ${
                      p.inventory === 0
                        ? 'text-red-400'
                        : p.inventory <= 5
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {p.inventory}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <Badge
                    variant={
                      p.status === 'ACTIVE'
                        ? 'success'
                        : p.status === 'DRAFT'
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {p.status}
                  </Badge>
                </td>
                <td className="px-5 py-4 text-sm text-white/60">
                  {p._count.orderItems}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/products/${p.slug}`}
                      className="p-1.5 text-white/30 hover:text-white transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/admin/products/${p.id}/edit`}
                      className="p-1.5 text-white/30 hover:text-brand-400 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
