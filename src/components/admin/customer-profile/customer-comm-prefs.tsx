'use client'

import { adminFetch } from '@/lib/admin-fetch'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Mail, MessageSquareText, Phone } from 'lucide-react'

interface Prefs {
  transactionalEmail: boolean
  marketingEmail: boolean
  sms: boolean
  phoneContact: boolean
}

interface Props {
  userId: string
  initial: Prefs
  mode?: 'admin' | 'self'
}

export function CustomerCommPrefs({
  userId,
  initial,
  mode = 'admin',
}: Props) {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Prefs>(initial)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const endpoint =
    mode === 'admin'
      ? `/api/admin/users/${userId}/communication`
      : `/api/account/communication`

  const save = async (next: Prefs) => {
    const before = prefs
    setPrefs(next)
    setBusy(true)
    setError(null)
    try {
      const r = await adminFetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (r.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
        router.refresh()
      } else {
        // The toggle used to stay flipped on failure, showing a preference
        // that was never saved.
        setPrefs(before)
        setError(r.error)
      }
    } finally {
      setBusy(false)
    }
  }

  const items: {
    key: keyof Prefs
    label: string
    desc: string
    icon: React.ReactNode
    disabled?: boolean
  }[] = [
    {
      key: 'transactionalEmail',
      label: 'Transactional email',
      desc: 'Order confirmations, shipping updates, password resets. Required for purchases.',
      icon: <Mail className="w-4 h-4 text-emerald-400" />,
      disabled: true,
    },
    {
      key: 'marketingEmail',
      label: 'Marketing email',
      desc: 'Product news, research digests, promotions.',
      icon: <Mail className="w-4 h-4 text-brand-400" />,
    },
    {
      key: 'sms',
      label: 'SMS',
      desc: 'Text message updates.',
      icon: <MessageSquareText className="w-4 h-4 text-purple-400" />,
    },
    {
      key: 'phoneContact',
      label: 'Phone contact OK',
      desc: 'Support or sales may call this customer.',
      icon: <Phone className="w-4 h-4 text-amber-400" />,
    },
  ]

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Communication preferences</h3>
        {saved && (
          <span className="text-xs text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Saved
          </span>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-400 mb-3">{error}</p>}
      <div className="space-y-3">
        {items.map((it) => (
          <div
            key={it.key}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/3 border border-white/5"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
              {it.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{it.label}</p>
              <p className="text-xs text-white/40 mt-0.5">{it.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={prefs[it.key]}
                disabled={busy || it.disabled}
                onChange={(e) =>
                  save({ ...prefs, [it.key]: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-10 h-5 bg-white/10 peer-checked:bg-brand-500 rounded-full transition-colors peer-disabled:opacity-50 relative after:content-[''] after:absolute after:left-0.5 after:top-0.5 after:w-4 after:h-4 after:bg-white after:rounded-full after:transition-transform peer-checked:after:translate-x-5" />
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
