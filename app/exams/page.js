export const dynamic = "force-dynamic";
export const revalidate = 0;

import ExamUpdatesPage from "@/components/ExamUpdatesPage";
import { normalizeExamFilters, normalizeExamPage } from "@/lib/exams/filters";
import { SITE_URL } from "@/lib/siteUrl";

const title = "ResultPulse AI — Exam Results, Admit Cards & Notifications";
const description = "Official-source exam results, admit cards, answer keys, applications, deadlines and notifications across India.";
const canonical = `${SITE_URL}/exams`;

export const metadata = {
  title,
  description,
  alternates: { canonical },
  openGraph: { title, description, url: canonical, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default async function Page({ searchParams }) {
  const params = (await searchParams) || {};
  const filters = normalizeExamFilters(params);
  return <ExamUpdatesPage filters={filters} page={normalizeExamPage(params.page)} />;
}
