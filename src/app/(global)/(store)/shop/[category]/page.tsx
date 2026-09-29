// /shop/[category] — Category landing page with products in that category.
//
// Uses the existing ProductCard from the /products page. SEO-friendly URL
// structure (one route per category) compared to /products?category=<slug>.

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProductCard } from "@/components/store/product-card";
import type { ProductWithImages } from "@/types";

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { category: slug } = await params;
  const cat = await prisma.category.findUnique({ where: { slug } });
  if (!cat) return { title: "Category not found" };
  return {
    title: `${cat.name} — Vitality Project`,
    description: cat.description ?? `${cat.name} research compounds.`,
  };
}

async function getCategoryAndProducts(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: "ACTIVE" },
        include: {
          images: { orderBy: { position: "asc" } },
          variants: { orderBy: { price: "asc" } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
  return category;
}

export default async function CategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const category = await getCategoryAndProducts(slug);
  if (!category) notFound();

  return (
    <main className="min-h-screen bg-[#0a0d12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-xs text-white/40 mb-4">
          <Link href="/shop" className="hover:text-white/70">Shop</Link>
          <span className="mx-2">/</span>
          <span className="text-white/70">{category.name}</span>
        </nav>

        {/* Header */}
        <div className="mb-10 max-w-2xl">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80 font-semibold">
            Catalog
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold">{category.name}</h1>
          {/* Category description blurb removed per owner request 2026-06-08.
              Data is preserved in Category.description; restore by re-adding
              {category.description && <p>…</p>} here. */}
          <p className="mt-3 text-xs text-white/35">
            {category.products.length} product{category.products.length === 1 ? "" : "s"} ·
            Third-party tested · COA available on request
          </p>
        </div>

        {/* Grid */}
        {category.products.length === 0 ? (
          <p className="text-center text-white/40 py-16">
            No products in this category yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(category.products as unknown as ProductWithImages[]).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
