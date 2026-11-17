'use client'

import { localInputToIso } from '@/lib/datetime-local'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Admin {
  id: string
  name: string | null
  email: string
}

interface Props {
  admins: Admin[]
  initialEntityType?: string
  initialEntityId?: string
  currentAdminId: string
}

const ENTITY_TYPES = ['', 'User', 'Order', 'Organization', 'Ticket']

export function TaskForm({
  admins,
  initialEntityType = '',
  initialEntityId = '',
  currentAdminId,
}: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<
    'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  >('NORMAL')
  const [dueAt, setDueAt] = useState('')
  const [assignedTo, setAssignedTo] = useState(currentAdminId)
  const [entityType, setEntityType] = useState(initialEntityType)
  const [entityId, setEntityId] = useState(initialEntityId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          dueAt: localInputToIso(dueAt) ?? undefined,
          assignedTo: assignedTo || undefined,
          entityType: entityType || undefined,
          entityId: entityId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed')
        return
      }
      router.push('/admin/tasks')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-6 space-y-5">
      <div>
        <label className="text-sm text-white/70 block mb-1.5">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Follow up with VIP about delayed order"
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div>
        <label className="text-sm text-white/70 block mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Context, relevant details…"
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-white/70 block mb-1.5">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-white/70 block mb-1.5">Due</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="text-sm text-white/70 block mb-1.5">Assign to</label>
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name ?? a.email}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm text-white/70 block mb-1.5">
            Related entity type
          </label>
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {ENTITY_TYPES.map((e) => (
              <option key={e || 'none'} value={e}>
                {e || '(none)'}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-white/70 block mb-1.5">
            Related entity ID
          </label>
          <input
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            disabled={!entityType}
            placeholder={entityType ? `${entityType} id…` : 'Select type first'}
            className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-40"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-400 border border-red-500/30 rounded-lg p-3 bg-red-500/10">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create task'}
        </button>
      </div>
    </form>
  )
}
