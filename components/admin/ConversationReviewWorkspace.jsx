"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });
}

async function readApiJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const body = await response.text();

  if (!contentType.includes("application/json")) {
    const preview = body.replace(/\s+/g, " ").trim().slice(0, 140);
    throw new Error(
      `Conversation service returned ${response.status} ${response.statusText || "response"} instead of JSON.${preview ? ` ${preview}` : ""}`
    );
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Conversation service returned invalid JSON (${response.status}).`);
  }
}

export default function ConversationReviewWorkspace({ embedded = false }) {
  const [items, setItems] = useState([]);
  const [publishedItems, setPublishedItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [feedStats, setFeedStats] = useState(null);
  const [windowInfo, setWindowInfo] = useState(null);
  const [previews, setPreviews] = useState({});
  const [previewing, setPreviewing] = useState(new Set());

  async function load() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/review/the-conversation", {
        cache: "no-store",
      });
      const data = await readApiJson(response);

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load The Conversation feed."
        );
      }

      const nextItems = data.items || [];
      setItems(nextItems);
      setPublishedItems(data.publishedItems || []);
      setReviewDate(data.reviewDate || "");
      setFeedStats(data.stats || null);
      setWindowInfo(data.window || null);
      setSelected(new Set(nextItems.map((item) => item.url)));
      setPreviews({});

      if (data.errors?.length) {
        setMessage(data.errors.join(" | "));
      }
    } catch (error) {
      setMessage(error?.message || "Unable to load News review feed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    if (!needle) return items;

    return items.filter((item) =>
      `${item.title} ${item.description} ${item.author}`
        .toLowerCase()
        .includes(needle)
    );
  }, [items, query]);

  function toggle(url) {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(url)) {
        next.delete(url);
        return next;
      }

      next.add(url);
      return next;
    });
  }

  async function loadPreview(url) {
    if (previews[url]) return;

    setPreviewing((current) => new Set(current).add(url));

    try {
      const response = await fetch(
        `/api/admin/review/the-conversation?preview=${encodeURIComponent(url)}`,
        { cache: "no-store" }
      );
      const data = await readApiJson(response);

      if (!response.ok || !data.success || !data.preview?.html) {
        throw new Error(
          data.message || "Unable to load the full article preview."
        );
      }

      setPreviews((current) => ({
        ...current,
        [url]: data.preview,
      }));
    } catch (error) {
      setMessage(error?.message || "Unable to load full article preview.");
    } finally {
      setPreviewing((current) => {
        const next = new Set(current);
        next.delete(url);
        return next;
      });
    }
  }

  async function publishSelected() {
    if (!selected.size) return;

    const selectedUrls = [...selected];
    const failedUrls = new Set();
    let published = 0;
    let duplicates = 0;
    let failed = 0;
    const failureDetails = [];

    setPublishing(true);
    setMessage("");

    try {
      for (let offset = 0; offset < selectedUrls.length; offset += 8) {
        const batch = selectedUrls.slice(offset, offset + 8);

        const response = await fetch("/api/admin/review/the-conversation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: batch }),
        });
        const data = await readApiJson(response);

        published += Number(data.stats?.published || 0);
        duplicates += Number(data.stats?.duplicates || 0);
        failed += Number(data.stats?.failed || 0);

        for (const result of data.results || []) {
          if (result.status === "failed" && result.url) {
            failedUrls.add(result.url);
            failureDetails.push(result.error || "Publication failed.");
          }
        }

        if (!response.ok && !Array.isArray(data.results)) {
          throw new Error(
            data.message || "Conversation publication batch failed."
          );
        }
      }

      const completed = new Set(
        selectedUrls.filter((url) => !failedUrls.has(url))
      );

      // Reload once after all 8-item batches complete so the server's durable
      // source-key state, not optimistic client state, separates published
      // stories from the new review queue.
      await load();
      setSelected(new Set(failedUrls));

      setMessage(
        `Published ${published}; duplicates ${duplicates}; failed ${failed}. ` +
          (failureDetails.length
            ? `Failures: ${failureDetails.slice(0, 3).join(" | ")}. `
            : "") +
          (completed.size
            ? "Completed items are now marked separately as already published."
            : "")
      );
    } catch (error) {
      setMessage(error?.message || "Publication failed.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-red-700">
          General-public News review
        </p>
        <h1 className="mt-2 text-3xl font-black text-gray-950">
          {embedded ? "The Conversation · General Public News" : "The Conversation · Review Inbox"}
        </h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          Broad public-facing stories from the English Conversation editions
          are collected for the current 9 PM-to-9 PM editorial window. Clear
          internal/professional notices are excluded. Every awaiting-review
          story is checked automatically; untick only what you do not want.
          Full article HTML is fetched only for Preview or Publish.
        </p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
          {reviewDate ? <span>Editorial batch: {reviewDate}</span> : null}
          {windowInfo?.slot ? (
            <>
              <span>·</span>
              <span>Last refresh: {windowInfo.slot}:00 IST</span>
            </>
          ) : null}
          {windowInfo?.feedsRequested ? (
            <>
              <span>·</span>
              <span>
                {windowInfo.feedsHealthy}/{windowInfo.feedsRequested} feeds healthy
              </span>
            </>
          ) : null}
          {feedStats ? (
            <>
              <span>·</span>
              <span>{feedStats.foundInWindow || 0} found in current window</span>
              <span>·</span>
              <span>{feedStats.alreadyPublished || 0} already published</span>
              <span>·</span>
              <span>{feedStats.available || 0} awaiting review</span>
            </>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={load}
            disabled={loading || publishing}
            className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Reloading..." : "Reload inbox"}
          </button>
          <button
            type="button"
            onClick={publishSelected}
            disabled={publishing || selected.size === 0}
            className="rounded-lg bg-red-700 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {publishing
              ? "Publishing..."
              : `Publish selected (${selected.size})`}
          </button>
        </div>
      </header>

      {message ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the current 9 PM–9 PM Conversation batch"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-950"
        />
      </section>

      <div className="text-sm text-gray-600">
        {filtered.length} new general-public articles in the current editorial window · selected {selected.size}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          className="font-bold text-red-700"
          onClick={() => setSelected(new Set(items.map((item) => item.url)))}
        >
          Select all
        </button>
        <button
          type="button"
          className="font-bold text-gray-600"
          onClick={() => setSelected(new Set())}
        >
          Deselect all
        </button>
      </div>

      <section className="space-y-3">
        {filtered.map((item) => {
          const preview = previews[item.url];
          const previewBusy = previewing.has(item.url);

          return (
            <article
              key={item.url}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex gap-4">
                <input
                  type="checkbox"
                  checked={selected.has(item.url)}
                  onChange={() => toggle(item.url)}
                  className="mt-1 h-5 w-5"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                    <span>The Conversation</span>
                    {item.author ? (
                      <>
                        <span>·</span>
                        <span>{item.author}</span>
                      </>
                    ) : null}
                    <span>·</span>
                    <span>{formatDate(item.publishedAt)}</span>
                  </div>

                  <h2 className="mt-2 text-lg font-bold leading-7 text-gray-950">
                    {item.title}
                  </h2>

                  {item.description ? (
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {item.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-4">
                    <button
                      type="button"
                      onClick={() => loadPreview(item.url)}
                      disabled={previewBusy || Boolean(preview)}
                      className="text-sm font-bold text-red-700 disabled:text-gray-500"
                    >
                      {previewBusy
                        ? "Loading full article..."
                        : preview
                          ? "Full article loaded"
                          : "Preview full article"}
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-blue-700"
                    >
                      Open original article
                    </a>
                  </div>

                  {preview ? (
                    <div className="admin-conversation-preview">
                      <div className="admin-conversation-preview-meta">
                        Full unchanged source preview ·{" "}
                        {(preview.authors || []).join(", ")}
                        {preview.institutions?.length
                          ? ` · ${preview.institutions.join(", ")}`
                          : ""}
                      </div>
                      <div
                        className="admin-conversation-preview-body"
                        dangerouslySetInnerHTML={{ __html: preview.html }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}

        {!loading && !filtered.length ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
            {query
              ? "No matching stories in the current Conversation batch."
              : "No new Conversation stories are awaiting review in the latest scheduled batch."}
          </div>
        ) : null}
      </section>

      {publishedItems.length ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5" aria-label="Already published Conversation articles">
          <h2 className="text-lg font-black text-emerald-950">Already published</h2>
          <p className="mt-1 text-sm text-emerald-800">These stories are recorded as published and are intentionally kept out of the new-item selection.</p>
          <div className="mt-4 space-y-2">
            {publishedItems.map((item) => (
              <div key={item.url} className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-950">
                <span className="mr-2 font-black text-emerald-700">Published</span>
                {item.title}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
