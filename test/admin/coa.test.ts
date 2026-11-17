import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/admin/coa/route'
import { DELETE } from '@/app/api/admin/coa/[id]/route'
import { makeUser, params, setSession } from '../helpers'

function multipart(fields: Record<string, string>, file?: { name: string; body: string; type: string }) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  if (file) fd.set('file', new File([file.body], file.name, { type: file.type }))
  return new NextRequest('http://localhost/api/admin/coa', { method: 'POST', body: fd })
}

const CANARY = path.resolve(process.cwd(), 'public', 'zz-test-coa-canary.txt')

describe('admin COA upload/delete', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'coa-admin', role: 'ADMIN' })
  })
  afterAll(async () => {
    await fs.unlink(CANARY).catch(() => {})
  })

  it('refuses an HTML upload (would be served from the store origin)', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const res = await POST(
      multipart({ productName: 'ZZ-TEST', lotNumber: 'ZZ1' }, { name: 'x.html', body: '<script>alert(1)</script>', type: 'text/html' }),
    )
    expect(res.status).toBe(400)
  })

  it('refuses a javascript: document URL', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const res = await POST(multipart({ productName: 'ZZ-TEST', lotNumber: 'ZZ2', documentUrl: 'javascript:alert(1)' }))
    expect(res.status).toBe(400)
  })

  it('accepts an https document URL', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const res = await POST(multipart({ productName: 'ZZ-TEST', lotNumber: 'ZZ3', documentUrl: 'https://example.invalid/coa.pdf' }))
    expect(res.status).toBe(201)
  })

  it('deleting a record whose URL escapes /coa never unlinks the outside file', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    await fs.writeFile(CANARY, 'canary')
    const rec = await prisma.certificateOfAnalysis.create({
      data: { productName: 'ZZ-TEST', lotNumber: 'ZZ4', documentUrl: '/coa/../zz-test-coa-canary.txt' },
    })
    const res = await DELETE(new NextRequest(`http://localhost/api/admin/coa/${rec.id}`, { method: 'DELETE' }), params({ id: rec.id }))
    expect(res.status).toBe(200)
    await expect(fs.readFile(CANARY, 'utf8')).resolves.toBe('canary')
  })
})
