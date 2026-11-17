'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { adminInput } from './admin-vip-ui'

/** Admin forms for the Academy, Library and points settings (vip/academy). */

type Tier = 'CLUB' | 'PLUS' | 'PREMIUM'
const label = 'block text-sm text-white/60'
const C = '/api/admin/vip/classroom'

function useSubmit() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function send(endpoint: string, method: string, body: unknown, okText = 'Saved.') {
    setBusy(true)
    setMsg(null)
    const res = await fetch(endpoint, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setMsg({ ok: false, text: data.error || 'Failed' })
      return null
    }
    setMsg({ ok: true, text: okText })
    router.refresh()
    return data
  }
  return { busy, msg, send, setMsg }
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <p role="status" className={msg.ok ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>{msg.text}</p>
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

// ─── Upload ────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string
  fileName: string
  sizeBytes: number
}

export function FileUpload({ onUploaded, current }: { onUploaded: (f: UploadedFile | null) => void; current: UploadedFile | null }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {current ? 'Replace file' : 'Upload file'}
        </button>
        {current && (
          <span className="text-xs text-white/60">
            {current.fileName} · {Math.max(1, Math.round(current.sizeBytes / 1024))} KB
            <button type="button" onClick={() => onUploaded(null)} className="ml-2 underline hover:text-white">
              remove
            </button>
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.mp3,.m4a,.mp4,application/pdf,image/png,image/jpeg,audio/mpeg,audio/mp4,video/mp4"
        className="sr-only"
        aria-label="Choose a file to upload"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setError(null)
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/admin/vip/files', { method: 'POST', body: fd })
          const d = await res.json().catch(() => ({}))
          setBusy(false)
          if (!res.ok) return setError(d.error || 'Upload failed')
          onUploaded(d.file)
        }}
      />
      <p className="text-xs text-white/40">PDF, PNG, JPEG, MP3, M4A or MP4 · up to 25MB · private to members who can open the item.</p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  )
}

// ─── Learning paths ────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'FOUNDATIONS', label: 'Foundations' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'HEALTH', label: 'Health' },
  { value: 'FITNESS', label: 'Fitness' },
  { value: 'LIFESTYLE', label: 'Lifestyle' },
]

export function TrackForm({
  track,
}: {
  track?: { id: string; title: string; slug: string; summary: string | null; category: string; published: boolean; sortOrder: number }
}) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(!track)
  const [title, setTitle] = useState(track?.title ?? '')
  const [summary, setSummary] = useState(track?.summary ?? '')
  const [category, setCategory] = useState(track?.category ?? 'FOUNDATIONS')
  const [published, setPublished] = useState(track?.published ?? true)
  const [sortOrder, setSortOrder] = useState(String(track?.sortOrder ?? 0))
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">
        Edit
      </button>
    )
  }
  return (
    <form
      className="mt-2 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(C, 'POST', { op: 'track.upsert', id: track?.id, title, slug: track?.slug, summary, category, published, sortOrder: Number(sortOrder) || 0 })
        if (ok && !track) {
          setTitle('')
          setSummary('')
        }
      }}
    >
      {!track && <h3 className="font-semibold">New learning path</h3>}
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <label className={label}>
        Summary
        <textarea className={`${adminInput} mt-1`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
      </label>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <label className={label}>
          Category
          <select className={`${adminInput} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Sort
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (shown once it has a published course)
      </label>
      <Msg msg={msg} />
      <div className="flex gap-2">
        <Submit busy={busy}>{track ? 'Save path' : 'Add path'}</Submit>
        {track && (
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5">
            Close
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Quiz ──────────────────────────────────────────────────────────────────

export function QuizSettingsForm({ moduleId, quiz }: { moduleId: string; quiz?: { title: string; intro: string | null; passPct: number; published: boolean } | null }) {
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState(quiz?.title ?? 'Module check')
  const [intro, setIntro] = useState(quiz?.intro ?? '')
  const [passPct, setPassPct] = useState(String(quiz?.passPct ?? 70))
  const [published, setPublished] = useState(quiz?.published ?? false)
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault()
        send(C, 'POST', { op: 'quiz.upsert', moduleId, title, intro, passPct: Number(passPct) || 70, published })
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_7rem]">
        <label className={label}>
          Quiz title
          <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
        </label>
        <label className={label}>
          Pass mark %
          <input className={`${adminInput} mt-1`} inputMode="numeric" value={passPct} onChange={(e) => setPassPct(e.target.value)} />
        </label>
      </div>
      <label className={label}>
        Intro (optional)
        <input className={`${adminInput} mt-1`} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={2000} />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (counts toward course completion once it has questions)
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>{quiz ? 'Save quiz' : 'Add a module quiz'}</Submit>
    </form>
  )
}

export function QuestionForm({
  quizId,
  question,
}: {
  quizId: string
  question?: { id: string; prompt: string; options: string[]; correctIndex: number; explanation: string | null; sortOrder: number }
}) {
  const { busy, msg, send, setMsg } = useSubmit()
  const [open, setOpen] = useState(!question)
  const [prompt, setPrompt] = useState(question?.prompt ?? '')
  const [options, setOptions] = useState<string[]>(question?.options ?? ['', '', ''])
  const [correct, setCorrect] = useState(question?.correctIndex ?? 0)
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [sortOrder, setSortOrder] = useState(String(question?.sortOrder ?? 0))
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">
        Edit
      </button>
    )
  }
  const filled = options.map((o) => o.trim()).filter(Boolean)
  return (
    <form
      className="mt-2 space-y-2 rounded-xl border border-white/10 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const opts = options.map((o) => o.trim())
        const kept = opts.map((o, i) => ({ o, i })).filter((x) => x.o)
        const correctIndex = kept.findIndex((x) => x.i === correct)
        if (correctIndex < 0) return setMsg({ ok: false, text: 'Mark which option is correct — it can’t be a blank one.' })
        const ok = await send(C, 'POST', {
          op: 'question.upsert',
          id: question?.id,
          quizId,
          prompt,
          options: kept.map((x) => x.o),
          correctIndex,
          explanation,
          sortOrder: Number(sortOrder) || 0,
        })
        if (ok && !question) {
          setPrompt('')
          setOptions(['', '', ''])
          setCorrect(0)
          setExplanation('')
        }
      }}
    >
      <label className={label}>
        {question ? 'Question' : 'New question'}
        <textarea className={`${adminInput} mt-1`} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} required maxLength={2000} />
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-sm text-white/60">Options — select the correct one</legend>
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`correct-${question?.id ?? 'new'}`} checked={correct === i} onChange={() => setCorrect(i)} aria-label={`Option ${i + 1} is correct`} className="accent-brand-500" />
            <input
              className={adminInput}
              value={o}
              onChange={(e) => setOptions((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder={`Option ${i + 1}`}
              aria-label={`Option ${i + 1}`}
              maxLength={300}
            />
          </div>
        ))}
        {options.length < 6 && (
          <button type="button" onClick={() => setOptions((xs) => [...xs, ''])} className="text-xs text-brand-300 hover:text-brand-200">
            + Add option
          </button>
        )}
      </fieldset>
      <div className="grid gap-2 sm:grid-cols-[1fr_6rem]">
        <label className={label}>
          Explanation shown after answering (optional)
          <input className={`${adminInput} mt-1`} value={explanation} onChange={(e) => setExplanation(e.target.value)} maxLength={2000} />
        </label>
        <label className={label}>
          Sort
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      {filled.length < 2 && <p className="text-xs text-amber-300">Give at least two options.</p>}
      <Msg msg={msg} />
      <div className="flex gap-2">
        <Submit busy={busy}>{question ? 'Save question' : 'Add question'}</Submit>
        {question && (
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5">
            Close
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Lesson resources ──────────────────────────────────────────────────────

export function ResourceAddForm({ lessonId }: { lessonId: string }) {
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [file, setFile] = useState<UploadedFile | null>(null)
  const [url, setUrl] = useState('')
  return (
    <form
      className="mt-2 space-y-2 rounded-xl border border-dashed border-white/15 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send(C, 'POST', { op: 'resource.add', lessonId, title, ...(mode === 'file' ? { fileId: file?.id } : { url }) }, 'Resource added.')
        if (ok) {
          setTitle('')
          setFile(null)
          setUrl('')
        }
      }}
    >
      <p className="text-sm font-medium text-white/70">Add a resource (PDF, worksheet, audio or link)</p>
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <div className="flex gap-3 text-sm text-white/70">
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === 'file'} onChange={() => setMode('file')} className="accent-brand-500" /> Upload
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} className="accent-brand-500" /> Link
        </label>
      </div>
      {mode === 'file' ? (
        <FileUpload current={file} onUploaded={setFile} />
      ) : (
        <label className={label}>
          https link
          <input className={`${adminInput} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" />
        </label>
      )}
      <Msg msg={msg} />
      <Submit busy={busy}>Add resource</Submit>
    </form>
  )
}

// ─── Grants ────────────────────────────────────────────────────────────────

export function GrantForm({ courseId }: { courseId: string }) {
  const { busy, msg, send } = useSubmit()
  const [email, setEmail] = useState('')
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await send(C, 'POST', { op: 'grant.add', courseId, email }, 'Access granted.')) setEmail('')
      }}
    >
      <label className={`${label} min-w-[14rem] flex-1`}>
        Give a member access (email)
        <input className={`${adminInput} mt-1`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
      </label>
      <Submit busy={busy}>Grant access</Submit>
      <div className="w-full">
        <Msg msg={msg} />
      </div>
    </form>
  )
}

// ─── Points ────────────────────────────────────────────────────────────────

// ─── Library ───────────────────────────────────────────────────────────────

export function LibraryItemForm({
  item,
  categories,
}: {
  item?: {
    id: string
    title: string
    summary: string | null
    category: string
    kind: string
    url: string | null
    file: UploadedFile | null
    minTier: Tier
    published: boolean
    sortOrder: number
  }
  categories: { key: string; label: string }[]
}) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(!item)
  const [title, setTitle] = useState(item?.title ?? '')
  const [summary, setSummary] = useState(item?.summary ?? '')
  const [category, setCategory] = useState(item?.category ?? categories[0]?.key ?? 'GUIDES')
  const [kind, setKind] = useState(item?.kind ?? 'PDF')
  const [url, setUrl] = useState(item?.url ?? '')
  const [file, setFile] = useState<UploadedFile | null>(item?.file ?? null)
  const [minTier, setMinTier] = useState<Tier>(item?.minTier ?? 'CLUB')
  const [published, setPublished] = useState(item?.published ?? false)
  const [sortOrder, setSortOrder] = useState(String(item?.sortOrder ?? 0))
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">
        Edit
      </button>
    )
  }
  return (
    <form
      className={item ? 'mt-2 space-y-3 rounded-xl border border-white/10 p-4' : 'glass space-y-3 rounded-2xl p-5'}
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send('/api/admin/vip/library', 'POST', {
          op: 'upsert',
          id: item?.id,
          title,
          summary,
          category,
          kind,
          url: file ? null : url,
          fileId: file?.id ?? null,
          minTier,
          published,
          sortOrder: Number(sortOrder) || 0,
        })
        if (ok && !item) {
          setTitle('')
          setSummary('')
          setUrl('')
          setFile(null)
          setPublished(false)
        }
      }}
    >
      {!item && <h2 className="font-semibold">New Library item</h2>}
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <label className={label}>
        Summary (searchable)
        <textarea className={`${adminInput} mt-1`} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={label}>
          Category
          <select className={`${adminInput} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
            {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Type
          <select className={`${adminInput} mt-1`} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="GUIDE">Guide</option>
            <option value="PDF">PDF</option>
            <option value="RECORDING">Recording</option>
            <option value="LINK">Link</option>
          </select>
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier)}>
            <option value="CLUB">The Club and up</option>
            <option value="PLUS">Plus and up</option>
            <option value="PREMIUM">Premium Stacks only</option>
          </select>
        </label>
      </div>
      <FileUpload current={file} onUploaded={setFile} />
      {!file && (
        <label className={label}>
          …or an https link (video, article, explainer)
          <input className={`${adminInput} mt-1`} value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://" />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
          Published
        </label>
        <label className="flex items-center gap-2 text-sm text-white/60">
          Sort
          <input className={`${adminInput} w-20`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} aria-label="Sort order" />
        </label>
      </div>
      <Msg msg={msg} />
      <div className="flex gap-2">
        <Submit busy={busy}>{item ? 'Save item' : 'Add to Library'}</Submit>
        {item && (
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5">
            Close
          </button>
        )}
      </div>
    </form>
  )
}
