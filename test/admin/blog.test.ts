import { beforeAll, describe, expect, it, vi } from 'vitest'

const revalidated = vi.hoisted(() => [] as string[])
vi.mock('next/cache', async (orig) => ({
  ...(await orig<typeof import('next/cache')>()),
  revalidatePath: vi.fn((p: string) => {
    revalidated.push(p)
  }),
}))

import { POST } from '@/app/api/admin/blog/route'
import { PATCH, DELETE } from '@/app/api/admin/blog/[id]/route'
import { makeUser, params, req, setSession } from '../helpers'

/** The public blog is ISR (1h). Admin edits must revalidate it immediately. */
describe('admin blog cache refresh', () => {
  let admin: { id: string; email: string }
  beforeAll(async () => {
    admin = await makeUser({ tag: 'blog-admin', role: 'ADMIN' })
  })

  it('create, unpublish/rename and delete revalidate /blog and the post page(s)', async () => {
    setSession({ ...admin, role: 'ADMIN' })
    const slug = `zz-test-post-${Date.now().toString(36)}`
    const created = await POST(
      req('http://localhost/x', {
        method: 'POST',
        body: { title: 'ZZ-TEST post', slug, excerpt: 'x', content: 'x', category: 'Research', published: true },
      }),
    )
    expect(created.status).toBe(201)
    const post = await created.json()
    expect(revalidated).toEqual(expect.arrayContaining(['/blog', `/blog/${slug}`]))

    revalidated.length = 0
    const renamed = `${slug}-b`
    const res = await PATCH(req('http://localhost/x', { method: 'PATCH', body: { published: false, slug: renamed } }), params({ id: post.id }))
    expect(res.status).toBe(200)
    expect(revalidated).toEqual(expect.arrayContaining(['/blog', `/blog/${slug}`, `/blog/${renamed}`]))

    revalidated.length = 0
    await DELETE(req('http://localhost/x', { method: 'DELETE' }), params({ id: post.id }))
    expect(revalidated).toEqual(expect.arrayContaining(['/blog', `/blog/${renamed}`]))
  })
})
