import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, Bookmark, CalendarDays, Compass, Dumbbell, Gift, Handshake, Home, Library, MessageCircle, MessagesSquare,
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
 *   exclude          → path prefixes owned by another item
 *
 * Every href is a real route: Fitness (/fitness, its own tabs inside),
 * Messages (/messages, social), Rewards and Partners (/rewards,
 * /rewards/partners — /partners redirects there), Discover, Saved, Events,
 * Library, Members, Profile, Settings. test/vip/nav.test.ts checks each one
 * has a page.
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
  /** Path prefixes that belong to another item (e.g. /rewards/partners → Partners). */
  exclude?: string[]
  /** One line for the More sheet. */
  hint?: string
}

export const VIP_NAV: VipNavItem[] = [
  // Mobile bottom bar — exactly five tabs (+ "More").
  { key: 'home', href: '/dashboard', label: 'Home', icon: Home, group: 'main', tab: true, match: ['/welcome'] },
  { key: 'community', href: '/feed', label: 'Community', icon: MessagesSquare, group: 'main', tab: true, community: true, match: ['/posts', '/tags'] },
  { key: 'learn', href: '/classroom', label: 'Learn', icon: BookOpen, group: 'main', tab: true, match: ['/certificate'] },
  { key: 'fitness', href: '/fitness', label: 'Fitness', icon: Dumbbell, group: 'main', tab: true },
  { key: 'rewards', href: '/rewards', label: 'Rewards', icon: Gift, group: 'main', tab: true, exclude: ['/rewards/partners'] },
  // Everything else: desktop rail "Explore" + the mobile More sheet.
  { key: 'messages', href: '/messages', label: 'Messages', icon: MessageCircle, group: 'more', community: true, badge: 'messages', hint: 'Private conversations' },
  { key: 'discover', href: '/discover', label: 'Discover', icon: Compass, group: 'more', community: true, hint: 'Trending tags and people' },
  { key: 'saved', href: '/saved', label: 'Saved', icon: Bookmark, group: 'more', community: true, hint: 'Posts you bookmarked' },
  { key: 'events', href: '/events', label: 'Events', icon: CalendarDays, group: 'more', hint: 'Live sessions and recordings' },
  { key: 'library', href: '/library', label: 'Library', icon: Library, group: 'more', hint: 'Guides, PDFs and replays' },
  { key: 'partners', href: '/rewards/partners', label: 'Partners', icon: Handshake, group: 'more', hint: 'Earn and spend points nearby' },
  { key: 'members', href: '/members', label: 'Members', icon: Users, group: 'more', community: true, hint: 'Find people in the Clubhouse' },
  { key: 'profile', href: '/profile', label: 'Profile', icon: UserRound, group: 'more', hint: 'Your photo, bio and privacy' },
  { key: 'settings', href: '/settings', label: 'Settings', icon: Settings, group: 'more', hint: 'Notifications, app and account' },
]

export function visibleNav(opts: { suspended: boolean }): VipNavItem[] {
  return VIP_NAV.filter((n) => !(opts.suspended && n.community))
}

const under = (pathname: string, p: string) => pathname === p || pathname.startsWith(`${p}/`)

export function isActive(item: Pick<VipNavItem, 'href' | 'match' | 'exclude'>, pathname: string): boolean {
  if (item.exclude?.some((p) => under(pathname, p))) return false
  return [item.href, ...(item.match ?? [])].some((p) => under(pathname, p))
}
