import { CalendarDays, Lock, Video } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { listUpcomingEvents } from '@/lib/vip/classroom'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { RsvpButton } from '@/components/vip/rsvp-button'
import { LocalTime } from '@/components/vip/local-time'
import { VIP_COPY } from '@/lib/vip/copy'
import { Repeat } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Events' }

// Date badge in UTC (deterministic on the server); the full time line is
// shown in the member's own time zone by <LocalTime>.
function fmt(iso: string) {
  const d = new Date(iso)
  return {
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
    date: d.getUTCDate(),
  }
}

export default async function EventsPage() {
  const viewer = await requireVipPage('member')
  const events = await listUpcomingEvents(viewer.userId, viewer.accessTier)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={VIP_COPY.events.title} intro={VIP_COPY.events.intro} />
      {events.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.events.title}>{VIP_COPY.empty.events.body}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const f = fmt(e.startsAt)
            return (
              <li key={e.id} className="vip-surface flex gap-4 p-4 sm:p-5">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-center leading-none" aria-hidden="true">
                  <span className="text-[10px] font-bold tracking-wider text-brand-300">{f.month}</span>
                  <span className="text-xl font-bold">{f.date}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{e.title}</h2>
                    {e.minTier !== 'CLUB' && <TierBadge tier={e.minTier} />}
                    {e.repeatMonthly && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/45">
                        <Repeat className="h-3 w-3" aria-hidden="true" /> Monthly
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-white/55">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    <LocalTime iso={e.startsAt} />
                  </p>
                  {e.description && <p className="mt-2 whitespace-pre-line text-sm text-white/70">{e.description}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {e.allowed ? (
                      <>
                        <RsvpButton eventId={e.id} initialGoing={e.going} initialCount={e.rsvpCount} />
                        {e.joinUrl && (
                          <a
                            href={e.joinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vip-focus inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-sm font-medium hover:bg-white/[0.06]"
                          >
                            <Video className="h-4 w-4" aria-hidden="true" /> Join link
                          </a>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-sm text-white/55">
                        <Lock className="h-4 w-4" aria-hidden="true" /> {VIP_COPY.events.requires} <TierBadge tier={e.minTier} />
                      </span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
