'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Trash2, Users, Loader2 } from 'lucide-react'
import { parseMoneyToCents } from '@/lib/money'

type Tier = '' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'
type Role = '' | 'CUSTOMER' | 'AFFILIATE' | 'ADMIN'
type TriBool = '' | 'yes' | 'no'

interface FormState {
  name: string
  description: string
  minSpent: string // dollars (string for input)
  maxSpent: string
  minOrders: string
  maxOrders: string
  tier: Tier
  tagIds: string[]
  registeredDays: string
  lastOrderDays: string
  neverOrdered: boolean
  state: string
  role: Role
  isAffiliate: TriBool
  hasOrgMembership: TriBool
  emailVerified: TriBool
}

const empty: FormState = {
  name: '',
  description: '',
  minSpent: '',
  maxSpent: '',
  minOrders: '',
  maxOrders: '',
  tier: '',
  tagIds: [],
  registeredDays: '',
  lastOrderDays: '',
  neverOrdered: false,
  state: '',
  role: '',
  isAffiliate: '',
  hasOrgMembership: '',
  emailVerified: '',
}

export interface TagOption {
  id: string
  name: string
  color: string
}

// Full US state list
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

function dollarsToCents(v: string): number | undefined {
  if (!v) return undefined
  const n = (parseMoneyToCents(v) ?? 0)
  if (Number.isNaN(n)) return undefined
  return n
}

function centsToDollars(c: number | undefined): string {
  if (c == null) return ''
  return (c / 100).toFixed(2)
}

function intOrUndef(v: string): number | undefined {
  if (!v) return undefined
  const n = parseInt(v, 10)
  if (Number.isNaN(n)) return undefined
  return n
}

function triToBool(v: TriBool): boolean | undefined {
  if (v === 'yes') return true
  if (v === 'no') return false
  return undefined
}

function boolToTri(v: boolean | undefined): TriBool {
  if (v === true) return 'yes'
  if (v === false) return 'no'
  return ''
}

export function SegmentBuilder({
  mode,
  id,
  tags,
}: {
  mode: 'create' | 'edit'
  id?: string
  tags: TagOption[]
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(empty)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetch(`/api/admin/segments/${id}`)
      .then((r) => r.json())
      .then((s) => {
        const f = s.filters ?? {}
        setForm({
          name: s.name ?? '',
          description: s.description ?? '',
          minSpent: centsToDollars(f.minSpent),
          maxSpent: centsToDollars(f.maxSpent),
          minOrders: f.minOrders != null ? String(f.minOrders) : '',
          maxOrders: f.maxOrders != null ? String(f.maxOrders) : '',
          tier: (f.tier as Tier) ?? '',
          tagIds: Array.isArray(f.tagIds) ? f.tagIds : [],
          registeredDays: f.registeredDays != null ? String(f.registeredDays) : '',
          lastOrderDays: f.lastOrderDays != null ? String(f.lastOrderDays) : '',
          neverOrdered: !!f.neverOrdered,
          state: f.state ?? '',
          role: (f.role as Role) ?? '',
          isAffiliate: boolToTri(f.isAffiliate),
          hasOrgMembership: boolToTri(f.hasOrgMembership),
          emailVerified: boolToTri(f.emailVerified),
        })
      })
      .finally(() => setLoading(false))
  }, [mode, id])

  const up = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const filtersPayload = useMemo(() => {
    const out: Record<string, unknown> = {}
    const minSpent = dollarsToCents(form.minSpent)
    const maxSpent = dollarsToCents(form.maxSpent)
    const minOrders = intOrUndef(form.minOrders)
    const maxOrders = intOrUndef(form.maxOrders)
    const registeredDays = intOrUndef(form.registeredDays)
    const lastOrderDays = intOrUndef(form.lastOrderDays)

    if (minSpent != null) out.minSpent = minSpent
    if (maxSpent != null) out.maxSpent = maxSpent
    if (minOrders != null) out.minOrders = minOrders
    if (maxOrders != null) out.maxOrders = maxOrders
    if (registeredDays != null) out.registeredDays = registeredDays
    if (lastOrderDays != null) out.lastOrderDays = lastOrderDays
    if (form.tier) out.tier = form.tier
    if (form.role) out.role = form.role
    if (form.state) out.state = form.state
    if (form.neverOrdered) out.neverOrdered = true
    if (form.tagIds.length > 0) out.tagIds = form.tagIds

    const aff = triToBool(form.isAffiliate)
    if (aff !== undefined) out.isAffiliate = aff
    const org = triToBool(form.hasOrgMembership)
    if (org !== undefined) out.hasOrgMembership = org
    const ver = triToBool(form.emailVerified)
    if (ver !== undefined) out.emailVerified = ver

    return out
  }, [form])

  const runPreview = async () => {
    setPreviewing(true)
    setPreviewCount(null)
    try {
      // Save temporarily as a dry count: we use POST then DELETE? Easier:
      // For preview, create/update via PATCH if edit, else just a POST preview.
      // Simpler: since the back-end's segment count needs a persisted row, we
      // instead pass the filters directly through a one-off query by creating
      // a temporary in-memory evaluation. Use the segment's own customers
      // endpoint on an existing id; for new segments save first.
      if (mode === 'edit' && id) {
        // Patch with current filters, then ask for customer count
        const res = await fetch(`/api/admin/segments/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filters: filtersPayload }),
        })
        if (!res.ok) {
          setError('Preview failed')
          return
        }
        const cust = await fetch(`/api/admin/segments/${id}/customers?limit=1&offset=0`)
        if (!cust.ok) {
          setError('Preview failed')
          return
        }
        const data = await cust.json()
        setPreviewCount(data.total ?? 0)
      } else {
        // Create a temp segment, query count, then delete it.
        const create = await fetch('/api/admin/segments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name || `Preview ${Date.now()}`,
            description: form.description || null,
            filters: filtersPayload,
          }),
        })
        if (!create.ok) {
          setError('Preview failed')
          return
        }
        const seg = await create.json()
        const cust = await fetch(`/api/admin/segments/${seg.id}/customers?limit=1&offset=0`)
        const data = cust.ok ? await cust.json() : { total: 0 }
        setPreviewCount(data.total ?? 0)
        // Cleanup preview segment and forward to edit page so user keeps it
        // if they want to save. Actually: delete it so the list isn't polluted.
        await fetch(`/api/admin/segments/${seg.id}`, { method: 'DELETE' })
      }
    } finally {
      setPreviewing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('Segment name is required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        filters: filtersPayload,
      }
      const url = mode === 'create' ? '/api/admin/segments' : `/api/admin/segments/${id}`
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
        router.push('/admin/segments')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id) return
    if (!confirm('Delete this segment? Campaigns using it will detach.')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/segments/${id}`, { method: 'DELETE' })
      if (res.ok) {
        router.push('/admin/segments')
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const toggleTag = (tagId: string) => {
    up(
      'tagIds',
      form.tagIds.includes(tagId)
        ? form.tagIds.filter((t) => t !== tagId)
        : [...form.tagIds, tagId],
    )
  }

  if (loading) return <p className="text-white/40">Loading…</p>

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-5">
      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white/80">Details</h2>
        <Input
          label="Segment name *"
          required
          value={form.name}
          onChange={(e) => up('name', e.target.value)}
          placeholder="High-value PLATINUM customers"
        />
        <div>
          <label className="text-sm font-medium text-white/70 mb-1.5 block">
            Description
          </label>
          <textarea
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
            rows={2}
            value={form.description}
            onChange={(e) => up('description', e.target.value)}
            placeholder="Optional — what this segment represents."
          />
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white/80">Spend & orders</h2>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min spent ($)"
            type="number"
            step="0.01"
            value={form.minSpent}
            onChange={(e) => up('minSpent', e.target.value)}
            placeholder="0.00"
          />
          <Input
            label="Max spent ($)"
            type="number"
            step="0.01"
            value={form.maxSpent}
            onChange={(e) => up('maxSpent', e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Min orders"
            type="number"
            value={form.minOrders}
            onChange={(e) => up('minOrders', e.target.value)}
            placeholder="0"
          />
          <Input
            label="Max orders"
            type="number"
            value={form.maxOrders}
            onChange={(e) => up('maxOrders', e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Last order within (days)"
            type="number"
            value={form.lastOrderDays}
            onChange={(e) => up('lastOrderDays', e.target.value)}
            placeholder="e.g. 90"
          />
          <label className="flex items-center gap-3 cursor-pointer px-4 py-2.5 rounded-xl bg-dark-700/50 border border-white/5 mt-7">
            <input
              type="checkbox"
              checked={form.neverOrdered}
              onChange={(e) => up('neverOrdered', e.target.checked)}
              className="w-4 h-4 rounded accent-brand-500"
            />
            <span className="text-sm text-white/70">Never ordered</span>
          </label>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white/80">Loyalty & tags</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Loyalty tier
            </label>
            <select
              value={form.tier}
              onChange={(e) => up('tier', e.target.value as Tier)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Any</option>
              <option value="BRONZE">Bronze</option>
              <option value="SILVER">Silver</option>
              <option value="GOLD">Gold</option>
              <option value="PLATINUM">Platinum</option>
            </select>
          </div>
          <Input
            label="Registered within (days)"
            type="number"
            value={form.registeredDays}
            onChange={(e) => up('registeredDays', e.target.value)}
            placeholder="e.g. 30"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-white/70 mb-1.5 block">
            Has tags (all must match)
          </label>
          {tags.length === 0 ? (
            <p className="text-xs text-white/30">
              No tags yet — create some from the Tags admin.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const on = form.tagIds.includes(t.id)
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      on
                        ? 'border-brand-500 bg-brand-500/20 text-brand-200'
                        : 'border-white/10 bg-dark-700 text-white/60 hover:text-white'
                    }`}
                    style={on ? { borderColor: t.color } : undefined}
                  >
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ background: t.color }}
                    />
                    {t.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white/80">Profile</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              State
            </label>
            <select
              value={form.state}
              onChange={(e) => up('state', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Any</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => up('role', e.target.value as Role)}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Any</option>
              <option value="CUSTOMER">Customer</option>
              <option value="AFFILIATE">Affiliate</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            ['isAffiliate', 'Is affiliate'] as const,
            ['hasOrgMembership', 'Has org membership'] as const,
            ['emailVerified', 'Email verified'] as const,
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-sm font-medium text-white/70 mb-1.5 block">
                {label}
              </label>
              <select
                value={form[k]}
                onChange={(e) => up(k, e.target.value as TriBool)}
                className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Any</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-white/40 uppercase tracking-wider mb-1">
            Preview
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            {previewing ? (
              <span className="text-sm text-white/60 inline-flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> counting…
              </span>
            ) : previewCount !== null ? (
              <span className="text-lg font-bold">
                {previewCount.toLocaleString()}{' '}
                <span className="text-sm text-white/40 font-normal">matching customers</span>
              </span>
            ) : (
              <span className="text-sm text-white/40">Click preview to count matching customers</span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={runPreview}
          loading={previewing}
        >
          Preview count
        </Button>
      </div>

      {error && <p className="text-red-400 text-sm px-1">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" loading={saving} size="lg">
          <Save className="w-4 h-4" /> {mode === 'create' ? 'Create segment' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => router.push('/admin/segments')}
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
