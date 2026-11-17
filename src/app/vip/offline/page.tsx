import { WifiOff } from 'lucide-react'
import { Monogram } from '@/components/vip/monogram'
import { ReloadButton } from '@/components/vip/reload-button'

// Dynamic on purpose: the root layout decides the clubhouse document from a
// request header, which a prerendered page would not see.
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Offline' }

/** Shown by the clubhouse service worker when a page can't load. */
export default function OfflinePage() {
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <Monogram size={64} />
      <WifiOff className="mt-8 h-6 w-6 text-white/60" aria-hidden="true" />
      <h1 className="mt-3 text-2xl font-bold tracking-tight">You’re offline</h1>
      <p className="mt-2 text-white/70">The Clubhouse needs a connection. Check your signal or Wi-Fi and try again — your progress is saved.</p>
      <ReloadButton />
    </main>
  )
}
