"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FilePlus2, Search, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";

const STORAGE_KEY = "currentpulse-personal-notes-v1";

function makeNote() {
  const now = new Date().toISOString();
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "Untitled revision note",
    body: "",
    tags: "",
    createdAt: now,
    updatedAt: now,
  };
}

export default function NotesWorkspace() {
  const [notes, setNotes] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
        if (Array.isArray(stored) && stored.length) {
          setNotes(stored);
          setActiveId(stored[0].id);
        }
      } catch {
        // Ignore damaged browser storage and start with a clean workspace.
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  }, [loaded, notes]);

  const filteredNotes = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return notes;
    return notes.filter((note) =>
      `${note.title} ${note.body} ${note.tags}`.toLowerCase().includes(search)
    );
  }, [notes, query]);

  const activeNote = notes.find((note) => note.id === activeId) || null;

  function addNote() {
    const note = makeNote();
    setNotes((current) => [note, ...current]);
    setActiveId(note.id);
  }

  function updateNote(field, value) {
    setNotes((current) =>
      current.map((note) =>
        note.id === activeId
          ? { ...note, [field]: value, updatedAt: new Date().toISOString() }
          : note
      )
    );
  }

  function deleteNote() {
    if (!activeNote || !window.confirm(`Delete “${activeNote.title}”?`)) return;
    const remaining = notes.filter((note) => note.id !== activeNote.id);
    setNotes(remaining);
    setActiveId(remaining[0]?.id || "");
  }

  function exportNote() {
    if (!activeNote) return;
    const safeTitle = activeNote.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const content = `# ${activeNote.title}\n\n${activeNote.tags ? `Tags: ${activeNote.tags}\n\n` : ""}${activeNote.body}`;
    const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeTitle || "currentpulse-note"}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid min-h-[640px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-[320px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950/70 p-5 lg:border-b-0 lg:border-r">
        <button
          type="button"
          onClick={addNote}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950"
        >
          <FilePlus2 size={18} /> New note
        </button>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-3 text-sm outline-none focus:border-cyan-500"
          />
        </div>

        <div className="mt-5 max-h-[470px] space-y-2 overflow-y-auto">
          {filteredNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setActiveId(note.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                note.id === activeId
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-600"
              }`}
            >
              <p className="line-clamp-1 font-bold">{note.title || "Untitled note"}</p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                {note.body || "Empty note"}
              </p>
            </button>
          ))}
          {loaded && !filteredNotes.length && (
            <p className="rounded-xl border border-dashed border-slate-800 p-5 text-center text-sm text-slate-500">
              {query ? "No matching notes." : "Create your first revision note."}
            </p>
          )}
        </div>
      </aside>

      <section className="p-5 sm:p-8">
        {activeNote ? (
          <div className="flex h-full flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-5">
              <p className="text-sm text-slate-500">
                Saved automatically in this browser
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportNote}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold hover:border-cyan-400"
                >
                  <Download size={16} /> Export
                </button>
                <button
                  type="button"
                  onClick={deleteNote}
                  className="inline-flex items-center gap-2 rounded-lg border border-rose-900 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950"
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>

            <input
              value={activeNote.title}
              onChange={(event) => updateNote("title", event.target.value)}
              aria-label="Note title"
              className="mt-7 w-full bg-transparent text-3xl font-black outline-none placeholder:text-slate-700"
              placeholder="Note title"
            />
            <input
              value={activeNote.tags}
              onChange={(event) => updateNote("tags", event.target.value)}
              aria-label="Note tags"
              className="mt-4 w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-cyan-500"
              placeholder="Tags: polity, GS-2, revision"
            />
            <textarea
              value={activeNote.body}
              onChange={(event) => updateNote("body", event.target.value)}
              aria-label="Note content"
              className="mt-5 min-h-[390px] flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950 p-5 leading-7 outline-none focus:border-cyan-500"
              placeholder="Write facts, prelims traps, mains arguments and revision cues…"
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
            <Sparkles className="h-12 w-12 text-cyan-400" />
            <h2 className="mt-5 text-2xl font-bold">Your revision workspace</h2>
            <p className="mt-3 max-w-md text-slate-400">
              Create concise notes, tag them by paper and export them as Markdown whenever needed.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={addNote}
                className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950"
              >
                Create a note
              </button>
              <Link
                href="/ai"
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold"
              >
                Generate with AI
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
