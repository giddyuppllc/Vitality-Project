import type { Metadata } from 'next'

// The membership page is a client component and could not set metadata, so
// it carried the homepage's title in tabs and search results.
export const metadata: Metadata = { title: 'Membership' }

export default function MembershipLayout({ children }: { children: React.ReactNode }) {
  return children
}
