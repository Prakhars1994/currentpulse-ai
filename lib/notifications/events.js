import { SITE_URL } from "@/lib/siteUrl";

export async function enqueueNotificationEvent(supabase, event = {}) {
  if (!supabase || !event?.title || !event?.url || !event?.topic) return null;
  const entityKey = String(event.entityKey || `${event.topic}:${event.url}`).slice(0, 500);
  const payload = {
    entity_key: entityKey,
    topic: String(event.topic).slice(0, 80),
    title: String(event.title).slice(0, 240),
    summary: String(event.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500) || null,
    url: String(event.url).startsWith("http") ? String(event.url) : `${SITE_URL}${event.url}`,
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("notification_events")
    .upsert(payload, { onConflict: "entity_key", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();
  // The notification migration may not be installed yet; publishing must never
  // fail just because alerts are not activated.
  if (error && error.code !== "42P01" && error.code !== "23505") {
    console.warn("[Notifications] Event enqueue failed:", error.message);
  }
  return data || null;
}
