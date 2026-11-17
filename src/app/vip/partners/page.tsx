import { redirect } from 'next/navigation'

/** Members' partner directory lives under Rewards; staff use /partners/portal. */
export default function PartnersIndex() {
  redirect('/rewards/partners')
}
