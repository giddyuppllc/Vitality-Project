import { UserSquare } from 'lucide-react'
import { LeadImportForm } from '@/components/admin/lead-import-form'

export default function LeadImportPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserSquare className="w-6 h-6 text-brand-400" /> Import Leads
        </h1>
        <p className="text-white/40 mt-1">
          Bulk-add leads into the sales pipeline from a CSV file.
        </p>
      </div>

      <LeadImportForm />
    </div>
  )
}
