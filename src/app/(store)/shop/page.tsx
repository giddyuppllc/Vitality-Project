// /shop — Category index. One card per category with product count + thumb.
//
// Click → /shop/<category-slug> → category landing page with that category's
// products. The existing /products?category=<slug> route still works (the
// admin / search flows lean on it); /shop is the new customer-facing tree.

import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Shop — Vitality Project",
  description: "Research-grade peptides, oral capsules, topicals, and supplies.",
};

async function getCategoriesWithCount() {
  const cats = await prisma.category.findMany({
    where: { products: { some: { status: "ACTIVE" } } },
    include: {
      _count: { select: { products: { where: { status: "ACTIVE" } } } },
    },
    orderBy: { name: "asc" },
  });
  return cats;
}

export default async function ShopIndexPage() {
  const categories = await getCategoriesWithCount();

  return (
    <main className="min-h-screen bg-[#0a0d12] text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-300/80 font-semibold">
            Catalog
          </p>
          <h1 className="mt-2 text-4xl md:text-5xl font-semibold">Shop by category</h1>
          <p className="mt-3 text-white/55 max-w-xl mx-auto">
            Research-grade peptides, oral capsules, topicals, and supplies.
            Third-party tested for purity. COA available on request.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/shop/${c.slug}`}
              className="group rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 hover:border-emerald-400/40 hover:bg-white/[0.04] transition-colors"
              data-testid={`category-card-${c.slug}`}
            >
              <h2 className="text-xl font-semibold text-white group-hover:text-emerald-200">
                {c.name}
              </h2>
              {c.description && (
                <p className="mt-2 text-sm text-white/55 leading-relaxed line-clamp-2">
                  {c.description}
                </p>
              )}
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-white/40">
                {c._count.products} product{c._count.products === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
          {categories.length === 0 && (
            <p className="col-span-full text-center text-white/40">
              Catalog is being prepared. Check back shortly.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
