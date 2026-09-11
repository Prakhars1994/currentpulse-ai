import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/sources-policy",
  "Sources Policy | CurrentPulse AI",
  "Review CurrentPulse source rules for administrator-published Current Affairs and News and official-source ResultPulse exam updates."
);

export default function SourcesPolicyLayout({ children }) {
  return children;
}
