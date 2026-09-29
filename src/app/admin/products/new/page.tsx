'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { parseMoneyToCents } from '@/lib/money'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Set when the API says this product looks like one that already exists.
  const [duplicate, setDuplicate] = useState<
    { message: string; id: string; name: string; status: string } | null
  >(null)
  const [form, setForm] = useState({
    name: '', description: '', shortDesc: '', price: '', comparePrice: '',
    sku: '', inventory: '0', featured: false,
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
    tags: '', imageUrl: '', imageAlt: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Required. A number input yields "" for anything it cannot parse, so
    // pasting "$64" or "1,200" leaves this empty — and the old
    // Math.round(parseFloat("") * 100) produced NaN, which JSON.stringify
    // writes as null. Check it before we start.
    setDuplicate(null)
    const priceCents = parseMoneyToCents(form.price)
    if (priceCents === null) {
      alert('Enter a price, e.g. 49.99')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          shortDesc: form.shortDesc || undefined,
          price: priceCents,
          comparePrice: form.comparePrice ? (parseMoneyToCents(form.comparePrice) ?? undefined) : undefined,
          sku: form.sku || undefined,
          inventory: parseInt(form.inventory),
          featured: form.featured,
          status: form.status,
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()) : [],
          images: form.imageUrl ? [{ url: form.imageUrl, alt: form.imageAlt, position: 0 }] : [],
        }),
      })
      if (res.ok) {
        router.push('/admin/products')
      } else {
        const d = await res.json()
        // A near-duplicate comes back as 409 with the product it looks like.
        // Offer to open that one — creating a second row is what produced five
        // duplicate products in this catalog already.
        if (res.status === 409 && d.match) {
          setDuplicate({ message: d.message, id: d.match.id, name: d.match.name, status: d.match.status })
          return
        }
        alert('Error: ' + JSON.stringify(d.error))
      }
    } finally {
      setLoading(false)
    }
  }

  const f = (field: keyof typeof form) => ({
    value: form[field] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm({ ...form, [field]: e.target.value }),
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin/products" className="text-white/40 hover:text-white transition-colors text-sm">← Products</a>
        <h1 className="text-2xl font-bold">Add Product</h1>
      </div>

      {duplicate && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <p className="font-medium">{duplicate.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              href={`/admin/products/${duplicate.id}/edit`}
              className="underline underline-offset-2 hover:text-amber-100"
            >
              Open &ldquo;{duplicate.name}&rdquo; ({duplicate.status.toLowerCase()}) instead
            </Link>
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              className="text-amber-200/70 hover:text-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Basic Info</h2>
          <Input label="Product Name *" required {...f('name')} />
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">Description *</label>
            <textarea required rows={5} {...f('description')}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              placeholder="Full product description..." />
          </div>
          <Input label="Short Description" {...f('shortDesc')} placeholder="One-liner for product cards" />
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Pricing & Inventory</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Price ($) *" type="number" step="0.01" required {...f('price')} placeholder="49.99" />
            <Input label="Compare At Price ($)" type="number" step="0.01" {...f('comparePrice')} placeholder="69.99" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" {...f('sku')} placeholder="VP-BPC-10MG" />
            <Input label="Inventory" type="number" min="0" {...f('inventory')} />
          </div>
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Image</h2>
          <Input label="Image URL" {...f('imageUrl')} placeholder="https://..." />
          <Input label="Image Alt Text" {...f('imageAlt')} placeholder="Product image description" />
        </div>

        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold">Publishing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4 rounded accent-brand-500" />
                <span className="text-sm font-medium text-white/70">Featured on homepage</span>
              </label>
            </div>
          </div>
          <Input label="Tags (comma separated)" {...f('tags')} placeholder="peptide, recovery, bpc-157" />
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={loading} size="lg">Create Product</Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
