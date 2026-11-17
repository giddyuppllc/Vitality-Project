'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarHeart, CheckCircle2, CreditCard, GraduationCap, Loader2, Package, Shirt } from 'lucide-react'
import type { MembershipTier, VipRewardKind } from '@prisma/client'
import { cn } from '@/lib/utils'

export interface CatalogItemView {
  id: string
  kind: VipRewardKind
  title: string
  description: string
  imageUrl: string | null
  pointsCost: number
  creditCents: number | null
  minTier: MembershipTier
  options: { id: string; label: string; available: boolean }[]
  tierOk: boolean
  inStock: boolean
  limitReached: boolean
  canAfford: boolean
  alreadyUnlocked: boolean
  courseTitle: string | null
}

export interface AddressView {
  name: string
  line1: string
  line2: string
  city: string
  state: string
  zip: string
  country: string
  phone: string
}

const KIND_META: Record<VipRewardKind, { label: string; icon: typeof Package; tone: string }> = {
  STORE_CREDIT: { label: 'Store credit', icon: CreditCard, tone: 'from-emerald-400/25 to-brand-500/10 text-emerald-200' },
  PRODUCT: { label: 'From the store', icon: Package, tone: 'from-brand-400/30 to-brand-900/10 text-brand-200' },
  MERCH: { label: 'Merch', icon: Shirt, tone: 'from-[#d4b26a]/30 to-[#d4b26a]/5 text-[#ead7a8]' },
  TRAINING: { label: 'Training', icon: GraduationCap, tone: 'from-sky-300/25 to-brand-700/10 text-sky-100' },
  EXPERIENCE: { label: 'Experience', icon: CalendarHeart, tone: 'from-rose-300/20 to-brand-800/10 text-rose-100' },
}

const TIER_NAME: Record<MembershipTier, string> = { NONE: '', CLUB: 'The Club', PLUS: 'Plus', PREMIUM: 'Premium Stacks' }

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`

function newKey() {
  return `ck_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

function blocker(i: CatalogItemView, balance: number): string | null {
  if (!i.tierOk) return `Opens at ${TIER_NAME[i.minTier]}`
  if (i.alreadyUnlocked) return 'Already unlocked'
  if (i.limitReached) return 'Limit reached'
  if (!i.inStock) return 'Out of stock'
  if (!i.canAfford) return `${(i.pointsCost - balance).toLocaleString('en-US')} more points needed`
  return null
}

export function CatalogGrid({ items, balance, address }: { items: CatalogItemView[]; balance: number; address: AddressView | null }) {
  const [open, setOpen] = useState<CatalogItemView | null>(null)
  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2">
        {items.map((i) => {
          const meta = KIND_META[i.kind]
          const Icon = meta.icon
          const why = blocker(i, balance)
          return (
            <li key={i.id} className="vip-surface flex flex-col overflow-hidden">
              <div className={cn('relative grid h-36 place-items-center bg-gradient-to-br', meta.tone)}>
                {i.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- members-only media route
                  <img src={i.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <Icon className="h-12 w-12 opacity-80" aria-hidden="true" />
                )}
                <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                  {meta.label}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-semibold">{i.title}</h3>
                {i.kind === 'STORE_CREDIT' && i.creditCents ? (
                  <p className="mt-0.5 text-sm text-emerald-300">{usd(i.creditCents)} to spend at vitalityproject.global</p>
                ) : null}
                {i.kind === 'TRAINING' && i.courseTitle ? <p className="mt-0.5 text-sm text-sky-200">Unlocks: {i.courseTitle}</p> : null}
                {i.description && <p className="mt-2 line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-white/65">{i.description}</p>}
                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <p className="text-lg font-extrabold">
                    {i.pointsCost.toLocaleString('en-US')} <span className="text-sm font-semibold text-white/55">pts</span>
                  </p>
                  {why ? (
                    <span className="rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/65">{why}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(i)}
                      className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
                    >
                      Redeem
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {open && <RedeemDialog item={open} balance={balance} address={address} onClose={() => setOpen(null)} />}
    </>
  )
}

function RedeemDialog({ item, balance, address, onClose }: { item: CatalogItemView; balance: number; address: AddressView | null; onClose: () => void }) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)
  // One key per opened dialog: double-clicks and retries are the same redemption.
  const clickKey = useMemo(newKey, [])
  const shipped = item.kind === 'PRODUCT' || item.kind === 'MERCH'
  const [optionId, setOptionId] = useState(item.options.find((o) => o.available)?.id ?? '')
  const [note, setNote] = useState('')
  const [ship, setShip] = useState<AddressView>(address ?? { name: '', line1: '', line2: '', city: '', state: '', zip: '', country: 'US', phone: '' })
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('busy')
    setError(null)
    const res = await fetch('/api/vip/rewards/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: item.id,
        optionId: item.options.length ? optionId : null,
        clickKey,
        memberNote: note || null,
        shipping: shipped ? { ...ship, line2: ship.line2 || undefined, phone: ship.phone || undefined } : null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not redeem. Try again.')
      setState('idle')
      return
    }
    setResult(
      item.kind === 'STORE_CREDIT'
        ? 'Your store credit is ready to spend at vitalityproject.global.'
        : item.kind === 'TRAINING'
          ? 'Unlocked — find it in the Classroom.'
          : 'Request sent. The team will confirm, and you can follow it under My redemptions.',
    )
    setState('done')
    router.refresh()
  }

  const field = 'vip-focus mt-1 h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-sm text-white placeholder:text-white/35'
  const set = (k: keyof AddressView) => (e: React.ChangeEvent<HTMLInputElement>) => setShip((s) => ({ ...s, [k]: e.target.value }))

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="redeem-title"
      style={{ background: "#0f1729" }}
      className="vip-surface-strong m-auto max-h-[92vh] w-[min(94vw,480px)] overflow-y-auto p-0 text-white backdrop:bg-black/65"
    >
      {state === 'done' ? (
        <div className="p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-300" aria-hidden="true" />
          <h2 id="redeem-title" className="mt-3 text-lg font-semibold">Redeemed</h2>
          <p className="mt-1 text-sm text-white/70" role="status">{result}</p>
          <div className="mt-5 flex justify-center gap-2">
            {item.kind === 'TRAINING' ? (
              <Link href="/classroom" className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold">Open Classroom</Link>
            ) : (
              <Link href="/rewards/redemptions" className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold">My redemptions</Link>
            )}
            <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="p-5">
          <h2 id="redeem-title" className="text-lg font-semibold">Redeem {item.title}</h2>
          <p className="mt-1 text-sm text-white/65">
            {item.pointsCost.toLocaleString('en-US')} points · you have {balance.toLocaleString('en-US')}, leaving{' '}
            {(balance - item.pointsCost).toLocaleString('en-US')}.
          </p>

          {item.options.length > 0 && (
            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-white/80">Size</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.options.map((o) => (
                  <label
                    key={o.id}
                    className={cn(
                      'cursor-pointer rounded-xl border px-3.5 py-2 text-sm font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-400',
                      !o.available && 'cursor-not-allowed opacity-40 line-through',
                      optionId === o.id ? 'border-brand-400 bg-brand-500/20' : 'border-white/15 hover:bg-white/[0.05]',
                    )}
                  >
                    <input type="radio" name="size" value={o.id} disabled={!o.available} checked={optionId === o.id} onChange={() => setOptionId(o.id)} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {shipped && (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-medium text-white/80">Ship to</legend>
              <label className="block text-xs text-white/65">Full name<input className={field} value={ship.name} onChange={set('name')} required maxLength={120} autoComplete="name" /></label>
              <label className="block text-xs text-white/65">Address<input className={field} value={ship.line1} onChange={set('line1')} required maxLength={200} autoComplete="address-line1" /></label>
              <label className="block text-xs text-white/65">Apartment, suite (optional)<input className={field} value={ship.line2} onChange={set('line2')} maxLength={200} autoComplete="address-line2" /></label>
              <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
                <label className="block text-xs text-white/65">City<input className={field} value={ship.city} onChange={set('city')} required maxLength={100} autoComplete="address-level2" /></label>
                <label className="block text-xs text-white/65">State<input className={field} value={ship.state} onChange={set('state')} required maxLength={60} autoComplete="address-level1" /></label>
                <label className="block text-xs text-white/65">ZIP<input className={field} value={ship.zip} onChange={set('zip')} required maxLength={20} autoComplete="postal-code" /></label>
              </div>
              <label className="block text-xs text-white/65">Phone (optional, for the courier)<input className={field} value={ship.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" inputMode="tel" /></label>
            </fieldset>
          )}

          {(item.kind === 'EXPERIENCE' || shipped) && (
            <label className="mt-4 block text-sm text-white/80">
              {item.kind === 'EXPERIENCE' ? 'When suits you? (days, times, time zone)' : 'Anything the team should know? (optional)'}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                className="vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] p-3 text-sm"
              />
            </label>
          )}

          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={state === 'busy' || (item.options.length > 0 && !optionId)}
              className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {state === 'busy' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Spend {item.pointsCost.toLocaleString('en-US')} points
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
