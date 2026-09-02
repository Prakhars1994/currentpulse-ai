import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Editorial Methodology",
  description: "CurrentPulse uses administrator-controlled Current Affairs and News publishing. PDF text is reviewed before publication and is not automatically collected or rewritten during ingestion.",
  alternates: { canonical: `${SITE_URL}/editorial-methodology` },
};

const sections = [
  {
    heading: "Current Affairs and News workflow",
    bullets: [
      "An administrator supplies a PDF or creates content in the protected Admin workspace.",
      "PDF extraction happens without an AI ingestion step, and detected articles are shown for administrator review before publication.",
      "Administrator-selected PDF text is preserved rather than automatically rewritten, merged or deduplicated during ingestion.",
      "Published manual content is protected from background repair jobs and automated source pipelines.",
      "The public reader is refreshed through the Cloudflare release workflow after publication."
    ]
  },
  {
    heading: "ResultPulse",
    bullets: [
      "ResultPulse is operationally separate from Current Affairs and News publishing.",
      "It can collect official-source exam and recruitment updates and links users back to the issuing authority."
    ]
  },
  {
    heading: "Corrections and updates",
    bullets: [
      "Material errors can be reported through the Contact page.",
      "Administrators can evaluate and edit published Current Affairs from the protected review workspace."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Editorial Methodology"
      intro="Current Affairs and News use a manual, administrator-controlled publishing workflow. Automated external collection and AI rewriting are not part of their ingestion path."
      sections={sections}
    />
  );
}
