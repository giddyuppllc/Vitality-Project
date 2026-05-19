"use client";

// Stack Builder — upgrade pass.
//
// The whole point of this component is to drive customers to 3-4
// peptides per cart so they hit the bundle discount tiers. So:
//
//   1. A persistent **discount ladder** at the top with three rungs (2 / 3 / 4+
//      peptides) and a glowing checkmark on whichever the user has hit.
//   2. **Live total + savings preview** that animates as variants change.
//   3. **Variant pickers** with the per-vial price visible so customers can
//      compare strengths at a glance.
//   4. Bottom call-to-action card showing the locked-in discount, current
//      savings, and a clear "Add stack to cart" button that explodes each
//      component into its own cart line item (so the bundle discount auto-
//      qualifies at checkout — no code, no refresh).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart, Zap, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/hooks/useCart";

interface StackComponent {
  productId: string;
  productSlug: string;
  productName: string;
  blurb?: string;
  variants: Array<{ id: string; name: string; price: number; inventory: number }>;
  defaultVariantId: string | null;
}

interface Props {
  stackName: string;
  stackSlug: string;
  components: StackComponent[];
}

const TIERS = [
  { count: 2, pct: 5,  label: "5% off"  },
  { count: 3, pct: 10, label: "10% off" },
  { count: 4, pct: 15, label: "15% off" },
];

function tierForCount(count: number) {
  return TIERS.slice().reverse().find((t) => count >= t.count) ?? null;
}

export function StackBuilder({ stackName, stackSlug, components }: Props) {
  const router = useRouter();
  const addItem = useCart((s) => s.addItem);
  const [picks, setPicks] = useState<Record<string, string>>(
    Object.fromEntries(
      components
        .map((c) => [c.productId, c.defaultVariantId ?? c.variants[0]?.id ?? ""])
        .filter(([, v]) => v),
    ),
  );
  const [added, setAdded] = useState(false);

  const selected = useMemo(() => {
    return components.map((c) => {
      const variantId = picks[c.productId];
      const variant = c.variants.find((v) => v.id === variantId) ?? c.variants[0];
      return { component: c, variant };
    });
  }, [components, picks]);

  const peptideCount = components.length;
  const subtotalCents = selected.reduce((s, x) => s + (x.variant?.price ?? 0), 0);
  const tier = tierForCount(peptideCount);
  const savedCents = tier ? Math.round(subtotalCents * (tier.pct / 100)) : 0;
  const finalCents = subtotalCents - savedCents;

  // Find the next tier above current (for upsell nudge)
  const nextTier = tier ? TIERS.find((t) => t.count > tier.count) : TIERS[0];
  const peptidesToNext = nextTier ? Math.max(0, nextTier.count - peptideCount) : 0;

  const handleAddStackToCart = () => {
    for (const { component, variant } of selected) {
      if (!variant) continue;
      // Price intentionally omitted — cart stores refs only; /api/cart
      // is the single source of truth for line totals.
      addItem({
        productId: component.productId,
        variantId: variant.id,
        name: `${component.productName} — ${variant.name}`,
        slug: component.productSlug,
        quantity: 1,
      });
    }
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      router.push("/cart");
    }, 1100);
  };

  return (
    <div className="space-y-6">
      {/* ── Discount ladder banner ───────────────────────────────── */}
      <div className="rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.08] via-teal-500/[0.04] to-transparent p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-emerald-300" />
          <p className="text-xs uppercase tracking-[0.14em] text-emerald-300 font-semibold">
            Auto-applied bundle discount
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {TIERS.map((t) => {
            const hit = peptideCount >= t.count;
            const isCurrent = tier?.count === t.count;
            return (
              <div
                key={t.count}
                className={`rounded-xl border p-3 transition-all ${
                  hit
                    ? "border-emerald-400/60 bg-emerald-500/10"
                    : "border-white/[0.08] bg-white/[0.02]"
                } ${isCurrent ? "shadow-[0_0_24px_rgba(52,211,153,0.18)] scale-[1.02]" : ""}`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      hit ? "bg-emerald-500 text-white" : "bg-white/[0.06] text-white/40 border border-white/10"
                    }`}
                  >
                    {hit ? <Check className="w-3 h-3" /> : <span className="text-[10px] font-bold">{t.count}</span>}
                  </div>
                  <p className={`text-xs font-medium ${hit ? "text-emerald-200" : "text-white/55"}`}>
                    {t.count}{t.count === 4 ? "+" : ""} peptide{t.count === 1 ? "" : "s"}
                  </p>
                </div>
                <p className={`text-lg font-semibold ${hit ? "text-emerald-200" : "text-white/45"}`}>
                  {t.label}
                </p>
              </div>
            );
          })}
        </div>
        {peptidesToNext > 0 && nextTier && (
          <p className="mt-3 text-xs text-emerald-200/85 flex items-center gap-1.5">
            <ArrowRight className="w-3 h-3 shrink-0" />
            Add {peptidesToNext} more peptide{peptidesToNext === 1 ? "" : "s"} (separately at /shop) to unlock {nextTier.label}.
          </p>
        )}
        {!nextTier && peptideCount >= 4 && (
          <p className="mt-3 text-xs text-emerald-200/85 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 shrink-0" />
            Locked in: maximum bundle discount.
          </p>
        )}
      </div>

      {/* ── Component variant pickers ────────────────────────────── */}
      <div className="space-y-4">
        {components.map((c, idx) => {
          const picked = picks[c.productId];
          const pickedVariant = c.variants.find((v) => v.id === picked) ?? c.variants[0];
          return (
            <div
              key={c.productId}
              className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.025] to-white/[0.01] p-5"
            >
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-400/25 flex items-center justify-center text-emerald-300 text-xs font-semibold shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-white">{c.productName}</h3>
                    {c.blurb && <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{c.blurb}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-white/35">Selected</p>
                  <p className="text-sm font-semibold text-white tabular-nums">
                    ${(pickedVariant?.price ?? 0) / 100 < 1 ? "—" : ((pickedVariant?.price ?? 0) / 100).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {c.variants.map((v) => {
                  const isPicked = v.id === picked;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [c.productId]: v.id }))}
                      className={`relative rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        isPicked
                          ? "border-emerald-400/60 bg-emerald-500/10 text-white"
                          : "border-white/[0.08] bg-white/[0.02] text-white/65 hover:border-white/25 hover:text-white"
                      }`}
                      data-testid={`stack-variant-${c.productSlug}-${v.id}`}
                    >
                      {isPicked && (
                        <Check className="absolute top-1.5 right-1.5 w-3 h-3 text-emerald-300" />
                      )}
                      <div className="font-semibold">{v.name}</div>
                      <div className="text-xs text-white/55 mt-0.5 tabular-nums">${(v.price / 100).toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Total + CTA ──────────────────────────────────────────── */}
      <div className="sticky bottom-4 z-10 rounded-2xl border-2 border-emerald-400/40 bg-[#0a0d12]/95 backdrop-blur-md p-5 shadow-[0_20px_60px_rgba(52,211,153,0.18)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <p className="text-xs uppercase tracking-[0.12em] text-emerald-300/80 font-semibold">
                Stack total
              </p>
              {tier && (
                <span className="text-[10px] font-semibold text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2 py-0.5">
                  {tier.label} applied
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-3xl font-bold text-white tabular-nums">
                ${(finalCents / 100).toFixed(2)}
              </p>
              {savedCents > 0 && (
                <>
                  <p className="text-base text-white/35 line-through tabular-nums">
                    ${(subtotalCents / 100).toFixed(2)}
                  </p>
                  <p className="text-sm font-semibold text-emerald-300 tabular-nums">
                    save ${(savedCents / 100).toFixed(2)}
                  </p>
                </>
              )}
            </div>
            <p className="mt-1 text-[11px] text-white/40">
              {peptideCount} peptide{peptideCount === 1 ? "" : "s"} · discount auto-applied at checkout · pay via Zelle
            </p>
          </div>

          <Button onClick={handleAddStackToCart} size="lg" className="shrink-0 min-w-[180px]">
            {added ? (
              <>
                <Check className="w-4 h-4" /> Added — going to cart
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" /> Add stack to cart
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
