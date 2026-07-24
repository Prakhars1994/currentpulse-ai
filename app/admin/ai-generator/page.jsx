"use client";

import { useState } from "react";

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
  const [article, setArticle] = useState(emptyArticle);

  async function generateArticle() {
    if (!newsUrl.trim() && !newsText.trim()) {
      alert("Please enter a news URL or paste news text.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/ai/generate-article", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newsUrl,
          newsText,
        }),
      });

     const data = await response.json();

console.log("API RESPONSE:", data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Article generation failed.");
      }

      setArticle({
        ...emptyArticle,
        ...data.article,
      });
    } catch (error) {
      console.error("Article generation error:", error);
      alert(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function updateArticleField(field, value) {
    setArticle((currentArticle) => ({
      ...currentArticle,
      [field]: value,
    }));
  }

async function saveDraft() {
  if (!article.title.trim()) {
    alert("Generate or enter an article title first.");
    return;
  }

  try {
    const response = await fetch("/api/articles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...article,
        status: "draft",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to save draft.");
    }

    alert("Draft saved successfully.");
  } catch (error) {
    console.error("Save draft error:", error);
    alert(error.message || "Failed to save draft.");
  }
}

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <h1 className="mb-2 text-3xl font-bold sm:text-4xl">
        🤖 CurrentPulse AI Generator
      </h1>

      <p className="mb-8 text-gray-500">
        Paste a news URL or article text. AI will generate a complete UPSC
        article.
      </p>

      <section className="rounded-xl bg-white p-6 shadow-lg">
        <label
          htmlFor="news-url"
          className="font-semibold text-gray-800"
        >
          News URL
        </label>

        <input
          id="news-url"
          type="url"
          placeholder="https://pib.gov.in/..."
          value={newsUrl}
          onChange={(event) => setNewsUrl(event.target.value)}
          className="mt-2 mb-6 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
        />

        <div className="mb-6 text-center font-semibold text-gray-500">
          OR
        </div>

        <label
          htmlFor="news-text"
          className="font-semibold text-gray-800"
        >
          Paste News Text
        </label>

        <textarea
          id="news-text"
          rows={10}
          placeholder="Paste the complete news article here..."
          value={newsText}
          onChange={(event) => setNewsText(event.target.value)}
          className="mt-2 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
        />

        <button
          type="button"
          onClick={generateArticle}
          disabled={loading}
          className="mt-8 rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating Article..." : "🚀 Generate Article"}
        </button>
      </section>

      <section className="mt-12 rounded-xl bg-white p-6 shadow-lg">
        <h2 className="mb-6 text-2xl font-bold">
          Generated Article
        </h2>

        <label
          htmlFor="article-title"
          className="mb-2 block font-semibold"
        >
          Title
        </label>

        <input
          id="article-title"
          value={article.title}
          onChange={(event) =>
            updateArticleField("title", event.target.value)
          }
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="Article title"
        />

        <label
          htmlFor="article-category"
          className="mb-2 block font-semibold"
        >
          Category
        </label>

        <input
          id="article-category"
          value={article.category}
          onChange={(event) =>
            updateArticleField("category", event.target.value)
          }
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="Science & Technology"
        />

        <label
          htmlFor="article-paper"
          className="mb-2 block font-semibold"
        >
          GS Paper
        </label>

        <input
          id="article-paper"
          value={article.paper}
          onChange={(event) =>
            updateArticleField("paper", event.target.value)
          }
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="GS-3"
        />

        <label
          htmlFor="article-why-news"
          className="mb-2 block font-semibold"
        >
          Why in News
        </label>

        <textarea
          id="article-why-news"
          rows={4}
          value={article.why_news}
          onChange={(event) =>
            updateArticleField("why_news", event.target.value)
          }
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="Why this topic is currently in the news"
        />

        <label
          htmlFor="article-prelims"
          className="mb-2 block font-semibold"
        >
          Prelims Facts
        </label>

        <textarea
          id="article-prelims"
          rows={6}
          value={article.prelims}
          onChange={(event) =>
            updateArticleField("prelims", event.target.value)
          }
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="Important prelims facts"
        />

        <label
          htmlFor="article-mains"
          className="mb-2 block font-semibold"
        >
          Mains Perspective
        </label>

        <textarea
          id="article-mains"
          rows={8}
          value={article.mains}
          onChange={(event) =>
            updateArticleField("mains", event.target.value)
          }
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="Mains analysis, challenges and way forward"
        />

        <label
          htmlFor="article-question"
          className="mb-2 block font-semibold"
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
          className="mb-4 w-full rounded-lg border p-3 outline-none focus:border-blue-500"
          placeholder="Possible UPSC mains question"
        />

        <div className="mt-6 flex flex-wrap gap-4">
         <button
  type="button"
  onClick={saveDraft}
  className="rounded-lg bg-gray-700 px-6 py-3 text-white hover:bg-gray-800"
>
  Save Draft
</button>

          <button
            type="button"
            className="rounded-lg bg-green-600 px-6 py-3 text-white hover:bg-green-700"
          >
            Publish
          </button>
        </div>
      </section>
    </main>
  );
}