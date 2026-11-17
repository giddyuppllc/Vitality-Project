import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { SOCIAL_COPY } from '@/lib/vip/social-copy'
import { PageHeader } from '@/components/vip/ui'
import { NewConversation } from '@/components/vip/new-conversation'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New message' }

export default async function NewMessagePage() {
  await requireVipPage('community')
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/messages" className="vip-focus mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Messages
      </Link>
      <PageHeader title={SOCIAL_COPY.messages.newTitle} intro={SOCIAL_COPY.messages.newIntro} />
      <NewConversation />
    </div>
  )
}
