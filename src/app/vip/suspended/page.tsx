import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getVipViewer } from '@/lib/vip/access'
import { Wordmark } from '@/components/vip/ui'
import { VIP_COPY } from '@/lib/vip/copy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Community access paused' }

export default async function SuspendedPage() {
  const viewer = await getVipViewer()
  if (!viewer) redirect('/signin')
  if (!viewer.suspended) redirect('/feed')
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Wordmark />
      <div className="vip-surface-strong mt-8 p-6">
        <h1 className="text-xl font-bold">{VIP_COPY.suspended.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/65">{VIP_COPY.suspended.body}</p>
        <p className="mt-2 text-sm text-white/50">{VIP_COPY.suspended.contact}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/classroom" className="vip-focus rounded-xl border border-white/15 px-4 py-2 hover:bg-white/[0.06]">Classroom</Link>
          <Link href="/events" className="vip-focus rounded-xl border border-white/15 px-4 py-2 hover:bg-white/[0.06]">Events</Link>
          <Link href="/rewards" className="vip-focus rounded-xl border border-white/15 px-4 py-2 hover:bg-white/[0.06]">Rewards</Link>
        </div>
      </div>
    </div>
  )
}
