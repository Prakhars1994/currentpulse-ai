import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-slate-800 bg-slate-950 text-gray-300">
      <div className="mx-auto max-w-7xl px-6 py-16">

        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-5">

          {/* Brand */}
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-bold text-cyan-400">
              CurrentPulse AI
            </h2>

            <p className="mt-5 leading-8 text-gray-400">
              Daily UPSC Current Affairs, Editorial Analysis,
              Prelims Facts, Mains Perspective,
              PYQs, AI-powered explanations,
              quizzes and downloadable study material.
            </p>

            <div className="mt-6 flex gap-3">
              <span className="rounded-full bg-cyan-600 px-3 py-1 text-sm text-white">
                UPSC
              </span>

              <span className="rounded-full bg-blue-600 px-3 py-1 text-sm text-white">
                PCS
              </span>

              <span className="rounded-full bg-emerald-600 px-3 py-1 text-sm text-white">
                SSC
              </span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-bold text-white">
              Quick Links
            </h3>

            <ul className="mt-5 space-y-3">
              <li>
                <Link href="/current-affairs" className="hover:text-cyan-400">
                  Current Affairs
                </Link>
              </li>

              <li>
                <Link href="/categories" className="hover:text-cyan-400">
                  Categories
                </Link>
              </li>

              <li>
                <Link href="/editorials" className="hover:text-cyan-400">
                  Editorials
                </Link>
              </li>

              <li>
                <Link href="/ai" className="hover:text-cyan-400">
                  AI Assistant
                </Link>
              </li>

              <li>
                <Link href="/quiz" className="hover:text-cyan-400">
                  Quiz
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-bold text-white">
              Categories
            </h3>

            <ul className="mt-5 space-y-3">
              <li>Polity</li>
              <li>Economy</li>
              <li>Science & Technology</li>
              <li>Environment</li>
              <li>International Relations</li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-bold text-white">
              Company
            </h3>

            <ul className="mt-5 space-y-3">
              <li>
                <Link href="/about" className="hover:text-cyan-400">
                  About
                </Link>
              </li>

              <li>
                <Link href="/contact" className="hover:text-cyan-400">
                  Contact
                </Link>
              </li>

              <li>
                <Link href="/privacy-policy" className="hover:text-cyan-400">
                  Privacy Policy
                </Link>
              </li>

              <li>
                <Link href="/terms" className="hover:text-cyan-400">
                  Terms & Conditions
                </Link>
              </li>

              <li>
                <Link href="/disclaimer" className="hover:text-cyan-400">
                  Disclaimer
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Newsletter */}
        <div className="mt-16 rounded-2xl border border-slate-800 bg-slate-900 p-8">

          <h3 className="text-2xl font-bold text-white">
            Stay Updated
          </h3>

          <p className="mt-3 text-gray-400">
            Get daily UPSC current affairs delivered directly to your inbox.
          </p>

          <div className="mt-6 flex flex-col gap-4 md:flex-row">
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-5 py-4 text-white outline-none focus:border-cyan-500"
            />

            <button className="rounded-xl bg-cyan-500 px-8 py-4 font-bold text-black transition hover:bg-cyan-400">
              Subscribe
            </button>
          </div>

        </div>

        {/* Bottom */}
        <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-slate-800 pt-8 md:flex-row">

          <p className="text-gray-500">
            © {year} CurrentPulse AI. All Rights Reserved.
          </p>

          <p className="text-gray-500">
            Made with ❤️ for UPSC Aspirants
          </p>

          <div className="flex gap-6 text-xl">
            <a href="#" className="hover:text-cyan-400">
              GitHub
            </a>

            <a href="#" className="hover:text-cyan-400">
              X
            </a>

            <a href="#" className="hover:text-cyan-400">
              LinkedIn
            </a>

            <a href="#" className="hover:text-cyan-400">
              Telegram
            </a>
          </div>

        </div>

      </div>
    </footer>
  );
}