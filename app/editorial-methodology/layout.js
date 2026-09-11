import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/editorial-methodology",
  "Editorial Methodology | CurrentPulse AI",
  "Read the CurrentPulse editorial workflow for administrator-controlled Current Affairs and News publishing, source handling and quality review."
);

export default function EditorialMethodologyLayout({ children }) {
  return children;
}
