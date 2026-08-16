import Link from "next/link";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";

export const metadata = {
  title: "UPSC Current Affairs by Subject",
  description:
    "Browse UPSC current affairs by Polity, Economy, International Relations, Environment, Science, Geography, History, Security and Social Issues.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesPage() {
  /*
   * Category navigation does not need an archive-wide database scan.
   *
   * Earlier this page loaded up to 5,000 full CA records merely to display
   * article counts. Actual category pages already load the relevant content,
   * so this index remains completely lightweight.
   */
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">
          Structured revision
        </p>

        <h1 className="mt-3 text-4xl font-black sm:text-5xl">
          Explore categories
        </h1>

        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
          Jump directly to the subject you want to revise. Each category page
          loads only the articles needed for that view.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CATEGORY_ROUTES.map((route) => (
            <Link
              key={route.slug}
              href={`/category/${route.slug}`}
              className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-cyan-500"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-4xl">{route.icon}</span>

                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-cyan-300">
                  Browse
                </span>
              </div>

              <h2 className="mt-5 text-xl font-bold group-hover:text-cyan-300">
                {route.name}
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Open category →
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}