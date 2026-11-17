'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

/** A read-only link with a copy button (falls back to selecting the text). */
export function CopyLink({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.getElementById('copy-link-input') as HTMLInputElement | null
      el?.select()
    }
  }
  return (
    <div className="flex gap-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{label}</span>
        <input
          id="copy-link-input"
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="vip-focus h-10 w-full truncate rounded-xl border border-white/12 bg-white/[0.05] px-3 font-mono text-[13px] text-white/80"
        />
      </label>
      <button
        type="button"
        onClick={copy}
        className="vip-focus inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-sm font-semibold text-white hover:bg-brand-600"
      >
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span role="status" className="sr-only">{copied ? 'Link copied' : ''}</span>
    </div>
  )
}
