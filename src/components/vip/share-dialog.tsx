'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, Users } from 'lucide-react'
import { Avatar } from './ui'

interface Conv {
  id: string
  isGroup: boolean
  title: string
  others: { id: string; displayName: string; avatarUrl: string | null }[]
}
interface Member {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
}

type Target = { kind: 'conversation'; id: string; label: string } | { kind: 'member'; id: string; label: string }

/** Share a post into a direct message: a recent conversation or any member. */
export function ShareDialog({ postId, onClose }: { postId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [convs, setConvs] = useState<Conv[] | null>(null)
  const [q, setQ] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [target, setTarget] = useState<Target | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [sentTo, setSentTo] = useState<{ id: string; label: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    fetch('/api/vip/messages')
      .then((r) => (r.ok ? r.json() : { conversations: [] }))
      .then((d) => setConvs((d.conversations ?? []).slice(0, 8)))
      .catch(() => setConvs([]))
  }, [])

  useEffect(() => {
    if (!q.trim()) {
      setMembers([])
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/vip/members/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { members: [] }))
        .then((d) => setMembers(d.members ?? []))
        .catch(() => {})
    }, 150)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [q])

  async function send() {
    if (!target) return
    setState('busy')
    setError(null)
    let convId = target.kind === 'conversation' ? target.id : null
    if (!convId) {
      const res = await fetch('/api/vip/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: target.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not start the conversation.')
        setState('idle')
        return
      }
      convId = data.id as string
    }
    const res = await fetch(`/api/vip/messages/${convId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: note, sharedPostId: postId }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(data.error || 'Could not send.')
      setState('idle')
      return
    }
    setSentTo({ id: convId, label: target.label })
    setState('done')
  }

  const pick = (t: Target) => {
    setTarget(t)
    setError(null)
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="share-title"
      className="vip-surface-strong m-auto w-[min(94vw,440px)] p-0 text-white backdrop:bg-black/60"
    >
      <div className="p-5">
        <h2 id="share-title" className="text-lg font-semibold">Send in a message</h2>
        {state === 'done' && sentTo ? (
          <>
            <p role="status" className="mt-2 text-sm text-white/75">Sent to {sentTo.label}.</p>
            <div className="mt-5 flex justify-end gap-2">
              <Link href={`/messages/${sentTo.id}`} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/80 hover:bg-white/[0.06]">
                Open conversation
              </Link>
              <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="relative mt-3 block">
              <span className="sr-only">Search members</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden="true" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search members"
                className="vip-focus h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/40"
              />
            </label>
            <div className="mt-3 max-h-64 overflow-y-auto" role="radiogroup" aria-label="Send to">
              {q.trim() ? (
                members.length ? (
                  members.map((m) => (
                    <PickRow
                      key={m.id}
                      checked={target?.kind === 'member' && target.id === m.id}
                      onPick={() => pick({ kind: 'member', id: m.id, label: m.displayName })}
                      name={m.displayName}
                      sub={m.username ? `@${m.username}` : null}
                      avatar={m.avatarUrl}
                    />
                  ))
                ) : (
                  <p className="px-1 py-2 text-sm text-white/60">No members match that name.</p>
                )
              ) : convs === null ? (
                <p className="flex items-center gap-2 px-1 py-2 text-sm text-white/60">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading conversations
                </p>
              ) : convs.length ? (
                <>
                  <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-white/60">Recent</p>
                  {convs.map((c) => (
                    <PickRow
                      key={c.id}
                      checked={target?.kind === 'conversation' && target.id === c.id}
                      onPick={() => pick({ kind: 'conversation', id: c.id, label: c.title })}
                      name={c.title}
                      sub={c.isGroup ? `${c.others.length + 1} people` : null}
                      avatar={c.isGroup ? null : c.others[0]?.avatarUrl ?? null}
                      group={c.isGroup}
                    />
                  ))}
                </>
              ) : (
                <p className="px-1 py-2 text-sm text-white/60">Search for a member to send this post to.</p>
              )}
            </div>
            <label className="mt-3 block text-sm text-white/75">
              Add a note (optional)
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={2000}
                className="vip-focus mt-1.5 w-full rounded-xl border border-white/12 bg-white/[0.05] p-3 text-sm"
              />
            </label>
            {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => ref.current?.close()} className="vip-focus rounded-xl px-4 py-2 text-sm text-white/70 hover:bg-white/[0.06]">
                Cancel
              </button>
              <button
                type="button"
                onClick={send}
                disabled={!target || state === 'busy'}
                className="vip-focus inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {state === 'busy' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  )
}

function PickRow({
  checked,
  onPick,
  name,
  sub,
  avatar,
  group,
}: {
  checked: boolean
  onPick: () => void
  name: string
  sub: string | null
  avatar: string | null
  group?: boolean
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onPick}
      className={`vip-focus flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm ${checked ? 'bg-brand-500/20 ring-1 ring-inset ring-brand-400/40' : 'hover:bg-white/[0.05]'}`}
    >
      {group ? (
        <span className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.06]" aria-hidden="true">
          <Users className="h-4 w-4" />
        </span>
      ) : (
        <Avatar name={name} src={avatar} size={32} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{name}</span>
        {sub && <span className="block truncate text-xs text-white/60">{sub}</span>}
      </span>
    </button>
  )
}
