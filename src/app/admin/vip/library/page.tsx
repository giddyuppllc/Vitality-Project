import { requireAdminPage } from '@/lib/vip/page-gate'
import { prisma } from '@/lib/prisma'
import { TIER_BENEFITS } from '@/lib/membership'
import { LIBRARY_CATEGORIES, categoryLabel, kindLabel } from '@/lib/vip/library'
import { LibraryItemForm } from '@/components/admin/vip/academy-forms'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

export default async function AdminVipLibraryPage() {
  await requireAdminPage()
  const items = await prisma.vipResource.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
    include: { file: { select: { id: true, fileName: true, sizeBytes: true } }, event: { select: { title: true } } },
    take: 500,
  })
  const categories = LIBRARY_CATEGORIES.map((c) => ({ key: c.key, label: c.label }))
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-1 font-semibold">Library</h2>
        <p className="mb-4 text-sm text-white/40">
          Guides, PDFs, explainer links and recordings members can search. Event recordings are filed here automatically when you add a recording
          link to an event (edit them on the event).
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-white/40">Nothing in the Library yet.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li key={r.id} className="rounded-xl bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-medium">{r.title}</span>{' '}
                    <span className="text-xs text-white/40">
                      · {categoryLabel(r.category)} · {kindLabel(r.kind)} · {TIER_BENEFITS[r.minTier].label} and up · {r.published ? 'published' : 'draft'}
                      {r.file && ` · ${r.file.fileName}`}
                      {r.event && ` · from event “${r.event.title}”`}
                    </span>
                  </p>
                  <AdminActionButton endpoint="/api/admin/vip/library" tone="danger" label="Delete" confirmText="Delete this Library item?" body={{ op: 'delete', id: r.id }} />
                </div>
                {!r.eventId && (
                  <LibraryItemForm
                    categories={categories}
                    item={{
                      id: r.id,
                      title: r.title,
                      summary: r.summary,
                      category: r.category,
                      kind: r.kind,
                      url: r.url,
                      file: r.file,
                      minTier: r.minTier === 'NONE' ? 'CLUB' : r.minTier,
                      published: r.published,
                      sortOrder: r.sortOrder,
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <LibraryItemForm categories={categories} />
    </div>
  )
}
