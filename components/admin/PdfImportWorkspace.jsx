"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Loader2,
} from "lucide-react";
import { extractPdfLocally } from "@/lib/pdf/clientExtract";
import { buildPdfImportPreview } from "@/lib/pdf/importFormat";

const CATEGORY_OPTIONS = [
  "Polity & Governance",
  "Economy",
  "International Relations",
  "Science & Technology",
  "Environment",
  "Defence & Security",
  "Social Issues",
  "Geography",
  "History & Culture",
  "Government Schemes",
  "Sports",
  "General News",
];

const PAPER_OPTIONS = [
  "Prelims",
  "GS-1",
  "GS-2",
  "GS-3",
  "GS-4",
  "Essay",
];

function todayIst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ImportPanel({ stream, title, subtitle, publishedAt }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [reading, setReading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState([]);
  const fileInputId = `pdf-file-${stream}`;

  const selectedDrafts = useMemo(
    () =>
      (preview?.drafts || []).filter((article) =>
        selected.has(article.importIndex)
      ),
    [preview, selected]
  );

  function updateDraft(index, field, value) {
    setPreview((current) => {
      if (!current) return current;

      return {
        ...current,
        drafts: current.drafts.map((article) =>
          article.importIndex === index
            ? { ...article, [field]: value }
            : article
        ),
      };
    });
  }

  async function readPdf() {
    if (!file) {
      setMessage("Choose a PDF first.");
      return;
    }

    setReading(true);
    setMessage("");
    setErrors([]);
    setPreview(null);
    setSelected(new Set());

    try {
      const extracted = await extractPdfLocally(file, setProgress);
      const built = buildPdfImportPreview({
        stream,
        fileName: extracted.fileName,
        fileHash: extracted.fileHash,
        pages: extracted.pages,
      });

      setPreview(built);
      setSelected(
        new Set(built.drafts.map((article) => article.importIndex))
      );
      setMessage(
        `${built.drafts.length} article${built.drafts.length === 1 ? "" : "s"} detected. All are selected by default.`
      );
    } catch (error) {
      setMessage(error?.message || "Could not read the PDF.");
    } finally {
      setReading(false);
      setProgress(null);
    }
  }

  function toggle(index) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function publishSelected() {
    if (!preview || !selectedDrafts.length) {
      setMessage("Select at least one detected article.");
      return;
    }

    setPublishing(true);
    setMessage("");
    setErrors([]);

    try {
      let published = 0;
      let duplicates = 0;
      let failed = 0;
      const failures = [];

      for (let offset = 0; offset < selectedDrafts.length; offset += 20) {
        const batch = selectedDrafts.slice(offset, offset + 20);

        const response = await fetch("/api/admin/pdf-import/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stream,
            fileName: preview.fileName,
            fileHash: preview.fileHash,
            publishedAt,
            articles: batch,
          }),
        });

        const data = await response.json();

        if (!response.ok && !data?.results) {
          throw new Error(data?.message || "PDF publish batch failed.");
        }

        published += Number(data?.stats?.published || 0);
        duplicates += Number(data?.stats?.duplicates || 0);
        failed += Number(data?.stats?.failed || 0);

        for (const result of data?.results || []) {
          if (result.status === "failed") {
            failures.push(
              `${result.title || "Article"}: ${result.error || "Failed"}`
            );
          }
        }
      }

      setErrors(failures.slice(0, 8));
      setMessage(
        `Published ${published}; duplicates ${duplicates}; failed ${failed}. ` +
        (published > 0
          ? "Structured articles are in Supabase; the public static reader still needs its incremental release."
          : "")
      );
    } catch (error) {
      setMessage(error?.message || "Could not publish the selected articles.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            {stream === "ca" ? "PDF 1" : stream === "ca_hi" ? "PDF 2" : "PDF 3"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            {subtitle}
          </p>
        </div>
        <FileUp className="h-8 w-8 text-slate-400" />
      </div>

      <div className="sticky top-4 z-20 mt-5 rounded-xl border-2 border-dashed border-blue-300 bg-white p-4 shadow-lg">
        <input
          id={fileInputId}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            setFile(event.target.files?.[0] || null);
            setPreview(null);
            setSelected(new Set());
            setMessage("");
            setErrors([]);
          }}
          className="sr-only"
        />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-slate-950">Upload a PDF</span>
          <label
            htmlFor={fileInputId}
            className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600"
          >
            Choose PDF
          </label>

          {file ? (
            <span className="text-sm font-semibold text-slate-800">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
            </span>
          ) : (
            <span className="text-sm text-slate-700">No PDF selected</span>
          )}

          <button
            type="button"
            onClick={readPdf}
            disabled={!file || reading || publishing}
            className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {reading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading PDF {progress ? `${progress.percent}%` : ""}
              </span>
            ) : (
              "Read PDF & build articles"
            )}
          </button>

        </div>
      </div>

      {preview ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Pages</div>
              <div className="text-xl font-black">{preview.stats.pages}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Articles detected</div>
              <div className="text-xl font-black">
                {preview.stats.articlesDetected}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">Text characters</div>
              <div className="text-xl font-black">
                {preview.stats.extractedChars.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <div className="text-xs text-emerald-700">AI calls</div>
              <div className="text-xl font-black text-emerald-800">0</div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">
              Selected {selected.size}/{preview.drafts.length}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                className="text-xs font-bold text-blue-700"
                onClick={() =>
                  setSelected(
                    new Set(
                      preview.drafts.map((article) => article.importIndex)
                    )
                  )
                }
              >
                Select all
              </button>
              <button
                type="button"
                className="text-xs font-bold text-slate-500"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-[700px] space-y-3 overflow-auto pr-1">
            {preview.drafts.map((article) => (
              <article
                key={article.importIndex}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(article.importIndex)}
                    onChange={() => toggle(article.importIndex)}
                    className="mt-2 h-4 w-4"
                  />

                  <div className="min-w-0 flex-1">
                    <input
                      value={article.title}
                      onChange={(event) =>
                        updateDraft(
                          article.importIndex,
                          "title",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-950"
                    />

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <select
                        value={article.category}
                        onChange={(event) =>
                          updateDraft(
                            article.importIndex,
                            "category",
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {CATEGORY_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      <select
                        value={article.paper}
                        onChange={(event) =>
                          updateDraft(
                            article.importIndex,
                            "paper",
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {PAPER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <details className="mt-3 rounded-lg bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-bold text-slate-700">
                        Preview extracted article ({article.fullText.length.toLocaleString()} chars)
                      </summary>
                      <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-slate-700">
                        {article.fullText}
                      </pre>
                    </details>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={publishSelected}
            disabled={!selected.size || publishing || reading}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            {publishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing selected…
              </>
            ) : (
              `Publish selected (${selected.size})`
            )}
          </button>
        </>
      ) : null}

      {message ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          {message.includes("Published") ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      {errors.length ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function PdfImportWorkspace({ embedded = false }) {
  const [publishedAt, setPublishedAt] = useState(todayIst());

  return (
    <div className={embedded ? "w-full" : "mx-auto max-w-6xl p-6 lg:p-8"}>
      <div className="rounded-2xl bg-slate-950 p-6 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">
          Low-quota ingestion
        </p>
        <h1 className="mt-2 text-3xl font-black">
          {embedded ? "Daily PDF Intake" : "Two-PDF CurrentPulse Import"}
        </h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-300">
          Upload one Current Affairs PDF and one News PDF. The browser reads
          the PDFs locally, removes repeated headers/page numbers, detects
          article headings, preserves the complete extracted text and converts
          it into CurrentPulse article fields. No AI call is used for extraction.
        </p>

        <div className="mt-5 flex items-center gap-3">
          <label htmlFor="pdf-import-date" className="text-sm font-bold">
            Publication date
          </label>
          <input
            id="pdf-import-date"
            type="date"
            value={publishedAt}
            onChange={(event) => setPublishedAt(event.target.value)}
            className="rounded-lg bg-white px-3 py-2 text-slate-950"
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <ImportPanel
          stream="ca"
          title="Current Affairs PDF"
          subtitle="Detected topics are formatted for Current Affairs with category, GS paper, Why in News, Static Foundation, Prelims/Mains fields and complete source text retained."
          publishedAt={publishedAt}
        />

        <ImportPanel
          stream="ca_hi"
          title="हिंदी Current Affairs PDF"
          subtitle="हिंदी PDF ब्राउज़र में ही पढ़ी जाती है और अलग हिंदी Current Affairs archive में प्रकाशित होती है। प्रत्येक publish request अधिकतम 20 लेखों की है; extraction में AI call नहीं होता।"
          publishedAt={publishedAt}
        />

        <ImportPanel
          stream="news"
          title="News PDF"
          subtitle="Detected stories are formatted for the News layout. The complete extracted story is preserved across the lead/context sections, with category and metadata assigned automatically."
          publishedAt={publishedAt}
        />
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        PDF images are not copied into Supabase in this first version. CurrentPulse
        can use its existing safe category visuals, which avoids image copyright
        problems and prevents storage quota growth.
      </div>
    </div>
  );
}
