import Link from 'next/link'
import { Wordmark } from '@/components/vip/ui'

export default function VipNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Wordmark />
      <div className="vip-surface-strong mt-8 p-6">
        <h1 className="text-xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-white/60">This page does not exist or is not available to you.</p>
        <Link href="/" className="vip-focus mt-5 inline-block rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          Back to the clubhouse
        </Link>
      </div>
    </div>
  )
}
