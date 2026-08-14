import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Usage Policy",
  description: "AI assists CurrentPulse with summarization, restructuring, classification and study-tool generation. It is not treated as an independent source for fresh f",
  alternates: { canonical: `${SITE_URL}/ai-usage-policy` },
};

const sections = [
  {
    "heading": "Grounding rules",
    "bullets": [
      "Current facts, figures, dates, office-holders and event details should come from retained source material.",
      "AI output is subject to deterministic publication-safety and quality checks.",
      "Low-quality or unavailable AI output can be deferred for retry instead of being forced into publication."
    ]
  },
  {
    "heading": "Reader responsibility",
    "bullets": [
      "AI-assisted explanations are educational material, not professional legal, medical, financial or official examination advice.",
      "For consequential exam actions, use the linked official authority notice."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="AI Usage Policy"
      intro="AI assists CurrentPulse with summarization, restructuring, classification and study-tool generation. It is not treated as an independent source for fresh facts."
      sections={sections}
    />
  );
}
