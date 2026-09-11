import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/about",
  "About CurrentPulse AI",
  "Learn how CurrentPulse publishes administrator-controlled Current Affairs and News, revision tools and official-source exam updates for UPSC and PCS learners."
);

export default function AboutLayout({ children }) {
  return children;
}
