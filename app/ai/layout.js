import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
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
