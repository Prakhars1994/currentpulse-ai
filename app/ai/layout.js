import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Ask CurrentPulse AI - UPSC Current Affairs Assistant",
  description: "Ask source-grounded questions across CurrentPulse News and UPSC Current Affairs.",
  alternates: {
    canonical: `${SITE_URL}/ai`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function AILayout({ children }) {
  return children;
}
