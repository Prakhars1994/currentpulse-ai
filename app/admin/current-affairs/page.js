"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, RefreshCw } from "lucide-react";
import PdfImportWorkspace from "@/components/admin/PdfImportWorkspace";

export default function CurrentAffairsAdminPage() {
  const router = useRouter();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/current-affairs", {
        cache: "no-store",
      });
      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        router.replace("/admin/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data?.message || "Unable to load Current Affairs.");
      }

      setArticles(data.articles || []);
    } catch (loadError) {
      setError(loadError?.message || "Unable to load Current Affairs.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  return (
    <div className="space-y-8 p-1">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              Manual Current Affairs
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              Review & publish Current Affairs
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Only administrator-supplied PDF Current Affairs appear here. Review the detected
              articles before publishing, then use Edit to evaluate or correct any published item.
              No coaching-source collection or AI ingestion runs from this page.
            </p>
          </div>

          <button
            type="button"
            onClick={loadArticles}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh list
          </button>
        </div>
      </section>

      <PdfImportWorkspace embedded />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Published CA review list</h2>
            <p className="text-sm text-slate-500">
              Latest {articles.length} administrator-PDF Current Affairs items.
            </p>
          </div>
          <Link href="/admin/articles" className="text-sm font-bold text-blue-700 hover:text-blue-900">
            All articles →
          </Link>
        </div>

        {error ? (
          <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading Current Affairs…</div>
        ) : articles.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="font-bold text-slate-900">No administrator-PDF Current Affairs yet</h3>
            <p className="mt-2 text-sm text-slate-500">Upload and review a CA PDF above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3">Title</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Paper</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Published</th>
                  <th className="px-6 py-3 text-right">Evaluate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {articles.map((article) => (
                  <tr key={article.id} className="align-top hover:bg-slate-50/60">
                    <td className="max-w-xl px-6 py-4 font-semibold text-slate-900">{article.title}</td>
                    <td className="px-6 py-4 text-slate-600">{article.category || "—"}</td>
                    <td className="px-6 py-4 text-slate-600">{article.paper || "—"}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        {article.status || "published"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                      {article.created_at ? new Date(article.created_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/admin/articles/edit/${article.id}`}
                          className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </Link>
                        <Link
                          href={`/current-affairs/${article.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-slate-900"
                        >
                          <ExternalLink className="h-4 w-4" /> Live
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
