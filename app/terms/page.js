import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Terms",
  description: "By using CurrentPulse you agree to treat the service as educational information and revision assistance rather than an official examination authority.",
  alternates: { canonical: `${SITE_URL}/terms` },
};

const sections = [
  {
    "heading": "Educational use",
    "bullets": [
      "CurrentPulse may summarize public developments and link to third-party sources.",
      "Exam dates, eligibility, applications, results, answer keys and deadlines must be verified on the linked official authority website before action.",
      "CurrentPulse cannot guarantee uninterrupted availability or that every external source remains reachable."
    ]
  },
  {
    "heading": "Content and links",
    "bullets": [
      "CurrentPulse creates original synthesis and does not claim ownership of third-party source material or external websites.",
      "External links are provided for verification and reference."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Terms of Use"
      intro="By using CurrentPulse you agree to treat the service as educational information and revision assistance rather than an official examination authority."
      sections={sections}
    />
  );
}
