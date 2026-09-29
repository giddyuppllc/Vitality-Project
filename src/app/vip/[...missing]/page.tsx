import { notFound } from 'next/navigation'

// Any clubhouse path with no page → the clubhouse 404 (never the store's).
export default function VipCatchAll() {
  notFound()
}
