"use client";

import { useState } from "react";

export default function AutomationPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  async function runStep(name, url) {
  setLogs((prev) => [...prev, `⏳ ${name}...`]);

  try {
    const options = {
      method: name === "Fetch RSS News" ? "GET" : "POST",
    };

    if (name === "AI Relevance Check") {
      options.headers = {
        "Content-Type": "application/json",
      };

      options.body = JSON.stringify({
        action: "evaluate",
      });
    }

    if (name === "Generate Articles") {
      options.headers = {
        "Content-Type": "application/json",
      };

      options.body = JSON.stringify({
        action: "generate",
      });
    }

    const res = await fetch(url, options);
    const text = await res.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new Error(
        typeof data === "string"
          ? data
          : JSON.stringify(data)
      );
    }

    setLogs((prev) => [
      ...prev,
      `✅ ${name} completed`,
      typeof data === "string"
        ? data
        : JSON.stringify(data),
    ]);

    return data;
  } catch (err) {
    console.error(err);

    setLogs((prev) => [
      ...prev,
      `❌ ${name} failed`,
      err.message || String(err),
    ]);

    throw err;
  }
}

async function runCompletePipeline() {
  setLogs([
    "🚀 Starting complete CurrentPulse pipeline...",
  ]);

  try {
    await runStep(
      "Fetch RSS News",
      "/api/fetch-all-news"
    );

    await runStep(
      "AI Relevance Check",
      "/api/automation"
    );

   const generated = await runStep(
  "Generate Articles",
  "/api/automation"
);

const articleIds =
  generated?.results
    ?.filter((item) => item.success)
    ?.map((item) => item.articleId) || [];

await fetch("/api/publish-drafts", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    articleIds,
  }),
})
  .then((r) => r.json())
  .then((data) => {
    setLogs((prev) => [
      ...prev,
      "✅ Publish Drafts completed",
      JSON.stringify(data),
    ]);
  });

    setLogs((prev) => [
      ...prev,
      "🎉 Complete pipeline finished successfully.",
    ]);
  } catch (err) {
    setLogs((prev) => [
      ...prev,
      "🛑 Pipeline stopped because one step failed.",
    ]);
  }
}
 
  return (
    <main className="max-w-5xl mx-auto p-10">

      <h1 className="text-4xl font-bold mb-8">
        ⚙️ CurrentPulse Automation
      </h1>

      <div className="grid md:grid-cols-2 gap-5">

        <button
          onClick={() => runStep("Fetch RSS News", "/api/fetch-all-news")}
          className="bg-blue-600 text-white rounded-xl p-4"
        >
          📰 Fetch RSS News
        </button>

        <button
onClick={() => runStep("AI Relevance Check", "/api/automation")}       
   className="bg-purple-600 text-white rounded-xl p-4"
        >
          🧠 Check AI Relevance
        </button>

        <button
          onClick={() => runStep("Generate Articles", "/api/automation")}
          className="bg-green-600 text-white rounded-xl p-4"
        >
          📝 Generate Articles
        </button>

        <button
          onClick={() => runStep("Generate Daily PDF", "/api/generate-pdf")}
          className="bg-orange-600 text-white rounded-xl p-4"
        >
          📄 Generate Daily PDF
        </button>

        <button
          onClick={() => runStep("Publish Drafts", "/api/publish-drafts")}
          className="bg-pink-600 text-white rounded-xl p-4"
        >
          🚀 Publish Drafts
        </button>

      </div>

      <button
        disabled={loading}
        onClick={runCompletePipeline}
        className="mt-10 w-full bg-black text-white rounded-xl p-5 text-xl"
      >
        {loading ? "Running Pipeline..." : "🚀 Run Complete Pipeline"}
      </button>

      <div className="mt-10 bg-gray-100 rounded-xl p-5">

        <h2 className="font-bold text-xl mb-4">
          Execution Log
        </h2>

        {logs.map((log, index) => (
          <p key={index} className="mb-2">
            {log}
          </p>
        ))}

      </div>

    </main>
  );
}