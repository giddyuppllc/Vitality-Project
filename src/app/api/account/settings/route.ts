import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const settingsSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const data = settingsSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Build update payload
    const updateData: { name?: string; email?: string; passwordHash?: string; emailVerified?: null } = {}

    if (data.name !== undefined) {
      updateData.name = data.name
    }

    // Compare case-insensitively: emails are stored lower-case, so typing the
    // same address with a capital letter used to look like a change, find the
    // user's own row, and fail with "Email is already in use".
    if (data.email !== undefined && data.email.toLowerCase() !== user.email.toLowerCase()) {
      // The sign-in email is the account-recovery address: changing it with
      // only a session cookie let anyone at an unlocked/borrowed session move
      // the account to their inbox and then reset the password. Require the
      // current password, as a password change already does.
      if (user.passwordHash) {
        if (!data.currentPassword) {
          return NextResponse.json({ error: 'Enter your current password to change your email' }, { status: 400 })
        }
        const ok = await bcrypt.compare(data.currentPassword, user.passwordHash)
        if (!ok) {
          return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
        }
      }
      // Check if email is already taken
      const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } })
      if (existing) {
        return NextResponse.json({ error: 'Email is already in use' }, { status: 409 })
      }
      updateData.email = data.email.toLowerCase()
      // The new address has not been verified.
      updateData.emailVerified = null
    }

    // Password change
    if (data.newPassword) {
      if (!data.currentPassword) {
        return NextResponse.json({ error: 'Current password is required to set a new password' }, { status: 400 })
      }
      if (!user.passwordHash) {
        return NextResponse.json({ error: 'No password set on this account' }, { status: 400 })
      }
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 })
      }
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 12)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'No changes' })
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    })

    return NextResponse.json({ message: 'Settings updated' })
  } catch (error) {
    console.error('Settings update error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
