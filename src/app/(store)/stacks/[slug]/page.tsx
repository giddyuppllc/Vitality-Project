// /stacks/[slug] — single stack detail with per-component variant picker.

import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStackBySlug } from "@/lib/stacks";
import { StackBuilder } from "@/components/store/stack-builder";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const s = getStackBySlug(slug);
  if (!s) return { title: "Stack not found" };
  return {
    title: `${s.name} — Vitality Project`,
    description: s.shortDesc,
  };
}

async function loadStack(slug: string) {
  const def = getStackBySlug(slug);
  if (!def) return null;

  const products = await prisma.product.findMany({
    where: {
      slug: { in: def.components.map((c) => c.productSlug) },
      status: "ACTIVE",
    },
    include: {
      variants: { orderBy: { price: "asc" } },
      category: { select: { slug: true, name: true } },
    },
  });

  // Pre-compute the per-component product + default variant id (in def order)
  const components = def.components
    .map((c) => {
      const product = products.find((p) => p.slug === c.productSlug);
      if (!product) return null;
      const variants = product.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        inventory: v.inventory,
      }));
      const defaultId =
        (c.defaultVariantName && variants.find((v) => v.name === c.defaultVariantName)?.id) ||
        variants[0]?.id ||
        null;
      return {
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        blurb: c.blurb,
        variants,
        defaultVariantId: defaultId,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { def, components };
}

export default async function StackDetailPage({ params }: Props) {
  const { slug } = await params;
  const stack = await loadStack(slug);
  if (!stack) notFound();
  const { def, components } = stack;

  return (
    <main className="min-h-screen bg-[#0a0d12] text-white">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-white/40 mb-4">
          <Link href="/stacks" className="hover:text-white/70">Stacks</Link>
          <span className="mx-2">/</span>
          <span className="text-white/70">{def.name}</span>
        </nav>

        {/* Hero */}
        <div className={`rounded-3xl border border-white/[0.06] bg-gradient-to-br ${def.accentClass ?? "from-white/[0.06] to-transparent"} p-8 md:p-10 mb-8`}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-8 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80 font-semibold">
                {def.components.length}-peptide stack
              </p>
              <h1 className="mt-2 text-3xl md:text-4xl font-semibold">{def.name}</h1>
              <p className="mt-3 text-white/65 leading-relaxed">{def.description}</p>
            </div>
            <div className="hidden md:flex items-center justify-center">
              <Image
                src="/products/vial-default.png"
                alt={def.name}
                width={220}
                height={220}
                className="object-contain opacity-90"
              />
            </div>
          </div>
        </div>

        {/* Builder (client component) */}
        <StackBuilder stackName={def.name} stackSlug={def.slug} components={components} />
      </div>
    </main>
  );
}
