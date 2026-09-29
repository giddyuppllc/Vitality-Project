'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Save, Loader2, ShieldCheck, Eye, EyeOff } from 'lucide-react'

type Settings = {
  // General
  siteName: string
  siteEmail: string
  // Affiliate
  affiliateCookieDays: string
  defaultCommissionRate: string
  // Storefront
  freeShippingThreshold: string
  maintenanceMode: string

  // Fulfillment
  fulfillmentAutoNotify: string

  // Zelle
  zelleEmail: string
  zelleDisplayName: string
  zellePhone: string

  // ACH (recipient: customers wire to this)
  achBankName: string
  achAccountName: string
  achRouting: string
  achAccount: string

  // Wire
  wireBankName: string
  wireBeneficiary: string
  wireAccount: string
  wireRouting: string
  wireSwift: string
}

const DEFAULTS: Settings = {
  siteName: 'The Vitality Project',
  siteEmail: '',
  affiliateCookieDays: '30',
  defaultCommissionRate: '10',
  freeShippingThreshold: '',
  maintenanceMode: '',
  fulfillmentAutoNotify: '',
  zelleEmail: '',
  zelleDisplayName: 'The Vitality Project',
  zellePhone: '',
  achBankName: '',
  achAccountName: '',
  achRouting: '',
  achAccount: '',
  wireBankName: '',
  wireBeneficiary: '',
  wireAccount: '',
  wireRouting: '',
  wireSwift: '',
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [showAchAccount, setShowAchAccount] = useState(false)
  const [showWireAccount, setShowWireAccount] = useState(false)

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data: Record<string, string>) => {
        setSettings((s) => ({ ...s, ...data }))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function saveSection(sectionKey: string, keys: (keyof Settings)[]) {
    setSaving(true)
    try {
      const partial = Object.fromEntries(keys.map((k) => [k, settings[k]]))
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      if (res.ok) {
        setSavedKey(sectionKey)
        setTimeout(() => setSavedKey((k) => (k === sectionKey ? null : k)), 2200)
      }
    } finally {
      setSaving(false)
    }
  }

  const s = (field: keyof Settings) => ({
    value: settings[field] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setSettings({ ...settings, [field]: e.target.value }),
  })

  const maskAccount = (v: string) =>
    v.length <= 4 ? v : `••••••${v.slice(-4)}`

  if (loading) {
    return (
      <div className="max-w-3xl py-12 flex items-center gap-3 text-white/50">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading settings…
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-white/40 mt-1">
          Site configuration, payment details, and operational preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* General */}
        <Section
          title="General"
          subtitle="Public-facing identity"
          onSave={() => saveSection('general', ['siteName', 'siteEmail'])}
          saving={saving}
          savedNow={savedKey === 'general'}
        >
          <Input label="Site Name" {...s('siteName')} />
          <Input
            label="Contact Email"
            type="email"
            {...s('siteEmail')}
            placeholder="support@vitalityproject.global"
          />
        </Section>

        {/* Financials — Zelle */}
        <Section
          title="Payment · Zelle"
          subtitle="Customers paying by Zelle are routed to this address"
          accent
          onSave={() =>
            saveSection('zelle', ['zelleEmail', 'zelleDisplayName', 'zellePhone'])
          }
          saving={saving}
          savedNow={savedKey === 'zelle'}
        >
          <Input
            label="Display name (what customers see in their bank)"
            {...s('zelleDisplayName')}
            placeholder="The Vitality Project"
          />
          <Input
            label="Zelle email *"
            type="email"
            {...s('zelleEmail')}
            placeholder="payments@vitalityproject.global"
          />
          <Input
            label="Zelle phone (optional — banks that don't accept email)"
            type="tel"
            {...s('zellePhone')}
            placeholder="+1 555 555 5555"
          />
          <Note>
            One of <strong>email or phone</strong> must be set, and it must be
            registered with your bank for Zelle. Customers will see this on
            their order confirmation and on the in-app checkout page.
          </Note>
        </Section>

        {/* Financials — ACH */}
        <Section
          title="Payment · ACH transfer"
          subtitle="Bank routing details for direct ACH payments (B2B / wholesale)"
          accent
          onSave={() =>
            saveSection('ach', [
              'achBankName',
              'achAccountName',
              'achRouting',
              'achAccount',
            ])
          }
          saving={saving}
          savedNow={savedKey === 'ach'}
        >
          <Input
            label="Bank name"
            {...s('achBankName')}
            placeholder="Chase Business Banking"
          />
          <Input
            label="Account holder name"
            {...s('achAccountName')}
            placeholder="The Vitality Project LLC"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Routing number (9 digits)"
              {...s('achRouting')}
              placeholder="111000025"
            />
            <div className="relative">
              <Input
                label="Account number"
                type={showAchAccount ? 'text' : 'password'}
                {...s('achAccount')}
                placeholder="•••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowAchAccount((v) => !v)}
                className="absolute right-3 top-[34px] text-white/40 hover:text-white/80"
                aria-label={showAchAccount ? 'Hide' : 'Show'}
              >
                {showAchAccount ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          {settings.achAccount && !showAchAccount && (
            <p className="text-xs text-white/40">
              Stored: {maskAccount(settings.achAccount)}
            </p>
          )}
        </Section>

        {/* Financials — Wire */}
        <Section
          title="Payment · Wire transfer"
          subtitle="International or large-ticket wholesale payments"
          accent
          onSave={() =>
            saveSection('wire', [
              'wireBankName',
              'wireBeneficiary',
              'wireAccount',
              'wireRouting',
              'wireSwift',
            ])
          }
          saving={saving}
          savedNow={savedKey === 'wire'}
        >
          <Input
            label="Beneficiary (legal entity name)"
            {...s('wireBeneficiary')}
            placeholder="The Vitality Project LLC"
          />
          <Input label="Bank name" {...s('wireBankName')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Routing / ABA" {...s('wireRouting')} />
            <div className="relative">
              <Input
                label="Account number"
                type={showWireAccount ? 'text' : 'password'}
                {...s('wireAccount')}
              />
              <button
                type="button"
                onClick={() => setShowWireAccount((v) => !v)}
                className="absolute right-3 top-[34px] text-white/40 hover:text-white/80"
                aria-label={showWireAccount ? 'Hide' : 'Show'}
              >
                {showWireAccount ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <Input
            label="SWIFT / BIC (international only)"
            {...s('wireSwift')}
            placeholder="CHASUS33"
          />
        </Section>

        {/* Affiliate */}
        <Section
          title="Affiliate Program"
          subtitle="Default commission and tracking duration"
          onSave={() =>
            saveSection('affiliate', [
              'defaultCommissionRate',
              'affiliateCookieDays',
            ])
          }
          saving={saving}
          savedNow={savedKey === 'affiliate'}
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Default Commission (%)"
              type="number"
              {...s('defaultCommissionRate')}
            />
            <Input
              label="Cookie Duration (days)"
              type="number"
              {...s('affiliateCookieDays')}
            />
          </div>
        </Section>

        {/* Storefront */}
        <Section
          title="Storefront"
          subtitle="Shipping and operational toggles"
          onSave={() =>
            saveSection('storefront', [
              'freeShippingThreshold',
              'maintenanceMode',
            ])
          }
          saving={saving}
          savedNow={savedKey === 'storefront'}
        >
          <Input
            label="Free Shipping Threshold ($)"
            type="number"
            {...s('freeShippingThreshold')}
            placeholder="0 = always charge"
          />
          <label className="flex items-center gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={settings.maintenanceMode === 'true'}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  maintenanceMode: e.target.checked ? 'true' : '',
                })
              }
              className="w-4 h-4 rounded accent-brand-500"
            />
            <div>
              <p className="text-sm font-medium">Maintenance mode</p>
              <p className="text-xs text-white/40">
                Shows a maintenance page to all non-admin visitors
              </p>
            </div>
          </label>
        </Section>

        {/* Fulfillment */}
        <Section
          title="Fulfillment"
          subtitle="Drop-ship pipeline routing"
          onSave={() => saveSection('fulfillment', ['fulfillmentAutoNotify'])}
          saving={saving}
          savedNow={savedKey === 'fulfillment'}
        >
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.fulfillmentAutoNotify === 'true'}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  fulfillmentAutoNotify: e.target.checked ? 'true' : '',
                })
              }
              className="w-4 h-4 mt-0.5 rounded accent-brand-500"
            />
            <div>
              <p className="text-sm font-medium">Auto-notify supplier on payment</p>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">
                When ON, marking an order paid emails the configured supplier
                (FULFILLMENT_EMAIL) — or pushes to NetSuite if creds are set —
                with full order details for drop-shipping.
                <br />
                When OFF (current manual-fulfillment phase), Fulfillment rows
                still get created but the supplier is not notified — admin
                ships manually and receives a "ready to ship" email instead.
              </p>
            </div>
          </label>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
  accent,
  onSave,
  saving,
  savedNow,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  accent?: boolean
  onSave: () => void
  saving: boolean
  savedNow: boolean
}) {
  return (
    <div
      className={`rounded-2xl p-6 space-y-4 ${
        accent
          ? 'glass border-brand-500/30 bg-gradient-to-b from-brand-500/[0.04] to-transparent'
          : 'glass'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            {accent && (
              <ShieldCheck className="w-4 h-4 text-brand-400" />
            )}
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>
          )}
        </div>
        <Button
          onClick={onSave}
          disabled={saving}
          size="sm"
          variant={savedNow ? 'secondary' : 'primary'}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {savedNow ? 'Saved' : 'Save'}
        </Button>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs leading-relaxed text-white/50">
      {children}
    </div>
  )
}
