'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Variant {
  id: string
  name: string
  sku: string | null
  price: number // cents
  inventory: number
}

interface Draft {
  id: string | null
  name: string
  sku: string
  price: string // dollars
  inventory: string
  dirty: boolean
  saving: boolean
}

/**
 * Money typed by a human -> cents, or null when it is not a number at all.
 *
 * `Math.round(parseFloat(v) * 100)` was used directly, and it has two failure
 * modes that both look like "the save did nothing":
 *
 *   "$64"    -> NaN -> JSON.stringify writes NULL -> Zod z.number() rejects it
 *               -> 400 -> and the old code swallowed the response entirely.
 *   "1,200"  -> parseFloat stops at the comma -> 100 -> saves $1.00 instead of
 *               $1,200.00. No error at all; just quietly the wrong price.
 *
 * Currency symbols, thousands separators and stray spaces are what people
 * actually type into a price box, so strip them rather than punish them.
 */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = String(raw ?? '').replace(/[^0-9.-]/g, '')
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100)
}

function toDraft(v: Variant): Draft {
  return {
    id: v.id,
    name: v.name,
    sku: v.sku ?? '',
    price: (v.price / 100).toFixed(2),
    inventory: String(v.inventory),
    dirty: false,
    saving: false,
  }
}

export function ProductVariantsEditor({
  productId,
  onCountChange,
}: {
  productId: string
  /** Lets the parent form show a read-only derived stock total. */
  onCountChange?: (n: number) => void
}) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  /**
   * Every save path used to be `if (res.ok) …` with no else. On failure the row
   * kept the values you had just typed, the spinner stopped, and nothing else
   * changed — visually IDENTICAL to a successful save. Only a refresh revealed
   * that nothing persisted. An expired admin session (guard() -> 401) produces
   * exactly that, silently.
   */
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/products/${productId}/variants`)
      if (res.ok) {
        const data: Variant[] = await res.json()
        setDrafts(data.map(toDraft))
        onCountChange?.(data.length)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [productId])

  /** Turn a failed Response into something a human can act on. */
  const explain = async (res: Response, what: string) => {
    let detail = ''
    try {
      const body = await res.json()
      detail = typeof body?.error === 'string' ? body.error : JSON.stringify(body?.error ?? '')
    } catch {
      /* non-JSON body — the status is still worth showing */
    }
    if (res.status === 401 || res.status === 403)
      return `Not saved — your admin session expired. Reload and sign in again.`
    return `${what} failed (${res.status})${detail ? ` — ${detail}` : ''}`
  }

  const update = (idx: number, patch: Partial<Draft>) =>
    setDrafts((ds) =>
      ds.map((d, i) => (i === idx ? { ...d, ...patch, dirty: true } : d)),
    )

  const saveRow = async (idx: number) => {
    const d = drafts[idx]
    if (!d.name) return
    setError(null)
    const cents = parseMoneyToCents(d.price)
    if (cents === null) {
      // Caught here rather than as an opaque 400 from the server.
      setError(`"${d.price}" is not a valid price. Enter a number like 64 or 64.00.`)
      return
    }
    const payload = {
      name: d.name,
      sku: d.sku || null,
      price: cents,
      inventory: parseInt(d.inventory || '0') || 0,
    }
    setDrafts((ds) =>
      ds.map((row, i) => (i === idx ? { ...row, saving: true } : row)),
    )

    try {
      if (d.id) {
        const res = await fetch(
          `/api/admin/products/${productId}/variants/${d.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
        if (res.ok) await load()
        else setError(await explain(res, 'Save'))
      } else {
        const res = await fetch(`/api/admin/products/${productId}/variants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          setAdding(false)
          await load()
        } else {
          setError(await explain(res, 'Add variant'))
        }
      }
    } finally {
      setDrafts((ds) =>
        ds.map((row, i) => (i === idx ? { ...row, saving: false } : row)),
      )
    }
  }

  const removeRow = async (idx: number) => {
    const d = drafts[idx]
    if (d.id) {
      if (!confirm(`Delete variant "${d.name}"?`)) return
      const res = await fetch(
        `/api/admin/products/${productId}/variants/${d.id}`,
        { method: 'DELETE' },
      )
      if (res.ok) await load()
      else setError(await explain(res, 'Delete'))
    } else {
      // Discard unsaved
      setDrafts((ds) => ds.filter((_, i) => i !== idx))
      setAdding(false)
    }
  }

  const addRow = () => {
    if (adding) return
    setAdding(true)
    setDrafts((ds) => [
      ...ds,
      {
        id: null,
        name: '',
        sku: '',
        price: '',
        inventory: '0',
        dirty: true,
        saving: false,
      },
    ])
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-white/50 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading variants…
      </div>
    )

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
        >
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-300/70 hover:text-red-200"
            aria-label="Dismiss"
          >
            &times;
          </button>
        </div>
      )}
      {drafts.length === 0 ? (
        <p className="text-sm text-white/40">
          No variants. Add one if this product has size/dose/pack variations.
        </p>
      ) : (
        <div className="space-y-2">
          {drafts.map((d, i) => (
            <div
              key={d.id ?? `new-${i}`}
              className="grid grid-cols-12 gap-2 items-end p-3 rounded-xl bg-dark-700/50 border border-white/5"
            >
              <div className="col-span-4">
                <Input
                  label={i === 0 ? 'Name' : undefined}
                  value={d.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="10mg / 30 vials"
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? 'SKU' : undefined}
                  value={d.sku}
                  onChange={(e) => update(i, { sku: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? 'Price ($)' : undefined}
                  type="number"
                  step="0.01"
                  value={d.price}
                  onChange={(e) => update(i, { price: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label={i === 0 ? 'Inventory' : undefined}
                  type="number"
                  value={d.inventory}
                  onChange={(e) => update(i, { inventory: e.target.value })}
                />
              </div>
              <div className="col-span-2 flex gap-1 justify-end">
                <button
                  type="button"
                  onClick={() => saveRow(i)}
                  disabled={!d.dirty || d.saving}
                  className="p-2 text-brand-400 hover:text-brand-300 disabled:opacity-40 transition-colors"
                  title="Save"
                >
                  {d.saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button type="button" variant="secondary" size="sm" onClick={addRow}>
        <Plus className="w-4 h-4" /> Add Variant
      </Button>
    </div>
  )
}
