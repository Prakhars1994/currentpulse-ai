"use client";

import { useEffect, useMemo, useState } from "react";

function formatDate(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : date.toLocaleString();
}

export default function AdminNewsPage() {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

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
      setSelected(new Set());

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

  async function publishSelected() {
    if (!selected.size) return;

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
            ? "New News is in Supabase; run the incremental reader release to expose it on the static site."
            : "")
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
          The Conversation
        </h1>

        <p className="mt-2 max-w-3xl text-gray-600">
          Select individual articles for CurrentPulse News. CurrentPulse uses
          The Conversation&apos;s official republish HTML, keeps its article
          text unchanged, preserves author/institution attribution and the
          mandatory page counter, and never sends these stories to Current Affairs.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={load}
            disabled={loading || publishing}
            className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh feed"}
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
          placeholder="Search The Conversation headlines"
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />
      </section>

      <div className="text-sm text-gray-600">
        {filtered.length} fresh feed items · selected {selected.size}/8
      </div>

      <section className="space-y-3">
        {filtered.map((item) => (
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
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">
                    {item.description}
                  </p>
                ) : null}

                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-bold text-blue-700"
                >
                  Open original article
                </a>
              </div>
            </div>
          </article>
        ))}

        {!loading && !filtered.length ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
            No matching The Conversation stories.
          </div>
        ) : null}
      </section>
    </main>
  );
}
