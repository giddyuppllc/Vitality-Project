import Link from 'next/link'
import { Search } from 'lucide-react'
import { VIP_COPY } from '@/lib/vip/copy'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listMembers } from '@/lib/vip/members'
import { Avatar, EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Members' }

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireVipPage('community')
  const { q } = await searchParams
  const members = await listMembers(q)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Members">
        <span className="text-sm text-white/50">{members.length} shown</span>
      </PageHeader>
      <form action="/members" method="get" role="search" className="mb-5">
        <label className="relative block">
          <span className="sr-only">Search members</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search by name"
            className="vip-focus h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-3 text-sm text-white placeholder:text-white/40"
          />
        </label>
      </form>
      {members.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.members.title}>{VIP_COPY.empty.members.body}</EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <li key={m.id}>
              <Link href={`/members/${m.id}`} className="vip-surface vip-focus flex items-center gap-3 p-4 transition-colors hover:bg-white/[0.04]">
                <Avatar name={m.displayName} src={m.avatarUrl} size={46} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{m.displayName}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <TierBadge tier={m.tier} admin={m.isAdmin} />
                    {m.username && <span className="truncate text-xs text-white/45">@{m.username}</span>}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
