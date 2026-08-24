import { createServerSupabase } from "@/lib/supabase-server";

const STALE_RUN_AGE_HOURS = 6;

export async function startAutomationRun(jobType) {
  try {
    const supabase = createServerSupabase();
    const staleBefore = new Date(
      Date.now() - STALE_RUN_AGE_HOURS * 60 * 60 * 1000
    ).toISOString();

    // A terminated Worker can leave a run open forever. Repair only old runs;
    // concurrent current work remains untouched.
    const { error: staleRunError } = await supabase
      .from("automation_runs")
      .update({
        status: "failed",
        error: "Marked failed by stale-run recovery when a later automation run started.",
        completed_at: new Date().toISOString(),
      })
      .eq("status", "running")
      .lt("started_at", staleBefore);

    if (staleRunError) throw staleRunError;

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
