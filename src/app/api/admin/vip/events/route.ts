import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdminApi } from '@/lib/vip/access'
import { logAudit } from '@/lib/audit'
import { EVENT_KINDS } from '@/lib/vip/classroom'
import { reseatWaitlist, syncRecordingToLibrary } from '@/lib/vip/events'

export const dynamic = 'force-dynamic'

const schema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('upsert'),
    id: z.string().max(64).optional(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(5000).nullish(),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }).nullish(),
    joinUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\//i.test(v), 'Join link must be https')
      .nullish(),
    minTier: z.enum(['CLUB', 'PLUS', 'PREMIUM']),
    published: z.boolean(),
    repeatMonthly: z.boolean().optional(),
    // Events upgrade (optional: omitted = unchanged)
    kind: z.enum(EVENT_KINDS).optional(),
    capacity: z.number().int().min(1).max(100_000).nullish(),
    recordingUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\//i.test(v), 'Recording link must be https')
      .nullish(),
  }),
  z.object({ op: z.literal('cancel'), id: z.string().max(64) }),
  z.object({ op: z.literal('uncancel'), id: z.string().max(64) }),
  z.object({ op: z.literal('delete'), id: z.string().max(64) }),
])

/** POST /api/admin/vip/events — create/update/cancel/delete an event. */
export async function POST(req: NextRequest) {
  const gate = await requireAdminApi()
  if (gate.response) return gate.response
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })
  const d = parsed.data
  let id: string
  try {
    if (d.op === 'upsert') {
      const startsAt = new Date(d.startsAt)
      const endsAt = d.endsAt ? new Date(d.endsAt) : null
      if (endsAt && endsAt <= startsAt) {
        return NextResponse.json({ error: 'End must be after start' }, { status: 400 })
      }
      const data = {
        title: d.title,
        description: d.description || null,
        startsAt,
        endsAt,
        joinUrl: d.joinUrl || null,
        minTier: d.minTier,
        published: d.published,
        ...(d.repeatMonthly !== undefined ? { repeatMonthly: d.repeatMonthly } : {}),
        ...(d.kind !== undefined ? { kind: d.kind } : {}),
        ...(d.capacity !== undefined ? { capacity: d.capacity || null } : {}),
      }
      let recording: { recordingUrl: string | null; recordingAddedAt?: Date | null } | null = null
      if (d.recordingUrl !== undefined) {
        const url = d.recordingUrl || null
        const prior = d.id ? await prisma.vipEvent.findUnique({ where: { id: d.id }, select: { recordingUrl: true } }) : null
        recording = { recordingUrl: url, ...(url !== (prior?.recordingUrl ?? null) ? { recordingAddedAt: url ? new Date() : null } : {}) }
      }
      let row
      if (d.id) {
        const before = await prisma.vipEvent.findUnique({ where: { id: d.id }, select: { startsAt: true } })
        row = await prisma.vipEvent.update({ where: { id: d.id }, data: { ...data, ...recording } })
        // Moved to a new time: the reminders already sent were for the old
        // time, so re-arm them for the new one.
        if (before && before.startsAt.getTime() !== startsAt.getTime()) {
          await prisma.vipEventRsvp.updateMany({
            where: { eventId: d.id },
            data: { reminded24hAt: null, reminded1hAt: null },
          })
        }
      } else {
        row = await prisma.vipEvent.create({ data: { ...data, ...recording, createdById: gate.userId } })
      }
      id = row.id
      // A raised (or removed) capacity seats the waitlist; the recording is
      // archived into (or withdrawn from) the Library.
      await reseatWaitlist(id)
      await syncRecordingToLibrary(id)
    } else if (d.op === 'delete') {
      await prisma.vipEvent.delete({ where: { id: d.id } })
      id = d.id
    } else {
      await prisma.vipEvent.update({
        where: { id: d.id },
        data: { cancelledAt: d.op === 'cancel' ? new Date() : null },
      })
      id = d.id
      await syncRecordingToLibrary(id)
    }
  } catch (err) {
    console.error('[admin/vip/events]', err)
    return NextResponse.json({ error: 'Not found or failed' }, { status: 404 })
  }
  await logAudit({ userId: gate.userId, action: `vip.event.${d.op}`, entityType: 'VipEvent', entityId: id })
  return NextResponse.json({ ok: true, id })
}
