'use client'

import { useState } from 'react'
import { VIP_COPY } from '@/lib/vip/copy'

type Prefs = { emailDigest: boolean; emailEvents: boolean; emailRewards: boolean }

/** Clubhouse email toggles on the member's profile; each change saves immediately. */
export function EmailPrefsForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial)
  const [msg, setMsg] = useState<string | null>(null)
  const P = VIP_COPY.profile
  async function toggle(key: keyof Prefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setMsg(null)
    const res = await fetch('/api/vip/email-prefs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: next[key] }),
    }).catch(() => null)
    if (res?.ok) setMsg('Saved.')
    else {
      setPrefs(prefs)
      setMsg('Could not save — try again.')
    }
  }
  const rows: Array<[keyof Prefs, readonly string[]]> = [
    ['emailDigest', P.emailDigest],
    ['emailEvents', P.emailEvents],
    ['emailRewards', P.emailRewards],
  ]
  return (
    <section id="email" className="vip-surface mt-5 p-5" aria-labelledby="email-h">
      <h2 id="email-h" className="font-semibold">{P.emailTitle}</h2>
      <p className="mt-1 text-sm text-white/55">{P.emailIntro}</p>
      <ul className="mt-4 divide-y divide-white/[0.06]">
        {rows.map(([key, [title, desc]]) => (
          <li key={key} className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-white/50">{desc}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[key]}
              aria-label={title}
              onClick={() => toggle(key)}
              className={`vip-focus relative h-6 w-11 shrink-0 rounded-full transition-colors ${prefs[key] ? 'bg-brand-500' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${prefs[key] ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </li>
        ))}
      </ul>
      {msg && <p role="status" className="mt-2 text-xs text-white/55">{msg}</p>}
    </section>
  )
}
