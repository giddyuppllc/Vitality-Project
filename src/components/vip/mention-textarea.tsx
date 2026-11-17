'use client'

import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Avatar } from './ui'

interface Suggestion {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
}

const TOKEN_RE = /(^|[^\w@])@([a-z0-9._-]{1,32})$/i

/**
 * A textarea with @mention autocomplete. Typing "@" plus a letter or two
 * lists matching members (by name or username); ↑/↓ choose, Enter or Tab
 * inserts "@username ", Esc closes. Mentions link by username, so members
 * without one are not offered.
 */
export const MentionTextarea = forwardRef<
  HTMLTextAreaElement,
  Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
    value: string
    onValueChange: (v: string) => void
  }
>(function MentionTextarea({ value, onValueChange, className, onKeyDown, ...rest }, outerRef) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(outerRef, () => ref.current as HTMLTextAreaElement)
  const listId = useId()
  const [query, setQuery] = useState<string | null>(null)
  const [items, setItems] = useState<Suggestion[]>([])
  const [active, setActive] = useState(0)
  const pendingCaret = useRef<number | null>(null)

  useEffect(() => {
    if (query === null || query.length < 1) {
      setItems([])
      return
    }
    const ctl = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vip/members/suggest?mentionable=1&q=${encodeURIComponent(query)}`, { signal: ctl.signal })
        if (!res.ok) return
        const data = await res.json()
        setItems(data.members ?? [])
        setActive(0)
      } catch {
        // aborted or offline — the list just stays closed
      }
    }, 150)
    return () => {
      clearTimeout(t)
      ctl.abort()
    }
  }, [query])

  function detect(text: string, caret: number) {
    const m = TOKEN_RE.exec(text.slice(0, caret))
    setQuery(m ? m[2] : null)
  }

  function insert(s: Suggestion) {
    const el = ref.current
    if (!el || !s.username) return
    const caret = el.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const m = TOKEN_RE.exec(before)
    if (!m) return
    const start = caret - m[2].length - 1
    const next = `${value.slice(0, start)}@${s.username} ${value.slice(caret)}`
    onValueChange(next)
    setQuery(null)
    setItems([])
    // Place the caret right after the inserted mention in the same commit as
    // the new value (a later frame would race fast typing).
    pendingCaret.current = start + s.username.length + 2
  }

  useLayoutEffect(() => {
    const el = ref.current
    const pos = pendingCaret.current
    if (el && pos !== null) {
      pendingCaret.current = null
      el.focus()
      el.setSelectionRange(pos, pos)
    }
  }, [value])

  const open = query !== null && items.length > 0

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value)
          detect(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onClick={(e) => detect(value, e.currentTarget.selectionStart ?? value.length)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (open) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => (a + 1) % items.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => (a - 1 + items.length) % items.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              insert(items[active])
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setQuery(null)
              return
            }
          }
          onKeyDown?.(e)
        }}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={className}
        {...rest}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Members to mention"
          className="vip-surface-strong absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto p-1 shadow-xl"
        >
          {items.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault()
                insert(s)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                i === active ? 'bg-brand-500/20 text-white' : 'text-white/80',
              )}
            >
              <Avatar name={s.displayName} src={s.avatarUrl} size={28} />
              <span className="min-w-0 flex-1 truncate font-medium">{s.displayName}</span>
              <span className="shrink-0 text-xs text-white/60">@{s.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
})
