import Link from "next/link";

export default function ArticlesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          Articles
        </h1>

        <Link
          href="/admin/articles/create"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg"
        >
          + New Article
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow p-8">
        <p>No articles yet.</p>
      </div>
    </div>
  );
}