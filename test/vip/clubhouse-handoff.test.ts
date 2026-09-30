import { afterEach, describe, expect, it } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { GET as clubhouseGET } from '@/app/clubhouse/route'
import AccountMembershipPage from '@/app/(store)/account/membership/page'
import { makeUser, req, setSession } from '../helpers'

/**
 * The .global → .vip hand-off never sends a member to a domain that doesn't
 * resolve yet: /clubhouse falls back to /account/membership and the "Enter the
 * Clubhouse" card stays hidden until vitalityproject.vip has DNS.
 */
const live = (globalThis as unknown as { __vipDomainLive: { value: boolean } }).__vipDomainLive

afterEach(() => {
  live.value = true
  setSession(null)
})

function hrefs(node: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => hrefs(n, out))
  else if (isValidElement(node)) {
    const props = node.props as { href?: unknown; children?: ReactNode }
    if (typeof props.href === 'string') out.push(props.href)
    hrefs(props.children, out)
  }
  return out
}

describe('/clubhouse hand-off while vitalityproject.vip has no DNS', () => {
  it('an active member goes back to /account/membership until the domain resolves, then to .vip SSO', async () => {
    const u = await makeUser({ tag: 'ho-route', tier: 'PLUS' })
    setSession(u)
    live.value = false
    const held = await clubhouseGET(req('/clubhouse'))
    expect(new URL(held.headers.get('location')!).pathname).toBe('/account/membership')

    live.value = true
    const ok = await clubhouseGET(req('/clubhouse'))
    expect(ok.headers.get('location')).toMatch(/^https:\/\/vitalityproject\.vip\/api\/sso\?token=/)
  })

  it('the "Enter the Clubhouse" card is shown only once the domain resolves', async () => {
    const u = await makeUser({ tag: 'ho-card', tier: 'PLUS' })
    setSession(u)
    live.value = false
    expect(hrefs(await AccountMembershipPage())).not.toContain('/clubhouse')
    live.value = true
    expect(hrefs(await AccountMembershipPage())).toContain('/clubhouse')
  })
})
