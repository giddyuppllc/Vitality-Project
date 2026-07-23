'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, X } from 'lucide-react'

export function CustomerSearchBar({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(defaultValue)
  const [, startTransition] = useTransition()

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = value.trim()
    // Preserve the active segment tab; reset q.
    const usp = new URLSearchParams(params?.toString() ?? '')
    if (q) usp.set('q', q)
    else usp.delete('q')
    startTransition(() =>
      router.push(`/admin/customers${usp.toString() ? `?${usp}` : ''}`),
    )
  }

  const clear = () => {
    setValue('')
    const usp = new URLSearchParams(params?.toString() ?? '')
    usp.delete('q')
    startTransition(() =>
      router.push(`/admin/customers${usp.toString() ? `?${usp}` : ''}`),
    )
  }

  return (
    <form
      onSubmit={submit}
      className="glass rounded-xl flex items-center gap-2 px-4 py-2.5"
    >
      <Search className="w-4 h-4 text-white/40 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search by name, email, or username..."
        className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={clear}
          className="p-1 text-white/40 hover:text-white transition-colors"
          aria-label="Clear"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      <button
        type="submit"
        className="text-xs uppercase tracking-wider text-brand-300 hover:text-brand-200 px-2 py-1"
      >
        Search
      </button>
    </form>
  )
}
