'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowLeft, Flag, ImagePlus, Loader2, LogOut, MoreHorizontal, Pencil, SendHorizontal, Users, X } from 'lucide-react'
import type { ConversationDetail, MessageView } from '@/lib/vip/messages'
import { renderPostBody } from '@/lib/vip/text'
import { cn } from '@/lib/utils'
import { Avatar } from './ui'
import { ReportDialog } from './report-dialog'
import { PostImages } from './post-media'
import { uploadVipImage } from './upload'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'

const POLL_VISIBLE_MS = 4000

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(Date.now() - 864e5)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, y)) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

function merge(cur: MessageView[], add: MessageView[]): MessageView[] {
  if (!add.length) return cur
  const seen = new Set(cur.map((m) => m.id))
  const fresh = add.filter((m) => !seen.has(m.id))
  if (!fresh.length) return cur
  return [...cur, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export function MessageThread({
  viewerId,
  viewerName,
  initialConversation,
  initialMessages,
  initialHasOlder,
}: {
  viewerId: string
  viewerName: string
  initialConversation: ConversationDetail
  initialMessages: MessageView[]
  initialHasOlder: boolean
}) {
  const router = useRouter()
  const [conv, setConv] = useState(initialConversation)
  const [messages, setMessages] = useState(initialMessages)
  const [hasOlder, setHasOlder] = useState(initialHasOlder)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [gone, setGone] = useState(false)
  const [body, setBody] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [headerMenu, setHeaderMenu] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState(initialConversation.customTitle ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nearBottom = useRef(true)
  const latest = useRef(messages)
  latest.current = messages

  const people = new Map(conv.others.map((o) => [o.id, o]))

  const scrollToBottom = useCallback((smooth = false) => {
    // Scroll the page to its end (not just the last message into view): the sticky
    // composer sits below the messages and would otherwise cover the newest ones.
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  useLayoutEffect(() => {
    scrollToBottom(false)
  }, [scrollToBottom])

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement
      nearBottom.current = doc.scrollHeight - (window.scrollY + window.innerHeight) < 240
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Live updates: poll for newer messages (and read receipts) while visible.
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const tick = async () => {
      if (stopped) return
      if (document.visibilityState === 'visible') {
        const last = latest.current[latest.current.length - 1]
        const sp = new URLSearchParams({ read: '1' })
        if (last) sp.set('after', last.createdAt)
        try {
          const res = await fetch(`/api/vip/messages/${conv.id}?${sp}`, { cache: 'no-store' })
          if (res.status === 404) {
            setGone(true)
            return
          }
          if (res.ok) {
            const data = await res.json()
            setConv(data.conversation)
            const before = latest.current.length
            setMessages((cur) => merge(cur, data.messages))
            if (data.messages.length && nearBottom.current) requestAnimationFrame(() => scrollToBottom(true))
            if (data.messages.length && before !== latest.current.length) window.dispatchEvent(new Event('vip:messages-read'))
          }
        } catch {
          // offline — try again next tick
        }
      }
      if (!stopped) timer = setTimeout(tick, POLL_VISIBLE_MS)
    }
    timer = setTimeout(tick, POLL_VISIBLE_MS)
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer)
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    window.dispatchEvent(new Event('vip:messages-read'))
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [conv.id, scrollToBottom])

  async function loadOlder() {
    const first = messages[0]
    if (!first) return
    setLoadingOlder(true)
    const res = await fetch(`/api/vip/messages/${conv.id}?before=${encodeURIComponent(first.id)}`)
    if (res.ok) {
      const data = await res.json()
      setMessages((cur) => {
        const seen = new Set(cur.map((m) => m.id))
        return [...data.messages.filter((m: MessageView) => !seen.has(m.id)), ...cur]
      })
      setHasOlder(data.hasOlder)
    }
    setLoadingOlder(false)
  }

  async function attach(file: File) {
    setUploading(true)
    setError(null)
    const r = await uploadVipImage(file)
    setUploading(false)
    if (r.ok) setImageUrl(r.url)
    else setError(r.error)
  }

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    if (sending || (!body.trim() && !imageUrl)) return
    const sentBody = body
    const sentImage = imageUrl
    setSending(true)
    setError(null)
    const res = await fetch(`/api/vip/messages/${conv.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: sentBody, imageUrl: sentImage }),
    }).catch(() => null)
    const data = await res?.json().catch(() => ({}))
    setSending(false)
    if (!res?.ok) {
      setError(data?.error || 'Could not send. Check your connection and try again.')
      return
    }
    // Clear only what was sent: a photo attached (or text typed) while this send was in flight stays.
    setBody((cur) => (cur === sentBody ? '' : cur))
    setImageUrl((cur) => (cur === sentImage ? null : cur))
    setMessages((cur) => merge(cur, [data.message]))
    requestAnimationFrame(() => scrollToBottom(true))
    inputRef.current?.focus()
  }

  async function leave() {
    setHeaderMenu(false)
    if (!confirm('Leave this group? You won’t see new messages unless someone starts a new conversation with you.')) return
    const res = await fetch(`/api/vip/messages/${conv.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/messages')
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/vip/messages/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleDraft.trim() || null }),
    })
    if (res.ok) {
      setRenaming(false)
      router.refresh()
      setConv((c) => ({ ...c, customTitle: titleDraft.trim() || null, title: titleDraft.trim() || c.title }))
    }
  }

  if (gone) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="vip-surface px-6 py-10 text-center">
          <p className="font-semibold text-white/90">This conversation is no longer available.</p>
          <Link href="/messages" className="mt-3 inline-block text-sm text-brand-300 hover:text-brand-200">Back to messages</Link>
        </div>
      </div>
    )
  }

  // Read receipts: who has seen my latest message.
  const myLast = [...messages].reverse().find((m) => m.senderId === viewerId)
  const seenBy = myLast
    ? conv.others.filter((o) => !o.blocked && o.lastReadAt && o.lastReadAt >= myLast.createdAt)
    : []
  const lastIsMine = messages.length > 0 && messages[messages.length - 1].senderId === viewerId
  const other = conv.isGroup ? null : conv.others[0]

  return (
    <div className="mx-auto flex max-w-2xl flex-col">
      {/* Header */}
      <div className="sticky top-16 z-20 -mx-2 -mt-5 rounded-b-2xl bg-[#070b14]/85 px-2 pb-3 pt-5 backdrop-blur-xl">
      <div className="vip-surface-strong flex items-center gap-3 px-3 py-2.5">
        <Link href="/messages" aria-label="Back to messages" className="vip-focus grid h-9 w-9 place-items-center rounded-lg text-white/75 hover:bg-white/[0.06]">
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        {other ? (
          <Link href={`/members/${other.id}`} className="vip-focus flex min-w-0 flex-1 items-center gap-2.5 rounded-xl">
            <Avatar name={other.displayName} src={other.avatarUrl} size={36} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{conv.title}</span>
              {other.username && <span className="block truncate text-xs text-white/60">@{other.username}</span>}
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06]" aria-hidden="true">
              <Users className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <h1 className="truncate font-semibold">{conv.title}</h1>
              <span className="block truncate text-xs text-white/60">
                You, {conv.others.map((o) => o.displayName).join(', ')}
              </span>
            </span>
          </div>
        )}
        {other && <h1 className="sr-only">Conversation with {conv.title}</h1>}
        {conv.isGroup && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenu((m) => !m)}
              aria-label="Conversation options"
              aria-expanded={headerMenu}
              className="vip-focus grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/[0.06]"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </button>
            {headerMenu && (
              <div className="vip-surface-strong absolute right-0 z-30 mt-1 w-48 p-1 text-sm shadow-xl" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setHeaderMenu(false)
                    setRenaming(true)
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" /> Rename group
                </button>
                <button type="button" role="menuitem" onClick={leave} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-red-200 hover:bg-white/[0.06]">
                  <LogOut className="h-4 w-4" aria-hidden="true" /> Leave group
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      </div>

      {renaming && (
        <form onSubmit={rename} className="vip-surface mb-3 flex flex-wrap items-end gap-2 p-3">
          <label className="min-w-0 flex-1 text-sm text-white/75">
            Group name
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={80}
              autoFocus
              className="vip-focus mt-1 h-10 w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 text-sm text-white"
            />
          </label>
          <button type="button" onClick={() => setRenaming(false)} className="vip-focus h-10 rounded-xl px-3 text-sm text-white/70 hover:bg-white/[0.06]">Cancel</button>
          <button type="submit" className="vip-focus h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold">Save</button>
        </form>
      )}

      {/* Messages */}
      <section aria-label="Messages" aria-live="polite" aria-relevant="additions" className="min-h-[40vh] space-y-1.5 px-1">
        {hasOlder && (
          <div className="flex justify-center pb-2">
            <button
              type="button"
              onClick={loadOlder}
              disabled={loadingOlder}
              className="vip-focus inline-flex items-center gap-2 rounded-xl border border-white/12 px-3.5 py-1.5 text-sm text-white/75 hover:bg-white/[0.05]"
            >
              {loadingOlder && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Earlier messages
            </button>
          </div>
        )}
        {messages.length === 0 && <p className="py-10 text-center text-sm text-white/60">{SOCIAL_COPY.messages.threadEmpty}</p>}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const mine = m.senderId === viewerId
          const sender = mine ? null : people.get(m.senderId)
          const newDay = !prev || new Date(prev.createdAt).toDateString() !== new Date(m.createdAt).toDateString()
          const grouped = !newDay && prev && prev.senderId === m.senderId && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000
          const senderName = mine ? viewerName : sender?.displayName ?? 'Former member'
          return (
            <div key={m.id}>
              {newDay && (
                <p className="py-3 text-center text-xs font-semibold text-white/60">
                  <span suppressHydrationWarning className="rounded-full bg-white/[0.06] px-3 py-1">{dayLabel(m.createdAt)}</span>
                </p>
              )}
              <div className={cn('group flex items-end gap-2', mine ? 'justify-end' : 'justify-start', !grouped && 'pt-1.5')}>
                {!mine && (
                  <span className="w-8 shrink-0" aria-hidden="true">
                    {!grouped && <Avatar name={senderName} src={sender?.avatarUrl} size={30} />}
                  </span>
                )}
                <div className={cn('flex max-w-[82%] flex-col sm:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
                  {conv.isGroup && !mine && !grouped && <span className="mb-0.5 pl-1 text-xs font-medium text-white/65">{senderName}</span>}
                  <div
                    className={cn(
                      'rounded-2xl text-[15px]',
                      !m.body && m.imageUrl && !m.sharedPost
                        ? 'p-0'
                        : cn('px-3.5 py-2', mine ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-white/[0.08] text-white/95'),
                    )}
                  >
                    <span suppressHydrationWarning className="sr-only">{senderName}, {clock(m.createdAt)}: </span>
                    {m.body && <div className="vip-body whitespace-normal" dangerouslySetInnerHTML={{ __html: renderPostBody(m.body) }} />}
                    {m.imageUrl && (
                      <div className={cn('w-56 max-w-full', m.body ? '[&>ul]:mt-2' : '[&>ul]:mt-0')}>
                        <PostImages images={[m.imageUrl]} />
                      </div>
                    )}
                    {m.sharedPost && (
                      <div className={cn('mt-1.5 rounded-xl border p-2.5 text-sm', mine ? 'border-white/30 bg-black/15' : 'border-white/10 bg-black/20')}>
                        {m.sharedPost.post ? (
                          <Link href={`/posts/${m.sharedPost.id}`} className="vip-focus block rounded-lg">
                            <span className="flex items-center gap-2">
                              <Avatar name={m.sharedPost.post.author.displayName} src={m.sharedPost.post.author.avatarUrl} size={22} />
                              <span className="truncate text-xs font-semibold">{m.sharedPost.post.author.displayName}</span>
                            </span>
                            <span className="mt-1 line-clamp-3 block whitespace-pre-line text-[13px] opacity-90">{m.sharedPost.post.body}</span>
                            {m.sharedPost.post.images[0] && (
                              // eslint-disable-next-line @next/next/no-img-element -- members-only media route
                              <img src={m.sharedPost.post.images[0]} alt="" className="mt-1.5 max-h-40 w-full rounded-lg object-cover" />
                            )}
                            <span className="mt-1 block text-xs font-semibold underline underline-offset-2">View post</span>
                          </Link>
                        ) : (
                          <span className="text-xs opacity-80">This post isn’t available.</span>
                        )}
                      </div>
                    )}
                  </div>
                  {!grouped || i === messages.length - 1 ? (
                    <span suppressHydrationWarning className="mt-0.5 px-1 text-[11px] text-white/60" aria-hidden="true">{clock(m.createdAt)}</span>
                  ) : null}
                </div>
                {!mine && (
                  <div className="relative self-center">
                    <button
                      type="button"
                      onClick={() => setMenuFor((x) => (x === m.id ? null : m.id))}
                      aria-label={`Options for message from ${senderName}`}
                      aria-expanded={menuFor === m.id}
                      className="vip-focus grid h-8 w-8 place-items-center rounded-lg text-white/60 opacity-100 hover:bg-white/[0.06] sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {menuFor === m.id && (
                      <div className="vip-surface-strong absolute right-0 z-20 mt-1 w-40 p-1 text-sm shadow-xl" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setMenuFor(null)
                            setReporting(m.id)
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/[0.06]"
                        >
                          <Flag className="h-4 w-4" aria-hidden="true" /> Report
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {lastIsMine && myLast && (
          <p className="px-1 pt-0.5 text-right text-[11px] font-medium text-white/65" aria-live="polite">
            {conv.isGroup
              ? seenBy.length
                ? `Seen by ${seenBy.length === conv.others.filter((o) => !o.blocked).length ? 'everyone' : seenBy.map((s) => s.displayName.split(/\s+/)[0]).join(', ')}`
                : 'Sent'
              : seenBy.length
                ? 'Seen'
                : 'Sent'}
          </p>
        )}
      </section>

      {/* Composer */}
      <div className="sticky bottom-[calc(4.4rem+env(safe-area-inset-bottom))] z-20 mt-3 lg:bottom-4">
        {conv.cannotSend ? (
          <p className="vip-surface-strong px-4 py-3 text-center text-sm text-white/75">{conv.cannotSend}</p>
        ) : (
          <form onSubmit={send} className="vip-surface-strong p-2.5" aria-label="Send a message">
            {imageUrl && (
              <div className="relative mb-2 ml-1 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- members-only media route */}
                <img src={imageUrl} alt="Photo to send" className="max-h-32 rounded-xl border border-white/10" />
                <button
                  type="button"
                  onClick={() => setImageUrl(null)}
                  aria-label="Remove photo"
                  className="vip-focus absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-black/75"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
            {error && <p role="alert" className="mb-2 px-1 text-sm text-red-300">{error}</p>}
            <div className="flex items-end gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) attach(f)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !!imageUrl}
                aria-label="Attach a photo"
                className="vip-focus grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
              >
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
              </button>
              <label className="min-w-0 flex-1">
                <span className="sr-only">Message</span>
                <textarea
                  ref={inputRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  rows={1}
                  maxLength={2000}
                  placeholder="Write a message"
                  className="vip-focus block max-h-40 min-h-10 w-full resize-none rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[15px] text-white placeholder:text-white/40 [field-sizing:content]"
                />
              </label>
              <button
                type="submit"
                disabled={sending || uploading || (!body.trim() && !imageUrl)}
                aria-label="Send"
                className="vip-focus grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <SendHorizontal className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>
          </form>
        )}
      </div>

      {reporting && <ReportDialog target={{ messageId: reporting }} onClose={() => setReporting(null)} />}
    </div>
  )
}
