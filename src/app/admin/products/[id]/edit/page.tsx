'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { ProductVariantsEditor } from '@/components/admin/product-variants-editor'
import { ProductImagesEditor } from '@/components/admin/product-images-editor'

type Status = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

interface Form {
  name: string
  shortDesc: string
  description: string
  price: string
  comparePrice: string
  salePrice: string
  sku: string
  inventory: string
  status: Status
  featured: boolean
  tags: string
}

const empty: Form = {
  name: '', shortDesc: '', description: '',
  price: '', comparePrice: '', salePrice: '',
  sku: '', inventory: '0',
  status: 'ACTIVE', featured: false, tags: '',
}

export default function EditProductPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [form, setForm] = useState<Form>(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/products/${id}`)
      .then((r) => r.json())
      .then((p) => {
        setForm({
          name: p.name ?? '',
          shortDesc: p.shortDesc ?? '',
          description: p.description ?? '',
          price: p.price != null ? (p.price / 100).toFixed(2) : '',
          comparePrice: p.comparePrice != null ? (p.comparePrice / 100).toFixed(2) : '',
          salePrice: p.salePrice != null ? (p.salePrice / 100).toFixed(2) : '',
          sku: p.sku ?? '',
          inventory: String(p.inventory ?? 0),
          status: p.status ?? 'ACTIVE',
          featured: p.featured ?? false,
          tags: (p.tags ?? []).join(', '),
        })
      })
      .finally(() => setLoading(false))
  }, [id])

  const set = (field: keyof Form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        description: form.description,
        shortDesc: form.shortDesc || undefined,
        price: Math.round(parseFloat(form.price) * 100),
        comparePrice: form.comparePrice ? Math.round(parseFloat(form.comparePrice) * 100) : null,
        salePrice: form.salePrice ? Math.round(parseFloat(form.salePrice) * 100) : null,
        sku: form.sku || undefined,
        inventory: parseInt(form.inventory),
        featured: form.featured,
        status: form.status,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      }
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      } else {
        const d = await res.json()
        setError(JSON.stringify(d.error))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => router.push('/admin/products')} className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold">Edit Product</h1>
          <p className="text-white/40 text-sm mt-0.5">{form.name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic Info */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white/80">Basic Info</h2>
          <Input label="Product Name *" required value={form.name} onChange={set('name')} />
          <Input label="Short Description" value={form.shortDesc} onChange={set('shortDesc')} placeholder="One-liner for product cards" />
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">Full Description *</label>
            <textarea
              required rows={6} value={form.description} onChange={set('description')}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>
        </div>

        {/* Images */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-white/80">Product Images</h2>
            <p className="text-xs text-white/40 mt-1">
              The <strong className="text-white/60">Card</strong> image (first one) is what shows on the shop &amp; homepage cards.
              Add a photo, then hover any image to make it the card image or remove it. Changes go live right away.
            </p>
          </div>
          <ProductImagesEditor productId={id as string} />
        </div>

        {/* Pricing */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white/80">Pricing</h2>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Price ($) *" type="number" step="0.01" min="0" required value={form.price} onChange={set('price')} placeholder="49.99" />
            <Input label="Compare At ($)" type="number" step="0.01" min="0" value={form.comparePrice} onChange={set('comparePrice')} placeholder="69.99" />
            <Input label="Sale Price ($)" type="number" step="0.01" min="0" value={form.salePrice} onChange={set('salePrice')} placeholder="Optional" />
          </div>
          <p className="text-xs text-white/30">
            <strong className="text-white/50">Compare At</strong> shows a strikethrough "was" price. <strong className="text-white/50">Sale Price</strong> overrides the regular price when set.
          </p>
        </div>

        {/* Inventory */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white/80">Inventory</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input label="SKU" value={form.sku} onChange={set('sku')} placeholder="VP-BPC-5MG" />
            <Input label="Stock Count" type="number" min="0" value={form.inventory} onChange={set('inventory')} />
          </div>
        </div>

        {/* Publishing */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white/80">Publishing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                  className="w-4 h-4 rounded accent-brand-500"
                />
                <span className="text-sm font-medium text-white/70">Featured on homepage</span>
              </label>
            </div>
          </div>
          <Input label="Tags (comma separated)" value={form.tags} onChange={set('tags')} placeholder="peptide, recovery, bpc-157" />
        </div>

        {/* Variants */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white/80">Variants</h2>
          <p className="text-xs text-white/40">
            Optional product variations (e.g. different doses or pack sizes). Variant price & inventory override the product-level values at checkout.
          </p>
          <ProductVariantsEditor productId={id as string} />
        </div>

        {/* Feedback */}
        {error && <p className="text-red-400 text-sm px-1">{error}</p>}
        {success && <p className="text-emerald-400 text-sm px-1">✓ Product updated</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} size="lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.push('/admin/products')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
