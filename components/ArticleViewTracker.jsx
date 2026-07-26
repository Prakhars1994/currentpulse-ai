"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ArticleViewTracker({
  slug,
  initialViews = 0,
}) {
  const [views, setViews] = useState(initialViews);

  useEffect(() => {
    if (!slug) return;

    const storageKey = `currentpulse-viewed-${slug}`;

    // Prevent repeated counting during the same browser session.
    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    async function registerView() {
      const { data, error } = await supabase.rpc(
        "increment_article_views",
        {
          article_slug: slug,
        }
      );

      if (error) {
        console.error("Unable to register article view:", error);
        return;
      }

      sessionStorage.setItem(storageKey, "true");

      if (typeof data === "number") {
        setViews(data);
      }
    }

    registerView();
  }, [slug]);

  return (
    <span className="px-4 py-2 rounded-full bg-violet-600 text-white">
      👁️ {views.toLocaleString("en-IN")} Views
    </span>
  );
}