import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "About CurrentPulse",
  description: "CurrentPulse is an independent educational current-affairs platform built to help UPSC and PCS learners connect daily developments with the syllabus, stati",
  alternates: { canonical: `${SITE_URL}/about` },
};

const sections = [
  {
    "heading": "What we publish",
    "bullets": [
      "General News is kept separate from UPSC Current Affairs.",
      "Current Affairs is synthesized from configured trusted coaching coverage and retained source material.",
      "ResultPulse surfaces official-source exam and recruitment updates with links back to the issuing authority."
    ]
  },
  {
    "heading": "What CurrentPulse is not",
    "bullets": [
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
      intro="CurrentPulse is an independent educational current-affairs platform built to help UPSC and PCS learners connect daily developments with the syllabus, static foundations, revision tools and official exam updates."
      sections={sections}
    />
  );
}
