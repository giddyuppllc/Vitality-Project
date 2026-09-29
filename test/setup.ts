import { vi } from 'vitest'

// Fixed, obviously-fake secrets for the test process only.
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret-not-real'
process.env.VIP_SSO_SECRET = 'test-vip-sso-secret-not-real'
process.env.VIP_HOST = 'vitalityproject.vip'
process.env.NEXTAUTH_URL = 'http://localhost:3000'
delete process.env.CRON_SECRET
delete process.env.RESEND_API_KEY
delete process.env.TWILIO_ACCOUNT_SID

if (!/127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) {
  throw new Error('Refusing to run: DATABASE_URL is not the local throwaway database')
}

// Session control: tests set the signed-in user via setSession() in
// test/helpers.ts; every getServerSession() call in the app reads it.
const state = vi.hoisted(() => ({ session: null as null | { user: Record<string, unknown> } }))
;(globalThis as Record<string, unknown>).__vipTestSession = state

vi.mock('next-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-auth')>()
  return {
    ...actual,
    getServerSession: vi.fn(async () => state.session),
  }
})

// Never send email/SMS from tests.
vi.mock('@/lib/email', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/email')>()
  return { ...actual, sendEmail: vi.fn(async () => ({ success: true, id: 'test' })) }
})
vi.mock('@/lib/sms', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sms')>()
  return { ...actual, sendOwnerSms: vi.fn(async () => undefined), sendSMS: vi.fn(async () => ({ success: true })) }
})

// next/font is a build-time transform; give layouts a stand-in under test.
vi.mock('next/font/google', () => ({
  Inter: () => ({ variable: '--font-inter', className: 'font-inter', style: { fontFamily: 'Inter' } }),
}))
