import { createServerSupabase } from "@/lib/supabase-server";

export const EXAM_PDF_EXAMS = [
  { slug: "ssc", label: "SSC" },
  { slug: "bpsc", label: "BPSC" },
  { slug: "banking", label: "Banking" },
  { slug: "uppcs", label: "UPPCS" },
];
export const EXAM_PDF_TYPES = [
  { slug: "yearly-updates", label: "One-year updates" },
  { slug: "mcq", label: "Exam MCQs" },
];
export const EXAM_PDF_EXAM_SLUGS = new Set(EXAM_PDF_EXAMS.map((item) => item.slug));
export const EXAM_PDF_TYPE_SLUGS = new Set(EXAM_PDF_TYPES.map((item) => item.slug));

export function formatCoverage(start, end) {
  if (!start && !end) return "Current edition";
  const format = (value) => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" }) : "Open";
  return `${format(start)} – ${format(end)}`;
}

export async function loadPublishedExamPdfs() {
  try {
    const { data, error } = await createServerSupabase().from("exam_pdfs")
      .select("id,exam_slug,pdf_type,title,description,coverage_start,coverage_end,file_url,original_filename,version,updated_at")
      .eq("published", true).order("updated_at", { ascending: false });
    if (error) {
      if (error.code !== "42P01") console.error("Exam PDF library query failed:", error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error("Exam PDF library unavailable:", error?.message || error);
    return [];
  }
}
