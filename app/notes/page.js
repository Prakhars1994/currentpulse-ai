import NotesWorkspace from "@/components/NotesWorkspace";

export const metadata = {
  title: "Revision Notes",
  description: "Create, search and export personal UPSC current-affairs revision notes.",
  alternates: { canonical: "/notes" },
};

export default function NotesPage() {
  return (
    <main className="notes-page-theme min-h-screen px-6 py-14 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="font-bold uppercase tracking-[0.24em] text-fuchsia-300">Personal workspace</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Revision notes</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
          Capture important facts, mains arguments and revision cues. Notes save automatically on this device.
        </p>
        <div className="mt-10">
          <NotesWorkspace />
        </div>
      </div>
    </main>
  );
}
