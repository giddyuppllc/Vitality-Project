import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireVipApi, vipJson } from '@/lib/vip/access'
import { MAX_MESSAGE_CHARS, memberRateLimit } from '@/lib/vip/guard'
import {
  getConversation,
  leaveGroup,
  listMessages,
  markRead,
  renameGroup,
  sendMessage,
} from '@/lib/vip/messages'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * GET /api/vip/messages/:id?after=<iso>|before=<messageId>&read=1 — the
 * conversation (participants + read receipts) and its messages. Polled by
 * the open thread with `after`; `read=1` also records the read receipt.
 * Only participants get anything but 404.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const sp = req.nextUrl.searchParams
  const conversation = await getConversation(gate.viewer, id)
  if (!conversation) return vipJson({ error: 'Not found' }, { status: 404 })
  const page = await listMessages(gate.viewer, id, { after: sp.get('after'), before: sp.get('before') })
  if (!page) return vipJson({ error: 'Not found' }, { status: 404 })
  if (sp.get('read') === '1') await markRead(gate.viewer, id)
  return vipJson({ conversation, ...page })
}

const sendSchema = z.object({
  body: z.string().max(MAX_MESSAGE_CHARS).default(''),
  imageUrl: z.string().max(200).nullish(),
  sharedPostId: z.string().max(64).nullish(),
})

/** POST /api/vip/messages/:id {body, imageUrl?, sharedPostId?} — send a message. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const wait = memberRateLimit(req, 'message', gate.viewer.userId)
  if (wait) return vipJson({ error: 'You are sending too quickly. Try again shortly.', retryAfter: wait }, { status: 429 })
  const { id } = await params
  const parsed = sendSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid message' }, { status: 400 })
  const r = await sendMessage(gate.viewer, id, parsed.data)
  if (!r.ok) return vipJson({ error: r.error }, { status: r.status })
  return vipJson({ ok: true, message: r.message }, { status: 201 })
}

const patchSchema = z.object({
  read: z.literal(true).optional(),
  title: z.string().trim().max(80).nullable().optional(),
})

/** PATCH /api/vip/messages/:id {read: true} | {title} — read receipt, or rename a group. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return vipJson({ error: 'Invalid request' }, { status: 400 })
  if (parsed.data.title !== undefined) {
    const r = await renameGroup(gate.viewer, id, parsed.data.title)
    if (!r.ok) return vipJson({ error: r.error }, { status: r.status })
  }
  if (parsed.data.read) {
    if (!(await markRead(gate.viewer, id))) return vipJson({ error: 'Not found' }, { status: 404 })
  }
  return vipJson({ ok: true })
}

/** DELETE /api/vip/messages/:id — leave a group conversation. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const gate = await requireVipApi('community')
  if (gate.response) return gate.response
  const { id } = await params
  const r = await leaveGroup(gate.viewer, id)
  if (!r.ok) return vipJson({ error: r.error }, { status: r.status })
  return vipJson({ ok: true })
}
