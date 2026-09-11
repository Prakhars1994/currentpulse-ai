import { SITE_URL } from "@/lib/siteUrl";

const title = "Revision Notes | CurrentPulse AI";
const description = "Create, search and export personal UPSC current-affairs revision notes stored on your device.";
const canonical = `${SITE_URL}/notes`;

export const metadata = {
  title,
  description,
  alternates: { canonical },
  robots: { index: false, follow: true },
  openGraph: { title, description, url: canonical, type: "website" },
  twitter: { card: "summary", title, description },
};

export default function NotesLayout({ children }) {
  return children;
}
