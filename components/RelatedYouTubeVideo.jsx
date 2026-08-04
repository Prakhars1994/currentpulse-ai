import { CirclePlay, ExternalLink } from "lucide-react";

export default function RelatedYouTubeVideo({ title, category }) {
  const query = [title, category, "UPSC current affairs explanation"]
    .filter(Boolean)
    .join(" ");
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  return (
    <section className="related-video-card" aria-labelledby="related-video-title">
      <div className="related-video-icon" aria-hidden="true">
        <CirclePlay size={34} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-[.18em] text-red-300">
          Watch and revise
        </p>
        <h2 id="related-video-title" className="mt-2 text-2xl font-black text-white">
          Related YouTube explanation
        </h2>
        <p className="mt-2 line-clamp-2 leading-7 text-slate-300">
          Open topic-specific videos for “{title}”. Prefer official, institutional
          or established UPSC education channels and verify dates before revising.
        </p>
      </div>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="related-video-link"
      >
        Find related video <ExternalLink size={16} />
      </a>
    </section>
  );
}
