'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, NotebookPen } from 'lucide-react'

const MAX = 20_000

/**
 * Private per-lesson notes. Autosaves a moment after typing stops (and on
 * blur); only the member who writes them can ever read them.
 */
export function LessonNotes({ lessonId, initial, updatedAt }: { lessonId: string; initial: string; updatedAt: string | null }) {
  const [body, setBody] = useState(initial)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>(updatedAt ? 'saved' : 'idle')
  const [savedAt, setSavedAt] = useState<string | null>(updatedAt)
  const last = useRef(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function save(value: string) {
    if (value === last.current) return
    setState('saving')
    const res = await fetch(`/api/vip/lessons/${lessonId}/note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: value }),
    }).catch(() => null)
    if (!res?.ok) return setState('error')
    const d = await res.json().catch(() => ({}))
    last.current = value
    setSavedAt(d.updatedAt ?? null)
    setState(d.saved ? 'saved' : 'idle')
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const status =
    state === 'saving'
      ? 'Saving…'
      : state === 'error'
        ? 'Not saved — check your connection and keep typing to retry.'
        : state === 'saved' && savedAt
          ? `Saved ${new Date(savedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
          : 'Notes save automatically.'

  return (
    <section className="vip-surface mt-5 p-5" aria-labelledby={`notes-${lessonId}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`notes-${lessonId}`} className="flex items-center gap-2 text-sm font-semibold">
          <NotebookPen className="h-4 w-4 text-brand-300" aria-hidden="true" /> Your notes
        </h2>
        <span className="inline-flex items-center gap-1 text-xs text-white/60">
          <Lock className="h-3 w-3" aria-hidden="true" /> Private to you
        </span>
      </div>
      <label htmlFor={`note-${lessonId}`} className="sr-only">
        Your private notes for this lesson
      </label>
      <textarea
        id={`note-${lessonId}`}
        value={body}
        maxLength={MAX}
        rows={5}
        placeholder="What do you want to remember from this lesson?"
        onChange={(e) => {
          const v = e.target.value
          setBody(v)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => save(v), 900)
        }}
        onBlur={() => {
          if (timer.current) clearTimeout(timer.current)
          void save(body)
        }}
        className="vip-focus mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-relaxed text-white placeholder:text-white/50"
      />
      <p className={state === 'error' ? 'mt-1.5 text-xs text-red-200' : 'mt-1.5 text-xs text-white/60'} role="status" aria-live="polite">
        {status}
      </p>
    </section>
  )
}
