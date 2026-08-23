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

export default function AdminNewsPage() {
  const [items, setItems] = useState([]);
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
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load The Conversation feed."
        );
      }

      setItems(data.items || []);
      setReviewDate(data.reviewDate || "");
      setFeedStats(data.stats || null);
      setWindowInfo(data.window || null);
      setSelected(new Set());
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

      if (next.size >= 8) {
        setMessage("Select at most 8 articles in one publication batch.");
        return current;
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
      const data = await response.json();

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

    const selectedUrls = new Set(selected);
    setPublishing(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/review/the-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [...selected] }),
      });
      const data = await response.json();

      const failureDetails = (data.results || [])
        .filter((item) => item.status === "failed")
        .slice(0, 3)
        .map((item) => item.error)
        .filter(Boolean)
        .join(" | ");

      if (!response.ok || !data.success) {
        throw new Error(
          [data.message, failureDetails].filter(Boolean).join(" | ") ||
            "Publication failed."
        );
      }

      setMessage(
        `Published ${data.stats?.published || 0}; ` +
          `duplicates ${data.stats?.duplicates || 0}; ` +
          `failed ${data.stats?.failed || 0}. ` +
          (failureDetails ? `Failures: ${failureDetails}. ` : "") +
          (data.releaseRequired
            ? "The selected News is safely stored. Public reader refresh is required before it appears on /news."
            : "")
      );

      setItems((current) =>
        current.filter((item) => !selectedUrls.has(item.url))
      );
      setSelected(new Set());
    } catch (error) {
      setMessage(error?.message || "Publication failed.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="space-y-6">
      <header className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-red-700">
          News-only republication
        </p>
        <h1 className="mt-2 text-3xl font-black text-gray-950">
          The Conversation · Review Inbox
        </h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          The inbox is refreshed only at 10:00 AM, 3:00 PM and 9:00 PM IST.
          Each editorial day runs from the previous 9:00 PM to the current
          9:00 PM. The 10 AM and 3 PM refreshes show the partial window; the
          9 PM refresh completes the full 24-hour batch. Full article HTML is
          fetched only when you preview or publish a selected story.
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
        {filtered.length} articles in the current editorial window · selected {selected.size}/8
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
    </main>
  );
}
