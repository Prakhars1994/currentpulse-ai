import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/contact",
  "Contact CurrentPulse AI",
  "Contact CurrentPulse to report a correction, suggest a source, share product feedback or discuss an educational partnership."
);

export default function ContactLayout({ children }) {
  return children;
}
