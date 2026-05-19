// ──────────────────────────────────────────────────────────────────────
// Vitality Project — supplier-confirmed catalog seed (2026-04-29)
//
// Source: AgeREcode Order Form 2026, Product Checklist tab. Of the 84
// products on the form, 63 were marked Y for supply. This script seeds
// those 63 into the Postgres `products` + `product_variants` tables,
// grouped under categories that match the form's structure.
//
// Pricing rule: wholesale (cost) and B2C (price) come straight from the
// form. All margins are 50%. Inventory starts at 0 — track inventory
// stays on so admin can restock through the UI.
//
// Run:  pnpm prisma db seed -- --file=prisma/seed-vitality-catalog.ts
//   or: npx tsx prisma/seed-vitality-catalog.ts
//
// Idempotent — uses upsert on slug for both categories and products,
// and on (productId, name) for variants. Safe to re-run.
// ──────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env.local first (it overrides .env), then .env as fallback.
config({ path: path.resolve(__dirname, "..", ".env.local") });
config({ path: path.resolve(__dirname, "..", ".env") });

import { PrismaClient, ProductStatus } from "@prisma/client";

const prisma = new PrismaClient();

const dollars = (n: number) => Math.round(n * 100); // cents

// ─── Category definitions ─────────────────────────────────────────────
const CATEGORIES: Array<{ slug: string; name: string; description: string }> = [
  { slug: "repair-recovery",     name: "Repair & Recovery",     description: "Research compounds studied for tissue repair and recovery" },
  { slug: "body-composition",    name: "Body Composition",      description: "GLP-1 and metabolic peptides for body composition optimization" },
  { slug: "longevity-aesthetics", name: "Longevity & Aesthetics", description: "Cellular longevity and skin health" },
  { slug: "neuro-mood",          name: "Neuro & Mood",          description: "Cognitive function and mood regulation" },
  { slug: "sexual-health",       name: "Sexual Health",         description: "Libido and sexual response research peptides" },
  { slug: "growth-performance",  name: "Growth & Performance",  description: "Growth hormone secretagogues and performance peptides" },
  { slug: "topicals-serums",     name: "Topicals & Serums",     description: "Topical creams and serums for skin and recovery" },
  { slug: "oral-capsules",       name: "Oral Capsules",         description: "Bioavailable oral formulations" },
  { slug: "supplies",            name: "Supplies",              description: "Bacteriostatic water, syringes, and reconstitution kits" },
];

// ─── Products + variants ──────────────────────────────────────────────
type Variant = { name: string; cost: number; price: number; sku: string };
type ProductSeed = {
  slug: string;
  name: string;
  shortDesc: string;
  description: string;
  categorySlug: string;
  tags: string[];
  variants: Variant[];
};

const PRODUCTS: ProductSeed[] = [
  // ── Body Composition: GLP-1 (Retatrutide-only play) + Tesamorelin ───
  {
    slug: "retatrutide",
    name: "Retatrutide",
    shortDesc: "Triple agonist GLP-1/GIP/Glucagon — next-gen weight management research",
    description: "Triple-receptor agonist studied for body composition and metabolic regulation. Available across a range of strengths to fit research protocols.",
    categorySlug: "body-composition",
    tags: ["peptide", "glp1", "weight-management", "retatrutide"],
    variants: [
      { name: "5 mg",  sku: "VP-RETA-5MG",  cost: dollars(21.00), price: dollars(42)  },
      { name: "10 mg", sku: "VP-RETA-10MG", cost: dollars(32.75), price: dollars(66)  },
      { name: "30 mg", sku: "VP-RETA-30MG", cost: dollars(71.00), price: dollars(142) },
      { name: "50 mg", sku: "VP-RETA-50MG", cost: dollars(82.25), price: dollars(165) },
      { name: "60 mg", sku: "VP-RETA-60MG", cost: dollars(110.00),price: dollars(220) },
    ],
  },
  {
    slug: "tesamorelin",
    name: "Tesamorelin",
    shortDesc: "GHRH analogue — visceral adiposity research",
    description: "Synthetic growth hormone-releasing hormone analogue studied for visceral fat reduction.",
    categorySlug: "body-composition",
    tags: ["peptide", "ghrh", "tesamorelin"],
    variants: [
      { name: "10 mg", sku: "VP-TESA-10MG", cost: dollars(75.00), price: dollars(150) },
    ],
  },

  // ── Repair & Recovery ──────────────────────────────────────────────
  {
    slug: "bpc-157",
    name: "BPC-157",
    shortDesc: "Body Protective Compound — tissue repair pathway research",
    description: "Synthetic 15-amino-acid peptide derived from a protective protein in the stomach. Studied for tissue repair, gut lining integrity, and angiogenesis.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "bpc157", "recovery", "gut"],
    variants: [
      { name: "10 mg", sku: "VP-BPC-10MG", cost: dollars(40.00), price: dollars(80) },
    ],
  },
  {
    slug: "tb-500",
    name: "TB-500 (Thymosin β4)",
    shortDesc: "Thymosin Beta-4 fragment — muscle and soft tissue research",
    description: "Synthetic Thymosin Beta-4 studied for muscle fiber repair, mobility, and angiogenesis.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "tb500", "thymosin", "recovery"],
    variants: [
      { name: "5 mg",  sku: "VP-TB500-5MG",  cost: dollars(35.00), price: dollars(70)  },
      { name: "10 mg", sku: "VP-TB500-10MG", cost: dollars(60.00), price: dollars(120) },
    ],
  },
  {
    slug: "kpv",
    name: "KPV",
    shortDesc: "α-MSH C-terminal tripeptide — anti-inflammatory pathway research",
    description: "Tripeptide fragment of α-melanocyte-stimulating hormone studied for inflammatory pathway modulation.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "kpv", "anti-inflammatory"],
    variants: [
      { name: "10 mg", sku: "VP-KPV-10MG", cost: dollars(40.00), price: dollars(80) },
    ],
  },
  {
    slug: "larazatide",
    name: "Larazatide",
    shortDesc: "Tight junction modulator — intestinal permeability research",
    description: "Octapeptide studied for tight junction regulation and intestinal barrier integrity.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "larazatide", "gut"],
    variants: [
      { name: "5 mg", sku: "VP-LARA-5MG", cost: dollars(37.50), price: dollars(75) },
    ],
  },
  {
    slug: "ll-37",
    name: "LL-37 (Cathelicidin)",
    shortDesc: "Antimicrobial peptide — innate immunity research",
    description: "Human cathelicidin antimicrobial peptide studied for innate immune response.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "ll37", "cathelicidin", "antimicrobial"],
    variants: [
      { name: "5 mg",  sku: "VP-LL37-5MG",  cost: dollars(30.00), price: dollars(60) },
      { name: "10 mg", sku: "VP-LL37-10MG", cost: dollars(44.00), price: dollars(88) },
    ],
  },
  {
    slug: "pe-22-28",
    name: "PE-22-28",
    shortDesc: "Spadin analogue — neurogenesis and mood pathway research",
    description: "Spadin-derived peptide studied for TREK-1 channel modulation and depression-related pathways.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "pe22-28", "mood"],
    variants: [
      { name: "5 mg", sku: "VP-PE2228-5MG", cost: dollars(24.00), price: dollars(48) },
    ],
  },
  {
    slug: "ghk-cu",
    name: "GHK-Cu",
    shortDesc: "Copper peptide — skin and systemic regenerative research",
    description: "Tripeptide-copper complex studied for collagen biosynthesis, hair follicle biology, and antioxidant pathways.",
    categorySlug: "repair-recovery",
    tags: ["peptide", "ghkcu", "copper", "skin"],
    variants: [
      { name: "50 mg",  sku: "VP-GHKCU-50MG",  cost: dollars(25.00), price: dollars(50)  },
      { name: "200 mg", sku: "VP-GHKCU-200MG", cost: dollars(65.00), price: dollars(130) },
    ],
  },

  // ── Longevity & Aesthetics ─────────────────────────────────────────
  {
    slug: "nad-plus",
    name: "NAD+",
    shortDesc: "Nicotinamide adenine dinucleotide — cellular energy and longevity research",
    description: "NAD+ is a coenzyme central to mitochondrial function and DNA repair. Studied across multiple longevity pathways.",
    categorySlug: "longevity-aesthetics",
    tags: ["nad", "longevity", "mitochondria"],
    variants: [
      { name: "100 mg",  sku: "VP-NAD-100MG",  cost: dollars(13.00), price: dollars(26) },
      { name: "500 mg",  sku: "VP-NAD-500MG",  cost: dollars(30.00), price: dollars(60) },
      { name: "1000 mg", sku: "VP-NAD-1000MG", cost: dollars(35.00), price: dollars(70) },
    ],
  },
  {
    slug: "mots-c",
    name: "MOTS-c",
    shortDesc: "Mitochondrial-derived peptide — metabolic homeostasis research",
    description: "Mitochondrial open reading frame peptide studied for insulin sensitivity and metabolic regulation.",
    categorySlug: "longevity-aesthetics",
    tags: ["peptide", "motsc", "mitochondria", "longevity"],
    variants: [
      { name: "10 mg", sku: "VP-MOTS-10MG", cost: dollars(24.75), price: dollars(50)  },
      { name: "40 mg", sku: "VP-MOTS-40MG", cost: dollars(65.25), price: dollars(131) },
    ],
  },
  {
    slug: "ss-31",
    name: "SS-31 (Elamipretide)",
    shortDesc: "Mitochondrial-targeted tetrapeptide — cardiolipin protection research",
    description: "Cell-permeable peptide that selectively targets cardiolipin on the inner mitochondrial membrane.",
    categorySlug: "longevity-aesthetics",
    tags: ["peptide", "ss31", "elamipretide", "mitochondria"],
    variants: [
      { name: "10 mg", sku: "VP-SS31-10MG", cost: dollars(55.00),  price: dollars(110) },
      { name: "50 mg", sku: "VP-SS31-50MG", cost: dollars(100.00), price: dollars(200) },
    ],
  },
  {
    slug: "humanin",
    name: "Humanin",
    shortDesc: "Mitochondrial-derived peptide — cytoprotective research",
    description: "Small mitochondrial peptide studied for cytoprotective and metabolic regulation pathways.",
    categorySlug: "longevity-aesthetics",
    tags: ["peptide", "humanin", "mitochondria"],
    variants: [
      { name: "10 mg", sku: "VP-HUMA-10MG", cost: dollars(45.00), price: dollars(90) },
    ],
  },
  {
    slug: "pinealon",
    name: "Pinealon",
    shortDesc: "Tripeptide bioregulator — pineal gland research",
    description: "Synthetic tripeptide bioregulator (Glu-Asp-Arg) studied for cognitive function and pineal pathway research.",
    categorySlug: "longevity-aesthetics",
    tags: ["peptide", "pinealon", "bioregulator"],
    variants: [
      { name: "10 mg", sku: "VP-PINE-10MG", cost: dollars(23.00), price: dollars(46) },
      { name: "20 mg", sku: "VP-PINE-20MG", cost: dollars(31.50), price: dollars(63) },
    ],
  },
  {
    slug: "epithalon",
    name: "Epithalon",
    shortDesc: "Tetrapeptide bioregulator — telomerase research",
    description: "Synthetic tetrapeptide (Ala-Glu-Asp-Gly) studied for telomerase activation and circadian regulation.",
    categorySlug: "longevity-aesthetics",
    tags: ["peptide", "epithalon", "telomere", "longevity"],
    variants: [
      { name: "10 mg", sku: "VP-EPIT-10MG", cost: dollars(22.00), price: dollars(44) },
      { name: "20 mg", sku: "VP-EPIT-20MG", cost: dollars(35.00), price: dollars(70) },
    ],
  },

  // ── Neuro & Mood ───────────────────────────────────────────────────
  {
    slug: "semax",
    name: "Semax",
    shortDesc: "ACTH-derived heptapeptide — neuroprotection research",
    description: "Synthetic ACTH(4-7) analogue studied for cognitive function and neuroprotection.",
    categorySlug: "neuro-mood",
    tags: ["peptide", "semax", "nootropic"],
    variants: [
      { name: "10 mg", sku: "VP-SEMA-10MG", cost: dollars(20.25), price: dollars(41) },
    ],
  },
  {
    slug: "selank",
    name: "Selank",
    shortDesc: "Tuftsin analogue — anxiolytic pathway research",
    description: "Synthetic heptapeptide based on the immunomodulatory peptide tuftsin.",
    categorySlug: "neuro-mood",
    tags: ["peptide", "selank", "anxiolytic"],
    variants: [
      { name: "10 mg", sku: "VP-SELA-10MG", cost: dollars(22.50), price: dollars(45) },
    ],
  },
  {
    slug: "dihexa",
    name: "Dihexa",
    shortDesc: "Angiotensin IV analogue — synaptogenesis research",
    description: "Hexapeptide studied for hepatocyte growth factor pathway and synapse formation.",
    categorySlug: "neuro-mood",
    tags: ["peptide", "dihexa", "nootropic"],
    variants: [
      { name: "5 mg", sku: "VP-DIHX-5MG", cost: dollars(35.00), price: dollars(70) },
    ],
  },
  {
    slug: "cortexin",
    name: "Cortexin",
    shortDesc: "Neuropeptide complex — cortical function research",
    description: "Polypeptide complex from bovine cortical tissue studied for neurotrophic effects.",
    categorySlug: "neuro-mood",
    tags: ["peptide", "cortexin", "nootropic"],
    variants: [
      { name: "10 mg", sku: "VP-CORT-10MG", cost: dollars(28.00), price: dollars(56) },
    ],
  },

  // ── Sexual Health ──────────────────────────────────────────────────
  {
    slug: "pt-141",
    name: "PT-141 (Bremelanotide)",
    shortDesc: "Melanocortin receptor agonist — sexual response research",
    description: "Cyclic heptapeptide melanocortin receptor agonist studied for sexual response pathways.",
    categorySlug: "sexual-health",
    tags: ["peptide", "pt141", "bremelanotide"],
    variants: [
      { name: "10 mg", sku: "VP-PT141-10MG", cost: dollars(24.00), price: dollars(48) },
    ],
  },
  {
    slug: "melanotan-2",
    name: "Melanotan-2",
    shortDesc: "Synthetic α-MSH analogue — pigmentation research",
    description: "Cyclic lactam melanocortin agonist studied for skin pigmentation and libido pathways.",
    categorySlug: "sexual-health",
    tags: ["peptide", "melanotan", "mt2"],
    variants: [
      { name: "10 mg", sku: "VP-MT2-10MG", cost: dollars(15.75), price: dollars(32) },
    ],
  },
  {
    slug: "melanotan-1",
    name: "Melanotan-1",
    shortDesc: "Linear α-MSH analogue — controlled pigmentation research",
    description: "Linear synthetic analogue of α-MSH with greater receptor selectivity than Melanotan-2.",
    categorySlug: "sexual-health",
    tags: ["peptide", "melanotan", "mt1"],
    variants: [
      { name: "10 mg", sku: "VP-MT1-10MG", cost: dollars(17.00), price: dollars(34) },
    ],
  },
  {
    slug: "oxytocin-acetate",
    name: "Oxytocin Acetate",
    shortDesc: "Nonapeptide — social bonding and reproductive physiology research",
    description: "Synthetic acetate salt of the nonapeptide hormone oxytocin.",
    categorySlug: "sexual-health",
    tags: ["peptide", "oxytocin"],
    variants: [
      { name: "2 mg", sku: "VP-OXY-2MG", cost: dollars(13.50), price: dollars(27) },
    ],
  },

  // ── Growth & Performance ───────────────────────────────────────────
  {
    slug: "sermorelin",
    name: "Sermorelin",
    shortDesc: "GHRH(1-29) analogue — natural GH pulse research",
    description: "Synthetic 29-amino-acid analogue of growth hormone-releasing hormone.",
    categorySlug: "growth-performance",
    tags: ["peptide", "sermorelin", "ghrh"],
    variants: [
      { name: "5 mg",  sku: "VP-SERM-5MG",  cost: dollars(23.75), price: dollars(48) },
      { name: "10 mg", sku: "VP-SERM-10MG", cost: dollars(37.00), price: dollars(74) },
    ],
  },
  {
    slug: "cjc-1295-no-dac",
    name: "CJC-1295 (no DAC)",
    shortDesc: "Modified GRF 1-29 — short half-life GH releasing research",
    description: "Modified GRF(1-29) without drug-affinity complex — pulsatile GH release pathway research.",
    categorySlug: "growth-performance",
    tags: ["peptide", "cjc1295", "ghrh"],
    variants: [
      { name: "5 mg", sku: "VP-CJCND-5MG", cost: dollars(22.00), price: dollars(44) },
    ],
  },
  {
    slug: "cjc-1295-w-dac",
    name: "CJC-1295 w/ DAC",
    shortDesc: "DAC-conjugated GHRH — extended half-life research",
    description: "CJC-1295 with drug-affinity complex for sustained plasma half-life via albumin binding.",
    categorySlug: "growth-performance",
    tags: ["peptide", "cjc1295", "ghrh", "dac"],
    variants: [
      { name: "5 mg", sku: "VP-CJCDAC-5MG", cost: dollars(28.00), price: dollars(56) },
    ],
  },
  {
    slug: "ipamorelin",
    name: "Ipamorelin",
    shortDesc: "Selective GH secretagogue — clean targeted pulse research",
    description: "Pentapeptide growth hormone secretagogue with minimal effect on cortisol or prolactin.",
    categorySlug: "growth-performance",
    tags: ["peptide", "ipamorelin"],
    variants: [
      { name: "5 mg", sku: "VP-IPA-5MG", cost: dollars(20.00), price: dollars(40) },
    ],
  },
  {
    slug: "cjc-1295-ipamorelin",
    name: "CJC-1295 + Ipamorelin",
    shortDesc: "Combined GHRH + GH secretagogue research blend",
    description: "Pre-blended CJC-1295 (no DAC) and Ipamorelin for synergistic GH pulse research.",
    categorySlug: "growth-performance",
    tags: ["peptide", "cjc1295", "ipamorelin", "blend"],
    variants: [
      { name: "5 / 5 mg", sku: "VP-CJCIPA-55MG", cost: dollars(38.00), price: dollars(76) },
    ],
  },
  {
    slug: "ghrp-2",
    name: "GHRP-2",
    shortDesc: "Growth hormone releasing peptide-2 — secretagogue research",
    description: "Synthetic hexapeptide ghrelin agonist and growth hormone secretagogue.",
    categorySlug: "growth-performance",
    tags: ["peptide", "ghrp2"],
    variants: [
      { name: "5 mg", sku: "VP-GHRP2-5MG", cost: dollars(18.00), price: dollars(36) },
    ],
  },
  {
    slug: "ghrp-6",
    name: "GHRP-6",
    shortDesc: "Growth hormone releasing peptide-6 — secretagogue research",
    description: "Synthetic hexapeptide GH secretagogue with appetite-stimulating activity.",
    categorySlug: "growth-performance",
    tags: ["peptide", "ghrp6"],
    variants: [
      { name: "5 mg", sku: "VP-GHRP6-5MG", cost: dollars(18.00), price: dollars(36) },
    ],
  },
  {
    slug: "hexarelin",
    name: "Hexarelin",
    shortDesc: "Potent ghrelin analogue — GH releasing research",
    description: "Hexapeptide ghrelin receptor agonist with potent growth hormone releasing activity.",
    categorySlug: "growth-performance",
    tags: ["peptide", "hexarelin"],
    variants: [
      { name: "5 mg", sku: "VP-HEXA-5MG", cost: dollars(25.00), price: dollars(50) },
    ],
  },
  {
    slug: "follistatin-344",
    name: "Follistatin 344",
    shortDesc: "Myostatin inhibitor — muscle pathway research",
    description: "Synthetic protein studied for myostatin inhibition and muscle growth pathway research.",
    categorySlug: "growth-performance",
    tags: ["peptide", "follistatin", "myostatin"],
    variants: [
      { name: "1 mg", sku: "VP-FOLLI-1MG", cost: dollars(75.00), price: dollars(150) },
    ],
  },
  {
    slug: "mgf",
    name: "MGF (Mechano Growth Factor)",
    shortDesc: "IGF-1 splice variant — muscle repair research",
    description: "IGF-1Ec splice variant studied for satellite cell activation and skeletal muscle repair.",
    categorySlug: "growth-performance",
    tags: ["peptide", "mgf", "igf1"],
    variants: [
      { name: "2 mg", sku: "VP-MGF-2MG", cost: dollars(24.00), price: dollars(48) },
    ],
  },

  // ── Metabolism (folded into Body Composition) ──────────────────────
  {
    slug: "l-carnitine",
    name: "L-Carnitine",
    shortDesc: "Quaternary ammonium compound — fatty acid transport research",
    description: "L-Carnitine 600 mg/mL injectable solution studied for fatty acid β-oxidation pathways.",
    categorySlug: "body-composition",
    tags: ["lcarnitine", "metabolism"],
    variants: [
      { name: "600 mg/mL · 10 mL", sku: "VP-LCAR-10ML", cost: dollars(18.50), price: dollars(37) },
    ],
  },
  {
    slug: "lc120",
    name: "LC120",
    shortDesc: "Lipotropic blend — metabolic support research",
    description: "Pre-formulated lipotropic injection blend for metabolic research.",
    categorySlug: "body-composition",
    tags: ["lipotropic", "metabolism"],
    variants: [
      { name: "10 mL", sku: "VP-LC120-10ML", cost: dollars(21.50), price: dollars(43) },
    ],
  },
  {
    slug: "lc216",
    name: "LC216",
    shortDesc: "Lipotropic blend — extended formulation research",
    description: "Extended lipotropic injection blend for metabolic research.",
    categorySlug: "body-composition",
    tags: ["lipotropic", "metabolism"],
    variants: [
      { name: "10 mL", sku: "VP-LC216-10ML", cost: dollars(21.50), price: dollars(43) },
    ],
  },

  // ── Topicals & Serums ──────────────────────────────────────────────
  {
    slug: "ghk-cu-serum",
    name: "GHK-Cu Serum",
    shortDesc: "Topical copper peptide serum — skin research",
    description: "30 mL topical serum formulated with GHK-Cu for skin matrix research.",
    categorySlug: "topicals-serums",
    tags: ["topical", "ghkcu", "skin"],
    variants: [
      { name: "30 mL", sku: "VP-GHKSER-30ML", cost: dollars(45.00), price: dollars(90) },
    ],
  },
  {
    slug: "egf-serum",
    name: "EGF Serum",
    shortDesc: "Epidermal growth factor topical — skin renewal research",
    description: "30 mL topical serum with epidermal growth factor for skin renewal research.",
    categorySlug: "topicals-serums",
    tags: ["topical", "egf", "skin"],
    variants: [
      { name: "30 mL", sku: "VP-EGF-30ML", cost: dollars(38.00), price: dollars(76) },
    ],
  },
  {
    slug: "kpv-cream",
    name: "KPV Cream",
    shortDesc: "Topical KPV — skin and inflammatory pathway research",
    description: "30 g topical cream formulated with KPV peptide.",
    categorySlug: "topicals-serums",
    tags: ["topical", "kpv", "skin"],
    variants: [
      { name: "30 g", sku: "VP-KPVCR-30G", cost: dollars(40.00), price: dollars(80) },
    ],
  },
  {
    slug: "bpc-157-topical",
    name: "BPC-157 Topical",
    shortDesc: "Topical BPC-157 — local tissue repair research",
    description: "30 mL topical formulation of BPC-157 for localized tissue research.",
    categorySlug: "topicals-serums",
    tags: ["topical", "bpc157"],
    variants: [
      { name: "30 mL", sku: "VP-BPCTOP-30ML", cost: dollars(42.00), price: dollars(84) },
    ],
  },

  // ── Oral Capsules ──────────────────────────────────────────────────
  {
    slug: "semaglutide-oral",
    name: "Semaglutide Oral",
    shortDesc: "Oral GLP-1 capsules — bioavailable formulation research",
    description: "1 mg oral semaglutide capsules, 30-count bottle.",
    categorySlug: "oral-capsules",
    tags: ["oral", "semaglutide", "glp1"],
    variants: [
      { name: "1 mg × 30 ct", sku: "VP-SEMAOR-30CT", cost: dollars(55.00), price: dollars(110) },
    ],
  },
  {
    slug: "nad-plus-oral",
    name: "NAD+ Oral",
    shortDesc: "Bioavailable NAD+ capsules — convenience research formulation",
    description: "500 mg NAD+ oral capsules, 30-count bottle.",
    categorySlug: "oral-capsules",
    tags: ["oral", "nad", "longevity"],
    variants: [
      { name: "500 mg × 30 ct", sku: "VP-NADOR-30CT", cost: dollars(28.00), price: dollars(56) },
    ],
  },
  {
    slug: "metformin",
    name: "Metformin",
    shortDesc: "Biguanide — glucose homeostasis and longevity research",
    description: "500 mg metformin tablets, 60-count bottle.",
    categorySlug: "oral-capsules",
    tags: ["oral", "metformin"],
    variants: [
      { name: "500 mg × 60 ct", sku: "VP-MET-60CT", cost: dollars(15.00), price: dollars(30) },
    ],
  },
  {
    slug: "berberine",
    name: "Berberine",
    shortDesc: "Plant alkaloid — AMPK activation research",
    description: "500 mg berberine capsules, 60-count bottle.",
    categorySlug: "oral-capsules",
    tags: ["oral", "berberine"],
    variants: [
      { name: "500 mg × 60 ct", sku: "VP-BERB-60CT", cost: dollars(12.00), price: dollars(24) },
    ],
  },
  {
    slug: "rapamycin",
    name: "Rapamycin",
    shortDesc: "mTOR inhibitor — cellular senescence research",
    description: "1 mg rapamycin capsules, 30-count bottle.",
    categorySlug: "oral-capsules",
    tags: ["oral", "rapamycin", "longevity", "mtor"],
    variants: [
      { name: "1 mg × 30 ct", sku: "VP-RAPA-30CT", cost: dollars(45.00), price: dollars(90) },
    ],
  },

  // ── Supplies ───────────────────────────────────────────────────────
  {
    slug: "bacteriostatic-water",
    name: "Bacteriostatic Water",
    shortDesc: "0.9% benzyl alcohol — peptide reconstitution",
    description: "30 mL multi-dose bacteriostatic water with 0.9% benzyl alcohol preservative.",
    categorySlug: "supplies",
    tags: ["supplies", "bacwater"],
    variants: [
      { name: "30 mL", sku: "VP-BACW-30ML", cost: dollars(4.50), price: dollars(9) },
    ],
  },
  {
    slug: "insulin-syringes",
    name: "Insulin Syringes",
    shortDesc: "Sterile single-use insulin syringes",
    description: "100-count box of sterile single-use insulin syringes.",
    categorySlug: "supplies",
    tags: ["supplies", "syringe"],
    variants: [
      { name: "100 ct", sku: "VP-SYR-100CT", cost: dollars(8.00), price: dollars(16) },
    ],
  },
  {
    slug: "alcohol-swabs",
    name: "Alcohol Swabs",
    shortDesc: "Sterile 70% isopropyl alcohol prep pads",
    description: "200-count box of sterile single-use 70% isopropyl alcohol prep pads.",
    categorySlug: "supplies",
    tags: ["supplies", "swab"],
    variants: [
      { name: "200 ct", sku: "VP-SWAB-200CT", cost: dollars(5.00), price: dollars(10) },
    ],
  },
  {
    slug: "reconstitution-kit",
    name: "Reconstitution Kit",
    shortDesc: "Complete kit for sterile peptide reconstitution",
    description: "5-pack reconstitution kit including bacteriostatic water, syringes, swabs, and instructions.",
    categorySlug: "supplies",
    tags: ["supplies", "kit", "reconstitution"],
    variants: [
      { name: "5 pack", sku: "VP-RECONKIT-5PK", cost: dollars(12.00), price: dollars(24) },
    ],
  },
];

async function main() {
  console.log("🌱 Seeding Vitality catalog (63 supplier-confirmed products)...\n");

  // Categories — both `name` and `slug` are unique. Look up by either,
  // update or create accordingly.
  const categoryRows: Record<string, string> = {};
  for (const c of CATEGORIES) {
    let row = await prisma.category.findFirst({
      where: { OR: [{ slug: c.slug }, { name: c.name }] },
    });
    if (row) {
      row = await prisma.category.update({
        where: { id: row.id },
        data: { name: c.name, slug: c.slug, description: c.description },
      });
    } else {
      row = await prisma.category.create({ data: c });
    }
    categoryRows[c.slug] = row.id;
  }
  console.log(`✅ ${CATEGORIES.length} categories ready`);

  let prodCount = 0;
  let varCount = 0;

  for (const p of PRODUCTS) {
    const categoryId = categoryRows[p.categorySlug];
    if (!categoryId) {
      console.error(`✗ ${p.slug}: unknown category ${p.categorySlug}`);
      continue;
    }

    // Lowest variant price = display price for the product card
    const minPrice = Math.min(...p.variants.map((v) => v.price));
    const minCost  = Math.min(...p.variants.map((v) => v.cost));

    // IMPORTANT: this seed is idempotent BY DEFAULT — no admin changes
    // (price tweaks, status archives, new variants added in /admin/products)
    // are clobbered by a re-run. Set SEED_FORCE=1 to do a full reset back
    // to the values in this file. See plan: "Kill the 'old products
    // reappear' problem at every layer", 2026-05-18.
    const force = process.env.SEED_FORCE === '1';

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      // Default mode: empty update — preserve every admin-set field.
      // Force mode: full overwrite to match this seed file.
      update: force
        ? {
            name: p.name,
            shortDesc: p.shortDesc,
            description: p.description,
            categoryId,
            price: minPrice,
            cost: minCost,
            status: ProductStatus.ACTIVE,
            tags: p.tags,
          }
        : {},
      // First-time creation: status DRAFT so an admin must explicitly
      // activate. Stops new seed entries from auto-publishing without review.
      create: {
        slug: p.slug,
        name: p.name,
        shortDesc: p.shortDesc,
        description: p.description,
        categoryId,
        price: minPrice,
        cost: minCost,
        status: force ? ProductStatus.ACTIVE : ProductStatus.DRAFT,
        tags: p.tags,
        sku: p.variants[0].sku,
      },
    });
    prodCount++;

    // Variants: NEVER delete existing ones (an admin may have added the
    // 20 mg variant or tuned a price). Upsert by SKU instead — create
    // missing rows; preserve existing rows' prices/inventory unless
    // SEED_FORCE=1, in which case we overwrite the price back to the
    // seed file value (inventory left alone always — that's a live
    // operational flag).
    for (const v of p.variants) {
      const existing = v.sku
        ? await prisma.productVariant.findFirst({
            where: { sku: v.sku },
          })
        : await prisma.productVariant.findFirst({
            where: { productId: product.id, name: v.name },
          });
      if (existing) {
        if (force) {
          await prisma.productVariant.update({
            where: { id: existing.id },
            data: { price: v.price, name: v.name },
          });
        }
        // Default mode: leave existing variant entirely alone.
      } else {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            name: v.name,
            sku: v.sku,
            price: v.price,
            inventory: 0,
          },
        });
      }
      varCount++;
    }
  }

  console.log(`✅ ${prodCount} products seeded`);
  console.log(`✅ ${varCount} variants seeded`);
  console.log(`\nVerification: SELECT COUNT(*) FROM products;  SELECT COUNT(*) FROM product_variants;`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
