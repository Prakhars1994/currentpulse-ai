const TABLE = "reader_release_requests";

export async function recordReaderReleaseRequest(supabase, { articleId, stream }) {
  const entityKey = String(articleId || "").trim();
  if (!supabase || !entityKey || !stream) return { durable: false, id: null };

  const { data, error } = await supabase
    .from(TABLE)
    .insert([{ entity_key: entityKey, stream, status: "pending" }])
    .select("id")
    .single();

  if (error) {
    // The application stays deployable before the migration is applied, but
    // the API must surface that durable recovery is unavailable.
    return { durable: false, id: null, error };
  }
  return { durable: true, id: data.id };
}

export async function recordReaderReleaseDispatch(supabase, requestId, error = null) {
  if (!supabase || !requestId) return;
  const values = {
    updated_at: new Date().toISOString(),
    last_dispatched_at: new Date().toISOString(),
    last_error: error ? String(error.reason || "dispatch_failed") : null,
  };
  const { error: updateError } = await supabase
    .from(TABLE)
    .update(values)
    .eq("id", requestId);
  if (updateError) console.error("Reader release outbox update failed:", updateError.message);
}
