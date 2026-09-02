import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Usage Policy",
  description: "AI is not used to collect or rewrite administrator-published Current Affairs and News during ingestion. Separate AI study features may remain available to users.",
  alternates: { canonical: `${SITE_URL}/ai-usage-policy` },
};

const sections = [
  {
    heading: "Current Affairs and News",
    bullets: [
      "AI is not used to collect external Current Affairs or News sources for publication.",
      "AI is not used to rewrite, merge or deduplicate administrator-selected PDF articles during ingestion.",
      "The administrator reviews detected PDF articles and decides what is published."
    ]
  },
  {
    heading: "Separate AI features",
    bullets: [
      "CurrentPulse may provide separate user-requested AI study or question-answering features outside the manual publishing path.",
      "AI-generated explanations are educational material and should not be treated as an official examination-authority notice.",
      "For consequential exam actions, use the linked official authority notice surfaced by ResultPulse or the issuing authority directly."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="AI Usage Policy"
      intro="The Current Affairs and News publishing path is manual. AI is not an ingestion, rewriting or publication-selection step for administrator-supplied PDFs/content."
      sections={sections}
    />
  );
}
