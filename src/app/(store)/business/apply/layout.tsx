import type { Metadata } from 'next'

// /business/apply is a client component and could not set metadata, so it carried the
// homepage's title in tabs and search results.
export const metadata: Metadata = { title: 'Become a Partner' }

export default function PartnerApplyLayout({ children }: { children: React.ReactNode }) {
  return children
}
