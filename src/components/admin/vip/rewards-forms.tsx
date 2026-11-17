'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { adminInput } from './admin-vip-ui'

/* Admin forms for the points economy and partner network
   (/admin/vip/rewards/*, /admin/vip/partners/*). Every call goes to an
   /api/admin/vip/* handler that re-checks ADMIN and writes the audit log. */

function useSubmit() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function send(endpoint: string, method: string, body: unknown, okText = 'Saved.') {
    setBusy(true)
    setMsg(null)
    const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setMsg({ ok: false, text: data.error || 'Failed' })
      return null
    }
    setMsg({ ok: true, text: okText })
    router.refresh()
    return data
  }
  return { busy, msg, send, setMsg }
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return (
    <p role="status" className={msg.ok ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>
      {msg.text}
    </p>
  )
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

const label = 'block text-sm text-white/60'
const toInt = (v: string) => (v.trim() === '' ? null : Math.round(Number(v)))
const toCents = (v: string) => (v.trim() === '' ? null : Math.round(Number(v) * 100))
const clickKey = () => `ak_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`

// ─── Image upload ─────────────────────────────────────────────────────────

function ImageField({ value, onChange, labelText }: { value: string; onChange: (v: string) => void; labelText: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className={label}>
      {labelText}
      <div className="mt-1 flex gap-2">
        <input aria-label={labelText} className={adminInput} value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… or upload" maxLength={500} />
        <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-white/5 px-3 text-xs text-white/70 hover:bg-white/10">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Upload className="h-3.5 w-3.5" aria-hidden="true" />}
          Upload
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0]
              if (!f) return
              setBusy(true)
              setErr(null)
              const fd = new FormData()
              fd.append('file', f)
              const res = await fetch('/api/admin/vip/rewards/upload', { method: 'POST', body: fd })
              const data = await res.json().catch(() => ({}))
              setBusy(false)
              if (!res.ok) return setErr(data.error || 'Upload failed')
              onChange(data.url)
            }}
          />
        </label>
      </div>
      {value.startsWith('/api/vip/media/') && <p className="mt-1 text-xs text-white/40">Uploaded — shown to members on vitalityproject.vip.</p>}
      {err && <p className="mt-1 text-xs text-red-300">{err}</p>}
    </div>
  )
}

// ─── Catalog ──────────────────────────────────────────────────────────────

type Kind = 'STORE_CREDIT' | 'PRODUCT' | 'MERCH' | 'TRAINING' | 'EXPERIENCE'
const KINDS: { value: Kind; label: string; help: string }[] = [
  { value: 'STORE_CREDIT', label: 'Store credit', help: 'Instant: credit lands in the member’s vitalityproject.global balance.' },
  { value: 'PRODUCT', label: 'Product from the store', help: 'A request: the team ships the chosen product to the member; stock is taken when marked fulfilled.' },
  { value: 'MERCH', label: 'Merch', help: 'A request with sizes (add them after saving); size stock is reserved at redemption.' },
  { value: 'TRAINING', label: 'Training', help: 'Instant: unlocks the chosen classroom course for the member.' },
  { value: 'EXPERIENCE', label: 'Experience', help: 'A request (e.g. a 1:1 coaching session) the team schedules.' },
]

export interface RewardItemInput {
  id?: string
  kind: Kind
  title: string
  description: string
  imageUrl: string | null
  pointsCost: number
  creditCents: number | null
  productId: string | null
  variantId: string | null
  courseId: string | null
  stock: number | null
  perMemberLimit: number | null
  minTier: 'CLUB' | 'PLUS' | 'PREMIUM' | 'NONE'
  active: boolean
  sortOrder: number
}

export interface ProductChoice {
  id: string
  name: string
  status: string
  variants: { id: string; name: string }[]
}

export function RewardItemForm({
  item,
  products,
  courses,
}: {
  item?: RewardItemInput
  products: ProductChoice[]
  courses: { id: string; title: string }[]
}) {
  const { busy, msg, send } = useSubmit()
  const [kind, setKind] = useState<Kind>(item?.kind ?? 'STORE_CREDIT')
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '')
  const [pointsCost, setPointsCost] = useState(item ? String(item.pointsCost) : '')
  const [credit, setCredit] = useState(item?.creditCents ? (item.creditCents / 100).toFixed(2) : '')
  const [productId, setProductId] = useState(item?.productId ?? '')
  const [variantId, setVariantId] = useState(item?.variantId ?? '')
  const [courseId, setCourseId] = useState(item?.courseId ?? '')
  const [stock, setStock] = useState(item?.stock === null || item?.stock === undefined ? '' : String(item.stock))
  const [limit, setLimit] = useState(item?.perMemberLimit ? String(item.perMemberLimit) : '')
  const [minTier, setMinTier] = useState<'CLUB' | 'PLUS' | 'PREMIUM'>(item && item.minTier !== 'NONE' ? item.minTier : 'CLUB')
  const [active, setActive] = useState(item?.active ?? false)
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0))
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId])
  const pts = Number(pointsCost) || 0

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const payload = {
          kind,
          title,
          description,
          imageUrl: imageUrl || null,
          pointsCost: pts,
          creditCents: kind === 'STORE_CREDIT' ? toCents(credit) : null,
          productId: kind === 'PRODUCT' ? productId || null : null,
          variantId: kind === 'PRODUCT' ? variantId || null : null,
          courseId: kind === 'TRAINING' ? courseId || null : null,
          // Merch stock lives on its sizes.
          stock: kind === 'MERCH' ? null : toInt(stock),
          perMemberLimit: toInt(limit),
          minTier,
          active,
          sortOrder: Number(sortOrder) || 0,
        }
        const ok = await send(
          '/api/admin/vip/rewards/catalog',
          'POST',
          item?.id ? { op: 'update', id: item.id, item: payload } : { op: 'create', item: payload },
          item?.id ? 'Saved.' : 'Reward created.',
        )
        if (ok && !item?.id) {
          setTitle('')
          setDescription('')
          setImageUrl('')
          setPointsCost('')
          setCredit('')
          setProductId('')
          setVariantId('')
          setCourseId('')
          setStock('')
          setLimit('')
          setMinTier('CLUB')
          setActive(false)
          setSortOrder('0')
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Kind
          <select className={`${adminInput} mt-1`} value={kind} onChange={(e) => setKind(e.target.value as Kind)} disabled={!!item?.id}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </label>
        <label className={label}>
          Title (shown to members)
          <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={120} />
        </label>
      </div>
      <p className="text-xs text-white/40">{KINDS.find((k) => k.value === kind)?.help}</p>
      <label className={label}>
        Description (shown to members — keep it product-neutral; the clubhouse never carries product or use wording)
        <textarea className={`${adminInput} mt-1`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
      </label>
      <ImageField value={imageUrl} onChange={setImageUrl} labelText="Image (optional)" />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Points
          <input className={`${adminInput} mt-1`} type="number" min={1} value={pointsCost} onChange={(e) => setPointsCost(e.target.value)} required />
          <span className="mt-0.5 block text-xs text-white/40">{pts > 0 ? `≈ $${(pts / 100).toFixed(2)} of points` : '100 points = $1'}</span>
        </label>
        {kind === 'STORE_CREDIT' && (
          <label className={label}>
            Credit given ($)
            <input className={`${adminInput} mt-1`} type="number" min={0.01} step={0.01} value={credit} onChange={(e) => setCredit(e.target.value)} required />
          </label>
        )}
        <label className={label}>
          Minimum level
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as 'CLUB' | 'PLUS' | 'PREMIUM')}>
            <option value="CLUB">The Club and up</option>
            <option value="PLUS">Plus and up</option>
            <option value="PREMIUM">Premium Stacks only</option>
          </select>
        </label>
      </div>

      {kind === 'PRODUCT' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label}>
            Product
            <select className={`${adminInput} mt-1`} value={productId} onChange={(e) => { setProductId(e.target.value); setVariantId('') }} required>
              <option value="">Choose…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}{p.status !== 'ACTIVE' ? ` (${p.status.toLowerCase()})` : ''}</option>
              ))}
            </select>
          </label>
          {product && product.variants.length > 0 && (
            <label className={label}>
              Size
              <select className={`${adminInput} mt-1`} value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
                <option value="">Choose…</option>
                {product.variants.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {kind === 'TRAINING' && (
        <label className={label}>
          Course unlocked
          <select className={`${adminInput} mt-1`} value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
            <option value="">Choose…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </label>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {kind !== 'MERCH' && (
          <label className={label}>
            Stock (blank = unlimited)
            <input className={`${adminInput} mt-1`} type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
          </label>
        )}
        <label className={label}>
          Per-member limit (blank = none)
          <input className={`${adminInput} mt-1`} type="number" min={1} value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <label className={label}>
          Sort order
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      {kind === 'MERCH' && <p className="text-xs text-white/40">Merch stock is set per size below the reward once it is saved.</p>}
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-brand-500" />
        Live in the catalog
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>{item?.id ? 'Save reward' : 'Create reward'}</Submit>
    </form>
  )
}

export function OptionEditor({ option }: { option: { id: string; label: string; stock: number | null } }) {
  const { busy, msg, send } = useSubmit()
  const [labelText, setLabel] = useState(option.label)
  const [stock, setStock] = useState(option.stock === null ? '' : String(option.stock))
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        send('/api/admin/vip/rewards/catalog', 'POST', { op: 'option.update', id: option.id, label: labelText, stock: toInt(stock) })
      }}
    >
      <input aria-label="Size" className={cn(adminInput, 'w-24')} value={labelText} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
      <input aria-label="Stock (blank = unlimited)" placeholder="∞" className={cn(adminInput, 'w-24')} type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
      <Submit busy={busy}>Save</Submit>
      <button
        type="button"
        onClick={() => confirm('Remove this size?') && send('/api/admin/vip/rewards/catalog', 'POST', { op: 'option.delete', id: option.id }, 'Removed.')}
        className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
      >
        Remove
      </button>
      <Msg msg={msg} />
    </form>
  )
}

export function OptionAdd({ itemId }: { itemId: string }) {
  const { busy, msg, send } = useSubmit()
  const [labelText, setLabel] = useState('')
  const [stock, setStock] = useState('')
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await send('/api/admin/vip/rewards/catalog', 'POST', { op: 'option.add', itemId, label: labelText, stock: toInt(stock) }, 'Size added.')) {
          setLabel('')
          setStock('')
        }
      }}
    >
      <input aria-label="New size" placeholder="Size (e.g. M)" className={cn(adminInput, 'w-32')} value={labelText} onChange={(e) => setLabel(e.target.value)} required maxLength={40} />
      <input aria-label="Stock" placeholder="Stock" className={cn(adminInput, 'w-24')} type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
      <Submit busy={busy}>Add size</Submit>
      <Msg msg={msg} />
    </form>
  )
}

// ─── Earning rules ────────────────────────────────────────────────────────

export interface RuleField {
  key: string
  group: string
  label: string
  help: string
  unit: string
  max: number
}

export function EarningRulesForm({ rules, fields }: { rules: Record<string, number>; fields: RuleField[] }) {
  const { busy, msg, send } = useSubmit()
  const [values, setValues] = useState<Record<string, string>>(Object.fromEntries(fields.map((f) => [f.key, String(rules[f.key])])))
  return (
    <form
      className="glass space-y-4 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault()
        const body = Object.fromEntries(fields.map((f) => [f.key, Math.round(Number(values[f.key]))]))
        send('/api/admin/vip/rewards/earning', 'PUT', body)
      }}
    >
      <h2 className="font-semibold">Earning rules</h2>
      <p className="text-xs text-white/50">
        Every points amount in the clubhouse and the store, in one place. 100 points = $1; 0 turns an award off. Members see the
        same list under Rewards → How to earn.
      </p>
      {[...new Set(fields.map((f) => f.group))].map((group) => (
        <fieldset key={group} className="space-y-3 border-t border-white/[0.06] pt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-white/60">{group}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields
              .filter((f) => f.group === group)
              .map((f) => (
                <label key={f.key} className={label}>
                  {f.label}
                  <span className="mt-1 flex items-center gap-2">
                    <input
                      className={adminInput}
                      type="number"
                      min={0}
                      max={f.max}
                      step={1}
                      required
                      value={values[f.key]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                    <span className="shrink-0 text-xs text-white/50">{f.unit}</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-white/50">{f.help}</span>
                </label>
              ))}
          </div>
        </fieldset>
      ))}
      <Msg msg={msg} />
      <Submit busy={busy}>Save rules</Submit>
    </form>
  )
}

// ─── Manual adjustment ────────────────────────────────────────────────────

export function PointsAdjustForm({ defaultMember = '' }: { defaultMember?: string }) {
  const { busy, msg, send } = useSubmit()
  const [member, setMember] = useState(defaultMember)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [key, setKey] = useState(clickKey)
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const n = Math.round(Number(points))
        if (!confirm(`${n > 0 ? 'Add' : 'Remove'} ${Math.abs(n).toLocaleString('en-US')} points ${n > 0 ? 'to' : 'from'} ${member}?`)) return
        const ok = await send('/api/admin/vip/rewards/points', 'POST', { member, points: n, reason, clickKey: key }, 'Adjustment applied.')
        if (ok) {
          setPoints('')
          setReason('')
          setKey(clickKey())
        }
      }}
    >
      <h2 className="font-semibold">Manual adjustment</h2>
      <p className="text-xs text-white/40">Positive adds, negative removes (never below zero). The reason is kept in the audit log; members see “Adjustment by the Vitality team”.</p>
      <label className={label}>
        Member email or member number
        <input className={`${adminInput} mt-1`} value={member} onChange={(e) => setMember(e.target.value)} required maxLength={200} />
      </label>
      <label className={label}>
        Points (+/−)
        <input className={`${adminInput} mt-1`} type="number" step={1} value={points} onChange={(e) => setPoints(e.target.value)} required />
      </label>
      <label className={label}>
        Reason
        <input className={`${adminInput} mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} />
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>Apply adjustment</Submit>
    </form>
  )
}

// ─── Partners ─────────────────────────────────────────────────────────────

export interface PartnerInput {
  id?: string
  name: string
  slug: string
  logoUrl: string | null
  description: string
  website: string | null
  address: string | null
  category: string | null
  active: boolean
  earnPointsPerDollar: number
  allowRedemption: boolean
  networkFeeBps: number
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export function PartnerForm({ partner }: { partner?: PartnerInput }) {
  const router = useRouter()
  const { busy, msg, send } = useSubmit()
  const [name, setName] = useState(partner?.name ?? '')
  const [slug, setSlug] = useState(partner?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!partner)
  const [logoUrl, setLogoUrl] = useState(partner?.logoUrl ?? '')
  const [description, setDescription] = useState(partner?.description ?? '')
  const [website, setWebsite] = useState(partner?.website ?? '')
  const [address, setAddress] = useState(partner?.address ?? '')
  const [category, setCategory] = useState(partner?.category ?? '')
  const [active, setActive] = useState(partner?.active ?? true)
  const [earn, setEarn] = useState(String(partner?.earnPointsPerDollar ?? 5))
  const [allowRedemption, setAllowRedemption] = useState(partner?.allowRedemption ?? true)
  const [feePct, setFeePct] = useState(((partner?.networkFeeBps ?? 500) / 100).toString())
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const body = {
          name,
          slug,
          logoUrl: logoUrl || null,
          description,
          website: website || null,
          address: address || null,
          category: category || null,
          active,
          earnPointsPerDollar: Math.round(Number(earn)),
          allowRedemption,
          networkFeeBps: Math.round(Number(feePct) * 100),
        }
        const data = await send('/api/admin/vip/partners', 'POST', partner?.id ? { op: 'update', id: partner.id, partner: body } : { op: 'create', partner: body }, partner?.id ? 'Saved.' : 'Partner created.')
        if (data && !partner?.id && data.partner?.id) router.push(`/admin/vip/partners/${data.partner.id}`)
      }}
    >
      <h2 className="font-semibold">{partner?.id ? 'Partner details' : 'New partner'}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Name
          <input
            className={`${adminInput} mt-1`}
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
            required
            minLength={2}
            maxLength={120}
          />
        </label>
        <label className={label}>
          Slug (used in ledger sources: partner:&lt;slug&gt;)
          <input className={`${adminInput} mt-1`} value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }} required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </label>
        <label className={label}>
          Category
          <input className={`${adminInput} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} placeholder="Gym, café, recovery studio…" />
        </label>
        <label className={label}>
          Website
          <input className={`${adminInput} mt-1`} value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={500} placeholder="https://" />
        </label>
      </div>
      <label className={label}>
        Address
        <input className={`${adminInput} mt-1`} value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
      </label>
      <label className={label}>
        Description (shown to members)
        <textarea className={`${adminInput} mt-1`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} />
      </label>
      <ImageField value={logoUrl} onChange={setLogoUrl} labelText="Logo (optional)" />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Points per $1 spent
          <input className={`${adminInput} mt-1`} type="number" min={0} max={100} step={1} value={earn} onChange={(e) => setEarn(e.target.value)} required />
          <span className="mt-0.5 block text-xs text-white/40">{Number(earn) || 0}% back in points</span>
        </label>
        <label className={label}>
          Network fee (% of member turnover)
          <input className={`${adminInput} mt-1`} type="number" min={0} max={50} step={0.01} value={feePct} onChange={(e) => setFeePct(e.target.value)} required />
        </label>
        <div className="space-y-2 pt-6 text-sm text-white/70">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allowRedemption} onChange={(e) => setAllowRedemption(e.target.checked)} className="accent-brand-500" />
            Members can spend points here
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-brand-500" />
            Active (listed + portal open)
          </label>
        </div>
      </div>
      <Msg msg={msg} />
      <Submit busy={busy}>{partner?.id ? 'Save partner' : 'Create partner'}</Submit>
    </form>
  )
}

export function StaffAddForm({ partnerId }: { partnerId: string }) {
  const { busy, msg, send } = useSubmit()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'STAFF' | 'MANAGER'>('STAFF')
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await send('/api/admin/vip/partners', 'POST', { op: 'staff.add', partnerId, email, role }, 'Staff linked.')) setEmail('')
      }}
    >
      <label className={`${label} min-w-[14rem] flex-1`}>
        Account email (an existing vitalityproject.global account)
        <input className={`${adminInput} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className={label}>
        Role
        <select className={`${adminInput} mt-1`} value={role} onChange={(e) => setRole(e.target.value as 'STAFF' | 'MANAGER')}>
          <option value="STAFF">Staff</option>
          <option value="MANAGER">Manager</option>
        </select>
      </label>
      <Submit busy={busy}>Link staff</Submit>
      <div className="w-full"><Msg msg={msg} /></div>
    </form>
  )
}

// ─── Statements ───────────────────────────────────────────────────────────

interface Decision {
  partner: string
  outcome: string
  math: { turnoverCents: number; feeCents: number; pointsIssued: number; pointsRedeemedCents: number; netCents: number }
}

export function StatementGenerator({ defaultPeriod }: { defaultPeriod: string }) {
  const { busy, msg, send, setMsg } = useSubmit()
  const [period, setPeriod] = useState(defaultPeriod)
  const [preview, setPreview] = useState<Decision[] | null>(null)
  const usd = (c: number) => `${c < 0 ? '−' : ''}$${(Math.abs(c) / 100).toFixed(2)}`
  return (
    <div className="glass space-y-3 rounded-2xl p-5">
      <h2 className="font-semibold">Generate statements</h2>
      <p className="text-xs text-white/40">Creates or refreshes DRAFT statements for every active partner (and any partner with activity) for the month. Issued and settled statements are never changed. The cron does this on the 1st for the month just ended.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className={label}>
          Month
          <input className={`${adminInput} mt-1`} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
        </label>
        <button
          type="button"
          disabled={busy || !period}
          onClick={async () => {
            setMsg(null)
            const d = await send('/api/admin/vip/partners/statements', 'POST', { op: 'generate', period, dryRun: true }, 'Preview ready — nothing saved.')
            if (d) setPreview(d.decisions)
          }}
          className="rounded-xl bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          Preview (dry run)
        </button>
        <button
          type="button"
          disabled={busy || !period}
          onClick={async () => {
            const d = await send('/api/admin/vip/partners/statements', 'POST', { op: 'generate', period }, 'Drafts generated.')
            if (d) setPreview(null)
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Generate drafts
        </button>
      </div>
      <Msg msg={msg} />
      {preview && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-white/40">
                <th className="py-2">Partner</th><th>Turnover</th><th>Fee</th><th>Redeemed</th><th>Net</th><th>Would</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {preview.map((d) => (
                <tr key={d.partner}>
                  <td className="py-2">{d.partner}</td>
                  <td>{usd(d.math.turnoverCents)}</td>
                  <td>{usd(d.math.feeCents)}</td>
                  <td>{usd(d.math.pointsRedeemedCents)}</td>
                  <td className="font-semibold">{usd(d.math.netCents)}</td>
                  <td className="text-white/50">{d.outcome.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
