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
    <section className="border-y border-white/5 bg-slate-900/35 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-black uppercase tracking-[.22em] text-blue-400">Syllabus map</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight">Explore by subject</h2>
        </div>
        <Link href="/categories" className="w-fit rounded-xl border border-slate-700 px-5 py-3 font-bold text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300">View all categories →</Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/category/${category.slug}`}
            className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-center font-bold transition hover:-translate-y-1 hover:border-cyan-400/60 hover:bg-slate-900 sm:p-7 sm:text-lg"
          >
            <span className="mx-auto mb-3 block text-3xl transition group-hover:scale-110">{category.icon}</span>
            {category.shortName || category.name}
          </Link>
        ))}
      </div>
      </div>
    </section>
  );
}
