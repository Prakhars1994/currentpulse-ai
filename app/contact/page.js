import Link from "next/link";
import { Mail, MessageSquareText } from "lucide-react";

export const metadata = {
  title: "Contact",
  description: "Contact CurrentPulse AI for support, corrections or partnerships.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-4xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">Support and feedback</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Contact CurrentPulse AI</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
          Report an article correction, suggest a source, share product feedback or discuss a partnership.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <a href="mailto:support@currentpulseai.com" className="rounded-2xl border border-slate-800 bg-slate-900 p-7 transition hover:border-cyan-500">
            <Mail className="text-cyan-400" />
            <h2 className="mt-5 text-xl font-bold">Email support</h2>
            <p className="mt-2 text-slate-400">support@currentpulseai.com</p>
          </a>
          <Link href="/ai" className="rounded-2xl border border-slate-800 bg-slate-900 p-7 transition hover:border-cyan-500">
            <MessageSquareText className="text-cyan-400" />
            <h2 className="mt-5 text-xl font-bold">Study question?</h2>
            <p className="mt-2 text-slate-400">Ask the CurrentPulse AI assistant for an immediate explanation.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
