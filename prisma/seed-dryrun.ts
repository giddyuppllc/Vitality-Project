/**
 * Dry run for seed-vitality-catalog's identity resolution.
 *
 * Answers, WITHOUT writing anything: for each catalog entry, would the seed
 * UPDATE an existing row, CREATE a new one, or be REFUSED by the duplicate
 * guard?
 *
 * Worth having because the seed runs on every deploy, and "it typechecks" says
 * nothing about whether it is about to create 58 duplicates.
 *
 * It PARSES the seed file rather than importing it. Importing would execute the
 * module's `main()` at the bottom — i.e. run the real seed against production,
 * which is the opposite of a dry run.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Each `{ slug: "x", name: "y", … variants: [{ … sku: "Z" …`, in order. */
function parseCatalog(src: string) {
  const out: { slug: string; name: string; sku: string | null }[] = []
  const re = /\{\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)"([\s\S]*?)variants:\s*\[([\s\S]*?)\n\s*\],/g
  for (const m of src.matchAll(re)) {
    const firstSku = m[4].match(/sku:\s*"([^"]+)"/)
    out.push({ slug: m[1], name: m[2], sku: firstSku ? firstSku[1] : null })
  }
  return out
}

async function main() {
  const whole = readFileSync(join(__dirname, 'seed-vitality-catalog.ts'), 'utf8')
  // Slice to the PRODUCTS array ONLY. v1 of this parser matched the CATEGORIES
  // array too — those also look like `{ slug: "…", name: "…" }` — and then
  // greedily reached down to the first `variants:` block far below, inventing a
  // product called "Repair & Recovery" carrying Retatrutide's SKU. A parser
  // that hallucinates a row is worse than no dry run at all.
  const start = whole.indexOf('const PRODUCTS')
  const src = start >= 0 ? whole.slice(start) : whole
  const PRODUCTS = parseCatalog(src)

  // Positive control: this catalog has ~58 entries. A parse that finds a
  // handful would produce a reassuring, meaningless report.
  if (PRODUCTS.length < 40) {
    console.error(`✗ SELF-CHECK FAILED — parsed only ${PRODUCTS.length} catalog entries (expected ~58).`)
    process.exit(2)
  }

  const all = await prisma.product.findMany({ select: { id: true, name: true, slug: true, sku: true } })
  const bySku = new Map(all.filter((p) => p.sku).map((p) => [p.sku as string, p]))
  const bySlug = new Map(all.map((p) => [p.slug, p]))

  let skuHit = 0, slugHit = 0
  const creates: string[] = []
  const refusals: string[] = []

  for (const p of PRODUCTS) {
    if (p.sku && bySku.has(p.sku)) { skuHit++; continue }
    if (bySlug.has(p.slug)) { slugHit++; continue }
    const clash = all.find((r) => key(r.name) === key(p.name))
    if (clash) refusals.push(`  REFUSE  ${p.name} (${p.slug} / ${p.sku ?? '—'})  ->  existing ${clash.slug} (${clash.sku ?? '—'})`)
    else creates.push(`  CREATE  ${p.name} (${p.slug} / ${p.sku ?? '—'})`)
  }

  console.log(`\ncatalog entries parsed: ${PRODUCTS.length}   products in DB: ${all.length}\n`)
  console.log(`  matched by SKU   : ${skuHit}`)
  console.log(`  matched by slug  : ${slugHit}`)
  console.log(`  would CREATE     : ${creates.length}`)
  console.log(`  would be REFUSED : ${refusals.length}\n`)
  if (refusals.length) console.log(refusals.join('\n'))
  if (creates.length) console.log(creates.join('\n'))
}

main().finally(() => prisma.$disconnect())
