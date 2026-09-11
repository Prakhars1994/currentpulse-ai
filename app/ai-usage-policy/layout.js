import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/ai-usage-policy",
  "AI Usage Policy | CurrentPulse AI",
  "Read how CurrentPulse uses AI, where human editorial control applies and how AI-assisted features are separated from administrator-published content."
);

export default function AiUsagePolicyLayout({ children }) {
  return children;
}
