import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { emailVerification } from '@/lib/email-templates'

const postSchema = z.object({ email: z.string().email() })

/**
 * POST — generates a verify token for the given email and sends the email.
 * Returns a generic response to prevent user-enumeration.
 */
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const generic = NextResponse.json({
    success: true,
    message: 'If that email is registered, a verification link is on its way.',
  })

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) return generic

    const email = parsed.data.email.toLowerCase()
    const user = await prisma.user.findUnique({ where: { email } })

    if (user && !user.emailVerified) {
      const token = randomBytes(32).toString('hex')
      await prisma.user.update({
        where: { id: user.id },
        data: { verifyToken: token },
      })

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
      const verifyUrl = `${baseUrl}/api/account/verify-email?token=${token}`

      void (async () => {
        try {
          const tpl = emailVerification({
            name: user.name || 'there',
            verifyUrl,
          })
          await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          })
        } catch (err) {
          console.error('Verification email failed:', err)
        }
      })()
    }

    return generic
  } catch {
    return generic
  }
}

/**
 * GET — invoked when user clicks the link in their email.
 * Verifies the token, marks the user as verified, and redirects.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'

  if (!token) {
    return NextResponse.redirect(`${baseUrl}/account?verified=invalid`)
  }

  const user = await prisma.user.findUnique({ where: { verifyToken: token } })
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/account?verified=invalid`)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      verifyToken: null,
    },
  })

  return NextResponse.redirect(`${baseUrl}/account?verified=1`)
}
