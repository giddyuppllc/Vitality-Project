'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED'
type Priority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

interface Props {
  ticketId: string
  initialStatus: Status
  initialPriority: Priority
  initialAssignedTo: string | null
  admins: { id: string; name: string | null; email: string }[]
}

export function TicketAdminPanel({
  ticketId,
  initialStatus,
  initialPriority,
  initialAssignedTo,
  admins,
}: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<Status>(initialStatus)
  const [priority, setPriority] = useState<Priority>(initialPriority)
  const [assignedTo, setAssignedTo] = useState<string>(
    initialAssignedTo ?? '',
  )
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const savePanel = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          priority,
          assignedTo: assignedTo || null,
        }),
      })
      // Previously this never checked res.ok and always showed "Saved." — so a
      // 401 (expired admin session) / 500 silently failed while the dropdown
      // claimed success. Only report saved when the server actually persisted it.
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Save failed (${res.status})`)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      router.refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/support/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply, internal }),
      })
      if (res.ok) {
        setReply('')
        setInternal(false)
        router.refresh()
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-sm">Manage</h3>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">
            Assigned to
          </label>
          <select
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Unassigned</option>
            {admins.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={savePanel}
          loading={saving}
          size="sm"
          className="w-full"
        >
          Save Changes
        </Button>
        {saveError && (
          <p className="text-red-400 text-xs text-center">{saveError}</p>
        )}
        {saved && (
          <p className="text-emerald-400 text-xs text-center">Saved.</p>
        )}
      </div>

      <form onSubmit={sendReply} className="glass rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Reply</h3>
          {internal && <Badge variant="warning">Internal note</Badge>}
        </div>
        <textarea
          rows={6}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={
            internal
              ? 'Internal note — not visible to customer'
              : 'Reply to customer…'
          }
          className="w-full px-3 py-2 rounded-lg bg-dark-700 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none text-sm"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={internal}
            onChange={(e) => setInternal(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-xs text-white/60">
            Internal note (only admins see this)
          </span>
        </label>
        <Button type="submit" loading={sending} size="sm" className="w-full">
          Send
        </Button>
      </form>
    </div>
  )
}
