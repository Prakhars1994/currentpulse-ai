import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Sources Policy",
  description: "Source provenance is central to CurrentPulse. Reader-facing articles keep links to retained sources so important claims can be traced back to their origin.",
  alternates: { canonical: `${SITE_URL}/sources-policy` },
};

const sections = [
  {
    "heading": "Source hierarchy",
    "bullets": [
      "Official government, court, regulator, institution and primary-source material is preferred when it is available in the retained evidence.",
      "High-quality news reporting is used for general News and for context around public developments.",
      "Configured UPSC coaching sources are used as an editorial discovery layer for Current Affairs."
    ]
  },
  {
    "heading": "Attribution",
    "bullets": [
      "CurrentPulse paraphrases and synthesizes instead of reproducing source articles verbatim.",
      "A source link does not imply that the source publisher endorses CurrentPulse.",
      "When sources materially disagree, the article should attribute the disagreement rather than present incompatible claims as one fact."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Sources Policy"
      intro="Source provenance is central to CurrentPulse. Reader-facing articles keep links to retained sources so important claims can be traced back to their origin."
      sections={sections}
    />
  );
}
