import { Download, FileQuestion, Newspaper } from "lucide-react";
import { EXAM_PDF_EXAMS, EXAM_PDF_TYPES, formatCoverage } from "@/lib/examPdfs";

export default function ExamPdfLibrary({ rows = [] }) {
  const byKey = new Map(rows.map((row) => [`${row.exam_slug}:${row.pdf_type}`, row]));
  return (
    <section className="mt-16" aria-labelledby="exam-pdf-library-title">
      <p className="font-black uppercase tracking-[.2em] text-violet-300">Exam-wise downloads</p>
      <h2 id="exam-pdf-library-title" className="mt-2 text-3xl font-black">Yearly updates and MCQ PDFs</h2>
      <p className="mt-3 max-w-3xl text-slate-400">Each exam has one current published file per type. Coverage and version labels update from the admin record.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {EXAM_PDF_EXAMS.flatMap((exam) => EXAM_PDF_TYPES.map((type) => {
          const row = byKey.get(`${exam.slug}:${type.slug}`);
          const Icon = type.slug === "mcq" ? FileQuestion : Newspaper;
          return <article key={`${exam.slug}-${type.slug}`} className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-slate-900 to-violet-950/30 p-6">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-black uppercase text-violet-300">{exam.label}</p><h3 className="mt-1 text-xl font-black">{row?.title || type.label}</h3></div><Icon className="text-violet-300" /></div>
            {row ? <><p className="mt-3 text-sm text-slate-400">{row.description || type.label}</p><p className="mt-4 text-xs font-bold text-slate-500">Coverage: {formatCoverage(row.coverage_start, row.coverage_end)} · v{row.version}</p><a href={row.file_url} download={row.original_filename} target="_blank" rel="noopener noreferrer" type="application/pdf" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-300 px-4 py-2 font-black text-slate-950"><Download size={17} /> Download PDF</a></> : <p className="mt-4 text-sm text-slate-500">Not published yet.</p>}
          </article>;
        }))}
      </div>
    </section>
  );
}
