import { BadgeCheck, CircleHelp, ShieldCheck, XCircle } from 'lucide-react'
import { verifyCertificate } from '@/lib/vip/academy'
import { Wordmark } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Verify a certificate' }

/**
 * PUBLIC certificate check (/verify/<code>). Shows only what the certificate
 * itself proves — the course, the date and the code. It never shows who
 * holds it: a visitor who already knows the holder's name can confirm it
 * matches, and is told only "matches" or "does not match".
 */
export default async function VerifyCertificatePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ name?: string }>
}) {
  const { code } = await params
  const { name } = await searchParams
  const checkName = typeof name === 'string' ? name.slice(0, 120) : ''
  const result = await verifyCertificate(decodeURIComponent(code), checkName || null)
  const issued = result
    ? new Date(result.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col px-4 py-8 sm:px-6">
      <header className="mb-8">
        <a href="/" className="vip-focus inline-block rounded-xl">
          <Wordmark />
        </a>
      </header>
      <main id="main" className="flex-1">
        {result ? (
          <section className="vip-surface-strong vip-premium p-6 sm:p-8" aria-labelledby="verified">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-300/10 px-3 py-1 text-sm font-semibold text-emerald-100">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Valid certificate
            </p>
            <h1 id="verified" className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
              {result.courseTitle}
            </h1>
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <dt className="text-white/60">Completed</dt>
                <dd className="mt-0.5 font-semibold">{issued}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <dt className="text-white/60">Verification ID</dt>
                <dd className="mt-0.5 font-mono font-semibold tracking-wide">{result.code}</dd>
              </div>
            </dl>
            <p className="mt-5 text-sm leading-relaxed text-white/70">
              Issued by The Vitality Project Clubhouse to a member who completed every lesson and module check in this course.
            </p>

            <div className="mt-6 border-t border-white/[0.08] pt-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-brand-300" aria-hidden="true" /> Confirm the holder
              </h2>
              <p className="mt-1 text-sm text-white/65">
                For privacy this page never shows who holds a certificate. If you know the name on it, enter it to confirm it matches.
              </p>
              <form method="get" className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label className="flex-1">
                  <span className="sr-only">Full name on the certificate</span>
                  <input
                    name="name"
                    defaultValue={checkName}
                    maxLength={120}
                    autoComplete="off"
                    placeholder="Full name on the certificate"
                    className="vip-focus h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 text-sm text-white placeholder:text-white/50"
                  />
                </label>
                <button type="submit" className="vip-focus h-11 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
                  Check name
                </button>
              </form>
              {result.nameChecked && (
                <p role="status" className={result.nameMatches ? 'mt-3 inline-flex items-center gap-2 text-sm font-semibold text-emerald-200' : 'mt-3 inline-flex items-center gap-2 text-sm font-semibold text-amber-200'}>
                  {result.nameMatches ? <BadgeCheck className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                  {result.nameMatches ? 'That name matches this certificate.' : 'That name does not match this certificate.'}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="vip-surface-strong p-6 sm:p-8" aria-labelledby="notfound">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-sm font-semibold text-white/80">
              <CircleHelp className="h-4 w-4" aria-hidden="true" /> Not found
            </p>
            <h1 id="notfound" className="mt-5 text-2xl font-bold tracking-tight">We couldn’t find that certificate.</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Check the verification ID — it looks like VP-XXXXX-XXXXX and is printed at the foot of every certificate.
            </p>
            <form method="get" action="/verify" className="mt-4 flex flex-col gap-2 sm:flex-row">
              <label className="flex-1">
                <span className="sr-only">Verification ID</span>
                <input
                  name="code"
                  maxLength={20}
                  autoComplete="off"
                  placeholder="VP-XXXXX-XXXXX"
                  className="vip-focus h-11 w-full rounded-xl border border-white/15 bg-white/[0.05] px-3 font-mono text-sm uppercase text-white placeholder:text-white/50"
                />
              </label>
              <button type="submit" className="vip-focus h-11 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
                Verify
              </button>
            </form>
          </section>
        )}
      </main>
      <footer className="mt-10 text-xs text-white/60">The Vitality Project Clubhouse — certificate verification.</footer>
    </div>
  )
}
