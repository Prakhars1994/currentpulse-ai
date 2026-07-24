import Link from "next/link";
import { supabase } from "@/lib/supabase";


export default async function CategoryPage({ params }) {


  const { category } = await params;


  const decodedCategory = decodeURIComponent(category);



  const { data: articles, error } = await supabase
    .from("articles")
    .select("*")
    .eq("category", decodedCategory)
    .order("created_at", { ascending: false });



  if (error) {
    console.log(error);
  }



  return (

    <main className="max-w-6xl mx-auto p-8">


      <h1 className="text-4xl font-bold">
        {decodedCategory} Current Affairs
      </h1>


      <p className="mt-3 text-gray-600">
        UPSC current affairs analysis for {decodedCategory}.
      </p>



      <div className="grid md:grid-cols-2 gap-6 mt-8">


        {articles?.map((article) => (


          <div
            key={article.id}
            className="border rounded-xl p-6"
          >


            <h2 className="text-2xl font-bold">
              {article.title}
            </h2>


            <p className="mt-2 text-gray-600">
              {article.paper}
            </p>



            <Link
              href={`/current-affairs/${article.slug}`}
              className="inline-block mt-5 bg-black text-white px-5 py-2 rounded-lg"
            >
              Read More
            </Link>


          </div>


        ))}


      </div>


    </main>

  );

}