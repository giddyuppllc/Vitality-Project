'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export function SortSelect({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const onChange = (value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set('sort', value)
    else next.delete('sort')
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <select
      aria-label="Sort products"
      className="bg-dark-700 border border-white/12 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      value={current}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Featured</option>
      <option value="newest">Newest</option>
      <option value="price-asc">Price: Low to High</option>
      <option value="price-desc">Price: High to Low</option>
      <option value="name-asc">Name: A-Z</option>
    </select>
  )
}
