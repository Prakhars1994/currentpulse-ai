"use client";

import { useState } from "react";

export default function AdminPage() {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [paper, setPaper] = useState("");
  const [whyNews, setWhyNews] = useState("");
  const [prelims, setPrelims] = useState("");
  const [mains, setMains] = useState("");
  const [question, setQuestion] = useState("");

  async function saveArticle() {
    try {
      const response = await fetch("/api/articles", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          category,
          paper,
          why_news: whyNews,
          prelims,
          mains,
          question,
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert("✅ Article Published Successfully!");

        setTitle("");
        setCategory("");
        setPaper("");
        setWhyNews("");
        setPrelims("");
        setMains("");
        setQuestion("");
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error(error);
      alert("Failed to publish article.");
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        CurrentPulse Admin Panel
      </h1>

      <div className="space-y-4">

        <input
          className="border p-3 w-full"
          placeholder="Article Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="border p-3 w-full"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          className="border p-3 w-full"
          placeholder="GS Paper (Example: GS-2)"
          value={paper}
          onChange={(e) => setPaper(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-28"
          placeholder="Why in News"
          value={whyNews}
          onChange={(e) => setWhyNews(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-28"
          placeholder="Prelims Facts"
          value={prelims}
          onChange={(e) => setPrelims(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-32"
          placeholder="Mains Perspective"
          value={mains}
          onChange={(e) => setMains(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-24"
          placeholder="Practice Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button
          onClick={saveArticle}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded"
        >
          Publish Article
        </button>

      </div>
    </main>
  );
}