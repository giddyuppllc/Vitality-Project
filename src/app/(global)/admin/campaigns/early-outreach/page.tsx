'use client'

import { useEffect, useState } from 'react'
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  Sparkles,
  Crown,
  UserPlus,
  Newspaper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type Recipient = {
  email: string
  name: string | null
  source: 'membership' | 'newsletter' | 'customer'
  signedUpAt: string
}

type Preview = {
  recipients: Recipient[]
  recipientCount: number
  status: {
    sent: boolean
    sentAt: string | null
    sentBy: string | null
    sentCount: number | null
  }
  discount: { code: string; pct: number; daysValid: number }
}

export default function EarlyOutreachCampaignPage() {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<{
    sent: number
    failed: number
    recipients: Array<{ email: string; ok: boolean; error?: string }>
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/campaigns/early-outreach')
      const data = await res.json()
      setPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load preview')
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    setError(null)
    setSending(true)
    try {
      const res = await fetch('/api/admin/campaigns/early-outreach', {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Send failed')
      setResult({
        sent: data.sent,
        failed: data.failed,
        recipients: data.recipients,
      })
      setConfirm(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send failed')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl py-12 flex items-center gap-3 text-white/50">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading preview…
      </div>
    )
  }

  if (!preview) {
    return (
      <div className="max-w-3xl py-12 text-red-300">
        Could not load preview. {error}
      </div>
    )
  }

  const alreadySent = preview.status.sent

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-brand-400" />
          Early Customer Outreach
        </h1>
        <p className="text-white/40 mt-1">
          One-shot email to people who showed commercial intent before checkout
          opened. Includes a {preview.discount.pct}% discount code valid for{' '}
          {preview.discount.daysValid} days.
        </p>
      </div>

      {alreadySent ? (
        <SentBanner
          sentAt={preview.status.sentAt}
          sentBy={preview.status.sentBy}
          sentCount={preview.status.sentCount}
        />
      ) : (
        <PendingBanner
          recipientCount={preview.recipientCount}
          discountCode={preview.discount.code}
          discountPct={preview.discount.pct}
        />
      )}

      {result && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-emerald-200">
              Campaign sent
            </h3>
          </div>
          <p className="text-sm text-emerald-100/80">
            {result.sent} delivered · {result.failed} failed
          </p>
          {result.failed > 0 && (
            <div className="mt-3 text-xs text-amber-200">
              <p className="font-medium mb-1">Failed deliveries:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {result.recipients
                  .filter((r) => !r.ok)
                  .map((r) => (
                    <li key={r.email}>
                      {r.email} — {r.error || 'unknown error'}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Recipient table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Mail className="w-4 h-4 text-white/40" />
              Recipients · {preview.recipientCount}
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              De-duped across membership signups, newsletter, and customer
              accounts. Internal/test emails excluded.
            </p>
          </div>
        </div>

        {preview.recipients.length === 0 ? (
          <div className="p-12 text-center text-white/40">
            No qualifying recipients right now.
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-5 py-3 text-xs font-medium text-white/40 uppercase tracking-wider">
                  Signed up
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {preview.recipients.map((r) => (
                <tr key={r.email}>
                  <td className="px-5 py-3 text-sm font-mono">{r.email}</td>
                  <td className="px-5 py-3 text-sm">
                    {r.name || (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <SourceBadge source={r.source} />
                  </td>
                  <td className="px-5 py-3 text-xs text-white/40">
                    {new Date(r.signedUpAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!alreadySent && preview.recipients.length > 0 && (
        <div className="flex items-center justify-end gap-3 pt-2">
          {confirm ? (
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirm(false)}
                disabled={sending}
              >
                Cancel
              </Button>
              <Button onClick={handleSend} disabled={sending} size="lg">
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Confirm — send to {preview.recipientCount}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={() => setConfirm(true)} size="lg">
              <Send className="w-4 h-4" />
              Send to {preview.recipientCount} recipients
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function PendingBanner({
  recipientCount,
  discountCode,
  discountPct,
}: {
  recipientCount: number
  discountCode: string
  discountPct: number
}) {
  return (
    <div className="rounded-2xl border border-brand-500/40 bg-gradient-to-b from-brand-500/[0.08] to-transparent p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center shrink-0">
        <AlertCircle className="w-5 h-5 text-brand-300" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-white">Ready to send</h3>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">
          {recipientCount} de-duped recipient
          {recipientCount === 1 ? '' : 's'} will receive a one-time email with
          discount code{' '}
          <span className="font-mono font-bold text-white">{discountCode}</span>{' '}
          ({discountPct}% off, single-use per customer).
        </p>
      </div>
    </div>
  )
}

function SentBanner({
  sentAt,
  sentBy,
  sentCount,
}: {
  sentAt: string | null
  sentBy: string | null
  sentCount: number | null
}) {
  return (
    <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-500/[0.08] to-transparent p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
        <CheckCircle2 className="w-5 h-5 text-emerald-300" />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-white">Campaign sent</h3>
        <p className="text-sm text-white/60 mt-1 leading-relaxed">
          {sentCount ?? '?'} email{sentCount === 1 ? '' : 's'} delivered{' '}
          {sentAt && (
            <>
              on{' '}
              <span className="text-white">
                {new Date(sentAt).toLocaleString()}
              </span>{' '}
            </>
          )}
          {sentBy && (
            <>
              by <span className="text-white">{sentBy}</span>.
            </>
          )}
        </p>
      </div>
    </div>
  )
}

function SourceBadge({ source }: { source: Recipient['source'] }) {
  const config = {
    membership: {
      label: 'Membership',
      Icon: Crown,
      cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    },
    newsletter: {
      label: 'Newsletter',
      Icon: Newspaper,
      cls: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    },
    customer: {
      label: 'Account',
      Icon: UserPlus,
      cls: 'bg-white/5 text-white/60 border-white/10',
    },
  }[source]
  const { label, Icon, cls } = config
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${cls}`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </span>
  )
}
