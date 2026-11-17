import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { GET as productGET, PATCH as productPATCH } from '@/app/api/admin/products/[id]/route'
import { POST as productPOST } from '@/app/api/admin/products/route'
import { makeUser, params, req, setSession } from '../helpers'

/** Admin Edit Product: every field the form sends must persist. ZZ-TEST fixtures, throwaway DB only. */

const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

async function product(over: Record<string, unknown> = {}) {
  return prisma.product.create({
    data: {
      name: `ZZ-TEST edit ${uniq()}`,
      description: 'Test fixture (throwaway DB only)',
      slug: `zz-test-edit-${uniq()}`,
      price: 4999,
      status: 'ACTIVE',
      ...over,
    },
  })
}

describe('admin product edit', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'prod-admin', role: 'ADMIN' })
  })
  const asAdmin = () => setSession({ ...admin, role: 'ADMIN' })

  it('Active -> Archived via the Status dropdown persists (the July report), alongside Featured', async () => {
    asAdmin()
    const p = await product()
    const res = await productPATCH(
      req(`http://localhost/api/admin/products/${p.id}`, { method: 'PATCH', body: { status: 'ARCHIVED', featured: true } }),
      params({ id: p.id }),
    )
    expect(res.status).toBe(200)
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.status).toBe('ARCHIVED')
    expect(after.featured).toBe(true)
    // and the form's re-load (GET) returns the saved value
    const g = await (await productGET(req(`http://localhost/api/admin/products/${p.id}`), params({ id: p.id }))).json()
    expect(g.status).toBe('ARCHIVED')
  })

  it('a SKU already used elsewhere is refused with a clear 409 — and nothing (not even status) is half-saved', async () => {
    asAdmin()
    const sku = `ZZ-SKU-${uniq()}`
    const other = await product({ sku })
    const p = await product()
    const res = await productPATCH(
      req(`http://localhost/api/admin/products/${p.id}`, { method: 'PATCH', body: { status: 'ARCHIVED', sku } }),
      params({ id: p.id }),
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(String(body.error)).toContain(other.name)
    const after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.status).toBe('ACTIVE')
    expect(after.sku).toBeNull()
  })

  it('an emptied SKU box clears the SKU (null), and the category can be set and cleared', async () => {
    asAdmin()
    const cat = await prisma.category.create({ data: { name: `ZZ-TEST cat ${uniq()}`, slug: `zz-test-cat-${uniq()}` } })
    const p = await product({ sku: `ZZ-SKU-${uniq()}` })
    let res = await productPATCH(
      req(`http://localhost/api/admin/products/${p.id}`, { method: 'PATCH', body: { sku: null, categoryId: cat.id } }),
      params({ id: p.id }),
    )
    expect(res.status).toBe(200)
    let after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.sku).toBeNull()
    expect(after.categoryId).toBe(cat.id)
    res = await productPATCH(
      req(`http://localhost/api/admin/products/${p.id}`, { method: 'PATCH', body: { categoryId: null } }),
      params({ id: p.id }),
    )
    after = await prisma.product.findUniqueOrThrow({ where: { id: p.id } })
    expect(after.categoryId).toBeNull()
  })

  it('a validation error comes back as a readable string, not a raw issue array', async () => {
    asAdmin()
    const p = await product()
    const res = await productPATCH(
      req(`http://localhost/api/admin/products/${p.id}`, { method: 'PATCH', body: { price: -5 } }),
      params({ id: p.id }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(typeof body.error).toBe('string')
  })

  it('New Product: a near-duplicate is refused, and "create anyway" (force) succeeds with its own slug', async () => {
    asAdmin()
    const name = `ZZ-TEST Forceable ${uniq()}`
    const body = { name, description: 'x', price: 1000 }
    const first = await productPOST(req('http://localhost/api/admin/products', { method: 'POST', body }))
    expect(first.status).toBe(201)
    const dup = await productPOST(req('http://localhost/api/admin/products', { method: 'POST', body }))
    expect(dup.status).toBe(409)
    const forced = await productPOST(req('http://localhost/api/admin/products', { method: 'POST', body: { ...body, force: true } }))
    expect(forced.status).toBe(201)
    const a = await first.json()
    const b = await forced.json()
    expect(b.slug).not.toBe(a.slug)
  })
})
