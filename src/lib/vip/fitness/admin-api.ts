import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { slugify } from '@/lib/utils'
import { isVipMediaUrl } from '@/lib/vip/media'

/** Shared bits for the /api/admin/vip/fitness/* routes (ADMIN only, audit-logged). */

export const tier = z.enum(['CLUB', 'PLUS', 'PREMIUM'])
export const id = z.string().min(1).max(64)
export const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https?:\/\//i.test(v), 'Must be an http(s) link')
  .nullish()
/** A picture: '' / an https link / an image uploaded to the clubhouse media store (/api/admin/vip/images). */
export const optionalImage = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === '' || /^https:\/\//i.test(v) || isVipMediaUrl(v), 'Must be an https link or an uploaded image')
  .nullish()
export const sort = z.number().int().min(-1000).max(1000).optional()

export function cleanSlug(raw: string | undefined, fallback: string): string {
  const s = slugify((raw || fallback).trim()).replace(/^-+|-+$/g, '').slice(0, 80)
  return s || `item-${Date.now().toString(36)}`
}

export async function parseAdmin<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    const i = parsed.error.issues[0]
    return { error: NextResponse.json({ error: i ? `${i.path.join('.') || 'body'}: ${i.message}` : 'Invalid request' }, { status: 400 }) }
  }
  return { data: parsed.data }
}

export function adminError(err: unknown, where: string): NextResponse {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (err.code === 'P2002') return NextResponse.json({ error: 'That already exists (duplicate number or slug)' }, { status: 409 })
    if (err.code === 'P2003') return NextResponse.json({ error: 'It is still in use elsewhere' }, { status: 409 })
  }
  const e = err as { status?: number; message?: string }
  if (typeof e?.status === 'number' && e.status >= 400 && e.status < 500) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error(`[admin/vip/fitness/${where}]`, err)
  return NextResponse.json({ error: 'Failed' }, { status: 500 })
}

export class AdminInputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
