import Link from 'next/link'
import { Wordmark } from '@/components/vip/ui'
import { VIP_COPY } from '@/lib/vip/copy'

export default function VipNotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Wordmark />
      <div className="vip-surface-strong mt-8 p-6">
        <h1 className="text-xl font-bold">{VIP_COPY.notFound.title}</h1>
        <p className="mt-2 text-sm text-white/60">{VIP_COPY.notFound.body}</p>
        <Link href="/" className="vip-focus mt-5 inline-block rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          Back to the clubhouse
        </Link>
      </div>
    </div>
  )
}
