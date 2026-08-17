export default function ArticleViewTracker() {
  // Public reader views are intentionally not written to Supabase.
  // At scale this component used to create one database write per browser
  // session/article, including hot-row contention on viral stories.
  // Use Cloudflare/Web Analytics or asynchronous sampled aggregation instead.
  return null;
}
