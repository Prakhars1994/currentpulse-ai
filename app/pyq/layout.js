import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/pyq",
  "UPSC Mains PYQ Explorer | CurrentPulse AI",
  "Explore verified UPSC Mains General Studies previous-year questions and use the theme-based PYQ bank for focused answer-writing revision."
);

export default function PyqLayout({ children }) {
  return children;
}
