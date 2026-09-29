import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

const hdrs = vi.hoisted(() => ({ site: null as string | null }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(hdrs.site ? { 'x-vp-site': hdrs.site } : {}),
}))

import RootLayout from '@/app/layout'

/** Collect every element type name + serialisable props in a rendered tree. */
function flatten(node: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, out))
  else if (isValidElement(node)) {
    const el = node as ReactElement<Record<string, unknown>>
    const t = typeof el.type === 'string' ? el.type : (el.type as { name?: string }).name || 'anon'
    out.push(t)
    const { children, dangerouslySetInnerHTML, ...rest } = el.props
    if (dangerouslySetInnerHTML) out.push(JSON.stringify(dangerouslySetInnerHTML))
    out.push(JSON.stringify(rest))
    flatten(children as ReactNode, out)
  } else if (typeof node === 'string') out.push(node)
  return out
}

describe('root layout — one document per site', () => {
  beforeEach(() => {
    hdrs.site = null
  })

  it('.global: the store document (JSON-LD, providers, modal, service worker) is rendered', async () => {
    const tree = flatten(await RootLayout({ children: 'PAGE' })).join('\n')
    expect(tree).toContain('application/ld+json')
    for (const c of ['Providers', 'VitalityVeins', 'ExitIntentModal', 'ServiceWorkerRegistration']) expect(tree).toContain(c)
    expect(tree).toContain('PAGE')
  })

  it('.vip: a bare document — no store JSON-LD, pixels, modal, canvas or service worker', async () => {
    hdrs.site = 'vip'
    const tree = flatten(await RootLayout({ children: 'PAGE' })).join('\n')
    expect(tree).toContain('PAGE')
    for (const c of ['ld+json', 'Providers', 'VitalityVeins', 'ExitIntentModal', 'ServiceWorkerRegistration', 'Script', 'peptide']) {
      expect(tree.toLowerCase(), c).not.toContain(c.toLowerCase())
    }
  })
})
