"use client";

import { useState } from "react";
import { EXAM_PDF_EXAMS, EXAM_PDF_TYPES } from "@/lib/examPdfs";

export default function ExamPdfWorkspace() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/exam-pdfs", { method: "POST", body: new FormData(event.currentTarget) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Upload failed.");
      setMessage(`${data.message}${data.releaseQueued ? " Public /pdf refresh queued." : " Public refresh still needs the incremental release token."}`);
      event.currentTarget.reset();
    } catch (error) { setMessage(error.message); } finally { setBusy(false); }
  }
  return <main className="p-6 lg:p-10"><div className="mx-auto max-w-3xl"><p className="font-black uppercase tracking-[.2em] text-violet-600">Download library</p><h1 className="mt-2 text-3xl font-black text-slate-950">Exam PDF upload</h1><p className="mt-3 text-slate-600">Publishing replaces the visible card for the selected exam and type. The previous database record and file remain unpublished for rollback.</p>
    <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl border bg-white p-6 shadow-sm">
      <label className="font-bold">Exam<select name="exam_slug" required className="mt-2 w-full rounded-xl border p-3">{EXAM_PDF_EXAMS.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
      <label className="font-bold">PDF type<select name="pdf_type" required className="mt-2 w-full rounded-xl border p-3">{EXAM_PDF_TYPES.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select></label>
      <label className="font-bold">Title<input name="title" required maxLength={160} className="mt-2 w-full rounded-xl border p-3" /></label>
      <label className="font-bold">Description (optional)<textarea name="description" maxLength={500} className="mt-2 w-full rounded-xl border p-3" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="font-bold">Coverage start<input type="date" name="coverage_start" className="mt-2 w-full rounded-xl border p-3" /></label><label className="font-bold">Coverage end<input type="date" name="coverage_end" className="mt-2 w-full rounded-xl border p-3" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="font-bold">Version<input name="version" defaultValue="1.0" maxLength={30} className="mt-2 w-full rounded-xl border p-3" /></label><label className="font-bold">Publication date<input type="date" name="publication_date" className="mt-2 w-full rounded-xl border p-3" /></label></div>
      <label className="font-bold">PDF file<input type="file" name="file" accept="application/pdf,.pdf" required className="mt-2 block w-full rounded-xl border p-3" /></label>
      <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="published" value="true" defaultChecked /> Publish now</label>
      <button disabled={busy} className="rounded-xl bg-violet-600 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? "Uploading…" : "Upload / replace PDF"}</button>
      {message && <p role="status" className="rounded-xl bg-slate-100 p-4 text-sm font-bold text-slate-700">{message}</p>}
    </form></div></main>;
}
