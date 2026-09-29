import { redirect } from 'next/navigation'

// The .global mint side (src/app/clubhouse) sends members to /dashboard.
export default function VipDashboard() {
  redirect('/feed')
}
