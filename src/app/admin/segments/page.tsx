import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus, Edit, Users } from 'lucide-react'
import { parseSegmentFilters, quickCount } from '@/lib/segments'

export const dynamic = 'force-dynamic'

export default async function AdminSegmentsPage() {
  const segments = await prisma.savedSegment.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const creatorIds = Array.from(new Set(segments.map((s) => s.createdBy)))
  const creators = await prisma.user.findMany({
    where: { id: { in: creatorIds } },
    select: { id: true, email: true, name: true },
  })
  const creatorMap = new Map(creators.map((c) => [c.id, c]))

  const rows = await Promise.all(
    segments.map(async (s) => {
      let count = 0
      try {
        count = await quickCount(parseSegmentFilters(s.filters))
      } catch {
        count = 0
      }
      return { segment: s, count }
    }),
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Saved segments</h1>
          <p className="text-white/40 mt-1">
            {segments.length} segment{segments.length === 1 ? '' : 's'} · reusable customer filters for campaigns
          </p>
        </div>
        <Link href="/admin/segments/new">
          <Button>
            <Plus className="w-4 h-4" /> New segment
          </Button>
        </Link>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5 text-left">
              {['Name', 'Description', 'Customers', 'Created by', 'Created', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-5 py-4 text-xs font-medium text-white/40 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map(({ segment, count }) => {
              const creator = creatorMap.get(segment.createdBy)
              return (
                <tr key={segment.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/segments/${segment.id}`}
                      className="font-medium text-white hover:text-brand-400 transition-colors"
                    >
                      {segment.name}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60 max-w-md truncate">
                    {segment.description || '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                      <Users className="w-3.5 h-3.5 text-brand-400" />
                      {count.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">
                    {creator?.name ?? creator?.email ?? '—'}
                  </td>
                  <td className="px-5 py-4 text-sm text-white/60">
                    {formatDate(segment.createdAt)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/segments/${segment.id}`}
                      className="p-1.5 text-white/30 hover:text-brand-400 transition-colors inline-flex"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              )
            })}
            {segments.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-16 text-center text-white/30 text-sm"
                >
                  No saved segments yet.{' '}
                  <Link href="/admin/segments/new" className="text-brand-400">
                    Create one
                  </Link>
                  .
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
