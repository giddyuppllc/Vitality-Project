'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { parseMoneyToCents } from '@/lib/money'
import { adminInput } from './admin-vip-ui'

type Tier = 'CLUB' | 'PLUS' | 'PREMIUM'
const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: 'CLUB', label: 'The Club and up' },
  { value: 'PLUS', label: 'Plus and up' },
  { value: 'PREMIUM', label: 'Premium Stacks only' },
]

function useSubmit() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function send(endpoint: string, method: string, body: unknown, okText = 'Saved.') {
    setBusy(true)
    setMsg(null)
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
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
  return { busy, msg, send }
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <p role="status" className={msg.ok ? 'text-sm text-emerald-300' : 'text-sm text-red-300'}>{msg.text}</p>
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
}

const label = 'block text-sm text-white/60'

// ─── Spaces ────────────────────────────────────────────────────────────────

export function SpaceCreateForm() {
  const { busy, msg, send } = useSubmit()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [adminOnly, setAdminOnly] = useState(false)
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await send('/api/admin/vip/spaces', 'POST', { name, description, adminOnly }, 'Space created.')) {
          setName('')
          setDescription('')
          setAdminOnly(false)
        }
      }}
    >
      <h2 className="font-semibold">New space</h2>
      <label className={label}>
        Name
        <input className={`${adminInput} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </label>
      <label className={label}>
        Description (optional)
        <textarea className={`${adminInput} mt-1`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} className="accent-brand-500" />
        Only admins can start posts here
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>Create space</Submit>
    </form>
  )
}

export function SpaceRowEditor({
  space,
}: {
  space: { id: string; name: string; description: string | null; sortOrder: number; adminOnly: boolean; archived: boolean }
}) {
  const { busy, msg, send } = useSubmit()
  const [name, setName] = useState(space.name)
  const [description, setDescription] = useState(space.description ?? '')
  const [sortOrder, setSortOrder] = useState(String(space.sortOrder))
  const [adminOnly, setAdminOnly] = useState(space.adminOnly)
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1.5fr_5rem_auto_auto] sm:items-center"
      onSubmit={(e) => {
        e.preventDefault()
        send(`/api/admin/vip/spaces/${space.id}`, 'PATCH', {
          name,
          description,
          sortOrder: Number(sortOrder) || 0,
          adminOnly,
        })
      }}
    >
      <input aria-label="Name" className={adminInput} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <input aria-label="Description" className={adminInput} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
      <input aria-label="Sort order" className={adminInput} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      <label className="flex items-center gap-1.5 text-xs text-white/60">
        <input type="checkbox" checked={adminOnly} onChange={(e) => setAdminOnly(e.target.checked)} className="accent-brand-500" /> admins only
      </label>
      <div className="flex items-center gap-2">
        <Submit busy={busy}>Save</Submit>
        <button
          type="button"
          onClick={() => send(`/api/admin/vip/spaces/${space.id}`, 'PATCH', { archived: !space.archived })}
          className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
        >
          {space.archived ? 'Unarchive' : 'Archive'}
        </button>
      </div>
      <div className="sm:col-span-5"><Msg msg={msg} /></div>
    </form>
  )
}

// ─── Classroom ─────────────────────────────────────────────────────────────

export function CourseForm({
  course,
}: {
  course?: {
    id: string
    title: string
    slug: string
    summary: string | null
    coverImage: string | null
    minTier: Tier
    published: boolean
    sortOrder: number
  }
}) {
  const router = useRouter()
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState(course?.title ?? '')
  const [slug, setSlug] = useState(course?.slug ?? '')
  const [summary, setSummary] = useState(course?.summary ?? '')
  const [coverImage, setCoverImage] = useState(course?.coverImage ?? '')
  const [minTier, setMinTier] = useState<Tier>(course?.minTier ?? 'CLUB')
  const [published, setPublished] = useState(course?.published ?? false)
  const [sortOrder, setSortOrder] = useState(String(course?.sortOrder ?? 0))
  return (
    <form
      className="glass space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        const data = await send('/api/admin/vip/classroom', 'POST', {
          op: 'course.upsert',
          id: course?.id,
          title,
          slug: slug || undefined,
          summary,
          coverImage,
          minTier,
          published,
          sortOrder: Number(sortOrder) || 0,
        })
        if (data && !course) router.push(`/admin/vip/classroom/${data.id}`)
      }}
    >
      <h2 className="font-semibold">{course ? 'Course details' : 'New course'}</h2>
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          URL slug (optional)
          <input className={`${adminInput} mt-1`} value={slug} onChange={(e) => setSlug(e.target.value)} maxLength={80} />
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <label className={label}>
        Summary (optional)
        <textarea className={`${adminInput} mt-1`} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={2000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <label className={label}>
          Cover image URL (optional, https)
          <input className={`${adminInput} mt-1`} value={coverImage} onChange={(e) => setCoverImage(e.target.value)} maxLength={500} />
        </label>
        <label className={label}>
          Sort
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published (visible to members)
      </label>
      <Msg msg={msg} />
      <Submit busy={busy}>{course ? 'Save course' : 'Create course'}</Submit>
    </form>
  )
}

export function ModuleForm({ courseId, module }: { courseId: string; module?: { id: string; title: string; sortOrder: number } }) {
  const { busy, msg, send } = useSubmit()
  const [title, setTitle] = useState(module?.title ?? '')
  const [sortOrder, setSortOrder] = useState(String(module?.sortOrder ?? 0))
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send('/api/admin/vip/classroom', 'POST', {
          op: 'module.upsert',
          id: module?.id,
          courseId,
          title,
          sortOrder: Number(sortOrder) || 0,
        })
        if (ok && !module) setTitle('')
      }}
    >
      <label className={`${label} min-w-[12rem] flex-1`}>
        {module ? 'Module title' : 'New module title'}
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <label className={`${label} w-24`}>
        Sort
        <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
      </label>
      <Submit busy={busy}>{module ? 'Save' : 'Add module'}</Submit>
      <Msg msg={msg} />
    </form>
  )
}

export function LessonForm({
  moduleId,
  lesson,
}: {
  moduleId: string
  lesson?: {
    id: string
    title: string
    body: string
    videoUrl: string | null
    minTier: Tier | null
    published: boolean
    sortOrder: number
  }
}) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(!lesson)
  const [title, setTitle] = useState(lesson?.title ?? '')
  const [body, setBody] = useState(lesson?.body ?? '')
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? '')
  const [minTier, setMinTier] = useState<Tier | ''>(lesson?.minTier ?? '')
  const [published, setPublished] = useState(lesson?.published ?? false)
  const [sortOrder, setSortOrder] = useState(String(lesson?.sortOrder ?? 0))

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">
        Edit
      </button>
    )
  }
  return (
    <form
      className="mt-2 w-full space-y-3 rounded-xl border border-white/10 p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        const ok = await send('/api/admin/vip/classroom', 'POST', {
          op: 'lesson.upsert',
          id: lesson?.id,
          moduleId,
          title,
          body,
          videoUrl,
          minTier: minTier || null,
          published,
          sortOrder: Number(sortOrder) || 0,
        })
        if (ok && !lesson) {
          setTitle('')
          setBody('')
          setVideoUrl('')
          setPublished(false)
        }
      }}
    >
      <label className={label}>
        {lesson ? 'Lesson title' : 'New lesson title'}
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <label className={label}>
        Body — supports # headings, - lists, 1. lists, **bold**, *italic*, [link](https://…)
        <textarea className={`${adminInput} mt-1 font-mono`} rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={50000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_6rem]">
        <label className={label}>
          Video URL (optional — YouTube/Vimeo embed, other links shown as a link)
          <input className={`${adminInput} mt-1`} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} maxLength={500} />
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier | '')}>
            <option value="">Same as course</option>
            {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Sort
          <input className={`${adminInput} mt-1`} type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published
      </label>
      <Msg msg={msg} />
      <div className="flex gap-2">
        <Submit busy={busy}>{lesson ? 'Save lesson' : 'Add lesson'}</Submit>
        {lesson && (
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5">
            Close
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Events ────────────────────────────────────────────────────────────────

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventForm({
  event,
}: {
  event?: {
    id: string
    title: string
    description: string | null
    startsAt: string
    endsAt: string | null
    joinUrl: string | null
    minTier: Tier
    published: boolean
    repeatMonthly?: boolean
  }
}) {
  const { busy, msg, send } = useSubmit()
  const [open, setOpen] = useState(!event)
  const [repeatMonthly, setRepeatMonthly] = useState(event?.repeatMonthly ?? false)
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [startsAt, setStartsAt] = useState(toLocalInput(event?.startsAt))
  const [endsAt, setEndsAt] = useState(toLocalInput(event?.endsAt))
  const [joinUrl, setJoinUrl] = useState(event?.joinUrl ?? '')
  const [minTier, setMinTier] = useState<Tier>(event?.minTier ?? 'CLUB')
  const [published, setPublished] = useState(event?.published ?? false)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs text-white/70 hover:bg-white/10">
        Edit
      </button>
    )
  }
  return (
    <form
      className="glass w-full space-y-3 rounded-2xl p-5"
      onSubmit={async (e) => {
        e.preventDefault()
        // datetime-local is the admin's local time → send an ISO instant.
        const ok = await send('/api/admin/vip/events', 'POST', {
          op: 'upsert',
          id: event?.id,
          title,
          description,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          joinUrl,
          minTier,
          published,
          repeatMonthly,
        })
        if (ok && !event) {
          setTitle('')
          setDescription('')
          setStartsAt('')
          setEndsAt('')
          setJoinUrl('')
          setPublished(false)
        }
      }}
    >
      <h2 className="font-semibold">{event ? 'Edit event' : 'New event'}</h2>
      <label className={label}>
        Title
        <input className={`${adminInput} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </label>
      <label className={label}>
        Description (optional)
        <textarea className={`${adminInput} mt-1`} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Starts (your local time)
          <input className={`${adminInput} mt-1`} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
        </label>
        <label className={label}>
          Ends (optional)
          <input className={`${adminInput} mt-1`} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Join link (https, shown only to eligible members)
          <input className={`${adminInput} mt-1`} value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} maxLength={500} />
        </label>
        <label className={label}>
          Access
          <select className={`${adminInput} mt-1`} value={minTier} onChange={(e) => setMinTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="accent-brand-500" />
        Published
      </label>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={repeatMonthly} onChange={(e) => setRepeatMonthly(e.target.checked)} className="accent-brand-500" />
        Repeats monthly — the next date (same weekday of the month, same time) is published automatically once this one starts
      </label>
      <Msg msg={msg} />
      <div className="flex gap-2">
        <Submit busy={busy}>{event ? 'Save event' : 'Create event'}</Submit>
        {event && (
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2 text-sm text-white/60 hover:bg-white/5">
            Close
          </button>
        )}
      </div>
    </form>
  )
}

// ─── Rewards ───────────────────────────────────────────────────────────────

export function RewardsForm({ initial }: { initial: Record<Tier, number> }) {
  const { busy, msg, send } = useSubmit()
  const [vals, setVals] = useState<Record<Tier, string>>({
    CLUB: (initial.CLUB / 100).toFixed(2),
    PLUS: (initial.PLUS / 100).toFixed(2),
    PREMIUM: (initial.PREMIUM / 100).toFixed(2),
  })
  const labels: Record<Tier, string> = { CLUB: 'The Club', PLUS: 'Plus', PREMIUM: 'Premium Stacks' }
  return (
    <form
      className="glass space-y-4 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault()
        const body: Record<Tier, number> = { CLUB: 0, PLUS: 0, PREMIUM: 0 }
        for (const t of ['CLUB', 'PLUS', 'PREMIUM'] as Tier[]) body[t] = parseMoneyToCents(vals[t] || '0') ?? 0
        send('/api/admin/vip/rewards', 'PUT', body)
      }}
    >
      <h2 className="font-semibold">Monthly store credit per tier</h2>
      <p className="text-sm text-white/45">
        Granted on the 1st of each month (UTC) by the “VIP member rewards” cron to members active that day (not
        suspended), into the member’s store credit at vitalityproject.global. Defaults: $5 / $20 / $50.{' '}
        <strong className="text-white/70">$0.00 = off.</strong>
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {(['CLUB', 'PLUS', 'PREMIUM'] as Tier[]).map((t) => (
          <label key={t} className={label}>
            {labels[t]} ($ / month)
            <input
              className={`${adminInput} mt-1`}
              inputMode="decimal"
              value={vals[t]}
              onChange={(e) => setVals((v) => ({ ...v, [t]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <Msg msg={msg} />
      <Submit busy={busy}>Save reward settings</Submit>
    </form>
  )
}

// ─── Clubhouse settings ────────────────────────────────────────────────────

export interface ClubhouseSettingsValues {
  'vip.rewardExpiryMonths': number
  'vip.emailReplyTo': string
  'vip.digestHourUtc': number
  'vip.timeZone': string
  'zelle.unpaidExpiryDays': number
}

export function ClubhouseSettingsForm({ initial }: { initial: ClubhouseSettingsValues }) {
  const { busy, msg, send } = useSubmit()
  const [v, setV] = useState({
    expiry: String(initial['vip.rewardExpiryMonths']),
    replyTo: initial['vip.emailReplyTo'],
    digestHour: String(initial['vip.digestHourUtc']),
    tz: initial['vip.timeZone'],
    zelleDays: String(initial['zelle.unpaidExpiryDays']),
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((x) => ({ ...x, [k]: e.target.value }))
  return (
    <form
      className="glass space-y-4 rounded-2xl p-5"
      onSubmit={(e) => {
        e.preventDefault()
        send('/api/admin/vip/settings', 'PUT', {
          'vip.rewardExpiryMonths': Number.parseInt(v.expiry || '0', 10),
          'vip.emailReplyTo': v.replyTo,
          'vip.digestHourUtc': Number.parseInt(v.digestHour || '0', 10),
          'vip.timeZone': v.tz,
          'zelle.unpaidExpiryDays': Number.parseInt(v.zelleDays || '0', 10),
        })
      }}
    >
      <h2 className="font-semibold">Clubhouse settings</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={label}>
          Reward credit expires after (months, 0 = never)
          <input className={`${adminInput} mt-1`} inputMode="numeric" value={v.expiry} onChange={set('expiry')} />
        </label>
        <label className={label}>
          Unpaid Zelle orders cancel after (days, 0 = never)
          <input className={`${adminInput} mt-1`} inputMode="numeric" value={v.zelleDays} onChange={set('zelleDays')} />
        </label>
        <label className={label}>
          Clubhouse email Reply-To
          <input className={`${adminInput} mt-1`} type="email" value={v.replyTo} onChange={set('replyTo')} />
        </label>
        <label className={label}>
          Daily digest hour (UTC, 0–23)
          <input className={`${adminInput} mt-1`} inputMode="numeric" value={v.digestHour} onChange={set('digestHour')} />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Time zone for event emails and monthly series (IANA, e.g. America/New_York)
          <input className={`${adminInput} mt-1`} value={v.tz} onChange={set('tz')} />
        </label>
      </div>
      <p className="text-xs text-white/40">
        Unpaid-order expiry runs in the existing “Stale Zelle nudge” cron and returns any store credit the order used.
      </p>
      <Msg msg={msg} />
      <Submit busy={busy}>Save clubhouse settings</Submit>
    </form>
  )
}
