import Link from "next/link";
import {
  ArrowUpRight,
  BrainCircuit,
  FileDown,
  LibraryBig,
  ListChecks,
  Newspaper,
  PlayCircle,
} from "lucide-react";

export default function Features() {
  const features = [
    {
      title: "Daily Current Affairs",
      desc: "Syllabus-linked briefs with static context, evidence and answer frameworks.",
      link: "/current-affairs",
      icon: Newspaper,
    },
    {
      title: "Revision Notes",
      desc: "Create, search, auto-save and export personal study notes.",
      link: "/notes",
      icon: BrainCircuit,
    },
    {
      title: "Daily PDFs",
      desc: "Build printable daily, weekly and monthly compilations.",
      link: "/pdf",
      icon: FileDown,
    },
    {
      title: "Prelims Quiz",
      desc: "Attempt quality-gated statement questions with complete explanations.",
      link: "/quiz",
      icon: ListChecks,
    },
    {
      title: "PYQ Analysis",
      desc: "Filter PYQ themes and open structured answer frameworks.",
      link: "/pyq",
      icon: LibraryBig,
    },
    {
      title: "Video Discovery",
      desc: "Discover topic-wise video explainers for recent articles.",
      link: "/videos",
      icon: PlayCircle,
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-black uppercase tracking-[.22em] text-cyan-400">One revision workflow</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">From today&apos;s news to exam-day recall</h2>
        <p className="mt-4 text-lg leading-8 text-slate-400">Read, connect, practise and revise without moving between scattered tools.</p>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((item) => {
          const Icon = item.icon;
          return (
          <Link
            href={item.link}
            key={item.link}
            className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-7 transition hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-2xl hover:shadow-cyan-950/20"
          >
            <div className="flex items-center justify-between">
              <span className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300 ring-1 ring-cyan-400/20"><Icon size={23} /></span>
              <ArrowUpRight className="text-slate-600 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-cyan-300" />
            </div>
            <h3 className="mb-3 mt-6 text-xl font-black">
              {item.title}
            </h3>

            <p className="text-gray-400">
              {item.desc}
            </p>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
