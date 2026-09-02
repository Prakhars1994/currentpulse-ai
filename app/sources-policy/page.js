import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Sources Policy",
  description: "CurrentPulse Current Affairs and News are published from administrator-supplied PDFs or administrator-created content. Automated external source collection is disabled.",
  alternates: { canonical: `${SITE_URL}/sources-policy` },
};

const sections = [
  {
    heading: "Current Affairs and News",
    bullets: [
      "Automated coaching-source, RSS, newspaper and PIB collection for Current Affairs and News is disabled.",
      "Public Current Affairs and News are limited to administrator-supplied PDFs or administrator-created content selected for publication.",
      "PDF provenance is retained internally so the public streams can remain restricted to administrator-approved material.",
      "ResultPulse is separate: exam and recruitment updates may use official issuing-authority sources and retain links to those authorities."
    ]
  },
  {
    heading: "Attribution and fidelity",
    bullets: [
      "Administrator-selected PDF text is preserved during ingestion rather than automatically rewritten, merged or deduplicated.",
      "A source or authority link does not imply that the publisher or authority endorses CurrentPulse.",
      "Administrators can review, edit, unpublish or correct material through the protected Admin workspace."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Sources Policy"
      intro="CurrentPulse uses a manual publishing model for Current Affairs and News. Automated external ingestion is disabled, while ResultPulse separately uses official exam-authority sources for exam updates."
      sections={sections}
    />
  );
}
