import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/videos",
  "Current Affairs Videos for UPSC | CurrentPulse AI",
  "Discover topic-linked current affairs video explanations for UPSC study alongside CurrentPulse written analysis and revision content."
);

export default function VideosLayout({ children }) {
  return children;
}
