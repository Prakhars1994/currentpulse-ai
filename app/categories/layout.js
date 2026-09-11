import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/categories",
  "UPSC Current Affairs Categories | CurrentPulse AI",
  "Browse CurrentPulse current affairs by UPSC-relevant categories including Polity, Economy, International Relations, Science, Environment and Society."
);

export default function CategoriesLayout({ children }) {
  return children;
}
