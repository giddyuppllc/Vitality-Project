import { prisma } from '@/lib/prisma'
import { SpaceCreateForm, SpaceRowEditor } from '@/components/admin/vip/forms'

export const dynamic = 'force-dynamic'

export default async function AdminVipSpacesPage() {
  const spaces = await prisma.vipSpace.findMany({
    orderBy: [{ archived: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { posts: true } } },
  })
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-1 font-semibold">Spaces</h2>
        <p className="mb-4 text-sm text-white/40">Categories members file posts under. Archiving hides a space; its posts stay.</p>
        {spaces.length === 0 ? (
          <p className="text-sm text-white/40">No spaces yet — posts go to “General” until you add some.</p>
        ) : (
          <ul className="space-y-4">
            {spaces.map((s) => (
              <li key={s.id} className={s.archived ? 'opacity-60' : ''}>
                <p className="mb-1.5 text-xs text-white/40">
                  /{s.slug} · {s._count.posts} posts {s.archived && '· archived'}
                </p>
                <SpaceRowEditor space={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <SpaceCreateForm />
    </div>
  )
}
