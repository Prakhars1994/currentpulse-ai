import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function TodayCurrentAffairsPage() {
  const today = new Date().toISOString().split("T")[0];

  const { data: articles, error } = await supabase
    .from("articles")
    .select(
      "id, title, slug, category, paper, why_news, image_url, created_at"
    )
    .eq("status", "published")
    .gte("created_at", `${today}T00:00:00`)
    .lt("created_at", `${today}T23:59:59`)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
  }

  const topStory = articles?.[0];

  return (
    <main className="max-w-7xl mx-auto px-6 py-10">

      <h1 className="text-4xl font-bold">
        📰 Today's Current Affairs
      </h1>

      <p className="text-gray-500 mt-2">
        Updated Today • {new Date().toLocaleDateString()}
      </p>

      <p className="mt-3 font-semibold">
        {articles?.length || 0} Articles Published
      </p>

      {!articles || articles.length === 0 ? (
        <div className="mt-10 rounded-xl border p-10 text-center">
          <h2 className="text-2xl font-bold">
            Today's current affairs are being prepared.
          </h2>

          <p className="text-gray-500 mt-3">
            Please check back later today.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-10">

            <h2 className="text-2xl font-bold mb-6">
              ⭐ Top Story
            </h2>

            <div className="rounded-2xl border bg-white shadow p-6">

              {topStory.image_url && (
                <img
                  src={topStory.image_url}
                  alt={topStory.title}
                  className="rounded-xl mb-5 w-full h-72 object-cover"
                />
              )}

              <h3 className="text-3xl font-bold">
                {topStory.title}
              </h3>

              <p className="mt-4 text-gray-600">
                {topStory.why_news}
              </p>

              <Link
                href={`/current-affairs/${topStory.slug}`}
                className="inline-block mt-6 bg-blue-600 text-white px-5 py-2 rounded-lg"
              >
                Read Article →
              </Link>

            </div>

          </section>

          <section className="mt-12">

            <h2 className="text-2xl font-bold mb-6">
              📚 Latest Articles
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

              {articles.slice(1).map((article) => (

                <div
                  key={article.id}
                  className="border rounded-xl p-5 hover:shadow-lg transition"
                >

                  <div className="text-sm text-blue-600 font-semibold">
                    {article.category}
                  </div>

                  <h3 className="font-bold text-xl mt-2">
                    {article.title}
                  </h3>

                  <p className="text-gray-600 mt-3 line-clamp-3">
                    {article.why_news}
                  </p>

                  <Link
                    href={`/current-affairs/${article.slug}`}
                    className="inline-block mt-4 text-blue-600 font-semibold"
                  >
                    Read More →
                  </Link>

                </div>

              ))}

            </div>

          </section>
        </>
      )}

    </main>
  );
}