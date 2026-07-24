import Link from "next/link";

export default function Categories() {
  const categories = [
    {
      name: "🏛️ Polity",
      link: "/category/polity",
    },
    {
      name: "💰 Economy",
      link: "/category/economy",
    },
    {
      name: "🌍 International",
      link: "/category/international",
    },
    {
      name: "🔬 Science & Tech",
      link: "/category/science-tech",
    },
    {
      name: "🌱 Environment",
      link: "/category/environment",
    },
    {
      name: "⚽ Sports",
      link: "/category/sports",
    },
    {
      name: "🛰️ Space",
      link: "/category/space",
    },
    {
      name: "⚖️ Judiciary",
      link: "/category/judiciary",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="mb-12 text-center text-4xl font-bold">
        Explore Categories
      </h2>

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        {categories.map((category, index) => (
          <Link
            key={index}
            href={category.link}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-xl font-semibold transition hover:border-cyan-400 hover:bg-slate-800 text-center"
          >
            {category.name}
          </Link>
        ))}
      </div>
    </section>
  );
}