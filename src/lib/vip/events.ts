import type { VipEvent } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { eventKind, EVENT_KIND_LABEL, GOING_WHERE } from './classroom'

/**
 * RSVPs with capacity + waitlist, .ics export and recording archive.
 *
 * Capacity is enforced under a row lock on the event (SELECT … FOR UPDATE),
 * so two members taking the last seat at once can't both get it. When a
 * GOING member steps out, the longest-waiting member is promoted in the same
 * transaction. Reminder emails (lib/vip/mailer.ts) go to GOING members only.
 */

export interface RsvpState {
  going: boolean
  waitlisted: boolean
  count: number
  position: number | null
}

async function lockEvent(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], eventId: string) {
  await tx.$queryRaw`SELECT id FROM vip_events WHERE id = ${eventId} FOR UPDATE`
}

export async function rsvpGoing(event: Pick<VipEvent, 'id' | 'capacity'>, userId: string): Promise<RsvpState> {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, event.id)
    const existing = await tx.vipEventRsvp.findUnique({ where: { eventId_userId: { eventId: event.id, userId } } })
    let status = existing?.status ?? (existing ? 'GOING' : null)
    if (!existing) {
      const going = await tx.vipEventRsvp.count({ where: { eventId: event.id, ...GOING_WHERE } })
      status = event.capacity && going >= event.capacity ? 'WAITLIST' : 'GOING'
      await tx.vipEventRsvp.create({ data: { eventId: event.id, userId, status } })
    }
    const count = await tx.vipEventRsvp.count({ where: { eventId: event.id, ...GOING_WHERE } })
    let position: number | null = null
    if (status === 'WAITLIST') {
      const mine = await tx.vipEventRsvp.findUniqueOrThrow({ where: { eventId_userId: { eventId: event.id, userId } } })
      position = (await tx.vipEventRsvp.count({ where: { eventId: event.id, status: 'WAITLIST', createdAt: { lt: mine.createdAt } } })) + 1
    }
    return { going: status !== 'WAITLIST', waitlisted: status === 'WAITLIST', count, position }
  })
}

export async function cancelRsvp(event: Pick<VipEvent, 'id' | 'capacity'>, userId: string): Promise<RsvpState & { promotedUserId: string | null }> {
  return prisma.$transaction(async (tx) => {
    await lockEvent(tx, event.id)
    const existing = await tx.vipEventRsvp.findUnique({ where: { eventId_userId: { eventId: event.id, userId } } })
    let promotedUserId: string | null = null
    if (existing) {
      await tx.vipEventRsvp.delete({ where: { id: existing.id } })
      promotedUserId = await promoteWaitlist(tx, event)
    }
    const count = await tx.vipEventRsvp.count({ where: { eventId: event.id, ...GOING_WHERE } })
    return { going: false, waitlisted: false, count, position: null, promotedUserId }
  })
}

/** Fill free seats from the waitlist, oldest first. Returns the last promoted member. */
async function promoteWaitlist(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  event: Pick<VipEvent, 'id' | 'capacity'>,
): Promise<string | null> {
  let promoted: string | null = null
  for (;;) {
    const going = await tx.vipEventRsvp.count({ where: { eventId: event.id, ...GOING_WHERE } })
    if (event.capacity && going >= event.capacity) break
    const next = await tx.vipEventRsvp.findFirst({ where: { eventId: event.id, status: 'WAITLIST' }, orderBy: { createdAt: 'asc' } })
    if (!next) break
    await tx.vipEventRsvp.update({ where: { id: next.id }, data: { status: 'GOING', promotedAt: new Date() } })
    promoted = next.userId
  }
  return promoted
}

/** After an admin raises (or removes) the capacity: seat the waitlist. */
export async function reseatWaitlist(eventId: string) {
  const event = await prisma.vipEvent.findUnique({ where: { id: eventId }, select: { id: true, capacity: true } })
  if (!event) return
  await prisma.$transaction(async (tx) => {
    await lockEvent(tx, eventId)
    await promoteWaitlist(tx, event)
  })
}

// ─── Recording → Library ───────────────────────────────────────────────────

/**
 * Keep the event's Library entry in step with its recording: a recording
 * creates (or updates) one RECORDINGS resource with the event's tier; no
 * recording unpublishes it. One entry per event (unique eventId).
 */
export async function syncRecordingToLibrary(eventId: string) {
  const e = await prisma.vipEvent.findUnique({ where: { id: eventId } })
  if (!e) return
  const existing = await prisma.vipResource.findUnique({ where: { eventId } })
  if (!e.recordingUrl || e.cancelledAt || !e.published) {
    if (existing?.published) await prisma.vipResource.update({ where: { id: existing.id }, data: { published: false } })
    return
  }
  const label = EVENT_KIND_LABEL[eventKind(e.kind)]
  const data = {
    title: e.title,
    summary: e.description ? e.description.slice(0, 600) : `${label} recording.`,
    category: 'RECORDINGS',
    kind: 'RECORDING',
    url: e.recordingUrl,
    minTier: e.minTier,
    published: true,
  }
  if (existing) await prisma.vipResource.update({ where: { id: existing.id }, data })
  else await prisma.vipResource.create({ data: { ...data, eventId } })
}

// ─── .ics ──────────────────────────────────────────────────────────────────

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

/** Fold lines at 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = []
  let rest = line
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--
    out.push(rest.slice(0, cut))
    rest = ` ${rest.slice(cut)}`
  }
  out.push(rest)
  return out.join('\r\n')
}

/**
 * A single-event calendar file. The video-call link is deliberately NOT in
 * it (calendars sync to other devices and services); the event links back to
 * the Clubhouse Events page, where the join link sits for eligible members.
 */
export function eventIcs(e: Pick<VipEvent, 'id' | 'title' | 'description' | 'startsAt' | 'endsAt' | 'kind' | 'updatedAt'>, baseUrl: string, now = new Date()): string {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 60 * 60e3)
  const url = `${baseUrl}/events?event=${encodeURIComponent(e.id)}`
  const desc = [e.description?.trim(), `Join from the Clubhouse: ${url}`].filter(Boolean).join('\n\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Vitality Project//Clubhouse//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@vitalityproject.vip`,
    `DTSTAMP:${icsDate(now)}`,
    `LAST-MODIFIED:${icsDate(e.updatedAt)}`,
    `DTSTART:${icsDate(e.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(e.title)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    `CATEGORIES:${icsEscape(EVENT_KIND_LABEL[eventKind(e.kind)])}`,
    `URL:${url}`,
    'LOCATION:The Vitality Project Clubhouse',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT30M',
    `DESCRIPTION:${icsEscape(e.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(fold).join('\r\n')}\r\n`
}
