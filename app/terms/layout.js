import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/terms",
  "Terms of Use | CurrentPulse AI",
  "Read the CurrentPulse terms of use for educational content, platform access, acceptable use and service limitations."
);

export default function TermsLayout({ children }) {
  return children;
}
