'use client'

import { RotateCw } from 'lucide-react'

export function ReloadButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="vip-focus mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-500 px-5 text-sm font-semibold text-white hover:bg-brand-600"
    >
      <RotateCw className="h-4 w-4" aria-hidden="true" /> Try again
    </button>
  )
}
