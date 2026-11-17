import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { memberRateLimit } from '@/lib/vip/guard'
import { createGroup, listConversations, MAX_GROUP_MEMBERS, startDirect } from '@/lib/vip/messages'

export const dynamic = 'force-dynamic'

/** GET /api/vip/messages — the viewer's conversations, newest first, with unread counts. */
export async function GET() {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  return vipJson({ conversations: await listConversations(gate.viewer) })
}

const schema = z.union([
  z.object({ recipientId: z.string().max(64) }),
  z.object({
    memberIds: z.array(z.string().max(64)).min(1).max(MAX_GROUP_MEMBERS),
    title: z.string().trim().max(80).nullish(),
  }),
])

/**
 * POST /api/vip/messages {recipientId} — open (or reuse) a 1:1 conversation.
 * POST /api/vip/messages {memberIds, title?} — start a group (2–19 others).
 * Returns { id }.
 */
export async function POST(req: NextRequest) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const wait = memberRateLimit(req, 'conversation', gate.viewer.userId)
  if (wait) return vipJson({ error: 'Too many new conversations. Try again later.', retryAfter: wait }, { status: 429 })
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid request' }, { status: 400 })
  const d = parsed.data
  const r =
    'recipientId' in d
      ? await startDirect(gate.viewer, d.recipientId)
      : d.memberIds.filter((id) => id !== gate.viewer.userId).length === 1
        ? await startDirect(gate.viewer, d.memberIds.find((id) => id !== gate.viewer.userId)!)
        : await createGroup(gate.viewer, d.memberIds, d.title ?? null)
  if (!r.ok) return vipJson({ error: r.error }, { status: r.status })
  return vipJson({ ok: true, id: r.id }, { status: 201 })
}
