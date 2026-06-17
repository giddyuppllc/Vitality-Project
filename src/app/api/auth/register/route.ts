import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { sendEmail } from '@/lib/email'
import { welcomeEmail, emailVerification } from '@/lib/email-templates'
import { TRAINER_ATTRIBUTION_COOKIE, attributeUserToTrainer } from '@/lib/trainer'
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit'

// Username: 3–24 chars, alphanumeric + underscore + dash + dot, must
// start with a letter or digit. Case-insensitive uniqueness enforced
// downstream by lowercasing before write.
const USERNAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,23}$/

const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  // Optional — accounts that don't pick one stay email-only
  username: z
    .string()
    .regex(USERNAME_REGEX, 'Username must be 3-24 chars (letters, numbers, _ . -); start with a letter or digit')
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export async function POST(req: NextRequest) {
  // Throttle account creation per IP — deters credential-stuffing / mass
  // signup abuse.
  const limited = checkRateLimit(req, 'register', { limit: 10, windowMs: 60_000 })
  if (!limited.allowed) return tooManyRequests(limited.retryAfter)

  try {
    const body = await req.json()
    const { name, email, password, username } = schema.parse(body)
    const usernameLower = username?.toLowerCase()

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
    }

    if (usernameLower) {
      const usernameClash = await prisma.user.findUnique({ where: { username: usernameLower } })
      if (usernameClash) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 400 })
      }
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const verifyToken = randomBytes(32).toString('hex')

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        username: usernameLower,
        passwordHash,
        verifyToken,
      },
    })

    // Trainer attribution (if visitor arrived via /join/<code>) — non-blocking
    try {
      const cookieStore = await cookies()
      const trainerCode = cookieStore.get(TRAINER_ATTRIBUTION_COOKIE)?.value
      if (trainerCode) {
        await attributeUserToTrainer(user.id, trainerCode)
        // Clear the cookie so it doesn't auto-attribute future signups on
        // this device (e.g. spouse signing up next)
        cookieStore.delete(TRAINER_ATTRIBUTION_COOKIE)
      }
    } catch (err) {
      console.error('Trainer attribution on signup failed:', err)
      // Never block account creation on attribution
    }

    // Fire-and-forget — never block the signup flow on email delivery
    void (async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitalityproject.global'
        const verifyUrl = `${baseUrl}/api/account/verify-email?token=${verifyToken}`

        const welcome = welcomeEmail({ name })
        await sendEmail({
          to: user.email,
          subject: welcome.subject,
          html: welcome.html,
          text: welcome.text,
        })

        const verify = emailVerification({ name, verifyUrl })
        await sendEmail({
          to: user.email,
          subject: verify.subject,
          html: verify.html,
          text: verify.text,
        })
      } catch (err) {
        console.error('Registration email send failed:', err)
      }
    })()

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
