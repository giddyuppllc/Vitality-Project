import { describe, expect, it } from 'vitest'
import { makeUser, setSession } from '../helpers'
import ModerationPage from '@/app/admin/vip/page'
import MembersPage from '@/app/admin/vip/members/page'
import EventsPage from '@/app/admin/vip/events/page'
import RewardsPage from '@/app/admin/vip/rewards/page'
import SpacesPage from '@/app/admin/vip/spaces/page'
import ClassroomPage from '@/app/admin/vip/classroom/page'
import CourseEditor from '@/app/admin/vip/classroom/[id]/page'
import CatalogPage from '@/app/admin/vip/rewards/catalog/page'
import RedemptionsPage from '@/app/admin/vip/rewards/redemptions/page'
import EarningPage from '@/app/admin/vip/rewards/earning/page'
import PointsPage from '@/app/admin/vip/rewards/points/page'
import PartnersPage from '@/app/admin/vip/partners/page'
import PartnerDetail from '@/app/admin/vip/partners/[id]/page'
import StatementsPage from '@/app/admin/vip/partners/statements/page'
import ReportedConversation from '@/app/admin/vip/conversations/[id]/page'
import LibraryPage from '@/app/admin/vip/library/page'
import FitnessPage from '@/app/admin/vip/fitness/page'
import FitArticles from '@/app/admin/vip/fitness/articles/page'
import FitArticle from '@/app/admin/vip/fitness/articles/[id]/page'
import FitChallenges from '@/app/admin/vip/fitness/challenges/page'
import FitChallenge from '@/app/admin/vip/fitness/challenges/[id]/page'
import FitExercises from '@/app/admin/vip/fitness/exercises/page'
import FitPrograms from '@/app/admin/vip/fitness/programs/page'
import FitProgram from '@/app/admin/vip/fitness/programs/[id]/page'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * The admin layout's role check is NOT an access boundary: Next renders only
 * the changed segments for a client navigation, and a crafted request
 * (RSC: 1 + a Next-Router-State-Tree that says the admin layout is already
 * on screen) gets the page segment's payload without the layout ever running.
 * Proven locally: an anonymous request read every member's email from
 * /admin/vip/members that way. So every clubhouse admin page checks itself.
 */
const pages: Array<[string, () => Promise<unknown>]> = [
  ['/admin/vip', () => ModerationPage()],
  ['/admin/vip/members', () => MembersPage({ searchParams: Promise.resolve({}) })],
  ['/admin/vip/events', () => EventsPage()],
  ['/admin/vip/rewards', () => RewardsPage()],
  ['/admin/vip/spaces', () => SpacesPage()],
  ['/admin/vip/classroom', () => ClassroomPage()],
  ['/admin/vip/classroom/[id]', () => CourseEditor({ params: Promise.resolve({ id: 'nope' }) })],
  ['/admin/vip/rewards/catalog', () => CatalogPage()],
  ['/admin/vip/rewards/redemptions', () => RedemptionsPage({ searchParams: Promise.resolve({}) })],
  ['/admin/vip/rewards/earning', () => EarningPage()],
  ['/admin/vip/rewards/points', () => PointsPage({ searchParams: Promise.resolve({ q: 'zz-nobody@example.invalid' }) })],
  ['/admin/vip/partners', () => PartnersPage()],
  ['/admin/vip/partners/[id]', () => PartnerDetail({ params: Promise.resolve({ id: 'nope' }) })],
  ['/admin/vip/partners/statements', () => StatementsPage({ searchParams: Promise.resolve({}) })],
  ['/admin/vip/conversations/[id]', () => ReportedConversation({ params: Promise.resolve({ id: 'nope' }) })],
  ['/admin/vip/library', () => LibraryPage()],
  ['/admin/vip/fitness', () => FitnessPage()],
  ['/admin/vip/fitness/articles', () => FitArticles()],
  ['/admin/vip/fitness/articles/[id]', () => FitArticle({ params: Promise.resolve({ id: 'nope' }) })],
  ['/admin/vip/fitness/challenges', () => FitChallenges()],
  ['/admin/vip/fitness/challenges/[id]', () => FitChallenge({ params: Promise.resolve({ id: 'nope' }) })],
  ['/admin/vip/fitness/exercises', () => FitExercises({ searchParams: Promise.resolve({}) })],
  ['/admin/vip/fitness/programs', () => FitPrograms()],
  ['/admin/vip/fitness/programs/[id]', () => FitProgram({ params: Promise.resolve({ id: 'nope' }) })],
]

async function outcome(render: () => Promise<unknown>): Promise<string> {
  try {
    await render()
    return 'rendered'
  } catch (err) {
    const digest = (err as { digest?: string }).digest ?? ''
    if (digest.startsWith('NEXT_REDIRECT')) return `redirect:${digest.split(';')[2]}`
    if (digest.startsWith('NEXT_HTTP_ERROR_FALLBACK;404')) return 'not-found'
    throw err
  }
}

describe('clubhouse admin pages check the role themselves', () => {
  it('lists every page under src/app/admin/vip (a new page must be added here)', () => {
    const root = path.resolve(__dirname, '../../src/app/admin/vip')
    const found: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (f === 'page.tsx') found.push(('/admin/vip/' + path.relative(root, path.dirname(p)).replace(/\\/g, '/')).replace(/\/$/, ''))
      }
    }
    walk(root)
    expect(found.sort()).toEqual(pages.map(([p]) => p).sort())
  })

  it('anonymous and non-admin members are redirected away from every page', async () => {
    const member = await makeUser({ tag: 'adm-pg-member', tier: 'PREMIUM' })
    for (const who of [null, member]) {
      setSession(who)
      for (const [path, render] of pages) {
        expect(await outcome(render), `${who ? 'member' : 'anon'} ${path}`).toBe('redirect:/auth/login')
      }
    }
    setSession(null)
  })

  it('an admin still gets every page', async () => {
    const admin = await makeUser({ tag: 'adm-pg-admin', role: 'ADMIN' })
    setSession({ ...admin, role: 'ADMIN' })
    for (const [path, render] of pages) {
      const r = await outcome(render)
      expect(r === 'rendered' || (path.includes('[id]') && r === 'not-found'), `${path}: ${r}`).toBe(true)
    }
    setSession(null)
  })
})
