import type { Metadata } from 'next'

// The cart page is a client component and could not set metadata, so it was
// indexable under the homepage's title and description.
export const metadata: Metadata = {
  title: 'Cart',
  robots: { index: false, follow: true },
}

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children
}
