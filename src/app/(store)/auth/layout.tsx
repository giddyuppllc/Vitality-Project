import type { Metadata } from 'next'

// Password-reset screens: not search landing pages.
export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false, follow: true },
}

export default function StoreAuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
