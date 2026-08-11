import { prisma } from '@/lib/prisma'

/**
 * Catch a near-duplicate product BEFORE it is created.
 *
 * WHY
 * The catalog grew five duplicate rows — cjc-ipa-blend / cjc-1295-ipamorelin,
 * cjc-1295-dac / cjc-1295-w-dac, recon-kit / reconstitution-kit, nad-oral /
 * nad-plus-oral, oxytocin / oxytocin-acetate — because two seeds upserted on
 * SLUG, and a slug cannot tell that two spellings are the same product.
 *
 * The seed is fixed (matches on SKU, refuses on a name clash). The ADMIN create
 * path had no such guard at all: type "CJC-1295 w/DAC" instead of
 * "CJC-1295 w/ DAC" and you get a second product, silently, with its own stock
 * and its own URL. Edward: "he and i will misspell shit accidentally — can it
 * fix the error, not make dumb shit."
 *
 * So this does not just reject. It returns the product it thinks you meant, so
 * the UI can offer to open that one instead.
 */

export interface SimilarMatch {
  id: string
  name: string
  slug: string
  sku: string | null
  status: string
  /** 0–1. 1 is an exact match once punctuation and case are ignored. */
  score: number
  reason: 'same-name' | 'same-sku' | 'near-name'
}

/** Lowercase, strip everything that is not a letter or digit. */
const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Significant words, so "CJC-1295 w/ DAC" -> ["cjc","1295","dac"]. */
const tokens = (v: string) =>
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !['the', 'and', 'with', 'for', 'mg', 'ml'].includes(t))

/** Levenshtein, capped — enough to catch a typo, cheap on short strings. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 4) return 99
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      last = tmp
    }
  }
  return prev[b.length]
}

/**
 * The existing product a new one would duplicate, or null.
 *
 * `excludeId` lets an EDIT ignore itself — otherwise renaming a product would
 * report the product as a duplicate of itself.
 */
export async function findSimilarProduct(
  name: string,
  sku?: string | null,
  excludeId?: string,
): Promise<SimilarMatch | null> {
  const all = await prisma.product.findMany({
    select: { id: true, name: true, slug: true, sku: true, status: true },
  })
  const candidates = all.filter((p) => p.id !== excludeId)

  // 1. Same SKU — the strongest signal; SKU is unique and warehouse-facing.
  if (sku) {
    const hit = candidates.find((p) => p.sku && p.sku.toLowerCase() === sku.toLowerCase())
    if (hit) return { ...hit, score: 1, reason: 'same-sku' }
  }

  // 2. Same name once punctuation and case are ignored. Catches
  //    "CJC-1295 w/DAC" vs "CJC-1295 w/ DAC".
  const key = norm(name)
  const exact = candidates.find((p) => norm(p.name) === key)
  if (exact) return { ...exact, score: 1, reason: 'same-name' }

  // 3. Near miss: every significant word matches, or one small typo.
  const mine = tokens(name)
  if (mine.length === 0) return null
  let best: SimilarMatch | null = null
  for (const p of candidates) {
    const theirs = tokens(p.name)
    if (theirs.length === 0) continue
    const shared = mine.filter((t) => theirs.includes(t)).length
    const overlap = shared / Math.max(mine.length, theirs.length)
    const dist = editDistance(key, norm(p.name))
    const typo = dist > 0 && dist <= Math.max(1, Math.floor(key.length / 8))

    // One name's words being a SUBSET of the other's. Overlap alone missed the
    // real cases here, because they differ by a single qualifying word:
    //   "CJC-1295 + Ipamorelin"  vs  "... Ipamorelin Blend"   (0.67)
    //   "Oxytocin"               vs  "Oxytocin Acetate"       (0.50)
    const subset =
      (mine.every((t) => theirs.includes(t)) || theirs.every((t) => mine.includes(t))) &&
      Math.min(mine.length, theirs.length) >= 1

    // An abbreviation of a word: "Recon Kit" vs "Reconstitution Kit". Needs
    // >=4 chars so "mg"/"ml" style fragments cannot trigger it.
    const abbrev = mine.some((a) =>
      theirs.some((b) => a !== b && a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))),
    )

    // Deliberately over-eager: this is a WARNING with a force override, so a
    // false positive costs one click while a false negative costs a duplicate
    // product with its own stock and its own URL.
    if (overlap >= 0.8 || typo || subset || (abbrev && shared >= 1)) {
      const score = Math.max(overlap, typo ? 0.9 : 0, subset ? 0.85 : 0, abbrev ? 0.7 : 0)
      if (!best || score > best.score) best = { ...p, score, reason: 'near-name' }
    }
  }
  return best
}
