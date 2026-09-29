import Link from 'next/link'
import { Wordmark } from './ui'
import { globalUrl } from '@/lib/vip/links'

/** Chrome for the clubhouse's public text pages (guidelines, privacy, email). */
export function PublicPage({ children, narrow = false }: { children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className={`mx-auto flex min-h-screen flex-col px-4 sm:px-6 ${narrow ? 'max-w-md' : 'max-w-3xl'}`}>
      <header className="flex h-20 items-center justify-between">
        <Link href="/" className="vip-focus rounded-xl">
          <Wordmark />
        </Link>
        <Link href="/feed" className="vip-focus rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/[0.06]">
          Open the Clubhouse
        </Link>
      </header>
      <main id="main" className="flex-1 pb-16 pt-4">{children}</main>
      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.07] py-6 text-xs text-white/45">
        <Link href="/guidelines" className="hover:text-white/80">Guidelines</Link>
        <Link href="/privacy" className="hover:text-white/80">Privacy</Link>
        <a href={globalUrl('/')} className="hover:text-white/80">vitalityproject.global</a>
      </footer>
    </div>
  )
}
