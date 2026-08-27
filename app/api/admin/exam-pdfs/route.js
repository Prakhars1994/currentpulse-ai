import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { EXAM_PDF_EXAM_SLUGS, EXAM_PDF_TYPE_SLUGS } from "@/lib/examPdfs";
import { requestReaderRelease } from "@/lib/publisher/requestReaderRelease";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_PDF_SIZE = 25 * 1024 * 1024;
const clean = (value, limit = 500) => String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);

export async function POST(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;
  let uploadedPath = "";
  try {
    const form = await request.formData();
    const examSlug = clean(form.get("exam_slug"), 30);
    const pdfType = clean(form.get("pdf_type"), 30);
    const title = clean(form.get("title"), 160);
    const description = clean(form.get("description"));
    const version = clean(form.get("version"), 30) || "1.0";
    const coverageStart = clean(form.get("coverage_start"), 10) || null;
    const coverageEnd = clean(form.get("coverage_end"), 10) || null;
    const publicationDate = clean(form.get("publication_date"), 10) || new Date().toISOString().slice(0, 10);
    const published = form.get("published") === "true";
    const file = form.get("file");
    if (!EXAM_PDF_EXAM_SLUGS.has(examSlug) || !EXAM_PDF_TYPE_SLUGS.has(pdfType) || !title) return NextResponse.json({ success: false, message: "Choose a supported exam/type and enter a title." }, { status: 400 });
    if (!(file instanceof File) || file.type !== "application/pdf" || !/\.pdf$/i.test(file.name)) return NextResponse.json({ success: false, message: "Choose a valid PDF file." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_PDF_SIZE) return NextResponse.json({ success: false, message: "PDF must be between 1 byte and 25 MB." }, { status: 400 });
    if (coverageStart && coverageEnd && coverageStart > coverageEnd) return NextResponse.json({ success: false, message: "Coverage start cannot be after coverage end." }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-100);
    uploadedPath = `${examSlug}/${pdfType}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await auth.supabase.storage.from("exam-pdfs").upload(uploadedPath, Buffer.from(await file.arrayBuffer()), { contentType: "application/pdf", cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicData } = auth.supabase.storage.from("exam-pdfs").getPublicUrl(uploadedPath, { download: safeName });

    const updatedAt = new Date().toISOString();
    const { data: inserted, error: insertError } = await auth.supabase.rpc("publish_exam_pdf_atomic", {
      p_exam_slug: examSlug,
      p_pdf_type: pdfType,
      p_title: title,
      p_description: description || null,
      p_coverage_start: coverageStart,
      p_coverage_end: coverageEnd,
      p_file_url: publicData.publicUrl,
      p_storage_path: uploadedPath,
      p_original_filename: safeName,
      p_version: version,
      p_published: published,
      p_created_at: `${publicationDate}T12:00:00Z`,
      p_updated_at: updatedAt,
    }).single();
    if (insertError) throw insertError;
    let releaseQueued = false;
    if (published) { try { await requestReaderRelease({ articleId: `exam-pdf-${inserted.inserted_id}`, stream: "pdf" }); releaseQueued = true; } catch (error) { console.error("Exam PDF reader refresh not queued:", error.message); } }
    return NextResponse.json({ success: true, releaseQueued, message: inserted.previous_id ? "Published replacement; previous edition retained as unpublished." : published ? "Exam PDF published." : "Exam PDF saved as draft." });
  } catch (error) {
    if (uploadedPath) await auth.supabase.storage.from("exam-pdfs").remove([uploadedPath]);
    return NextResponse.json({ success: false, message: error?.message || "Exam PDF upload failed." }, { status: 500 });
  }
}
