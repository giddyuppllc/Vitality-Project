import Link from 'next/link'
import { Home, ShoppingBag } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="glass rounded-2xl p-10 max-w-lg w-full text-center">
        <div className="text-7xl font-bold bg-gradient-to-br from-brand-300 to-brand-600 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold mb-3">Page not found</h1>
        <p className="text-white/60 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
          Let&apos;s get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-medium transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Browse products
          </Link>
        </div>
      </div>
    </div>
  )
}
