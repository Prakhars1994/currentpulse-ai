import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/privacy",
  "Privacy Policy | CurrentPulse AI",
  "Read the CurrentPulse privacy policy covering data handling, analytics, account information and user privacy practices."
);

export default function PrivacyLayout({ children }) {
  return children;
}
