import { createHash } from "node:crypto";

const BUCKET = "article-images";
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

function isSupabaseStorageUrl(url = "") {
  return /\.supabase\.co\/storage\/v1\/object\/public\/article-images\//i.test(url);
}

export async function persistRemoteArticleImage(supabase, imageUrl, seed = "article") {
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return "";
  if (isSupabaseStorageUrl(imageUrl)) return imageUrl;

  try {
    const digest = createHash("sha256").update(imageUrl).digest("hex").slice(0, 24);
    const { data: existing } = await supabase.storage.from(BUCKET).list("shared", { limit: 5, search: digest });
    const cached = (existing || []).find((item) => item?.name?.startsWith(`${digest}.`));
    if (cached?.name) {
      return supabase.storage.from(BUCKET).getPublicUrl(`shared/${cached.name}`).data.publicUrl || imageUrl;
    }

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CurrentPulseAI/1.0)",
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.6",
        Referer: new URL(imageUrl).origin,
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(18000),
    });

    if (!response.ok) throw new Error(`Remote image returned HTTP ${response.status}`);

    const contentType = String(response.headers.get("content-type") || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const extension = ALLOWED_TYPES.get(contentType);
    if (!extension) throw new Error(`Unsupported remote image type: ${contentType || "unknown"}`);

    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      throw new Error(`Remote image size is invalid (${bytes.length} bytes)`);
    }

    const filePath = `shared/${digest}.${extension}`;

    const { error } = await supabase.storage.from(BUCKET).upload(filePath, bytes, {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });

    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl || imageUrl;
  } catch (error) {
    console.error("[Image storage] Using remote URL after storage failure:", error?.message || error);
    return imageUrl;
  }
}
