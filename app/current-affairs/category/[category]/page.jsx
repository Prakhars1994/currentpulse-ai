import Link from "next/link";
import { supabase } from "@/lib/supabase";


export default async function CategoryPage({ params }) {


  const { category } = await params;


  const decodedCategory = decodeURIComponent(category);



  const { data: allArticles, error } = await supabase
  .from("articles")
  .select("*")
  .eq("status", "published")
  .order("created_at", { ascending: false });

const articles =
  allArticles?.filter((article) => {
    const slug = (article.category || "")
      .toLowerCase()
      .trim()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug === decodedCategory;
  }) || [];



  if (error) {
    console.log(error);
  }



  return (

    <main className="max-w-6xl mx-auto p-8">


      <h1 className="text-4xl font-bold">
        {decodedCategory} Current Affairs
      </h1>


      <p className="mt-3 text-gray-600">
  UPSC current affairs analysis and latest published articles for {decodedCategory}.
</p>





<div className="grid md:grid-cols-2 gap-6 mt-8">

  {articles?.map((article) => (

    ...

  ))}

</div>

{articles.length === 0 && (
  <div className="mt-10 rounded-xl border bg-white p-8 text-center">
    <h2 className="text-xl font-bold">
      No published articles found
    </h2>

    <p className="mt-2 text-gray-500">
      Articles in this category will appear here after they are published.
    </p>
  </div>
)}

</main>
  );

}