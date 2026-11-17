'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, CheckCircle2, Loader2, Receipt, RotateCcw, Search, Wallet, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Member {
  memberNumber: string
  name: string
  active: boolean
  tier: string
  canRedeemHere: boolean
}
interface Txn {
  id: string
  kind: 'EARN' | 'REDEEM'
  amountCents: number
  points: number
  receiptRef: string | null
  createdAt: string
  voidedAt: string | null
  voidable: boolean
  memberNumber?: string
}

const TIER: Record<string, string> = { CLUB: 'The Club', PLUS: 'Plus', PREMIUM: 'Premium Stacks', NONE: 'No active membership' }
const usd = (c: number) => `$${(c / 100).toFixed(2)}`
const time = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/vip/partner-portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

/** Pulls a member number out of whatever the QR held (the number itself, or text containing it). */
function extractNumber(raw: string): string | null {
  const m = /VP[-\s]?(\d{4})[-\s]?(\d{4})/i.exec(raw)
  return m ? `VP-${m[1]}-${m[2]}` : null
}

type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }

export function PartnerPortal({
  partners,
  initialPartnerId,
  initialTxns,
  earnRate,
}: {
  partners: { id: string; name: string; earnPointsPerDollar: number; allowRedemption: boolean }[]
  initialPartnerId: string
  initialTxns: Txn[]
  earnRate: number
}) {
  const router = useRouter()
  const [partnerId, setPartnerId] = useState(initialPartnerId)
  const partner = partners.find((p) => p.id === partnerId) ?? partners[0]
  const [query, setQuery] = useState('')
  const [member, setMember] = useState<Member | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [txns, setTxns] = useState<Txn[]>(initialTxns)
  const [scanning, setScanning] = useState(false)

  const refreshTxns = useCallback(async (pid: string) => {
    const res = await fetch(`/api/vip/partner-portal?partnerId=${encodeURIComponent(pid)}`)
    if (res.ok) setTxns((await res.json()).txns)
  }, [])

  useEffect(() => {
    if (partnerId !== initialPartnerId) void refreshTxns(partnerId)
  }, [partnerId, initialPartnerId, refreshTxns])

  async function lookup(num?: string) {
    const memberNumber = (num ?? query).trim()
    if (!memberNumber) return
    setLookupBusy(true)
    setLookupError(null)
    setMember(null)
    const r = await api({ op: 'lookup', partnerId, memberNumber })
    setLookupBusy(false)
    if (!r.ok) {
      setLookupError(r.data.error || 'Member not found.')
      return
    }
    setMember(r.data.member)
    setQuery(r.data.member.memberNumber)
  }

  return (
    <div className="space-y-6">
      {partners.length > 1 && (
        <label className="block max-w-xs text-sm font-medium text-white/80">
          Business
          <select
            value={partnerId}
            onChange={(e) => {
              setPartnerId(e.target.value)
              setMember(null)
            }}
            className="vip-focus mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-[#0f1729] px-3 text-sm text-white"
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}

      <section className="vip-surface-strong p-5" aria-labelledby="find">
        <h2 id="find" className="font-semibold">Find a member</h2>
        <p className="mt-1 text-sm text-white/60">Scan the QR on their member card, or type the member number.</p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            void lookup()
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Member number</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="VP-1234-5678"
              autoComplete="off"
              autoCapitalize="characters"
              className="vip-focus h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 font-mono text-[15px] tracking-wider text-white placeholder:text-white/35"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={lookupBusy || !query.trim()} className="vip-focus inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold disabled:opacity-50 sm:flex-none">
              {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
              Look up
            </button>
            <button type="button" onClick={() => setScanning(true)} className="vip-focus inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/[0.06] sm:flex-none">
              <Camera className="h-4 w-4" aria-hidden="true" /> Scan
            </button>
          </div>
        </form>
        {lookupError && <p role="alert" className="mt-2 text-sm text-red-300">{lookupError}</p>}
        {scanning && (
          <Scanner
            onClose={() => setScanning(false)}
            onResult={(num) => {
              setScanning(false)
              setQuery(num)
              void lookup(num)
            }}
          />
        )}
      </section>

      {member && (
        <section aria-labelledby="member" className="space-y-4">
          <div className="vip-surface flex flex-wrap items-center justify-between gap-3 p-4" data-testid="portal-member">
            <div>
              <p id="member" className="text-lg font-bold">{member.name}</p>
              <p className="font-mono text-sm text-white/65">{member.memberNumber}</p>
            </div>
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', member.active ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100' : 'border-amber-200/40 bg-amber-200/10 text-amber-100')}>
              {member.active ? `Active · ${TIER[member.tier] ?? member.tier}` : TIER.NONE}
            </span>
          </div>
          {member.active ? (
            <div className="grid gap-4 md:grid-cols-2">
              <PurchaseForm
                partnerId={partnerId}
                member={member}
                earnRate={partner?.earnPointsPerDollar ?? earnRate}
                onDone={() => {
                  void refreshTxns(partnerId)
                  router.refresh()
                }}
              />
              <RedeemForm
                partnerId={partnerId}
                member={member}
                allowed={!!partner?.allowRedemption}
                onDone={() => {
                  void refreshTxns(partnerId)
                  router.refresh()
                }}
              />
            </div>
          ) : (
            <p className="vip-surface p-4 text-sm text-white/70">Points can’t be earned or spent until this membership is active again.</p>
          )}
        </section>
      )}

      <section aria-labelledby="recent">
        <h2 id="recent" className="mb-3 font-semibold">Recent transactions</h2>
        {txns.length === 0 ? (
          <p className="vip-surface p-5 text-sm text-white/60">No transactions yet.</p>
        ) : (
          <ul className="vip-surface divide-y divide-white/[0.06]" data-testid="portal-txns">
            {txns.map((t) => (
              <TxnRow key={t.id} t={t} partnerId={partnerId} onChange={() => void refreshTxns(partnerId)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Result({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <p role={ok ? 'status' : 'alert'} className={cn('mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm', ok ? 'bg-emerald-300/10 text-emerald-100' : 'bg-red-400/10 text-red-200')}>
      {ok && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  )
}

const input = 'vip-focus mt-1 h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[15px] text-white'

function PurchaseForm({ partnerId, member, earnRate, onDone }: { partnerId: string; member: Member; earnRate: number; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const [receipt, setReceipt] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const cents = Math.round((Number.parseFloat(amount) || 0) * 100)
  const preview = Math.floor((cents * earnRate) / 100)
  return (
    <form
      className="vip-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setMsg(null)
        const r = await api({ op: 'purchase', partnerId, memberNumber: member.memberNumber, amountCents: cents, receiptRef: receipt })
        setBusy(false)
        if (!r.ok) return setMsg({ ok: false, text: r.data.error || 'Could not record the purchase.' })
        setMsg({
          ok: true,
          text: r.data.duplicate
            ? `Receipt ${receipt} was already recorded — no extra points were given.`
            : `${r.data.txn.points.toLocaleString('en-US')} points added for ${usd(r.data.txn.amountCents)}.`,
        })
        if (!r.data.duplicate) {
          setAmount('')
          setReceipt('')
        }
        onDone()
      }}
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <Receipt className="h-4 w-4 text-emerald-300" aria-hidden="true" /> Record a purchase
      </h3>
      <p className="mt-0.5 text-xs text-white/55">{earnRate} points per $1 spent.</p>
      <label className="mt-3 block text-sm text-white/80">
        Amount paid ($)
        <input className={input} type="number" inputMode="decimal" min={0.01} step={0.01} required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="mt-2 block text-sm text-white/80">
        Receipt number
        <input className={input} required maxLength={64} value={receipt} onChange={(e) => setReceipt(e.target.value)} autoComplete="off" />
      </label>
      <button type="submit" disabled={busy || cents <= 0 || !receipt.trim()} className="vip-focus mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/90 text-sm font-semibold text-[#04110b] hover:bg-emerald-400 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {preview > 0 ? `Add ${preview.toLocaleString('en-US')} points` : 'Add points'}
      </button>
      {msg && <Result ok={msg.ok}>{msg.text}</Result>}
    </form>
  )
}

function RedeemForm({ partnerId, member, allowed, onDone }: { partnerId: string; member: Member; allowed: boolean; onDone: () => void }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!allowed) {
    return (
      <div className="vip-surface p-4 text-sm text-white/65">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <Wallet className="h-4 w-4 text-brand-200" aria-hidden="true" /> Take points as payment
        </h3>
        <p className="mt-2">Members can’t spend points at this business yet. The Vitality team can switch this on.</p>
      </div>
    )
  }
  return (
    <form
      className="vip-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setMsg(null)
        const r = await api({ op: 'redeem', partnerId, memberNumber: member.memberNumber, code })
        setBusy(false)
        if (!r.ok) return setMsg({ ok: false, text: r.data.error || 'Could not take the points.' })
        setMsg({ ok: true, text: `${r.data.points.toLocaleString('en-US')} points taken — take ${usd(r.data.points)} off the bill.` })
        setCode('')
        onDone()
      }}
    >
      <h3 className="flex items-center gap-2 font-semibold">
        <Wallet className="h-4 w-4 text-brand-200" aria-hidden="true" /> Take points as payment
      </h3>
      <p className="mt-0.5 text-xs text-white/55">The member opens Rewards → Partners in their app, chooses the amount and shows you a 6-digit code.</p>
      <label className="mt-3 block text-sm text-white/80">
        Member’s code
        <input
          className={cn(input, 'font-mono tracking-[0.3em]')}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <button type="submit" disabled={busy || code.replace(/\D/g, '').length !== 6} className="vip-focus mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 text-sm font-semibold hover:bg-brand-600 disabled:opacity-50">
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Take points
      </button>
      {msg && <Result ok={msg.ok}>{msg.text}</Result>}
    </form>
  )
}

function TxnRow({ t, partnerId, onChange }: { t: Txn; partnerId: string; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function voidIt() {
    const reason = window.prompt('Reason for voiding (shown on the statement)')
    if (reason === null) return
    setBusy(true)
    setError(null)
    const r = await api({ op: 'void', partnerId, txnId: t.id, reason })
    setBusy(false)
    if (!r.ok) return setError(r.data.error || 'Could not void.')
    onChange()
  }
  return (
    <li className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm', t.voidedAt && 'opacity-60')}>
      <div className="min-w-0">
        <p className="font-medium">
          {t.kind === 'EARN' ? `Purchase ${usd(t.amountCents)}` : `Points spent ${usd(t.amountCents)}`}
          <span className={t.kind === 'EARN' ? 'text-emerald-300' : 'text-white/70'}> · {t.kind === 'EARN' ? '+' : '−'}{t.points.toLocaleString('en-US')} pts</span>
          {t.voidedAt && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase">Voided</span>}
        </p>
        <p className="text-xs text-white/55">
          {time(t.createdAt)}
          {t.memberNumber && ` · ${t.memberNumber}`}
          {t.receiptRef && ` · receipt ${t.receiptRef}`}
        </p>
        {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      </div>
      {t.voidable && (
        <button type="button" onClick={voidIt} disabled={busy} className="vip-focus inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/75 hover:bg-white/[0.06] disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />}
          Void
        </button>
      )}
    </li>
  )
}

/** Camera QR scan with the browser's BarcodeDetector; typed entry stays available everywhere. */
function Scanner({ onResult, onClose }: { onResult: (memberNumber: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  // Latest callback without restarting the camera on every parent render.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let stopped = false
    const Detector = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setError('This browser can’t scan QR codes. Type the member number instead.')
      return
    }
    const detector = new Detector({ formats: ['qr_code'] })
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop())
        stream = s
        const v = videoRef.current
        if (!v) return
        v.srcObject = s
        await v.play().catch(() => {})
        timer = setInterval(async () => {
          if (!v.videoWidth) return
          try {
            const codes = await detector.detect(v)
            for (const c of codes) {
              const n = extractNumber(c.rawValue)
              if (n) {
                if (timer) clearInterval(timer)
                onResultRef.current(n)
                return
              }
            }
          } catch {
            /* keep scanning */
          }
        }, 250)
      })
      .catch(() => setError('Camera access was blocked. Allow the camera, or type the member number instead.'))
    return () => {
      stopped = true
      if (timer) clearInterval(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between px-3 py-2 text-sm">
        <span className="font-medium">Point the camera at the member’s QR code</span>
        <button type="button" onClick={onClose} className="vip-focus grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10" aria-label="Close scanner">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p role="alert" className="px-3 pb-3 text-sm text-amber-100">{error}</p>
      ) : (
        <video ref={videoRef} muted playsInline className="aspect-video w-full bg-black object-cover" />
      )}
    </div>
  )
}
