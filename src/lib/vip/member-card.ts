import { randomInt } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * Member numbers — what a member shows (as text or QR) at a partner business
 * and shares as their referral code. Format "VP" + 8 digits, shown
 * "VP-1234-5678". The 8th digit is a Luhn check digit, so a mistyped number is
 * rejected before any lookup. Random, so numbers reveal nothing about join
 * order or member count.
 */

export function luhnCheckDigit(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i])
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10
}

export function generateMemberNumber(): string {
  let body = ''
  for (let i = 0; i < 7; i++) body += String(randomInt(0, 10))
  if (body[0] === '0') body = String(randomInt(1, 10)) + body.slice(1)
  return `VP${body}${luhnCheckDigit(body)}`
}

/** "vp 1234-5678", "VP12345678", "12345678" → "VP12345678"; null when malformed or the check digit fails. */
export function normalizeMemberNumber(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const m = /^(?:VP)?(\d{8})$/.exec(raw)
  if (!m) return null
  const digits = m[1]
  if (luhnCheckDigit(digits.slice(0, 7)) !== Number(digits[7])) return null
  return `VP${digits}`
}

export function formatMemberNumber(n: string): string {
  const d = n.replace(/^VP/, '')
  return `VP-${d.slice(0, 4)}-${d.slice(4)}`
}

/** The member's card, created on first use. */
export async function getOrCreateMemberCard(userId: string) {
  const existing = await prisma.vipMemberCard.findUnique({ where: { userId } })
  if (existing) return existing
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await prisma.vipMemberCard.create({ data: { userId, memberNumber: generateMemberNumber() } })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Either this user's card was created concurrently, or the random
        // number collided — re-read, else try a new number.
        const raced = await prisma.vipMemberCard.findUnique({ where: { userId } })
        if (raced) return raced
        continue
      }
      throw e
    }
  }
  throw new Error('Could not allocate a member number')
}

/** userId for a member number (any formatting), or null. */
export async function findUserIdByMemberNumber(input: string): Promise<string | null> {
  const n = normalizeMemberNumber(input)
  if (!n) return null
  const card = await prisma.vipMemberCard.findUnique({ where: { memberNumber: n }, select: { userId: true } })
  return card?.userId ?? null
}
