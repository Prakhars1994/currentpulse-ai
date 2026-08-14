import TrustPage from "@/components/TrustPage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Privacy Policy",
  description: "CurrentPulse is designed to collect as little personal information as practical for the features a user chooses to use.",
  alternates: { canonical: `${SITE_URL}/privacy` },
};

const sections = [
  {
    "heading": "ResultPulse alerts",
    "bullets": [
      "If you opt in to alerts, CurrentPulse may store the email address or phone number you provide, alert preferences, consent time and delivery status.",
      "Alert contact information is used to provide the notifications you requested and is not sold as an advertising list.",
      "Unsubscribe controls should be honored for future alert delivery."
    ]
  },
  {
    "heading": "Notes and analytics",
    "bullets": [
      "Revision Notes currently save in your browser on the device unless a future sync feature is explicitly offered.",
      "CurrentPulse may use privacy-conscious traffic analytics, including Vercel Analytics and Google Analytics when configured, to understand aggregate site usage."
    ]
  },
  {
    "heading": "External links",
    "bullets": [
      "Official authority and source links lead to third-party sites with their own privacy practices."
    ]
  }
];

export default function Page() {
  return (
    <TrustPage
      kicker="CurrentPulse standards"
      title="Privacy Policy"
      intro="CurrentPulse is designed to collect as little personal information as practical for the features a user chooses to use."
      sections={sections}
    />
  );
}
