'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

function generateAffiliateCode(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AFF'
  return base + Math.floor(1000 + Math.random() * 9000)
}

// Admin manually creates an affiliate for an EXISTING user (by email) and
// approves them immediately (ACTIVE). An affiliate requires a User row, so if
// the person has no account yet, admin sends them the invite link to sign up +
// apply (surfaced on the affiliates page). No-op (safe) if the email has no
// user or already has an affiliate.
export async function addAffiliateManually(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return

  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const paypalEmail = String(formData.get('paypalEmail') ?? '').trim() || null
  if (!email) return

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return
  const existing = await prisma.affiliate.findUnique({ where: { userId: user.id } })
  if (existing) return

  let code = generateAffiliateCode(user.name ?? user.email)
  let attempt = 0
  while ((await prisma.affiliate.findUnique({ where: { code } })) && attempt < 6) {
    code = generateAffiliateCode(user.name ?? user.email)
    attempt++
  }

  await prisma.affiliate.create({
    data: { userId: user.id, code, paypalEmail, status: 'ACTIVE' },
  })
  revalidatePath('/admin/affiliates')
}
