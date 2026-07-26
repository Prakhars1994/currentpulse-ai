"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import slugify from "slugify";
import toast from "react-hot-toast";

import { supabase } from "@/lib/supabase";
import RichTextEditor from "./RichTextEditor";
import ImageUpload from "./ImageUpload";

const articleSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  slug: z.string().min(5, "Slug must be at least 5 characters"),
  category: z.string().min(1, "Category is required"),
  paper: z.string().optional(),
  seo_title: z.string().optional(),
  seo_description: z
    .string()
    .max(160, "Meta description must be less than 160 characters")
    .optional(),
  status: z.enum(["draft", "published"]),
});

export default function ArticleForm({ article = null }) {
  const router = useRouter();
  const isEditing = Boolean(article);

  const [loading, setLoading] = useState(false);

  const [imageUrl, setImageUrl] = useState(
    article?.image || article?.image_url || ""
  );

  const [content, setContent] = useState(article?.content || "");
  const [whyNews, setWhyNews] = useState(article?.why_news || "");
  const [prelims, setPrelims] = useState(article?.prelims || "");
  const [mains, setMains] = useState(article?.mains || "");
  const [question, setQuestion] = useState(article?.question || "");

  const initialTags = Array.isArray(article?.tags)
    ? article.tags.join(", ")
    : article?.tags || "";

  const [tags, setTags] = useState(initialTags);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: article?.title || "",
      slug: article?.slug || "",
      category: article?.category || "",
      paper: article?.paper || "",
      seo_title: article?.seo_title || "",
      seo_description: article?.seo_description || "",
      status: article?.status || "draft",
    },
  });

  const title = watch("title");

  useEffect(() => {
    if (title && !isEditing) {
      const generatedSlug = slugify(title, {
        lower: true,
        strict: true,
        trim: true,
      });

      setValue("slug", generatedSlug, {
        shouldValidate: true,
      });
    }
  }, [title, isEditing, setValue]);

  async function onSubmit(data) {
    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (!session) {
        toast.error("Your session has expired. Please login again.");
        router.replace("/admin/login");
        return;
      }

      const articleData = {
        id: article?.id,
        title: data.title,
        slug: data.slug,
        category: data.category,
        paper: data.paper || "",
        seo_title: data.seo_title || "",
        seo_description: data.seo_description || "",
        status: data.status,

        image: imageUrl || null,
        content,
        why_news: whyNews,
        prelims,
        mains,
        question,

        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      const response = await fetch("/api/articles", {
        method: isEditing ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(articleData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Unable to save the article."
        );
      }

      toast.success(
        result.message ||
          (isEditing
            ? "Article updated successfully."
            : "Article created successfully.")
      );

      router.push("/admin/articles");
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save the article.";

      console.error("Article save error:", error);

      toast.error(message, {
        duration: 10000,
      });
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="rounded-lg bg-white p-6 text-gray-900 shadow">
        <div className="grid grid-cols-1 gap-6">

          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700"
            >
              Article Title *
            </label>

            <input
              id="title"
              type="text"
              {...register("title")}
              className={inputClass}
              placeholder="Enter article title"
            />

            {errors.title && (
              <p className="mt-1 text-sm text-red-600">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-700"
            >
              URL Slug *
            </label>

            <div className="mt-1 flex rounded-md shadow-sm">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm text-gray-500">
                /current-affairs/
              </span>

              <input
                id="slug"
                type="text"
                {...register("slug")}
                className="block w-full flex-1 rounded-r-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="article-slug"
              />
            </div>

            {errors.slug && (
              <p className="mt-1 text-sm text-red-600">
                {errors.slug.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="category"
                className="block text-sm font-medium text-gray-700"
              >
                Category *
              </label>

              <select
                id="category"
                {...register("category")}
                className={inputClass}
              >
                <option value="">Select Category</option>
                <option value="Polity">Polity</option>
                <option value="Economy">Economy</option>
                <option value="Science & Technology">
                  Science &amp; Technology
                </option>
                <option value="Environment">Environment</option>
                <option value="International Relations">
                  International Relations
                </option>
                <option value="History">History</option>
                <option value="Geography">Geography</option>
                <option value="Social Justice">Social Justice</option>
                <option value="Governance">Governance</option>
                <option value="Internal Security">
                  Internal Security
                </option>
                <option value="Ethics">Ethics</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>

              {errors.category && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.category.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="paper"
                className="block text-sm font-medium text-gray-700"
              >
                GS Paper
              </label>

              <select
                id="paper"
                {...register("paper")}
                className={inputClass}
              >
                <option value="">Select GS Paper</option>
                <option value="GS-1">GS Paper 1</option>
                <option value="GS-2">GS Paper 2</option>
                <option value="GS-3">GS Paper 3</option>
                <option value="GS-4">GS Paper 4</option>
                <option value="ESSAY">Essay</option>
                <option value="PRELIMS">Prelims</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Featured Image
            </label>

            <div className="mt-2">
              <ImageUpload
                imageUrl={imageUrl}
                onImageUpload={(url) => setImageUrl(url)}
                onImageRemove={() => setImageUrl("")}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Article Content
            </label>

            <div className="mt-2">
              <RichTextEditor
                content={content}
                onChange={setContent}
                placeholder="Write the full article content"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Why in News
            </label>

            <div className="mt-2">
              <RichTextEditor
                content={whyNews}
                onChange={setWhyNews}
                placeholder="Why is this topic in the news?"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Prelims Facts
            </label>

            <div className="mt-2">
              <RichTextEditor
                content={prelims}
                onChange={setPrelims}
                placeholder="Write important facts for Prelims"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mains Perspective
            </label>

            <div className="mt-2">
              <RichTextEditor
                content={mains}
                onChange={setMains}
                placeholder="Write Mains analysis and perspective"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              UPSC Mains Question
            </label>

            <div className="mt-2">
              <RichTextEditor
                content={question}
                onChange={setQuestion}
                placeholder="Write a possible UPSC Mains question"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              SEO Settings
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="seo_title"
                  className="block text-sm font-medium text-gray-700"
                >
                  SEO Title
                </label>

                <input
                  id="seo_title"
                  type="text"
                  {...register("seo_title")}
                  className={inputClass}
                  placeholder="SEO title, or leave blank to use article title"
                />
              </div>

              <div>
                <label
                  htmlFor="seo_description"
                  className="block text-sm font-medium text-gray-700"
                >
                  Meta Description
                </label>

                <textarea
                  id="seo_description"
                  {...register("seo_description")}
                  rows={3}
                  className={inputClass}
                  placeholder="Meta description, maximum 160 characters"
                />

                {errors.seo_description && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.seo_description.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-gray-700"
                >
                  Tags
                </label>

                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  className={inputClass}
                  placeholder="Economy, Budget, Inflation"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Separate tags with commas.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <fieldset>
              <legend className="text-sm font-medium text-gray-700">
                Status
              </legend>

              <div className="mt-3 flex gap-6">
                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="radio"
                    {...register("status")}
                    value="draft"
                    className="h-4 w-4"
                  />

                  <span className="ml-2 text-sm text-gray-700">
                    Draft
                  </span>
                </label>

                <label className="inline-flex cursor-pointer items-center">
                  <input
                    type="radio"
                    {...register("status")}
                    value="published"
                    className="h-4 w-4"
                  />

                  <span className="ml-2 text-sm text-gray-700">
                    Published
                  </span>
                </label>
              </div>

              {errors.status && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.status.message}
                </p>
              )}
            </fieldset>
          </div>

        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/articles")}
          disabled={loading}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Saving..."
            : isEditing
              ? "Update Article"
              : "Create Article"}
        </button>
      </div>
    </form>
  );
}