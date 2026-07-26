"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const emptyArticle = {
  title: "",
  category: "",
  paper: "",
  why_news: "",
  prelims: "",
  mains: "",
  question: "",
};

export default function AIGeneratorPage() {
  const [newsUrl, setNewsUrl] = useState("");
  const [newsText, setNewsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingStatus, setSavingStatus] = useState("");
  const [message, setMessage] = useState("");
  const [article, setArticle] = useState(emptyArticle);

  const reviewChecks = useMemo(() => {
    return [
      {
        label: "Title added",
        passed: article.title.trim().length >= 10,
      },
      {
        label: "Category selected",
        passed: article.category.trim().length > 0,
      },
      {
        label: "GS paper selected",
        passed: article.paper.trim().length > 0,
      },
      {
        label: "Why in News completed",
        passed: article.why_news.trim().length >= 40,
      },
      {
        label: "Prelims facts completed",
        passed: article.prelims.trim().length >= 80,
      },
      {
        label: "Mains analysis completed",
        passed: article.mains.trim().length >= 120,
      },
      {
        label: "Possible UPSC question added",
        passed: article.question.trim().length >= 20,
      },
    ];
  }, [article]);

  const completedChecks = reviewChecks.filter(
    (check) => check.passed
  ).length;

  const readinessScore = Math.round(
    (completedChecks / reviewChecks.length) * 100
  );

  const articleReady = completedChecks === reviewChecks.length;

async function fetchNewsFromUrl() {
  if (!newsUrl.trim()) {
    setMessage("Please enter a news URL.");
    return;
  }

  try {
    setLoading(true);
    setMessage("");

    const response = await fetch("/api/fetch-news", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: newsUrl.trim(),
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Failed to fetch news.");
    }

    setNewsText(data.text);

    setMessage("News fetched successfully. You can now generate the UPSC article.");
  } catch (error) {
    console.error(error);

    setMessage(
      error.message || "Unable to fetch the news article."
    );
  } finally {
    setLoading(false);
  }
}

  async function generateArticle() {
    if (!newsUrl.trim() && !newsText.trim()) {
      setMessage("Please enter a news URL or paste news text.");
      return;
    }

    try {
      setLoading(true);
      setMessage("");

      const response = await fetch("/api/ai/generate-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newsUrl: newsUrl.trim(),
          newsText: newsText.trim(),
        }),
      });

      const data = await response.json();

      console.log("AI GENERATOR RESPONSE:", data);

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Article generation failed."
        );
      }

      setArticle({
        ...emptyArticle,
        ...data.article,
      });

      setMessage(
        "Article generated successfully. Review every field before publishing."
      );
    } catch (error) {
      console.error("Article generation error:", error);

      setMessage(
        error.message || "Something went wrong while generating."
      );
    } finally {
      setLoading(false);
    }
  }

  function updateArticleField(field, value) {
    setArticle((currentArticle) => ({
      ...currentArticle,
      [field]: value,
    }));

    setMessage("");
  }

  function validateArticle(status) {
    if (!article.title.trim()) {
      setMessage("Please generate or enter an article title.");
      return false;
    }

    if (!article.category.trim()) {
      setMessage("Please enter an article category.");
      return false;
    }

    if (!article.paper.trim()) {
      setMessage("Please enter the relevant GS paper.");
      return false;
    }

    if (status === "published" && !articleReady) {
      setMessage(
        "Complete all article sections before publishing. You may save it as a draft now."
      );
      return false;
    }

    return true;
  }

  async function saveArticle(status) {
  alert(`Save function started: ${status}`);
  console.log("saveArticle() called", status);

  if (!validateArticle(status)) {
    return;
  }

  try {
    setSavingStatus(status);
    setMessage("");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("SESSION:", session);
console.log("ACCESS TOKEN:", session?.access_token);

    if (sessionError) {
      throw new Error(sessionError.message);
    }

    if (!session?.access_token) {
      throw new Error(
        "Your admin login session is missing or expired. Please log out and log in again."
      );
    }

    const response = await fetch("/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        ...article,
        title: article.title.trim(),
        category: article.category.trim(),
        paper: article.paper.trim(),
        why_news: article.why_news.trim(),
        prelims: article.prelims.trim(),
        mains: article.mains.trim(),
        question: article.question.trim(),
        status,
      }),
    });

    const data = await response.json();

    console.log("SAVE ARTICLE RESPONSE:", data);

    if (!response.ok || !data.success) {
      throw new Error(
        data.message ||
          data.error ||
          `Failed to ${
            status === "published"
              ? "publish article"
              : "save draft"
          }.`
      );
    }

    setMessage(
      data.message ||
        (status === "published"
          ? "Article published successfully."
          : "Draft saved successfully.")
    );
  } catch (error) {
    console.error("Save article error:", error);

    setMessage(
      error.message ||
        `Failed to ${
          status === "published"
            ? "publish article"
            : "save draft"
        }.`
    );
  } finally {
    setSavingStatus("");
  }
}

  function resetGenerator() {
    const confirmed = window.confirm(
      "Clear the current source and generated article?"
    );

    if (!confirmed) {
      return;
    }

    setNewsUrl("");
    setNewsText("");
    setArticle(emptyArticle);
    setMessage("");
  }

  const fieldClass =
    "mb-5 w-full rounded-xl border border-gray-300 bg-white p-3 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          CurrentPulse AI Generator
        </h1>

        <p className="mt-2 max-w-3xl text-gray-600">
          Convert reliable news into an exam-focused current-affairs
          article. Review the generated content before publishing.
        </p>
      </div>

      {message && (
        <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-900">
          {message}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
              Step 1
            </p>

            <h2 className="mt-1 text-2xl font-bold text-gray-900">
              Add a reliable news source
            </h2>
          </div>

          <label
            htmlFor="news-url"
            className="mb-2 block font-semibold text-gray-800"
          >
            News URL
          </label>

          <input
            id="news-url"
            type="url"
            placeholder="https://pib.gov.in/..."
            value={newsUrl}
            onChange={(event) => setNewsUrl(event.target.value)}
            className={fieldClass}
          />

          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-sm font-semibold text-gray-400">
              OR
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <label
            htmlFor="news-text"
            className="mb-2 block font-semibold text-gray-800"
          >
            Paste News Text
          </label>

          <textarea
            id="news-text"
            rows={12}
            placeholder="Paste the news report, official release or source material here..."
            value={newsText}
            onChange={(event) => setNewsText(event.target.value)}
            className={fieldClass}
          />

          <div className="flex flex-wrap gap-3">

<button
  type="button"
  onClick={fetchNewsFromUrl}
  disabled={
    loading ||
    Boolean(savingStatus) ||
    !newsUrl.trim()
  }
  className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {loading ? "Fetching..." : "Fetch News from URL"}
</button>
            <button
              type="button"
              onClick={generateArticle}
              disabled={loading || Boolean(savingStatus)}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Generating and structuring..."
                : "Generate UPSC Article"}
            </button>

            <button
              type="button"
              onClick={resetGenerator}
              disabled={loading || Boolean(savingStatus)}
              className="rounded-xl border border-gray-300 px-6 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </section>

        <aside className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
            Article readiness
          </p>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold text-gray-900">
                {readinessScore}%
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {completedChecks} of {reviewChecks.length} checks
                completed
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                articleReady
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {articleReady ? "Ready" : "Needs review"}
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${readinessScore}%` }}
            />
          </div>

          <div className="mt-6 space-y-3">
            {reviewChecks.map((check) => (
              <div
                key={check.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"
              >
                <span className="text-sm text-gray-700">
                  {check.label}
                </span>

                <span
                  className={`text-sm font-bold ${
                    check.passed
                      ? "text-green-600"
                      : "text-gray-300"
                  }`}
                >
                  {check.passed ? "Passed" : "Pending"}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs leading-5 text-gray-500">
            This readiness check confirms that required sections are
            complete. Important facts should still be compared with the
            original source before publishing.
          </p>
        </aside>
      </div>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-7">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">
            Step 2
          </p>

          <h2 className="mt-1 text-2xl font-bold text-gray-900">
            Review generated article
          </h2>

          <p className="mt-2 text-sm text-gray-500">
            Edit any incorrect, unclear or incomplete information before
            publishing.
          </p>
        </div>

        <label
          htmlFor="article-title"
          className="mb-2 block font-semibold text-gray-800"
        >
          Title
        </label>

        <input
          id="article-title"
          value={article.title}
          onChange={(event) =>
            updateArticleField("title", event.target.value)
          }
          className={fieldClass}
          placeholder="Article title"
        />

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label
              htmlFor="article-category"
              className="mb-2 block font-semibold text-gray-800"
            >
              Category
            </label>

            <select
              id="article-category"
              value={article.category}
              onChange={(event) =>
                updateArticleField("category", event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Select category</option>
              <option value="Polity & Governance">
                Polity & Governance
              </option>
              <option value="Economy">Economy</option>
              <option value="International Relations">
                International Relations
              </option>
              <option value="Science & Technology">
                Science & Technology
              </option>
              <option value="Environment">Environment</option>
              <option value="Defence & Security">
                Defence & Security
              </option>
              <option value="Social Issues">Social Issues</option>
              <option value="Geography">Geography</option>
              <option value="History & Culture">
                History & Culture
              </option>
              <option value="Government Schemes">
                Government Schemes
              </option>
            </select>
          </div>

          <div>
            <label
              htmlFor="article-paper"
              className="mb-2 block font-semibold text-gray-800"
            >
              GS Paper
            </label>

            <select
              id="article-paper"
              value={article.paper}
              onChange={(event) =>
                updateArticleField("paper", event.target.value)
              }
              className={fieldClass}
            >
              <option value="">Select paper</option>
              <option value="Prelims">Prelims</option>
              <option value="GS-1">GS-1</option>
              <option value="GS-2">GS-2</option>
              <option value="GS-3">GS-3</option>
              <option value="GS-4">GS-4</option>
              <option value="Essay">Essay</option>
            </select>
          </div>
        </div>

        <label
          htmlFor="article-why-news"
          className="mb-2 block font-semibold text-gray-800"
        >
          Why in News
        </label>

        <textarea
          id="article-why-news"
          rows={5}
          value={article.why_news}
          onChange={(event) =>
            updateArticleField("why_news", event.target.value)
          }
          className={fieldClass}
          placeholder="Explain the recent development and why the topic is important."
        />

        <label
          htmlFor="article-prelims"
          className="mb-2 block font-semibold text-gray-800"
        >
          Prelims Facts
        </label>

        <textarea
          id="article-prelims"
          rows={8}
          value={article.prelims}
          onChange={(event) =>
            updateArticleField("prelims", event.target.value)
          }
          className={fieldClass}
          placeholder="Important facts, institutions, locations, reports and terminology."
        />

        <label
          htmlFor="article-mains"
          className="mb-2 block font-semibold text-gray-800"
        >
          Mains Perspective
        </label>

        <textarea
          id="article-mains"
          rows={12}
          value={article.mains}
          onChange={(event) =>
            updateArticleField("mains", event.target.value)
          }
          className={fieldClass}
          placeholder="Background, significance, challenges, analysis and way forward."
        />

        <label
          htmlFor="article-question"
          className="mb-2 block font-semibold text-gray-800"
        >
          Possible UPSC Question
        </label>

        <textarea
          id="article-question"
          rows={4}
          value={article.question}
          onChange={(event) =>
            updateArticleField("question", event.target.value)
          }
          className={fieldClass}
          placeholder="Write an analytical UPSC-style mains question."
        />

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={() => saveArticle("draft")}
            disabled={loading || Boolean(savingStatus)}
            className="rounded-xl bg-gray-700 px-6 py-3 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingStatus === "draft"
              ? "Saving Draft..."
              : "Save Draft"}
          </button>

          <button
            type="button"
            onClick={() => saveArticle("published")}
            disabled={
              loading ||
              Boolean(savingStatus) ||
              !articleReady
            }
            className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingStatus === "published"
              ? "Publishing..."
              : "Publish Article"}
          </button>

          {!articleReady && (
            <p className="text-sm text-amber-700">
              Complete all readiness checks to enable publishing.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}