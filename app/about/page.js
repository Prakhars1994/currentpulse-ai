import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "About CurrentPulse",
  description: "CurrentPulse is an independent educational platform for administrator-published Current Affairs, News, study tools and official-source ResultPulse exam updates.",
  alternates: { canonical: `${SITE_URL}/about` },
};

const sections = [
  {
    heading: "What we publish",
    bullets: [
      "General News is kept separate from UPSC Current Affairs.",
      "Current Affairs and News are published only from administrator-supplied PDFs or administrator-created content; external source collection is disabled.",
      "Administrator-selected PDF text is preserved rather than automatically rewritten, merged or deduplicated during ingestion.",
      "ResultPulse separately surfaces official-source exam and recruitment updates with links back to the issuing authority."
    ]
  },
  {
    heading: "What CurrentPulse is not",
    bullets: [
      "CurrentPulse is not a government website and is not affiliated with UPSC, SSC, NTA or any other examination authority.",
      "Students should use official authority links for final confirmation of results, deadlines, applications and eligibility."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="About CurrentPulse"
      intro="CurrentPulse is an independent educational platform built to help UPSC and PCS learners use administrator-published Current Affairs and News alongside revision tools and official exam updates."
      sections={sections}
    />
  );
}
