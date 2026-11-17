'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { Avatar } from './ui'

interface Member {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
}

const MAX_OTHERS = 19

/** Pick one member (1:1) or several (group, up to 20 people with you). */
export function NewConversation() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Member[]>([])
  const [loading, setLoading] = useState(false)
  const [picked, setPicked] = useState<Member[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const ctl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      fetch(`/api/vip/members/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((d) => {
          setResults(d.members ?? [])
          setLoading(false)
        })
        .catch(() => {})
    }, 150)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [q])

  function toggle(m: Member) {
    setError(null)
    setPicked((cur) => {
      if (cur.some((p) => p.id === m.id)) return cur.filter((p) => p.id !== m.id)
      if (cur.length >= MAX_OTHERS) {
        setError(`Groups hold up to ${MAX_OTHERS + 1} people, including you.`)
        return cur
      }
      return [...cur, m]
    })
  }

  async function start() {
    setBusy(true)
    setError(null)
    const body =
      picked.length === 1
        ? { recipientId: picked[0].id }
        : { memberIds: picked.map((p) => p.id), title: title.trim() || null }
    const res = await fetch('/api/vip/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setBusy(false)
    if (!res?.ok) {
      setError(data?.error || 'Could not start the conversation.')
      return
    }
    router.push(`/messages/${data.id}`)
  }

  const group = picked.length > 1

  return (
    <div className="space-y-4">
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Selected members">
          {picked.map((p) => (
            <li key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/35 bg-brand-500/15 py-1 pl-1 pr-1.5 text-sm">
              <Avatar name={p.displayName} src={p.avatarUrl} size={24} />
              {p.displayName}
              <button type="button" onClick={() => toggle(p)} aria-label={`Remove ${p.displayName}`} className="vip-focus grid h-6 w-6 place-items-center rounded-full hover:bg-white/10">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="relative block">
        <span className="sr-only">Search members</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or @username"
          className="vip-focus h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/40"
        />
      </label>

      <div className="vip-surface overflow-hidden" aria-live="polite">
        {loading && results.length === 0 ? (
          <p className="flex items-center gap-2 px-4 py-4 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Searching
          </p>
        ) : results.length === 0 ? (
          <p className="px-4 py-4 text-sm text-white/60">No members match that name.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {results.map((m) => {
              const on = picked.some((p) => p.id === m.id)
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m)}
                    aria-pressed={on}
                    className={`vip-focus flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03] ${on ? 'bg-brand-500/10' : ''}`}
                  >
                    <Avatar name={m.displayName} src={m.avatarUrl} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{m.displayName}</span>
                      {m.username && <span className="block truncate text-xs text-white/60">@{m.username}</span>}
                    </span>
                    <span
                      className={`grid h-6 w-6 place-items-center rounded-full border ${on ? 'border-brand-400 bg-brand-500 text-white' : 'border-white/25'}`}
                      aria-hidden="true"
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {group && (
        <label className="block text-sm font-medium text-white/80">
          Group name <span className="font-normal text-white/60">(optional)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Saturday long-run crew"
            className="vip-focus mt-1.5 h-11 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-[15px] text-white placeholder:text-white/35"
          />
        </label>
      )}

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}

      <button
        type="button"
        onClick={start}
        disabled={busy || picked.length === 0}
        className="vip-focus inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {group ? `Start group (${picked.length + 1} people)` : 'Start conversation'}
      </button>
    </div>
  )
}
