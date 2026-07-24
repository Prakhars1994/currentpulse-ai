import Link from "next/link";

export default function Features() {
  const features = [
    {
      title: "🔥 Daily Current Affairs",
      desc: "Latest national and international news explained for exams.",
      link: "/current-affairs",
    },
    {
      title: "🧠 AI Notes",
      desc: "Short AI-generated notes for quick revision.",
      link: "/notes",
    },
    {
      title: "📄 Daily PDFs",
      desc: "Download concise PDFs every day.",
      link: "/pdf",
    },
    {
      title: "❓ MCQ Quiz",
      desc: "Practice exam-style questions instantly.",
      link: "/quiz",
    },
    {
      title: "📊 PYQ Analysis",
      desc: "Previous year question analysis by topic.",
      link: "/pyq",
    },
    {
      title: "🎥 Video Library",
      desc: "Watch current affairs video summaries.",
      link: "/videos",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <h2 className="mb-12 text-center text-4xl font-bold">
        Everything You Need
      </h2>

      <div className="grid gap-8 md:grid-cols-3">
        {features.map((item, index) => (
          <Link
            href={item.link}
            key={index}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-8 hover:border-cyan-500 transition"
          >
            <h3 className="mb-4 text-2xl font-bold">
              {item.title}
            </h3>

            <p className="text-gray-400">
              {item.desc}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}