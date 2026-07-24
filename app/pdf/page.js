export default function PdfPage() {
  return (
    <main className="min-h-screen bg-slate-100 py-16">
      <div className="mx-auto max-w-5xl px-6">
        <div className="rounded-3xl bg-white p-8 shadow-lg md:p-12">
          <p className="font-semibold uppercase tracking-widest text-cyan-600">
            CurrentPulse AI
          </p>

          <h1 className="mt-3 text-4xl font-bold text-slate-900">
            Current Affairs PDFs
          </h1>

          <p className="mt-4 text-lg leading-8 text-slate-600">
            Daily, weekly, and monthly UPSC current affairs PDFs will be
            available here soon.
          </p>

          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
            <h2 className="text-xl font-bold text-slate-900">
              PDF Library Coming Soon
            </h2>

            <p className="mt-2 text-slate-600">
              We are preparing revision-friendly current affairs material for
              UPSC, PCS, SSC, and other competitive examinations.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}