import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Offline',
  description: 'You are currently offline.',
}

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="glass rounded-2xl p-10 max-w-lg w-full text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
          <WifiOff className="w-7 h-7 text-white/60" />
        </div>
        <h1 className="text-2xl font-bold mb-3">You&apos;re offline</h1>
        <p className="text-white/60 mb-8 leading-relaxed">
          It looks like you&apos;ve lost your connection. Check your network and try again.
          Previously viewed pages may still be available.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
        >
          Try home page
        </Link>
      </div>
    </div>
  )
}
