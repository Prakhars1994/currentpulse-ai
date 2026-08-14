import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Corrections Policy",
  description: "CurrentPulse aims to correct meaningful factual, classification, sourcing and duplication errors quickly while preserving a reliable public archive.",
  alternates: { canonical: `${SITE_URL}/corrections-policy` },
};

const sections = [
  {
    "heading": "How corrections work",
    "bullets": [
      "Report the page URL and the specific issue through Contact.",
      "The article may be corrected, reclassified, enriched with better sources, merged with a duplicate or removed from public display.",
      "Material source conflicts should be resolved or explicitly attributed before the article remains public."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Corrections Policy"
      intro="CurrentPulse aims to correct meaningful factual, classification, sourcing and duplication errors quickly while preserving a reliable public archive."
      sections={sections}
    />
  );
}
