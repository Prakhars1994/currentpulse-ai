"use client";

import { useEffect, useMemo, useState } from "react";

export default function NewsQueuePage() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const pendingNews = useMemo(() => {
    return news.filter(
      (item) =>
        !item.article_id &&
        String(item.status || "NEW").toUpperCase() !== "DRAFT" &&
        String(item.status || "NEW").toUpperCase() !== "GENERATING"
    );
  }, [news]);

  async function loadNews() {
    try {
      const res = await fetch("/api/news-queue", {
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load news queue.");
      }

      setNews(data.news || []);
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to load news queue.");
    } finally {
      setLoading(false);
    }
  }

  async function requestGeneration(queueId) {
    const res = await fetch("/api/generate-article", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queueId,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || "Article generation failed.");
    }

    return data;
  }

  async function generateArticle(queueId) {
    try {
      setGeneratingId(queueId);
      setMessage("");
      setError("");

      const data = await requestGeneration(queueId);

      setMessage(
        `Article generated successfully: ${
          data.article?.title || "Draft created"
        }`
      );

      await loadNews();
    } catch (err) {
      console.error(err);
      setError(err.message || "Article generation failed.");
      await loadNews();
    } finally {
      setGeneratingId(null);
    }
  }

  async function generateAll() {
    const itemsToGenerate = pendingNews;

    if (itemsToGenerate.length === 0) {
      setMessage("There are no NEW queue items to generate.");
      setError("");
      return;
    }

    const confirmed = window.confirm(
      `Generate ${itemsToGenerate.length} articles now? This may take several minutes and use Gemini API quota.`
    );

    if (!confirmed) {
      return;
    }

    setBulkGenerating(true);
    setMessage("");
    setError("");
    setProgress({
      current: 0,
      total: itemsToGenerate.length,
      success: 0,
      failed: 0,
    });

    let successCount = 0;
    let failedCount = 0;

    for (let index = 0; index < itemsToGenerate.length; index += 1) {
      const item = itemsToGenerate[index];

      setGeneratingId(item.id);
      setProgress({
        current: index + 1,
        total: itemsToGenerate.length,
        success: successCount,
        failed: failedCount,
      });

      try {
        await requestGeneration(item.id);
        successCount += 1;
      } catch (err) {
        console.error(
          `Generation failed for queue item ${item.id}:`,
          err
        );
        failedCount += 1;
      }

      setProgress({
        current: index + 1,
        total: itemsToGenerate.length,
        success: successCount,
        failed: failedCount,
      });

      await loadNews();
    }

    setGeneratingId(null);
    setBulkGenerating(false);

    setMessage(
      `Generate All completed. Generated: ${successCount}. Failed: ${failedCount}.`
    );

    if (failedCount > 0) {
      setError(
        `${failedCount} item(s) failed. Check the FAILED rows for details.`
      );
    }

    await loadNews();
  }

  useEffect(() => {
    loadNews();
  }, []);

  if (loading) {
    return <div className="p-8 text-xl">Loading News Queue...</div>;
  }

  return (
    <main className="mx-auto max-w-7xl p-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">📰 News Queue</h1>

          <p className="mt-2 text-gray-600">
            Pending items: {pendingNews.length}
          </p>
        </div>

        <button
          type="button"
          onClick={generateAll}
          disabled={bulkGenerating || pendingNews.length === 0}
          className={`rounded px-5 py-3 font-semibold text-white ${
            bulkGenerating || pendingNews.length === 0
              ? "cursor-not-allowed bg-gray-400"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {bulkGenerating
            ? `Generating ${progress.current}/${progress.total}`
            : `Generate All (${pendingNews.length})`}
        </button>
      </div>

      {bulkGenerating && (
        <div className="mb-6 rounded border border-blue-300 bg-blue-50 p-4">
          <div className="mb-2 font-semibold text-blue-900">
            Generating article {progress.current} of {progress.total}
          </div>

          <div className="mb-3 h-3 overflow-hidden rounded bg-blue-100">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.current / progress.total) * 100}%`
                    : "0%",
              }}
            />
          </div>

          <p className="text-sm text-blue-800">
            Successful: {progress.success} | Failed: {progress.failed}
          </p>
        </div>
      )}

      {message && (
        <div className="mb-6 rounded border border-green-300 bg-green-50 p-4 text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {news.length === 0 ? (
        <div className="rounded border border-gray-300 p-6 text-gray-600">
          No news items found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border p-3 text-left">Score</th>
                <th className="border p-3 text-left">Source</th>
                <th className="border p-3 text-left">Title</th>
                <th className="border p-3 text-left">Status</th>
                <th className="border p-3 text-left">Action</th>
              </tr>
            </thead>

            <tbody>
              {news.map((item) => {
                const isGenerating = generatingId === item.id;
                const isGenerated =
                  Boolean(item.article_id) ||
                  String(item.status || "").toUpperCase() === "DRAFT";

                return (
                  <tr key={item.id}>
                    <td className="border p-3">{item.score ?? "-"}</td>

                    <td className="border p-3">
                      {item.source || "-"}
                    </td>

                    <td className="border p-3">
                      <div className="font-medium">{item.title}</div>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-sm text-blue-600 underline"
                        >
                          Open source
                        </a>
                      )}
                    </td>

                    <td className="border p-3">
                      <span className="font-medium">
                        {isGenerating
                          ? "GENERATING"
                          : item.status || "NEW"}
                      </span>

                      {item.generated_error && (
                        <p className="mt-2 max-w-xs text-sm text-red-600">
                          {item.generated_error}
                        </p>
                      )}
                    </td>

                    <td className="border p-3">
                      <button
                        type="button"
                        onClick={() => generateArticle(item.id)}
                        disabled={
                          bulkGenerating ||
                          isGenerating ||
                          isGenerated
                        }
                        className={`rounded px-4 py-2 text-white ${
                          bulkGenerating ||
                          isGenerating ||
                          isGenerated
                            ? "cursor-not-allowed bg-gray-400"
                            : "bg-blue-600 hover:bg-blue-700"
                        }`}
                      >
                        {isGenerating
                          ? "Generating..."
                          : isGenerated
                            ? "Generated"
                            : "Generate"}
                      </button>

                      {item.article_id && (
                        <a
                          href={`/admin/articles/edit/${item.article_id}`}
                          className="ml-3 inline-block text-sm font-medium text-blue-600 underline"
                        >
                          Edit article
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}