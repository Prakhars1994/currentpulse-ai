import Link from "next/link";

const studyLinks = [
  ["Current Affairs", "/current-affairs"],
  ["Daily Quiz", "/quiz"],
  ["PDF Digests", "/pdf"],
  ["Revision Notes", "/notes"],
  ["PYQ Explorer", "/pyq"],
  ["Video Discovery", "/videos"],
];

const categoryLinks = [
  ["Polity & Governance", "/category/polity"],
  ["Economy", "/category/economy"],
  ["International Relations", "/category/international"],
  ["Science & Technology", "/category/science-tech"],
  ["Environment", "/category/environment"],
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-300 print:hidden">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-black text-cyan-400">CurrentPulse AI</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-400">
              Automated, exam-focused current affairs with source-backed analysis,
              prelims facts, mains perspectives and daily revision tools.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/current-affairs"
                className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Start today&apos;s revision
              </Link>
              <Link
                href="/ai"
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold text-white transition hover:border-cyan-400"
              >
                Ask CurrentPulse AI
              </Link>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white">Study tools</h3>
            <ul className="mt-4 space-y-3">
              {studyLinks.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-cyan-400">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white">Explore</h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/categories" className="font-semibold text-cyan-400">
                  All categories
                </Link>
              </li>
              {categoryLinks.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="transition hover:text-cyan-400">
                    {label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/contact" className="transition hover:text-cyan-400">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-slate-800 pt-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} CurrentPulse AI</p>
          <p>Built for focused UPSC and PCS preparation.</p>
        </div>
      </div>
    </footer>
  );
}
