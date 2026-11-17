'use client'

import { isoToLocalInput, localInputToIso } from '@/lib/datetime-local'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Save,
  Send,
  Clock,
  Beaker,
  Users,
  Loader2,
  Mail,
  MessageSquare,
} from 'lucide-react'

export interface SegmentOption {
  id: string
  name: string
}

type Channel = 'EMAIL' | 'SMS'
// 'New recipients only' was offered but never implemented server-side — it
// mailed every customer. Removed until there is a real implementation.
type Audience = 'segment' | 'all'

interface FormState {
  name: string
  channel: Channel
  subject: string
  body: string
  audience: Audience
  segmentId: string
  scheduledAt: string
  testEmail: string
}

const empty: FormState = {
  name: '',
  channel: 'EMAIL',
  subject: '',
  body: '',
  audience: 'all',
  segmentId: '',
  scheduledAt: '',
  testEmail: '',
}

export function CampaignBuilder({
  mode,
  id,
  segments,
  initialStatus,
  adminEmail,
}: {
  mode: 'create' | 'edit'
  id?: string
  segments: SegmentOption[]
  initialStatus?: string
  adminEmail?: string | null
}) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    ...empty,
    testEmail: adminEmail || '',
  })
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [countingRecipients, setCountingRecipients] = useState(false)
  const [status, setStatus] = useState<string>(initialStatus ?? 'DRAFT')

  useEffect(() => {
    if (mode !== 'edit' || !id) return
    fetch(`/api/admin/campaigns/${id}`)
      .then((r) => r.json())
      .then((c) => {
        setForm({
          name: c.name ?? '',
          channel: c.channel ?? 'EMAIL',
          subject: c.subject ?? '',
          body: c.body ?? '',
          audience: c.segmentId ? 'segment' : 'all',
          segmentId: c.segmentId ?? '',
          scheduledAt: isoToLocalInput(c.scheduledAt),
          testEmail: adminEmail || '',
        })
        setStatus(c.status ?? 'DRAFT')
      })
      .finally(() => setLoading(false))
  }, [mode, id, adminEmail])

  const up = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Live recipient count — the same audience logic the send uses (opt-outs
  // excluded), so the number shown is the number that will be mailed.
  const runRecipientCount = async () => {
    setCountingRecipients(true)
    setRecipientCount(null)
    try {
      if (form.audience === 'segment' && !form.segmentId) return
      const qs = form.audience === 'segment' ? `?segmentId=${encodeURIComponent(form.segmentId)}` : ''
      const res = await fetch(`/api/admin/customers/count${qs}`).catch(() => null)
      if (res && res.ok) {
        const d = await res.json()
        setRecipientCount(d.count ?? null)
      } else {
        setNotice('Could not count recipients right now — try again.')
      }
    } finally {
      setCountingRecipients(false)
    }
  }

  useEffect(() => {
    setRecipientCount(null)
  }, [form.audience, form.segmentId])

  const renderedBody = useMemo(() => {
    // simple preview with placeholder substitution
    return form.body
      .replace(/\{\{\s*firstName\s*\}\}/g, 'Alex')
      .replace(/\{\{\s*name\s*\}\}/g, 'Alex Researcher')
      .replace(/\{\{\s*email\s*\}\}/g, 'alex@example.com')
  }, [form.body])

  const buildPayload = (overrides: Partial<FormState> = {}) => {
    const f = { ...form, ...overrides }
    return {
      name: f.name,
      channel: f.channel,
      subject: f.subject || null,
      body: f.body,
      segmentId: f.audience === 'segment' ? f.segmentId || null : null,
      scheduledAt: localInputToIso(f.scheduledAt),
    }
  }

  const save = async (): Promise<string | null> => {
    if (!form.name.trim()) {
      setError('Campaign name is required')
      return null
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const url = mode === 'create' ? '/api/admin/campaigns' : `/api/admin/campaigns/${id}`
      const method = mode === 'create' ? 'POST' : 'PATCH'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(typeof d.error === 'string' ? d.error : 'Failed to save')
        return null
      }
      const saved = await res.json()
      setNotice('Saved as draft')
      return saved.id as string
    } finally {
      setSaving(false)
    }
  }

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    const newId = await save()
    if (newId && mode === 'create') {
      router.push(`/admin/campaigns/${newId}`)
      router.refresh()
    } else if (newId) {
      router.refresh()
    }
  }

  const handleSendNow = async () => {
    if (!confirm('Send this campaign now to all recipients? This cannot be undone.')) return
    setSending(true)
    setError('')
    setNotice('')
    try {
      let campaignId = id
      if (!campaignId) {
        const saved = await save()
        if (!saved) return
        campaignId = saved
      } else {
        // Save first to persist latest content
        await fetch(`/api/admin/campaigns/${campaignId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        })
      }

      const res = await fetch(`/api/admin/campaigns/${campaignId}/send`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Send failed')
      } else {
        setNotice(`Sent to ${data.sent ?? 0} recipients (${data.skipped ?? 0} skipped).`)
        router.push(`/admin/campaigns/${campaignId}`)
        router.refresh()
      }
    } finally {
      setSending(false)
    }
  }

  const handleSchedule = async () => {
    if (!form.scheduledAt) {
      setError('Pick a scheduled date/time first')
      return
    }
    const newId = await save()
    if (newId) {
      // Flip status
      await fetch(`/api/admin/campaigns/${newId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SCHEDULED' }),
      })
      setNotice(`Scheduled for ${new Date(form.scheduledAt).toLocaleString()}`)
      router.push(`/admin/campaigns/${newId}`)
      router.refresh()
    }
  }

  const handleTest = async () => {
    if (!form.testEmail) {
      setError('Enter an email to send the test to')
      return
    }
    let campaignId = id
    if (!campaignId) {
      const saved = await save()
      if (!saved) return
      campaignId = saved
    } else {
      await fetch(`/api/admin/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
    }
    setTesting(true)
    setError('')
    setNotice('')
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.testEmail }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.ok === false) {
        setError(
          typeof data.error === 'string'
            ? data.error
            : typeof data.detail === 'string'
            ? data.detail
            : 'Test send failed',
        )
      } else {
        setNotice(`Test sent to ${form.testEmail}`)
      }
    } finally {
      setTesting(false)
    }
  }

  const isSent = status === 'SENT'

  if (loading) return <p className="text-white/40">Loading…</p>

  return (
    <form onSubmit={handleSaveDraft} className="space-y-5">
      {/* Step 1 — Basics */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">
            1
          </span>
          <h2 className="font-semibold text-white/80">Basics</h2>
        </div>
        <Input
          label="Campaign name *"
          required
          value={form.name}
          onChange={(e) => up('name', e.target.value)}
          placeholder="Q2 Peptide Launch"
          disabled={isSent}
        />
        <div>
          <label className="text-sm font-medium text-white/70 mb-1.5 block">
            Channel
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isSent}
              onClick={() => up('channel', 'EMAIL')}
              className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-2 ${
                form.channel === 'EMAIL'
                  ? 'border-brand-500 bg-brand-500/10 text-white'
                  : 'border-white/10 bg-dark-700 text-white/60 hover:text-white'
              }`}
            >
              <Mail className="w-4 h-4" /> Email
            </button>
            <button
              type="button"
              disabled
              className="px-4 py-3 rounded-xl border border-white/5 bg-dark-800 text-white/30 flex items-center gap-2 cursor-not-allowed"
              title="SMS channel coming soon"
            >
              <MessageSquare className="w-4 h-4" /> SMS (coming soon)
            </button>
          </div>
        </div>
        {form.channel === 'EMAIL' && (
          <Input
            label="Subject line"
            value={form.subject}
            onChange={(e) => up('subject', e.target.value)}
            placeholder="Hi {{firstName}}, our newest peptide is here"
            disabled={isSent}
          />
        )}
      </div>

      {/* Step 2 — Audience */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">
            2
          </span>
          <h2 className="font-semibold text-white/80">Audience</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['all', 'All customers'],
              ['segment', 'Saved segment'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              disabled={isSent}
              onClick={() => up('audience', val as Audience)}
              className={`px-4 py-3 rounded-xl border text-sm transition-all ${
                form.audience === val
                  ? 'border-brand-500 bg-brand-500/10 text-white'
                  : 'border-white/10 bg-dark-700 text-white/60 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {form.audience === 'segment' && (
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Pick a segment
            </label>
            <select
              value={form.segmentId}
              onChange={(e) => up('segmentId', e.target.value)}
              disabled={isSent}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Choose —</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm">
            {countingRecipients ? (
              <span className="inline-flex items-center gap-2 text-white/60">
                <Loader2 className="w-3 h-3 animate-spin" /> counting…
              </span>
            ) : recipientCount !== null ? (
              <span className="inline-flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-400" />
                <strong>{recipientCount.toLocaleString()}</strong>
                <span className="text-white/40">recipients</span>
              </span>
            ) : (
              <span className="text-white/40">Preview recipient count</span>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={runRecipientCount}
            disabled={form.audience === 'segment' && !form.segmentId}
          >
            Refresh count
          </Button>
        </div>
      </div>

      {/* Step 3 — Content */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">
            3
          </span>
          <h2 className="font-semibold text-white/80">Content</h2>
        </div>
        <p className="text-xs text-white/40">
          HTML is supported. Use <code className="text-brand-400">{'{{firstName}}'}</code>,{' '}
          <code className="text-brand-400">{'{{name}}'}</code>, or{' '}
          <code className="text-brand-400">{'{{email}}'}</code> for per-recipient substitution.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Body (HTML)
            </label>
            <textarea
              value={form.body}
              onChange={(e) => up('body', e.target.value)}
              disabled={isSent}
              rows={14}
              className="w-full px-4 py-2.5 rounded-xl bg-dark-700 border border-white/10 text-white font-mono text-xs placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder={`<h1>Hi {{firstName}},</h1>\n<p>Our newest peptide just dropped.</p>\n<a href="https://vitalityproject.global/products">Shop now</a>`}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-white/70 mb-1.5 block">
              Preview
            </label>
            <div
              className="rounded-xl bg-white text-[#0c0e1a] p-4 overflow-auto prose prose-sm max-w-none"
              style={{ minHeight: 240, maxHeight: 400 }}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderedBody || '<em style="color:#999">Preview will appear here</em>' }}
            />
          </div>
        </div>
      </div>

      {/* Step 4 — Schedule */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center">
            4
          </span>
          <h2 className="font-semibold text-white/80">Schedule</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 items-end">
          <Input
            label="Send at (optional)"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => up('scheduledAt', e.target.value)}
            disabled={isSent}
          />
          <p className="text-xs text-white/40 pb-2.5">
            Leave blank to send immediately when you click <em>Send now</em>.
          </p>
        </div>
      </div>

      {/* Test send */}
      {!isSent && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <h2 className="font-semibold text-white/80 flex items-center gap-2">
            <Beaker className="w-4 h-4 text-brand-400" /> Test send
          </h2>
          <div className="flex gap-3">
            <Input
              type="email"
              value={form.testEmail}
              onChange={(e) => up('testEmail', e.target.value)}
              placeholder="you@example.com"
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={handleTest} loading={testing}>
              Send test
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-red-400 text-sm px-1">{error}</p>}
      {notice && <p className="text-emerald-400 text-sm px-1">{notice}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving} size="lg" variant="secondary" disabled={isSent}>
          <Save className="w-4 h-4" /> Save draft
        </Button>
        <Button
          type="button"
          size="lg"
          loading={sending}
          onClick={handleSendNow}
          disabled={isSent}
        >
          <Send className="w-4 h-4" /> Send now
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={handleSchedule}
          disabled={isSent || !form.scheduledAt}
        >
          <Clock className="w-4 h-4" /> Schedule
        </Button>
      </div>
    </form>
  )
}
