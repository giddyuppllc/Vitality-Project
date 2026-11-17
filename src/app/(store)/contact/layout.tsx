import type { Metadata } from 'next'

// /contact is a client component and could not set metadata, so it carried the
// homepage's title in tabs and search results.
export const metadata: Metadata = { title: 'Contact Us' }

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children
}
