import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Unsubscribed — The Vitality Project',
  description: 'You have been unsubscribed.',
}

export default function UnsubscribedPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="glass rounded-2xl p-10 max-w-lg w-full text-center">
        <h1 className="text-2xl font-bold mb-3">You&apos;ve been unsubscribed</h1>
        <p className="text-white/60 mb-6 leading-relaxed">
          We&apos;ve removed your email from our newsletter. Sorry to see you go — you can resubscribe anytime from the footer.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            Back to home
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 font-medium transition-colors border border-white/10"
          >
            Browse products
          </Link>
        </div>
      </div>
    </div>
  )
}
