import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Editorial Methodology",
  description: "CurrentPulse uses deterministic source collection, deduplication, taxonomy checks and AI-assisted synthesis. The goal is a source-grounded revision product",
  alternates: { canonical: `${SITE_URL}/editorial-methodology` },
};

const sections = [
  {
    "heading": "Publishing workflow",
    "bullets": [
      "Collect configured sources and retain source URLs and timestamps.",
      "Reject navigation, promotional, stale and non-article pages.",
      "Merge only strong same-event coverage and preserve distinct topics separately.",
      "Use AI to reorganize retained source material into reader-ready or exam-ready structure.",
      "Run publication-safety, taxonomy, duplication and quality checks before public display."
    ]
  },
  {
    "heading": "Corrections and updates",
    "bullets": [
      "Material errors can be reported through the Contact page.",
      "Articles may be corrected, enriched, merged or removed from public display when later checks identify a quality problem."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Editorial Methodology"
      intro="CurrentPulse uses deterministic source collection, deduplication, taxonomy checks and AI-assisted synthesis. The goal is a source-grounded revision product rather than a copy of any publisher."
      sections={sections}
    />
  );
}
