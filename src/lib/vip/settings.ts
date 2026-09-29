import { prisma } from '@/lib/prisma'

/**
 * Admin-editable clubhouse + Zelle-credit settings, stored in the existing
 * `site_settings` key/value table (the same table admin → Settings uses).
 *
 * Every value here is an ASSUMPTION made 09-29 (see docs/VIP_CLUBHOUSE.md,
 * "Assumptions made 09-29") and is editable at /admin/vip/rewards. A missing
 * row means "use the default below" — nothing is written until an admin saves.
 */
export const VIP_SETTING_DEFAULTS = {
  /** Monthly reward credit expires this many months after it is issued. 0 = never. */
  'vip.rewardExpiryMonths': 12,
  /** Reply-To on every clubhouse email (sender stays noreply@vitalityproject.global). */
  'vip.emailReplyTo': 'vital@vitalityproject.global',
  /** Hour (UTC) the daily reply/mention digest goes out. 13 UTC = 9am US Eastern (EDT). */
  'vip.digestHourUtc': 13,
  /** Unpaid Zelle orders are cancelled after this many days (credit returned). 0 = never. */
  'zelle.unpaidExpiryDays': 14,
} as const

export type VipSettingKey = keyof typeof VIP_SETTING_DEFAULTS
export type VipSettings = { -readonly [K in VipSettingKey]: (typeof VIP_SETTING_DEFAULTS)[K] extends number ? number : string }

export const VIP_SETTING_KEYS = Object.keys(VIP_SETTING_DEFAULTS) as VipSettingKey[]

function coerce<K extends VipSettingKey>(key: K, raw: string | undefined): VipSettings[K] {
  const def = VIP_SETTING_DEFAULTS[key]
  if (raw === undefined) return def as VipSettings[K]
  if (typeof def === 'number') {
    const n = Number.parseInt(raw, 10)
    return (Number.isFinite(n) && n >= 0 ? n : def) as VipSettings[K]
  }
  const v = raw.trim()
  return (v || def) as VipSettings[K]
}

export async function getVipSettings(): Promise<VipSettings> {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: VIP_SETTING_KEYS } } })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as Record<string, unknown>
  for (const k of VIP_SETTING_KEYS) out[k] = coerce(k, map.get(k))
  return out as VipSettings
}

export async function getVipSetting<K extends VipSettingKey>(key: K): Promise<VipSettings[K]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: key as string } })
  return coerce(key, row?.value)
}

export async function setVipSettings(values: Partial<VipSettings>): Promise<void> {
  for (const k of VIP_SETTING_KEYS) {
    const v = values[k]
    if (v === undefined) continue
    await prisma.siteSetting.upsert({
      where: { key: k },
      update: { value: String(v) },
      create: { key: k, value: String(v) },
    })
  }
}
