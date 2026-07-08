import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { supportTicketCreated } from '@/lib/email-templates'
import { createAdminNotification } from '@/lib/notifications'
import { sendOwnerSms } from '@/lib/sms'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'

const schema = z.object({
  subject: z.string().min(2).max(200),
  message: z.string().min(2).max(5000),
  email: z.string().email().optional(),
  name: z.string().optional(),
  orderId: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
})

async function nextTicketNumber(): Promise<string> {
  // VP-TKT-000001 style. Count existing and add 1 for a monotonic feel.
  const count = await prisma.supportTicket.count()
  return `VP-TKT-${String(count + 1).padStart(6, '0')}`
}

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: { select: { messages: true } },
    },
  })
  return NextResponse.json(tickets)
}

export async function POST(req: NextRequest) {
  // 10 tickets per IP per 5 minutes — looser for logged-in users below.
  const rl = checkRateLimit(req, 'support', { limit: 10, windowMs: 5 * 60_000 })
  if (!rl.allowed) return tooManyRequests(rl.retryAfter)

  try {
    const session = await getServerSession(authOptions)
    const data = schema.parse(await req.json())

    const email = session?.user?.email ?? data.email
    const name = session?.user?.name ?? data.name ?? 'there'
    if (!email) {
      return NextResponse.json(
        { error: 'Email required for guest tickets' },
        { status: 400 },
      )
    }

    const number = await nextTicketNumber()

    const ticket = await prisma.supportTicket.create({
      data: {
        number,
        userId: session?.user?.id,
        email,
        subject: data.subject,
        status: 'OPEN',
        priority: data.priority ?? 'NORMAL',
        orderId: data.orderId,
        messages: {
          create: {
            authorId: session?.user?.id ?? null,
            authorName: name,
            body: data.message,
          },
        },
      },
      include: { messages: true },
    })

    // Mirror guest tickets into the CRM as a SalesLead so marketing-intent
    // inquiries (someone asking pre-sales questions via the contact form)
    // land in /admin/leads alongside the B2B applications. Logged-in
    // ticket creators are existing customers — already in /admin/customers,
    // no lead needed.
    if (!session?.user?.id) {
      void (async () => {
        try {
          const existingLead = await prisma.salesLead.findFirst({
            where: { contactEmail: email, organizationId: null },
            select: { id: true },
          })
          if (!existingLead) {
            await prisma.salesLead.create({
              data: {
                businessName: data.name?.trim() || email.split('@')[0],
                contactName: name,
                contactEmail: email,
                source: 'website-contact-form',
                stage: 'NEW',
                priority: data.priority === 'URGENT' || data.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
                notes: `From contact form. Subject: ${data.subject}\n\n${data.message.slice(0, 2000)}`,
              },
            })
          }
        } catch (err) {
          // Non-fatal — ticket creation already succeeded.
          console.error('SalesLead mirror from support ticket failed:', err)
        }
      })()
    }

    // Fire-and-forget emails + notifications
    void (async () => {
      try {
        const tpl = supportTicketCreated({
          name,
          ticketNumber: ticket.number,
          subject: ticket.subject,
        })
        await sendEmail({
          to: email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      } catch (err) {
        console.error('Support ticket email failed:', err)
      }

      await createAdminNotification({
        type: 'SUPPORT_TICKET_NEW',
        title: `New ticket ${ticket.number}`,
        body: ticket.subject,
        link: `/admin/support/${ticket.id}`,
        entityType: 'SupportTicket',
        entityId: ticket.id,
      })

      // Text the business owner about the new contact-form message.
      void sendOwnerSms(
        `Vitality: new contact ${ticket.number} — "${ticket.subject}" from ${email}`,
      )
    })()

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: error.issues }, { status: 400 })
    console.error('Ticket create error:', error)
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 },
    )
  }
}
