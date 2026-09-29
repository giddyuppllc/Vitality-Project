import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import { logAudit } from './audit'
import bcrypt from 'bcryptjs'

const cookieDomain = process.env.NEXTAUTH_COOKIE_DOMAIN
const isSecure = (process.env.NEXTAUTH_URL || '').startsWith('https://')
const sessionCookieName = `${isSecure ? '__Secure-' : ''}next-auth.session-token`

/**
 * Email-or-username + password check shared by next-auth's credentials
 * provider (vitalityproject.global) and the clubhouse sign-in
 * (/api/vip/auth/login on vitalityproject.vip) — one User table, one rule.
 */
export async function authorizeCredentials(
  credentials: Record<'email' | 'password', string> | undefined,
) {
  if (!credentials?.email || !credentials?.password) return null

  const identifier = credentials.email.trim().toLowerCase()

  // Heuristic: anything containing '@' = email, otherwise username.
  // Avoids two round-trips on the common (email) path.
  const user = identifier.includes('@')
    ? await prisma.user.findUnique({ where: { email: identifier } })
    : await prisma.user.findUnique({ where: { username: identifier } })

  if (!user || !user.passwordHash) {
    await logAudit({
      userEmail: identifier,
      action: 'auth.login.failure',
      metadata: { reason: 'not_found_or_oauth_only' },
    })
    return null
  }

  const valid = await bcrypt.compare(credentials.password, user.passwordHash)
  if (!valid) {
    await logAudit({
      userId: user.id,
      userEmail: user.email,
      action: 'auth.login.failure',
      metadata: { reason: 'bad_password' },
    })
    return null
  }

  await logAudit({
    userId: user.id,
    userEmail: user.email,
    action: 'auth.login.success',
  })

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  }
}

/** Exposed so the clubhouse can issue the SAME next-auth session cookie. */
export const SESSION_COOKIE_NAME = sessionCookieName
export const SESSION_COOKIE_SECURE = isSecure

export const authOptions: NextAuthOptions = {
  useSecureCookies: isSecure,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  cookies: cookieDomain
    ? {
        sessionToken: {
          name: sessionCookieName,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: isSecure,
            domain: cookieDomain,
          },
        },
      }
    : undefined,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        // The form field is still named `email` for backward compat with
        // existing client code, but it accepts either an email OR a
        // username. The login page label was updated accordingly.
        email: { label: 'Email or username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: (credentials) => authorizeCredentials(credentials),
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Initial sign-in — pull base claims off the user object
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }

      // Enrich with org context. Done on initial sign-in AND whenever the
      // session is updated (so flipping owner roles in another tab refreshes
      // here on next request). Cached on the token between requests.
      if (user || trigger === 'update' || !('organizationId' in token)) {
        try {
          const userId = (token.id as string) || (user as any)?.id
          if (userId) {
            const orgMember = await prisma.orgMember.findFirst({
              where: { userId },
              // OrgMember enum order is OWNER, ADMIN, STAFF, COACH, DOCTOR —
              // ascending sort puts the highest privilege first
              orderBy: { role: 'asc' },
              select: {
                organizationId: true,
                role: true,
                organization: { select: { name: true, slug: true, status: true } },
              },
            })
            if (orgMember) {
              token.organizationId = orgMember.organizationId
              token.organizationName = orgMember.organization.name
              token.organizationSlug = orgMember.organization.slug
              token.organizationStatus = orgMember.organization.status
              token.orgMemberRole = orgMember.role
            } else {
              token.organizationId = null
              token.organizationName = null
              token.organizationSlug = null
              token.organizationStatus = null
              token.orgMemberRole = null
            }
          }
        } catch (err) {
          console.error('JWT org-context lookup failed:', err)
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        // Mirror org context to the session so client + server components
        // can read it without extra queries
        ;(session.user as any).organizationId = (token as any).organizationId ?? null
        ;(session.user as any).organizationName = (token as any).organizationName ?? null
        ;(session.user as any).organizationSlug = (token as any).organizationSlug ?? null
        ;(session.user as any).organizationStatus = (token as any).organizationStatus ?? null
        ;(session.user as any).orgMemberRole = (token as any).orgMemberRole ?? null
      }
      return session
    },
  },
}
