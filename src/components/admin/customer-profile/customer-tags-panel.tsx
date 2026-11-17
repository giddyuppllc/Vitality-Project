'use client'

import { adminFetch } from '@/lib/admin-fetch'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tag as TagIcon, Plus, X } from 'lucide-react'

interface TagShape {
  id: string
  name: string
  color: string
}

interface Props {
  userId: string
  assignedTags: TagShape[]
  allTags: TagShape[]
}

export function CustomerTagsPanel({ userId, assignedTags, allTags }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const assignedIds = new Set(assignedTags.map((t) => t.id))
  const available = allTags.filter((t) => !assignedIds.has(t.id))

  const assign = async (tagId: string) => {
    setBusy(true)
    setError(null)
    try {
      const r = await adminFetch(`/api/admin/users/${userId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      if (!r.ok) return setError(r.error)
      setAdding(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (tagId: string) => {
    setBusy(true)
    setError(null)
    try {
      const r = await adminFetch(`/api/admin/users/${userId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      if (!r.ok) return setError(r.error)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const createAndAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    setError(null)
    try {
      // Typing the name of a tag that already exists used to 409 and do
      // nothing at all. Reuse the existing tag instead.
      let tagId = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id
      if (!tagId) {
        const created = await adminFetch<{ id: string }>(`/api/admin/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!created.ok) return setError(created.error)
        tagId = created.data.id
      }
      const r = await adminFetch(`/api/admin/users/${userId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagId }),
      })
      if (!r.ok) return setError(r.error)
      setNewName('')
      setAdding(false)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-brand-400" /> Tags
        </h3>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          aria-label="Add tag"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {assignedTags.length === 0 && (
          <p className="text-xs text-white/40">No tags yet.</p>
        )}
        {assignedTags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              backgroundColor: `${t.color}20`,
              color: t.color,
              border: `1px solid ${t.color}40`,
            }}
          >
            {t.name}
            <button
              type="button"
              onClick={() => remove(t.id)}
              disabled={busy}
              className="hover:text-white"
              aria-label={`Remove ${t.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>

      {error && <p role="alert" className="text-xs text-red-400 mb-2">{error}</p>}
      {adding && (
        <div className="border-t border-white/5 pt-3 mt-3 space-y-2">
          {available.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-1.5">Existing tags</p>
              <div className="flex flex-wrap gap-1.5">
                {available.slice(0, 12).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => assign(t.id)}
                    disabled={busy}
                    className="px-2 py-0.5 rounded-full text-xs bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={createAndAssign} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New tag name"
              className="flex-1 px-3 py-1.5 rounded-lg bg-dark-700 border border-white/10 text-white text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
