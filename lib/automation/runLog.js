import { createServerSupabase } from "@/lib/supabase-server";

export async function startAutomationRun(jobType) {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("automation_runs")
      .insert([{ job_type: jobType, status: "running" }])
      .select("id")
      .single();

    if (error) throw error;
    return data?.id || null;
  } catch (error) {
    // Logging must never stop publishing; the status API will identify a
    // missing migration separately.
    console.error("[Automation run log] Start failed:", error?.message || error);
    return null;
  }
}

export async function finishAutomationRun(runId, { success, summary, error }) {
  if (!runId) return;

  try {
    const supabase = createServerSupabase();
    const { error: updateError } = await supabase
      .from("automation_runs")
      .update({
        status: success ? "success" : "failed",
        summary: summary || {},
        error: error ? String(error).slice(0, 1000) : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    if (updateError) throw updateError;
  } catch (updateError) {
    console.error("[Automation run log] Completion failed:", updateError?.message || updateError);
  }
}
