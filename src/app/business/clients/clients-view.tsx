'use client'

import { useEffect, useState, useCallback } from 'react'
import { Copy, Check, Users, UserPlus, Link as LinkIcon } from 'lucide-react'

interface ClientRow {
  id: string
  status: string
  user: { id: string; name: string | null; email: string; createdAt: string }
  orderCount: number
  lifetimeSpendCents: number
  trainer: { id: string; name: string | null; email: string; role: string } | null
}

interface MeResponse {
  id: string
  role: string
  referralCode: string
  joinUrl: string
  organization: { name: string }
}

interface StaffRow {
  id: string
  role: string
  user: { name: string | null; email: string }
}

const fmtMoney = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export function ClientsView() {
  const [me, setMe] = useState<MeResponse | null>(null)
  const [clients, setClients] = useState<ClientRow[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [trainerFilter, setTrainerFilter] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [reassignTarget, setReassignTarget] = useState<ClientRow | null>(null)
  const [reassignTrainerId, setReassignTrainerId] = useState('')
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [meRes, clientsRes, staffRes] = await Promise.all([
        fetch('/api/business/me'),
        fetch(`/api/business/clients${trainerFilter ? `?trainerId=${trainerFilter}` : ''}`),
        fetch('/api/business/staff'),
      ])
      if (meRes.ok) setMe(await meRes.json())
      if (clientsRes.ok) {
        const data = await clientsRes.json()
        setClients(data.clients || [])
      }
      if (staffRes.ok) {
        const data = await staffRes.json()
        setStaff(Array.isArray(data) ? data : [])
      }
    } finally {
      setLoading(false)
    }
  }, [trainerFilter])

  useEffect(() => { refresh() }, [refresh])

  const copyJoinUrl = async () => {
    if (!me) return
    await navigator.clipboard.writeText(me.joinUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const submitReassign = async () => {
    if (!reassignTarget) return
    setError('')
    try {
      const res = await fetch(`/api/business/clients/${reassignTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainerOrgMemberId: reassignTrainerId || null }),
      })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || 'Reassign failed')
      }
      setReassignTarget(null)
      setReassignTrainerId('')
      refresh()
    } catch (err: any) {
      setError(err?.message || 'Reassign failed')
    }
  }

  const isOwnerOrAdmin = me?.role === 'OWNER' || me?.role === 'ADMIN'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-400" />
          Clients
        </h1>
        <p className="text-white/40 mt-1">
          {isOwnerOrAdmin
            ? `Every customer attributed to ${me?.organization.name || 'your organization'}.`
            : 'Customers who signed up via your personal join link.'}
        </p>
      </div>

      {/* Personal join link card */}
      {me && (
        <div className="glass rounded-2xl p-5 flex items-start gap-4 flex-wrap">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center flex-shrink-0">
            <LinkIcon className="w-5 h-5 text-brand-400" />
          </div>
          <div className="flex-1 min-w-[260px]">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-1">
              Your personal join link — share with new clients
            </p>
            <code className="text-sm text-brand-300 break-all">{me.joinUrl}</code>
            <p className="text-[11px] text-white/40 mt-1">
              Code: <strong>{me.referralCode}</strong>. Visitors who sign up after clicking are
              attributed to you for life.
            </p>
          </div>
          <button
            type="button"
            onClick={copyJoinUrl}
            className="inline-flex items-center gap-2 px-3 py-2 bg-brand-500 hover:bg-brand-400 text-black font-semibold rounded-lg text-sm"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Trainer filter (owner/admin only) */}
      {isOwnerOrAdmin && staff.length > 0 && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-white/50">Filter by trainer:</label>
          <select
            value={trainerFilter}
            onChange={(e) => setTrainerFilter(e.target.value)}
            className="px-3 py-1.5 text-sm bg-dark-800 border border-white/10 rounded-lg text-white"
          >
            <option value="">All trainers</option>
            {staff
              .filter((s) => ['STAFF', 'COACH', 'DOCTOR'].includes(s.role))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.user.name || s.user.email} ({s.role})
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Client table */}
      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wider text-white/40">
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Trainer</th>
              <th className="px-5 py-3 text-center">Orders</th>
              <th className="px-5 py-3 text-right">Lifetime Spend</th>
              <th className="px-5 py-3 text-right">Joined</th>
              {isOwnerOrAdmin && <th className="px-5 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading && (
              <tr><td colSpan={isOwnerOrAdmin ? 6 : 5} className="px-5 py-8 text-center text-white/40">Loading…</td></tr>
            )}
            {!loading && clients.length === 0 && (
              <tr>
                <td colSpan={isOwnerOrAdmin ? 6 : 5} className="px-5 py-8 text-center text-white/40">
                  No clients yet. Share your join link above to start attributing signups.
                </td>
              </tr>
            )}
            {!loading && clients.map((c) => (
              <tr key={c.id} className="hover:bg-white/5">
                <td className="px-5 py-3">
                  <p className="text-white font-medium">{c.user.name || '—'}</p>
                  <p className="text-xs text-white/40">{c.user.email}</p>
                </td>
                <td className="px-5 py-3">
                  {c.trainer ? (
                    <>
                      <p className="text-white/70 text-sm">{c.trainer.name || c.trainer.email}</p>
                      <p className="text-[10px] text-white/40">{c.trainer.role}</p>
                    </>
                  ) : (
                    <span className="text-xs text-white/30">— unassigned —</span>
                  )}
                </td>
                <td className="px-5 py-3 text-center text-white/60">{c.orderCount}</td>
                <td className="px-5 py-3 text-right text-emerald-400 font-medium">{fmtMoney(c.lifetimeSpendCents)}</td>
                <td className="px-5 py-3 text-right text-xs text-white/40">{new Date(c.user.createdAt).toLocaleDateString()}</td>
                {isOwnerOrAdmin && (
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => { setReassignTarget(c); setReassignTrainerId(c.trainer?.id ?? ''); setError('') }}
                      className="text-xs text-brand-400 hover:text-brand-300"
                    >
                      Reassign
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reassign modal */}
      {reassignTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setReassignTarget(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-1">Reassign Client</h3>
            <p className="text-xs text-white/40 mb-4">
              {reassignTarget.user.name || reassignTarget.user.email}
            </p>
            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300 mb-3">{error}</div>}
            <label className="block mb-4">
              <span className="block text-xs text-white/60 mb-1">Trainer</span>
              <select
                value={reassignTrainerId}
                onChange={(e) => setReassignTrainerId(e.target.value)}
                className="w-full px-3 py-2 bg-dark-900 border border-white/10 rounded-lg text-white text-sm"
              >
                <option value="">— Unassigned —</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.user.name || s.user.email} ({s.role})</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReassignTarget(null)} className="px-4 py-2 text-sm text-white/60 hover:text-white">Cancel</button>
              <button onClick={submitReassign} className="px-4 py-2 text-sm bg-brand-500 text-black font-semibold rounded-lg hover:bg-brand-400">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
