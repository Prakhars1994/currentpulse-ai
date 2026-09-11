import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/corrections-policy",
  "Corrections Policy | CurrentPulse AI",
  "Read how CurrentPulse handles factual corrections, source updates and transparent editorial fixes across published study and news content."
);

export default function CorrectionsPolicyLayout({ children }) {
  return children;
}
