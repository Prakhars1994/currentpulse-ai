import Link from "next/link";

export default function TrustPage({ kicker, title, intro, sections = [] }) {
  return (
    <main className="min-h-screen bg-slate-950 py-12 text-white sm:py-16">
      <article className="mx-auto max-w-4xl px-5 sm:px-6">
        <header className="rounded-3xl border border-cyan-400/15 bg-slate-900/80 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[.2em] text-cyan-300">
            {kicker}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">{intro}</p>
        </header>

        <div className="mt-8 space-y-6">
          {sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 sm:p-8">
              <h2 className="text-2xl font-black text-white">{section.heading}</h2>
              {(section.paragraphs || []).map((paragraph) => (
                <p key={paragraph} className="mt-4 leading-7 text-slate-300">{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul className="mt-4 list-disc space-y-2 pl-6 leading-7 text-slate-300">
                  {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-800 p-5 text-slate-300">
          Questions or corrections? <Link className="font-bold text-cyan-300" href="/contact">Contact CurrentPulse</Link>.
        </div>
      </article>
    </main>
  );
}
