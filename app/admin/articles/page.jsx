"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Eye,
  Pencil,
  PlusCircle,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchArticles();
  }, []);

  async function fetchArticles() {
    setLoading(true);

    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast.error("Failed to load articles");
    } else {
      setArticles(data || []);
    }

    setLoading(false);
  }

  async function updateArticleStatus(articleId, nextStatus) {
    try {
      setUpdatingId(articleId);

      const { error } = await supabase
        .from("articles")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", articleId);

      if (error) {
        throw error;
      }

      toast.success(
        nextStatus === "published"
          ? "Article published"
          : "Article moved to draft"
      );

      setArticles((currentArticles) =>
        currentArticles.map((article) =>
          article.id === articleId
            ? {
                ...article,
                status: nextStatus,
                updated_at: new Date().toISOString(),
              }
            : article
        )
      );
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to update article status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteArticle(id) {
    const confirmed = window.confirm(
      "Delete this article permanently? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    const { error } = await supabase
      .from("articles")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Article deleted");

    setArticles((currentArticles) =>
      currentArticles.filter((article) => article.id !== id)
    );
  }

  const filteredArticles = useMemo(() => {
    if (statusFilter === "all") {
      return articles;
    }

    return articles.filter(
      (article) =>
        String(article.status || "draft").toLowerCase() === statusFilter
    );
  }, [articles, statusFilter]);

  const draftCount = articles.filter(
    (article) =>
      String(article.status || "draft").toLowerCase() === "draft"
  ).length;

  const publishedCount = articles.filter(
    (article) =>
      String(article.status || "").toLowerCase() === "published"
  ).length;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Articles</h1>

          <p className="text-gray-500">
            Manage your UPSC Current Affairs articles
          </p>
        </div>

        <Link
          href="/admin/articles/create"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          <PlusCircle size={18} />
          New Article
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            statusFilter === "all"
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          All ({articles.length})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("draft")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            statusFilter === "draft"
              ? "bg-yellow-500 text-white"
              : "bg-yellow-100 text-yellow-800"
          }`}
        >
          Drafts ({draftCount})
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("published")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${
            statusFilter === "published"
              ? "bg-green-600 text-white"
              : "bg-green-100 text-green-800"
          }`}
        >
          Published ({publishedCount})
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : filteredArticles.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <h2 className="text-xl font-semibold">
            No Articles Found
          </h2>

          <p className="mt-2 text-gray-500">
            No articles match the selected filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left">Title</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Paper</th>
                <th className="px-6 py-3 text-left">Status</th>
                <th className="px-6 py-3 text-left">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredArticles.map((article) => {
                const status = String(
                  article.status || "draft"
                ).toLowerCase();

                const isPublished = status === "published";
                const isUpdating = updatingId === article.id;

                return (
                  <tr
                    key={article.id}
                    className="border-t hover:bg-gray-50"
                  >
                    <td className="max-w-md px-6 py-4 font-medium">
                      {article.title}
                    </td>

                    <td className="px-6 py-4">
                      {article.category || "-"}
                    </td>

                    <td className="px-6 py-4">
                      {article.paper || "-"}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isPublished
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {isPublished ? "Published" : "Draft"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      {article.created_at
                        ? new Date(
                            article.created_at
                          ).toLocaleDateString()
                        : "-"}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-3">
                        <Link
                          href={`/current-affairs/${article.slug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900"
                          title="Preview article"
                        >
                          <Eye size={18} />
                        </Link>

                        <Link
                          href={`/admin/articles/edit/${article.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          title="Edit article"
                        >
                          <Pencil size={18} />
                        </Link>

                        {isPublished ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateArticleStatus(
                                article.id,
                                "draft"
                              )
                            }
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Unpublish article"
                          >
                            <Undo2 size={18} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              updateArticleStatus(
                                article.id,
                                "published"
                              )
                            }
                            disabled={isUpdating}
                            className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Publish article"
                          >
                            <Send size={18} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            deleteArticle(article.id)
                          }
                          disabled={isUpdating}
                          className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Delete article"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}