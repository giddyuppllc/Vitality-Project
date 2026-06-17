import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { sendEmail } from '@/lib/email'
import { passwordReset } from '@/lib/email-templates'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'

const schema = z.object({
  email: z.string().email(),
})

/**
 * Generic response — never leak whether the email exists (prevents enumeration).
 */
const GENERIC_RESPONSE = NextResponse.json({
  success: true,
  message: 'If that email is registered, a reset link is on its way.',
})

export async function POST(req: NextRequest) {
  // Throttle reset requests per IP — deters reset-email spam / enumeration
  // probing. Return the same generic body on limit so we still don't leak
  // whether the email exists.
  const limited = checkRateLimit(req, 'password-reset', { limit: 5, windowMs: 60_000 })
  if (!limited.allowed) return GENERIC_RESPONSE

  try {
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      // Even validation errors return the generic message to prevent probing
      return GENERIC_RESPONSE
    }
    const email = parsed.data.email.toLowerCase()

    const user = await prisma.user.findUnique({ where: { email } })

    if (user) {
      const token = randomBytes(32).toString('hex')
      const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: token,
          resetTokenExpiry: expiry,
        },
      })

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
      const resetUrl = `${baseUrl}/auth/reset-password/${token}`

      // Fire-and-forget — don't block response or reveal delivery status
      void (async () => {
        try {
          const tpl = passwordReset({
            name: user.name || 'there',
            resetUrl,
          })
          await sendEmail({
            to: user.email,
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
          })
        } catch (err) {
          console.error('Password reset email failed:', err)
        }
      })()
    }

    return GENERIC_RESPONSE
  } catch {
    return GENERIC_RESPONSE
  }
}
