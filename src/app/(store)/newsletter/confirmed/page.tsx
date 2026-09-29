import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Subscription Confirmed — The Vitality Project',
  description: 'Your newsletter subscription is confirmed.',
}

export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const sp = await searchParams
  const invalid = sp?.status === 'invalid'

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-10 max-w-lg w-full text-center">
        {invalid ? (
          <>
            <h1 className="text-2xl font-bold mb-3">Link expired or invalid</h1>
            <p className="text-white/60 mb-6">
              We couldn&apos;t confirm that subscription. The link may have expired or already been used.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
            >
              Back to home
            </Link>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold mb-3">You&apos;re in.</h1>
            <p className="text-white/60 mb-6 leading-relaxed">
              Your subscription is confirmed. Expect thoughtful research notes, new product drops, and the occasional members-only perk — never spam.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
              >
                Shop the catalog
              </Link>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-medium transition-colors border border-white/10"
              >
                Read the blog
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
