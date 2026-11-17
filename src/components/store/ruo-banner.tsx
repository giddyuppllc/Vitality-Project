'use client'

import { useState, useEffect } from 'react'
import { X, FlaskConical } from 'lucide-react'

export function RuoBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('ruo-banner-dismissed')
    if (!dismissed) setVisible(true)
  }, [])

  const dismiss = () => {
    localStorage.setItem('ruo-banner-dismissed', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-brand-500/10 border-b border-brand-500/20 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-white/60">
          <FlaskConical className="w-3.5 h-3.5 text-brand-400 shrink-0" />
          <span>
            <strong className="text-white/80">Research Use Only.</strong> All products are strictly for laboratory and research purposes. Not for human consumption. Not evaluated or approved by the FDA.
          </span>
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss notice" className="text-white/30 hover:text-white transition-colors shrink-0 p-2 -m-1">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
