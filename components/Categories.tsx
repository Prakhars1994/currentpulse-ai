import Link from "next/link";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";

export default function Categories() {
  const categories = CATEGORY_ROUTES.filter((category) =>
    [
      "polity",
      "economy",
      "international",
      "science-tech",
      "environment",
      "sports",
      "space",
      "judiciary",
    ].includes(category.slug)
  );

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="mb-12 text-center text-4xl font-bold">
        Explore Categories
      </h2>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {categories.map((category, index) => (
          <Link
            key={index}
            href={`/category/${category.slug}`}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-xl font-semibold transition hover:border-cyan-400 hover:bg-slate-800 text-center"
          >
            {category.icon} {category.shortName || category.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
