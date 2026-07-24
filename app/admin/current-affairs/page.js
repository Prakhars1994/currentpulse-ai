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

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  function handleImageChange(event) {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) {
      setImage(null);
      setImagePreview("");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      alert("Only JPG, PNG and WEBP images are allowed.");
      event.target.value = "";
      setImage(null);
      setImagePreview("");
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5 MB.");
      event.target.value = "";
      setImage(null);
      setImagePreview("");
      return;
    }

    setImage(selectedFile);
    setImagePreview(URL.createObjectURL(selectedFile));
  }

  function removeImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(null);
    setImagePreview("");

    const fileInput = document.getElementById("article-image");

    if (fileInput) {
      fileInput.value = "";
    }
  }

  async function uploadArticleImage() {
    if (!image) {
      return "";
    }

    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append("file", image);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData.success) {
        throw new Error(
          uploadData.message || "Image upload failed."
        );
      }

      return uploadData.imageUrl;
    } finally {
      setUploadingImage(false);
    }
  }

  async function saveArticle() {
    if (!title.trim()) {
      alert("Please enter the article title.");
      return;
    }

    if (!category.trim()) {
      alert("Please enter the article category.");
      return;
    }

    if (!paper.trim()) {
      alert("Please enter the GS paper.");
      return;
    }

    setPublishing(true);

    try {
      const uploadedImageUrl = await uploadArticleImage();
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
          image: uploadedImageUrl,
status: "published",
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

        removeImage();
      } else {
        alert(data.message || "Failed to publish article.");
      }
    } catch (error) {
      console.error(error);
      alert(error.message || "Failed to publish article.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        CurrentPulse Admin Panel
      </h1>

      <div className="space-y-4">

        <input
          className="border p-3 w-full rounded"
          placeholder="Article Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          className="border p-3 w-full rounded"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />

        <input
          className="border p-3 w-full rounded"
          placeholder="GS Paper (Example: GS-2)"
          value={paper}
          onChange={(e) => setPaper(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-28 rounded"
          placeholder="Why in News"
          value={whyNews}
          onChange={(e) => setWhyNews(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-28 rounded"
          placeholder="Prelims Facts"
          value={prelims}
          onChange={(e) => setPrelims(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-32 rounded"
          placeholder="Mains Perspective"
          value={mains}
          onChange={(e) => setMains(e.target.value)}
        />

        <textarea
          className="border p-3 w-full h-24 rounded"
          placeholder="Practice Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <div className="border rounded p-4">
          <label
            htmlFor="article-image"
            className="block font-semibold mb-2"
          >
            Article Image
          </label>

          <input
            id="article-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleImageChange}
            className="block w-full"
          />

          <p className="text-sm text-gray-500 mt-2">
            JPG, PNG or WEBP. Maximum size: 5 MB.
          </p>

          {imagePreview && (
            <div className="mt-4">
              <img
                src={imagePreview}
                alt="Article preview"
                className="w-full max-h-80 object-cover rounded border"
              />

              <button
                type="button"
                onClick={removeImage}
                className="mt-3 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
              >
                Remove Image
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={saveArticle}
          disabled={publishing}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded"
        >
          {publishing
            ? uploadingImage
              ? "Uploading Image..."
              : "Publishing Article..."
            : "Publish Article"}
        </button>

      </div>
    </main>
  );
}