// /stacks — Curated bundle index. Each card → /stacks/<slug>.
//
// Page design is geared to drive 3-4-peptide cart sizes. Hero shows the
// discount ladder with tier rungs; cards show peptide count + projected
// discount tier so customers can pre-judge what they're walking into.

import Link from "next/link";
import Image from "next/image";
import { Check, Zap, Sparkles, ArrowRight, ShoppingCart } from "lucide-react";
import { STACKS } from "@/lib/stacks";

export const metadata = {
  title: "Stacks — Vitality Project",
  description:
    "Curated multi-peptide stacks. Pick the strength of each component. Automatic bundle discount at checkout — 2 peptides 5% off, 3 → 10%, 4+ → 15%.",
};

const TIERS = [
  { count: 2, pct: 5,  label: "5% off"  },
  { count: 3, pct: 10, label: "10% off" },
  { count: 4, pct: 15, label: "15% off" },
];

export default function StacksIndexPage() {
  return (
    <main className="min-h-screen bg-[#0a0d12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        {/* ── Hero with discount ladder ───────────────────────── */}
        <div className="mb-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/85 font-semibold flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Curated Stacks
            </p>
            <h1 className="mt-2 text-4xl md:text-5xl font-semibold leading-[1.05]">
              The more you stack,<br />
              <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-emerald-300 bg-clip-text text-transparent">
                the more you save.
              </span>
            </h1>
            <p className="mt-4 text-white/60 leading-relaxed max-w-xl">
              Pre-built protocols that pair complementary peptides at the right strengths. Pick a
              dose for each component, add the whole stack with one click. Discount tiers apply
              automatically at checkout — no codes, no fine print.
            </p>
          </div>

          {/* Discount ladder card */}
          <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-emerald-300" />
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-300 font-semibold">
                Bundle pricing
              </p>
            </div>
            <ul className="space-y-2">
              {TIERS.map((t) => (
                <li
                  key={t.count}
                  className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-sm text-white/85">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center text-emerald-200 text-xs font-bold">
                      {t.count}{t.count === 4 ? "+" : ""}
                    </span>
                    peptide{t.count === 1 ? "" : "s"}
                  </span>
                  <span className="text-base font-semibold text-emerald-300">{t.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-white/40 leading-relaxed">
              Tiers apply to ANY peptide combination — you can mix curated stacks with single vials
              from <Link href="/shop" className="text-emerald-300 hover:underline">/shop</Link> and
              still hit the threshold.
            </p>
          </div>
        </div>

        {/* ── Stack cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STACKS.map((s) => {
            const tier = TIERS.slice().reverse().find((t) => s.components.length >= t.count);
            return (
              <Link
                key={s.slug}
                href={`/stacks/${s.slug}`}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden hover:border-emerald-400/45 hover:bg-white/[0.04] transition-all hover:-translate-y-0.5"
                data-testid={`stack-card-${s.slug}`}
              >
                <div className={`relative aspect-[5/3] bg-gradient-to-br ${s.accentClass ?? "from-white/[0.06] to-white/[0.02]"} overflow-hidden`}>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image
                      src="/products/vial-default-600.png"
                      alt={s.name}
                      width={220}
                      height={220}
                      className="object-contain opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  {/* Component count chip */}
                  <div className="absolute top-3 left-3 rounded-md bg-black/55 backdrop-blur-sm px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white/90 font-semibold">
                    {s.components.length} peptides
                  </div>
                  {/* Tier chip */}
                  {tier && (
                    <div className="absolute top-3 right-3 rounded-md bg-emerald-500/85 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-white font-bold flex items-center gap-1">
                      <Check className="w-3 h-3" /> {tier.label}
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <h2 className="text-lg font-semibold text-white group-hover:text-emerald-200 transition-colors">
                    {s.name}
                  </h2>
                  <p className="mt-1.5 text-sm text-white/55 leading-relaxed line-clamp-2">
                    {s.shortDesc}
                  </p>
                  <p className="mt-4 text-xs text-emerald-300/80 flex items-center gap-1">
                    Build this stack <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Mix-and-match nudge ─────────────────────────────── */}
        <div className="mt-12 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-6 flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.14em] text-white/45 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Mix and match
            </p>
            <h3 className="mt-1 text-xl font-semibold text-white">Build your own bundle</h3>
            <p className="mt-2 text-sm text-white/55 leading-relaxed max-w-2xl">
              Hit the 4+ tier with any combination. Add a Repair stack peptide, a Longevity peptide,
              an oral capsule and a Topical — all four count toward the 15% off automatically.
            </p>
          </div>
          <Link
            href="/shop"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-400/60 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors"
          >
            <ShoppingCart className="w-4 h-4" /> Browse all peptides
          </Link>
        </div>
      </div>
    </main>
  );
}
