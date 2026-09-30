import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { publicUrl } from '@/lib/public-url'
import { GET as unsubscribeGET } from '@/app/api/newsletter/unsubscribe/[token]/route'
import { GET as confirmGET } from '@/app/api/newsletter/confirm/[token]/route'
import { GET as trackGET } from '@/app/api/affiliate/track/route'
import { GET as slugGET } from '@/app/r/[code]/[slug]/route'
import { GET as clubhouseGET } from '@/app/clubhouse/route'
import { GET as refGET } from '@/app/r/[code]/route'
import { params } from './helpers'

/**
 * In production the app sits behind nginx + Cloudflare in Docker, so req.url
 * is http://0.0.0.0:3000/…. Redirects must use the host the visitor used.
 */
const behindProxy = (path: string) =>
  new NextRequest(new URL(path, 'http://0.0.0.0:3000'), {
    headers: { host: 'vitalityproject.global', 'x-forwarded-proto': 'https', 'x-forwarded-for': '10.9.9.9' },
  })
const loc = (r: Response) => r.headers.get('location')

describe('redirects behind the proxy go to the public host, never 0.0.0.0', () => {
  it('publicUrl: forwarded host/proto; https by default; absolute URLs unchanged', () => {
    expect(publicUrl(behindProxy('/x'), '/shop?a=1')).toBe('https://vitalityproject.global/shop?a=1')
    const fwd = new NextRequest('http://0.0.0.0:3000/', { headers: { host: '0.0.0.0:3000', 'x-forwarded-host': 'vitalityproject.global' } })
    expect(publicUrl(fwd, '/')).toBe('https://vitalityproject.global/')
    expect(publicUrl(behindProxy('/'), 'https://example.com/a')).toBe('https://example.com/a')
  })

  it("Cloudflare's CF-Visitor scheme wins over the origin nginx's X-Forwarded-Proto: http", () => {
    const viaCf = (visitor: string) =>
      new NextRequest('http://0.0.0.0:3000/', {
        headers: { host: 'vitalityproject.global', 'x-forwarded-proto': 'http', 'cf-visitor': visitor },
      })
    expect(publicUrl(viaCf('{"scheme":"https"}'), '/shop')).toBe('https://vitalityproject.global/shop')
    expect(publicUrl(viaCf('not json'), '/shop')).toBe('http://vitalityproject.global/shop')
    expect(publicUrl(viaCf('{"scheme":"javascript"}'), '/shop')).toBe('http://vitalityproject.global/shop')
  })

  it('affiliate click (/r/<code>) lands on https behind Cloudflare', async () => {
    const r = new NextRequest('http://0.0.0.0:3000/r/ZZNOPE?to=/shop', {
      headers: { host: 'vitalityproject.global', 'x-forwarded-proto': 'http', 'cf-visitor': '{"scheme":"https"}', 'x-forwarded-for': '10.9.9.8' },
    })
    expect(loc(await refGET(r, params({ code: 'ZZNOPE' })))).toBe('https://vitalityproject.global/shop')
  })

  it('newsletter unsubscribe and confirm (links in customer email)', async () => {
    expect(loc(await unsubscribeGET(behindProxy('/api/newsletter/unsubscribe/zz'), params({ token: 'zz-none' })))).toBe(
      'https://vitalityproject.global/unsubscribed',
    )
    expect(loc(await confirmGET(behindProxy('/api/newsletter/confirm/zz'), params({ token: 'zz-none' })))).toBe(
      'https://vitalityproject.global/newsletter/confirmed?status=invalid',
    )
  })

  it('affiliate track without a code, and an unknown /r/<code>/<slug>', async () => {
    expect(loc(await trackGET(behindProxy('/api/affiliate/track?to=/shop')))).toBe('https://vitalityproject.global/shop')
    expect(loc(await slugGET(behindProxy('/r/ZZ/zz-none'), params({ code: 'ZZ', slug: 'zz-none' })))).toBe(
      'https://vitalityproject.global/',
    )
  })

  it('/clubhouse signed out → login on the public host', async () => {
    expect(loc(await clubhouseGET(behindProxy('/clubhouse')))).toBe(
      'https://vitalityproject.global/auth/login?callbackUrl=/clubhouse',
    )
  })
})
