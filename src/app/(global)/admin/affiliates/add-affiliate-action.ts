'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export type AddAffiliateState = { ok: boolean; message: string } | null

function generateAffiliateCode(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AFF'
  return base + Math.floor(1000 + Math.random() * 9000)
}

// Admin manually creates an affiliate for an EXISTING user (by email) and
// approves them immediately (ACTIVE). An affiliate requires a User row, so if
// the person has no account yet, admin sends them the invite link to sign up.
//
// Every exit path now returns a human-readable reason — the old version
// returned void on every failure, so an admin whose add silently did nothing
// (wrong/missing account, not signed in as ADMIN, already an affiliate) had no
// idea why. (Glenna incident, 2026-06-12.)
export async function addAffiliateManually(
  _prev: AddAffiliateState,
  formData: FormData,
): Promise<AddAffiliateState> {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return {
      ok: false,
      message:
        'Not authorized — you must be signed in to an ADMIN account. If you have two logins, use the admin one.',
    }
  }

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const paypalEmail = String(formData.get('paypalEmail') ?? '').trim() || null
  if (!email) return { ok: false, message: 'Enter an email address.' }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return {
      ok: false,
      message: `No account exists for ${email}. They must sign up first — send them the invite link (vitalityproject.global/affiliate), or check the spelling.`,
    }
  }

  const existing = await prisma.affiliate.findUnique({ where: { userId: user.id } })
  if (existing) {
    return {
      ok: false,
      message: `${email} is already an affiliate (code ${existing.code}, ${existing.status}). Manage them in the list below.`,
    }
  }

  let code = generateAffiliateCode(user.name ?? user.email)
  let attempt = 0
  while ((await prisma.affiliate.findUnique({ where: { code } })) && attempt < 8) {
    code = generateAffiliateCode(user.name ?? user.email)
    attempt++
  }

  try {
    await prisma.affiliate.create({
      data: { userId: user.id, code, paypalEmail, status: 'ACTIVE' },
    })
  } catch (err) {
    return {
      ok: false,
      message: `Could not create affiliate: ${(err as Error).message}`,
    }
  }

  revalidatePath('/admin/affiliates')
  return {
    ok: true,
    message: `Added ${user.name ?? email} as an affiliate — code ${code}, Active, 10%.`,
  }
}
