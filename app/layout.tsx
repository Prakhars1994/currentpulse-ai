import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteShell from "@/components/SiteShell";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import { SITE_URL } from "@/lib/siteUrl";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "CurrentPulse AI",
  title: {
    default: "CurrentPulse AI - UPSC Current Affairs, PYQs, Quiz & News",
    template: "%s | CurrentPulse AI",
  },
  description:
    "CurrentPulse AI is an exam-focused platform for administrator-published UPSC current affairs, Prelims facts, Mains analysis, PYQs, quizzes, revision PDFs and source-attributed news.",
  keywords: [
    "CurrentPulse AI",
    "Current Pulse AI",
    "UPSC current affairs",
    "UPSC current affairs today",
    "daily current affairs for UPSC",
    "UPSC Prelims current affairs",
    "UPSC Mains current affairs",
    "UPSC PYQ",
    "UPSC current affairs quiz",
  ],
  authors: [{ name: "CurrentPulse Editorial Desk", url: SITE_URL }],
  creator: "CurrentPulse AI",
  publisher: "CurrentPulse AI",
  alternates: { types: { "application/rss+xml": `${SITE_URL}/feed.xml` } },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "CurrentPulse AI",
    title: "CurrentPulse AI - UPSC Current Affairs, PYQs, Quiz & News",
    description:
      "Administrator-published UPSC current affairs with Prelims facts, Mains analysis, PYQs, quizzes, revision tools and source-attributed news.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CurrentPulse AI - UPSC Current Affairs",
    description:
      "UPSC current affairs, PYQs, quizzes, revision tools and source-attributed news.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": `${SITE_URL}/#organization`,
                  name: "CurrentPulse AI",
                  alternateName: ["Current Pulse AI", "CurrentPulseAI"],
                  url: SITE_URL,
                  logo: `${SITE_URL}/icon.svg`,
                  description: "Exam-focused UPSC current affairs, PYQs, quizzes and revision tools.",
                },
                {
                  "@type": "WebSite",
                  "@id": `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: "CurrentPulse AI",
                  alternateName: ["Current Pulse AI", "CurrentPulseAI"],
                  publisher: { "@id": `${SITE_URL}/#organization` },
                  inLanguage: "en-IN",
                  potentialAction: {
                    "@type": "SearchAction",
                    target: `${SITE_URL}/search?q={search_term_string}`,
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        <SiteShell>{children}</SiteShell>
        <GoogleAnalytics />
      </body>
    </html>
  );
}
