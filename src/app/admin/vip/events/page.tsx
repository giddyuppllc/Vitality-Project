import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/utils'
import { TIER_BENEFITS } from '@/lib/membership'
import { EventForm } from '@/components/admin/vip/forms'
import { AdminActionButton } from '@/components/admin/vip/admin-vip-ui'

export const dynamic = 'force-dynamic'

const E = '/api/admin/vip/events'

export default async function AdminVipEventsPage() {
  const events = await prisma.vipEvent.findMany({
    orderBy: { startsAt: 'desc' },
    take: 100,
    include: { _count: { select: { rsvps: true } } },
  })
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_26rem]">
      <div className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-semibold">Events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-white/40">No events yet.</p>
        ) : (
          <ul className="space-y-3">
            {events.map((e) => {
              const minTier = e.minTier === 'NONE' ? 'CLUB' : e.minTier
              return (
                <li key={e.id} className="rounded-xl bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-white/40">
                        {formatDate(e.startsAt)} {e.startsAt.toISOString().slice(11, 16)} UTC · {TIER_BENEFITS[minTier].label} and up ·{' '}
                        {e.published ? 'published' : 'draft'} · {e._count.rsvps} RSVPs
                        {e.cancelledAt && <span className="text-amber-300"> · cancelled</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <AdminActionButton
                        endpoint={E}
                        label={e.cancelledAt ? 'Un-cancel' : 'Cancel'}
                        body={{ op: e.cancelledAt ? 'uncancel' : 'cancel', id: e.id }}
                      />
                      <AdminActionButton endpoint={E} tone="danger" label="Delete" confirmText="Delete this event and its RSVPs?" body={{ op: 'delete', id: e.id }} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <EventForm
                      event={{
                        id: e.id,
                        title: e.title,
                        description: e.description,
                        startsAt: e.startsAt.toISOString(),
                        endsAt: e.endsAt?.toISOString() ?? null,
                        joinUrl: e.joinUrl,
                        minTier,
                        published: e.published,
                        repeatMonthly: e.repeatMonthly,
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <EventForm />
    </div>
  )
}
