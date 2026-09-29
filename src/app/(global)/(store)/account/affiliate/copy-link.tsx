'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function AffiliateCopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = link
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 bg-dark-700 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-brand-400 truncate">
        {link}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 p-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-all shadow-lg shadow-brand-500/25"
        title="Copy to clipboard"
      >
        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
      </button>
    </div>
  )
}
