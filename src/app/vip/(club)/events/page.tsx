import Link from 'next/link'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, List, Lock, PlayCircle, Repeat, Users, Video } from 'lucide-react'
import { requireVipPage } from '@/lib/vip/page-gate'
import { EVENT_KIND_LABEL, listEventsBetween, listPastRecordings, listUpcomingEvents, type EventView } from '@/lib/vip/classroom'
import { getVipSetting } from '@/lib/vip/settings'
import { zonedParts, zonedTimeToUtc } from '@/lib/vip/time'
import { EmptyState, PageHeader, TierBadge } from '@/components/vip/ui'
import { Pill } from '@/components/vip/academy-ui'
import { RsvpButton } from '@/components/vip/rsvp-button'
import { LocalDateBadge, LocalTime } from '@/components/vip/local-time'
import { VIP_COPY } from '@/lib/vip/copy'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Events' }

const KIND_TONE = { AMA: 'blue', WORKSHOP: 'gold', CLASS: 'green', OFFICE_HOURS: 'default' } as const

function EventCard({ e, highlight }: { e: EventView; highlight?: boolean }) {
  return (
    <li id={`event-${e.id}`} className={cn('vip-surface flex scroll-mt-24 gap-4 p-4 sm:p-5', highlight && 'ring-2 ring-brand-400/60')}>
      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-center leading-none" aria-hidden="true">
        <LocalDateBadge iso={e.startsAt} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={KIND_TONE[e.kind]}>{EVENT_KIND_LABEL[e.kind]}</Pill>
          {e.minTier !== 'CLUB' && <TierBadge tier={e.minTier} />}
          {e.repeatMonthly && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-white/60">
              <Repeat className="h-3 w-3" aria-hidden="true" /> Monthly
            </span>
          )}
        </div>
        <h3 className="mt-1.5 font-semibold">{e.title}</h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/65">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            <LocalTime iso={e.startsAt} />
          </span>
          {e.capacity && (
            <span className={cn('inline-flex items-center gap-1.5', e.spotsLeft === 0 && 'text-amber-200')}>
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {e.spotsLeft === 0 ? 'Full — waitlist open' : `${e.spotsLeft} of ${e.capacity} seats left`}
            </span>
          )}
        </p>
        {e.description && <p className="mt-2 whitespace-pre-line text-sm text-white/75">{e.description}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {e.allowed ? (
            <>
              <RsvpButton
                eventId={e.id}
                initialGoing={e.going}
                initialCount={e.rsvpCount}
                initialWaitlisted={e.waitlisted}
                initialPosition={e.waitlistPosition}
                capacity={e.capacity}
              />
              {e.joinUrl && (
                <a href={`/api/vip/events/${e.id}/join`} target="_blank" rel="noopener noreferrer" className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 px-3.5 text-sm font-medium hover:bg-white/[0.06]">
                  <Video className="h-4 w-4" aria-hidden="true" /> Join link
                </a>
              )}
              <a href={`/api/vip/events/${e.id}/ics`} className="vip-focus inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/75 hover:bg-white/[0.06] hover:text-white" download>
                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
              </a>
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-white/65">
              <Lock className="h-4 w-4" aria-hidden="true" /> {VIP_COPY.events.requires} <TierBadge tier={e.minTier} />
            </span>
          )}
        </div>
      </div>
    </li>
  )
}

function monthParam(raw: string | undefined, tz: string): { y: number; m: number } {
  const match = raw && /^(\d{4})-(\d{2})$/.exec(raw)
  if (match) {
    const y = Number(match[1])
    const m = Number(match[2])
    if (y >= 2000 && y <= 2100 && m >= 1 && m <= 12) return { y, m }
  }
  const z = zonedParts(new Date(), tz)
  return { y: z.year, m: z.month }
}
const ym = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`
const shift = (y: number, m: number, d: number) => {
  const i = y * 12 + (m - 1) + d
  return { y: Math.floor(i / 12), m: (i % 12) + 1 }
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string; event?: string }> }) {
  const viewer = await requireVipPage('member')
  const { view, month, event: focus } = await searchParams
  const tz = await getVipSetting('vip.timeZone')
  const calendar = view === 'calendar'
  const { y, m } = monthParam(month, tz)

  const tabs = (
    <nav className="mb-5 inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1" aria-label="Events view">
      {[
        { key: 'list', label: 'Upcoming', icon: List, href: '/events' },
        { key: 'calendar', label: 'Calendar', icon: CalendarDays, href: `/events?view=calendar&month=${ym(y, m)}` },
      ].map((t) => {
        const on = (t.key === 'calendar') === calendar
        return (
          <Link
            key={t.key}
            href={t.href}
            aria-current={on ? 'page' : undefined}
            className={cn('vip-focus inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium', on ? 'bg-brand-500/20 text-white' : 'text-white/65 hover:text-white')}
          >
            <t.icon className="h-4 w-4" aria-hidden="true" /> {t.label}
          </Link>
        )
      })}
    </nav>
  )

  if (calendar) {
    const from = zonedTimeToUtc(y, m, 1, 0, 0, tz)
    const next = shift(y, m, 1)
    const to = zonedTimeToUtc(next.y, next.m, 1, 0, 0, tz)
    const events = await listEventsBetween(viewer.userId, viewer.accessTier, from, to)
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
    const byDay = new Map<number, EventView[]>()
    for (const e of events) {
      const d = zonedParts(new Date(e.startsAt), tz).day
      byDay.set(d, [...(byDay.get(d) ?? []), e])
    }
    const today = zonedParts(new Date(), tz)
    const isThisMonth = today.year === y && today.month === m
    const prev = shift(y, m, -1)
    const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    const cells: Array<number | null> = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
    while (cells.length % 7) cells.push(null)
    const zoneName = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(from).find((p) => p.type === 'timeZoneName')?.value ?? tz

    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title={VIP_COPY.events.title} intro={VIP_COPY.events.intro} />
        {tabs}
        <div className="vip-surface overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] px-3 py-2 sm:px-4">
            <Link href={`/events?view=calendar&month=${ym(prev.y, prev.m)}`} className="vip-focus grid h-11 w-11 place-items-center rounded-xl text-white/75 hover:bg-white/[0.06]" aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h2 className="text-base font-semibold" aria-live="polite">
              {label}
            </h2>
            <Link href={`/events?view=calendar&month=${ym(next.y, next.m)}`} className="vip-focus grid h-11 w-11 place-items-center rounded-xl text-white/75 hover:bg-white/[0.06]" aria-label="Next month">
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
          <div role="grid" aria-label={`${label} calendar`} className="text-sm">
            <div role="row" className="grid grid-cols-7 border-b border-white/[0.06] text-center text-[11px] font-semibold uppercase tracking-wider text-white/60">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} role="columnheader" className="py-2">
                  <span aria-hidden="true">{d.slice(0, 1)}</span>
                  <span className="sr-only">{d}</span>
                </div>
              ))}
            </div>
            {Array.from({ length: cells.length / 7 }, (_, w) => (
              <div role="row" key={w} className="grid grid-cols-7">
                {cells.slice(w * 7, w * 7 + 7).map((d, i) => {
                  const list = d ? byDay.get(d) ?? [] : []
                  const isToday = isThisMonth && d === today.day
                  return (
                    <div
                      role="gridcell"
                      key={i}
                      aria-label={d ? `${label.split(' ')[0]} ${d}${list.length ? `, ${list.length} session${list.length > 1 ? 's' : ''}` : ''}` : undefined}
                      className={cn('min-h-[64px] border-b border-r border-white/[0.05] p-1 sm:min-h-[104px] sm:p-1.5', !d && 'bg-white/[0.015]', (i + 1) % 7 === 0 && 'border-r-0')}
                    >
                      {d && (
                        <>
                          <span className={cn('grid h-6 w-6 place-items-center rounded-full text-xs', isToday ? 'bg-brand-500 font-bold text-white' : 'text-white/70')}>{d}</span>
                          <ul className="mt-1 space-y-1">
                            {list.map((e) => (
                              <li key={e.id}>
                                <Link
                                  href={`/events?event=${e.id}#event-${e.id}`}
                                  className={cn(
                                    'vip-focus block truncate rounded-md px-1 py-0.5 text-[10px] font-medium leading-tight sm:px-1.5 sm:text-[11px]',
                                    e.going ? 'bg-emerald-300/15 text-emerald-100' : e.allowed ? 'bg-brand-500/20 text-brand-100' : 'bg-white/[0.06] text-white/70',
                                  )}
                                  title={e.title}
                                >
                                  <span className="hidden sm:inline">
                                    {new Date(e.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: tz })}{' '}
                                  </span>
                                  {e.title}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-xs text-white/60">Calendar times in {zoneName}. Session cards show your local time.</p>
        </div>

        <section className="mt-6" aria-labelledby="month-list">
          <h2 id="month-list" className="mb-3 text-base font-semibold">
            Sessions in {label}
          </h2>
          {events.length === 0 ? (
            <p className="vip-surface p-5 text-sm text-white/65">No sessions on the calendar this month.</p>
          ) : (
            <ul className="space-y-3">
              {events.map((e) => (
                <EventCard key={e.id} e={e} highlight={e.id === focus} />
              ))}
            </ul>
          )}
        </section>
      </div>
    )
  }

  const [events, recordings] = await Promise.all([
    listUpcomingEvents(viewer.userId, viewer.accessTier),
    listPastRecordings(viewer.userId, viewer.accessTier),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={VIP_COPY.events.title} intro={VIP_COPY.events.intro} />
      {tabs}
      {events.length === 0 ? (
        <EmptyState title={VIP_COPY.empty.events.title}>{VIP_COPY.empty.events.body}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {events.map((e) => (
            <EventCard key={e.id} e={e} highlight={e.id === focus} />
          ))}
        </ul>
      )}

      {recordings.length > 0 && (
        <section className="mt-10" aria-labelledby="rec-h">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="rec-h" className="text-base font-semibold">
              Recordings
            </h2>
            <Link href="/library?c=RECORDINGS" className="vip-focus rounded text-sm font-medium text-brand-300 hover:text-brand-200">
              All in the Library →
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recordings.map((e) => (
              <li key={e.id}>
                {e.allowed && e.recordingUrl ? (
                  <a href={e.recordingUrl} target="_blank" rel="noopener noreferrer" className="vip-focus vip-surface flex h-full gap-3 p-4 hover:bg-white/[0.04]">
                    <PlayCircle className="h-6 w-6 shrink-0 text-brand-300" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{e.title}</span>
                      <span className="block text-xs text-white/60">
                        {EVENT_KIND_LABEL[e.kind]} · <LocalTime iso={e.startsAt} />
                      </span>
                    </span>
                  </a>
                ) : (
                  <div className="vip-surface flex h-full gap-3 p-4">
                    <Lock className="h-5 w-5 shrink-0 text-white/60" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-semibold">{e.title}</span>
                      <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-white/60">
                        Recording opens at <TierBadge tier={e.minTier} />
                      </span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
