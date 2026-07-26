import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

function slugToCategory(slug: string) {
  const categoryMap: Record<string, string> = {
    "science-tech": "Science & Technology",
    "science-and-technology": "Science & Technology",
    "international-relations": "International Relations",
    economy: "Economy",
    polity: "Polity",
    environment: "Environment",
    sports: "Sports",
    space: "Space",
    judiciary: "Judiciary",
  };

  return (
    categoryMap[slug] ||
    slug
      .split("-")
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join(" ")
  );
}
export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;

  const category = slugToCategory(slug);

  const { data: articles } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "published")
    .eq("category", category)
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-slate-100 py-12">
      <div className="mx-auto max-w-6xl px-6">

        <h1 className="text-4xl font-bold text-slate-900">
          {category}
        </h1>

        <p className="mt-2 text-gray-600">
          UPSC Current Affairs for {category}
        </p>

        <div className="mt-10 grid gap-6">
          {(articles || []).map((article) => (
            <Link
              key={article.id}
              href={`/current-affairs/${article.slug}`}
              className="rounded-xl bg-white p-6 shadow hover:shadow-lg transition"
            >
              <h2 className="text-2xl font-bold text-slate-900">
                {article.title}
              </h2>

              <p className="mt-3 text-gray-600 line-clamp-2">
                {article.why_news}
              </p>

              <span className="mt-5 inline-block text-cyan-600 font-semibold">
                Read Article →
              </span>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}