import { landingMetadata } from "@/lib/landingMetadata";

export const metadata = landingMetadata(
  "/quiz",
  "UPSC Current Affairs Quiz | CurrentPulse AI",
  "Practice CurrentPulse UPSC current affairs questions with a daily quiz built around published current affairs and revision-focused facts."
);

export default function QuizLayout({ children }) {
  return children;
}
