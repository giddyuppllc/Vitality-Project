import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Wordmark } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Verify a certificate' }

/** PUBLIC: enter a verification ID (/verify?code=…) → /verify/<code>. */
export default async function VerifyLookupPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  const clean = typeof code === 'string' ? code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20) : ''
  if (clean) redirect(`/verify/${encodeURIComponent(clean)}`)
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <a href="/" className="vip-focus inline-block rounded-xl">
          <Wordmark />
        </a>
      </header>
      <main id="main" className="vip-surface-strong p-6 sm:p-8">
        <ShieldCheck className="h-7 w-7 text-brand-300" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Verify a certificate</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Every Clubhouse certificate carries a verification ID at its foot. Enter it to confirm the course and completion date.
        </p>
        <form method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Verification ID</span>
            <input
              name="code"
              maxLength={20}
              required
              autoComplete="off"
              placeholder="VP-XXXXX-XXXXX"
              className="vip-focus h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 font-mono text-sm uppercase text-white placeholder:text-white/50"
            />
          </label>
          <button type="submit" className="vip-focus h-11 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
            Verify
          </button>
        </form>
      </main>
    </div>
  )
}
