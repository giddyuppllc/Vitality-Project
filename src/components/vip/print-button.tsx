'use client'

import { Printer } from 'lucide-react'

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="vip-focus inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
    >
      <Printer className="h-4 w-4" aria-hidden="true" /> {label}
    </button>
  )
}
