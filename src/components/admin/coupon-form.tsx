'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Trash2 } from 'lucide-react'
import { parseMoneyToCents } from '@/lib/money'

type CouponType = 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING' | 'BOGO'
type Tier = 'NONE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

interface Form {
  code: string
  type: CouponType
  value: string
  minOrder: string
  maxUses: string
  expiresAt: string
  active: boolean
  // rule
  ruleEnabled: boolean
  minOrderCents: string
  productIds: string[]
  categoryIds: string[]
  newCustomersOnly: boolean
  membersOnly: boolean
  tierRequired: Tier
  stackable: boolean
  autoApply: boolean
  firstPurchaseOnly: boolean
  usesPerCustomer: string
}

const empty: Form = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  minOrder: '',
  maxUses: '',
  expiresAt: '',
  active: true,
  ruleEnabled: false,
  minOrderCents: '',
  productIds: [],
  categoryIds: [],
  newCustomersOnly: false,
  membersOnly: false,
  tierRequired: 'NONE',
  stackable: false,
  autoApply: false,
  firstPurchaseOnly: false,
  usesPerCustomer: '',
}

interface ProductOption {
  id: string
  name: string
}
interface CategoryOption {
  id: string
  name: string
}

export function CouponForm({
  mode,
  id,
  products,
  categories,
}: {
  mode: 'create' | 'edit'
  id?: string
  products: ProductOption[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [form, setForm] = useState<Form>(empty)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetch(`/api/admin/discounts/${id}`)
      .then((r) => r.json())
      .then((c) => {
        setForm({
          code: c.code ?? '',
          type: c.type ?? 'PERCENTAGE',
          value:
            c.type === 'PERCENTAGE'
              ? String(c.value ?? '')
              : c.value != null
              ? (c.value / 100).toFixed(2)
              : '',
          minOrder: c.minOrder != null ? (c.minOrder / 100).toFixed(2) : '',
          maxUses: c.maxUses != null ? String(c.maxUses) : '',
          expiresAt: c.expiresAt
            ? new Date(c.expiresAt).toISOString().slice(0, 10)
            : '',
          active: c.active ?? true,
          ruleEnabled: !!c.rule,
          minOrderCents:
            c.rule?.minOrderCents != null
              ? (c.rule.minOrderCents / 100).toFixed(2)
              : '',
          productIds: c.rule?.productIds ?? [],
          categoryIds: c.rule?.categoryIds ?? [],
          newCustomersOnly: c.rule?.newCustomersOnly ?? false,
          membersOnly: c.rule?.membersOnly ?? false,
          tierRequired: (c.rule?.tierRequired as Tier) ?? 'NONE',
          stackable: c.rule?.stackable ?? false,
          autoApply: c.rule?.autoApply ?? false,
          firstPurchaseOnly: c.rule?.firstPurchaseOnly ?? false,
          usesPerCustomer:
            c.rule?.usesPerCustomer != null
              ? String(c.rule.usesPerCustomer)
              : '',
        })
      })
      .finally(() => setLoading(false))
  }, [mode, id])

  const up = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const valueAsInt = () => {
    if (!form.value) return 0
    if (form.type === 'PERCENTAGE') return parseInt(form.value) || 0
    return (parseMoneyToCents(form.value) ?? 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        code: form.code.toUpperCase(),
        type: form.type,
        value: valueAsInt(),
        minOrder: form.minOrder
          ? (parseMoneyToCents(form.minOrder) ?? 0)
          : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        expiresAt: form.expiresAt || null,
        active: form.active,
      }
      if (form.ruleEnabled) {
        payload.rule = {
          minOrderCents: form.minOrderCents
            ? (parseMoneyToCents(form.minOrderCents) ?? 0)
            : null,
          productIds: form.productIds,
          categoryIds: form.categoryIds,
          newCustomersOnly: form.newCustomersOnly,
          membersOnly: form.membersOnly,
          tierRequired: form.tierRequired === 'NONE' ? null : form.tierRequired,
          stackable: form.stackable,
          autoApply: form.autoApply,
          firstPurchaseOnly: form.firstPurchaseOnly,
          usesPerCustomer: form.usesPerCustomer
            ? parseInt(form.usesPerCustomer)
            : null,
        }
      } else if (mode === 'edit') {
        payload.rule = null
      }

      const url =
        mode === 'create'
          ? '/api/admin/discounts'
          : `/api/admin/discounts/${id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === 'string' ? d.error : 'Failed to save')
      } else {
        router.push('/admin/discounts')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Delete this coupon? This cannot be undone.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/discounts/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        router.push('/admin/discounts')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-white/40">Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white/80">Code</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Code *"
            required
            value={form.code}
            onChange={(e) =>
              up('code', e.target.value.toUpperCase().replace(/\s/g, ''))
            }
            placeholder="SUMMER20"
          />
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Type
            </label>
            <select
              value={form.type}
              onChange={(e) => up('type', e.target.value as CouponType)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed Amount</option>
              <option value="FREE_SHIPPING">Free Shipping</option>
              <option value="BOGO">Buy-One-Get-One</option>
            </select>
          </div>
        </div>
        {(form.type === 'PERCENTAGE' || form.type === 'FIXED') && (
          <Input
            label={form.type === 'PERCENTAGE' ? 'Value (%)' : 'Value ($)'}
            required
            type="number"
            step={form.type === 'FIXED' ? '0.01' : '1'}
            value={form.value}
            onChange={(e) => up('value', e.target.value)}
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min Order ($)"
            type="number"
            step="0.01"
            value={form.minOrder}
            onChange={(e) => up('minOrder', e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Max Uses"
            type="number"
            value={form.maxUses}
            onChange={(e) => up('maxUses', e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Input
            label="Expiry Date"
            type="date"
            value={form.expiresAt}
            onChange={(e) => up('expiresAt', e.target.value)}
          />
          <label className="flex items-center gap-3 cursor-pointer py-2.5">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => up('active', e.target.checked)}
              className="w-4 h-4 rounded accent-brand-500"
            />
            <span className="text-sm font-medium text-white/70">Active</span>
          </label>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white/80">Advanced Rules</h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.ruleEnabled}
              onChange={(e) => up('ruleEnabled', e.target.checked)}
              className="w-4 h-4 rounded accent-brand-500"
            />
            <span className="text-xs text-white/60">Enable rules</span>
          </label>
        </div>

        {form.ruleEnabled && (
          <div className="space-y-4">
            <Input
              label="Minimum order cents ($)"
              type="number"
              step="0.01"
              value={form.minOrderCents}
              onChange={(e) => up('minOrderCents', e.target.value)}
              placeholder="Optional"
            />

            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">
                Specific products
              </label>
              <select
                multiple
                value={form.productIds}
                onChange={(e) =>
                  up(
                    'productIds',
                    Array.from(e.target.selectedOptions, (o) => o.value),
                  )
                }
                className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white h-36 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-white/30 mt-1">
                Cmd/Ctrl + click to select multiple. Leave empty for any product.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">
                Specific categories
              </label>
              <select
                multiple
                value={form.categoryIds}
                onChange={(e) =>
                  up(
                    'categoryIds',
                    Array.from(e.target.selectedOptions, (o) => o.value),
                  )
                }
                className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white h-28 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-white/70 mb-1.5 block">
                  Tier required
                </label>
                <select
                  value={form.tierRequired}
                  onChange={(e) => up('tierRequired', e.target.value as Tier)}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="NONE">None</option>
                  <option value="BRONZE">Bronze</option>
                  <option value="SILVER">Silver</option>
                  <option value="GOLD">Gold</option>
                  <option value="PLATINUM">Platinum</option>
                </select>
              </div>
              <Input
                label="Uses per customer"
                type="number"
                value={form.usesPerCustomer}
                onChange={(e) => up('usesPerCustomer', e.target.value)}
                placeholder="Unlimited"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ['newCustomersOnly', 'New customers only'],
                ['membersOnly', 'Members only'],
                ['firstPurchaseOnly', 'First-purchase only'],
                ['stackable', 'Stackable'],
                ['autoApply', 'Auto-apply'],
              ].map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 cursor-pointer p-3 rounded-xl bg-dark-700/50 border border-white/5"
                >
                  <input
                    type="checkbox"
                    checked={form[key as keyof Form] as boolean}
                    onChange={(e) =>
                      up(key as keyof Form, e.target.checked as never)
                    }
                    className="w-4 h-4 rounded accent-brand-500"
                  />
                  <span className="text-sm text-white/70">{label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-sm px-1">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={saving} size="lg">
          <Save className="w-4 h-4" /> {mode === 'create' ? 'Create Coupon' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.push('/admin/discounts')}
        >
          Cancel
        </Button>
        {mode === 'edit' && (
          <Button
            type="button"
            variant="danger"
            size="lg"
            onClick={handleDelete}
            className="ml-auto"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </Button>
        )}
      </div>
    </form>
  )
}
