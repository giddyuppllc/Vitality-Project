import type { LeadStage, LeadPriority } from '@prisma/client'

export const LEAD_STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'NEW', label: 'New', color: 'bg-white/10 text-white/70' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-brand-500/20 text-brand-400' },
  { key: 'QUALIFIED', label: 'Qualified', color: 'bg-purple-500/20 text-purple-400' },
  { key: 'PROPOSAL', label: 'Proposal', color: 'bg-amber-500/20 text-amber-400' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'bg-orange-500/20 text-orange-400' },
  { key: 'CLOSED_WON', label: 'Closed Won', color: 'bg-emerald-500/20 text-emerald-400' },
  { key: 'CLOSED_LOST', label: 'Closed Lost', color: 'bg-red-500/20 text-red-400' },
]

export const LEAD_PRIORITIES: {
  key: LeadPriority
  label: string
  badge: 'default' | 'success' | 'warning' | 'danger' | 'info'
}[] = [
  { key: 'LOW', label: 'Low', badge: 'default' },
  { key: 'NORMAL', label: 'Normal', badge: 'info' },
  { key: 'HIGH', label: 'High', badge: 'warning' },
  { key: 'URGENT', label: 'Urgent', badge: 'danger' },
]

export const LEAD_SOURCES = [
  { key: 'website', label: 'Website' },
  { key: 'website_application', label: 'Website application' },
  { key: 'affiliate_application', label: 'Affiliate application' },
  { key: 'tradeshow', label: 'Tradeshow' },
  { key: 'referral', label: 'Referral' },
  { key: 'cold_outreach', label: 'Cold outreach' },
  { key: 'inbound_email', label: 'Inbound email' },
  { key: 'partner', label: 'Partner' },
  { key: 'csv_import', label: 'CSV import' },
  { key: 'other', label: 'Other' },
]
