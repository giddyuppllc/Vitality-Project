import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, CalendarDays, ClipboardCheck, Dumbbell, Gift, Handshake, Home, Library, MessageCircle, MessagesSquare,
  Settings, UserRound, Users,
} from 'lucide-react'

/**
 * Clubhouse navigation — ONE data array for the whole shell
 * (components/vip/shell.tsx renders it as the desktop left rail, the mobile
 * bottom tab bar and the mobile "More" sheet).
 *
 * Adding a section = adding one line here:
 *   tab: true        → one of the five bottom tabs on mobile (keep it at five)
 *   group            → where it sits in the desktop rail ('main' or 'more';
 *                      every non-tab item also appears in the mobile More sheet)
 *   community: true  → hidden from community-suspended members
 *   badge            → which unread counter to show ('notifications' | 'messages';
 *                      the (club) layout fills the counts)
 *   match            → extra path prefixes that light the item up
 *
 * /training, /checkin, /messages, /partners and /rewards belong to the other
 * clubhouse builders (fitness, social, rewards); they are listed here so the
 * merge only needs to add pages, not nav.
 */

export type VipNavBadge = 'notifications' | 'messages'

export interface VipNavItem {
  key: string
  href: string
  label: string
  icon: LucideIcon
  group: 'main' | 'more'
  tab?: boolean
  community?: boolean
  badge?: VipNavBadge
  match?: string[]
  /** One line for the More sheet. */
  hint?: string
}

export const VIP_NAV: VipNavItem[] = [
  { key: 'home', href: '/dashboard', label: 'Home', icon: Home, group: 'main', tab: true },
  { key: 'community', href: '/feed', label: 'Community', icon: MessagesSquare, group: 'main', tab: true, community: true, match: ['/posts'] },
  { key: 'learn', href: '/classroom', label: 'Learn', icon: BookOpen, group: 'main', tab: true, match: ['/certificate'] },
  { key: 'training', href: '/training', label: 'Training', icon: Dumbbell, group: 'main', tab: true },
  { key: 'rewards', href: '/rewards', label: 'Rewards', icon: Gift, group: 'main', tab: true },
  { key: 'checkin', href: '/checkin', label: 'Check-in', icon: ClipboardCheck, group: 'more', hint: 'Log today in a minute' },
  { key: 'events', href: '/events', label: 'Events', icon: CalendarDays, group: 'more', hint: 'Live sessions and recordings' },
  { key: 'library', href: '/library', label: 'Library', icon: Library, group: 'more', hint: 'Guides, PDFs and replays' },
  { key: 'messages', href: '/messages', label: 'Messages', icon: MessageCircle, group: 'more', community: true, badge: 'messages', hint: 'Private conversations' },
  { key: 'partners', href: '/partners', label: 'Partners', icon: Handshake, group: 'more', hint: 'The partner network' },
  { key: 'members', href: '/members', label: 'Members', icon: Users, group: 'more', community: true, hint: 'Find people in the Clubhouse' },
  { key: 'profile', href: '/profile', label: 'Profile', icon: UserRound, group: 'more', hint: 'Your photo, bio and email' },
  { key: 'settings', href: '/settings', label: 'Settings', icon: Settings, group: 'more', hint: 'Notifications, app and account' },
]

export function visibleNav(opts: { suspended: boolean }): VipNavItem[] {
  return VIP_NAV.filter((n) => !(opts.suspended && n.community))
}

export function isActive(item: Pick<VipNavItem, 'href' | 'match'>, pathname: string): boolean {
  const prefixes = [item.href, ...(item.match ?? [])]
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
