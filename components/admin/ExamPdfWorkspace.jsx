"use client";

import { useState } from "react";
import { EXAM_PDF_EXAMS, EXAM_PDF_TYPES } from "@/lib/examPdfs";
import { readerReleaseAdminMessage } from "@/lib/publisher/readerReleaseResult";

export default function ExamPdfWorkspace() {
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/exam-pdfs", { method: "POST", body: new FormData(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Upload failed.");
      setMessageTone("success");
      setMessage(`${data.message}${data.releaseQueued ? " Public /pdf refresh queued." : ` Public reader refresh was not queued: ${readerReleaseAdminMessage(data.readerRefresh?.reason)}`}`);
      form.reset();
    } catch (error) {
      setMessageTone("error");
      setMessage(error.message);
    } finally { setBusy(false); }
  }

  async function refreshPublicPdf() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/exam-pdfs/refresh", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Refresh request failed.");
      setMessageTone(data.releaseQueued ? "success" : "error");
      setMessage(data.releaseQueued ? "Public /pdf refresh queued." : `Public reader refresh was not queued: ${readerReleaseAdminMessage(data.readerRefresh?.reason)}`);
    } catch (error) {
      setMessageTone("error"); setMessage(error.message);
    } finally { setBusy(false); }
  }

  const labelClass = "block min-w-0 font-bold text-slate-800";
  const controlClass = "mt-2 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

  return (
    <section className="py-2 lg:py-4" aria-labelledby="exam-pdf-upload-title">
      <div className="mx-auto max-w-3xl">
        <p className="font-black uppercase tracking-[.2em] text-violet-700">Download library</p>
        <h1 id="exam-pdf-upload-title" className="mt-2 text-3xl font-black text-slate-950">Exam PDF upload</h1>
        <p className="mt-3 text-slate-600">Publishing replaces the visible card for the selected exam and type. The previous database record and file remain unpublished for rollback.</p>
        <form onSubmit={submit} className="mt-8 grid min-w-0 gap-6 rounded-2xl border border-slate-300 bg-white p-5 text-slate-900 shadow-md sm:p-7">
          <label className={labelClass}>Exam
            <select name="exam_slug" required className={controlClass}>{EXAM_PDF_EXAMS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select>
          </label>
          <label className={labelClass}>PDF type
            <select name="pdf_type" required className={controlClass}>{EXAM_PDF_TYPES.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select>
          </label>
          <label className={labelClass}>Title
            <input name="title" required maxLength={160} placeholder="PDF title" className={controlClass} />
          </label>
          <label className={labelClass}>Description (optional)
            <textarea name="description" maxLength={500} rows={4} placeholder="Describe the PDF coverage" className={controlClass} />
          </label>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className={labelClass}>Coverage start<input type="date" name="coverage_start" className={controlClass} /></label>
            <label className={labelClass}>Coverage end<input type="date" name="coverage_end" className={controlClass} /></label>
          </div>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className={labelClass}>Version<input name="version" defaultValue="1.0" maxLength={30} className={controlClass} /></label>
            <label className={labelClass}>Publication date<input type="date" name="publication_date" className={controlClass} /></label>
          </div>
          <label className={labelClass}>PDF file
            <input type="file" name="file" accept="application/pdf,.pdf" required className={`${controlClass} max-w-full cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-bold file:text-slate-800 hover:file:bg-slate-200`} />
          </label>
          <label className="flex items-center gap-3 font-bold text-slate-800">
            <input type="checkbox" name="published" value="true" defaultChecked className="h-5 w-5 rounded border-slate-400 accent-violet-600 focus:ring-2 focus:ring-violet-500/40" />
            Publish now
          </label>
          <button disabled={busy} className="rounded-xl bg-violet-700 px-5 py-3 font-black text-white shadow-sm hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-100">
            {busy ? "Uploading…" : "Upload / replace PDF"}
          </button>
          <button type="button" onClick={refreshPublicPdf} disabled={busy} className="rounded-xl border border-violet-300 bg-white px-5 py-3 font-black text-violet-800 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">
            Refresh public PDF page
          </button>
          {message && <p role="status" className={`rounded-xl border p-4 text-sm font-bold ${messageTone === "error" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{message}</p>}
        </form>
      </div>
    </section>
  );
}
