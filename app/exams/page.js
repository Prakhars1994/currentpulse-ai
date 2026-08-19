export const dynamic = "force-dynamic";
export const revalidate = 0;

import ExamUpdatesPage from "@/components/ExamUpdatesPage";
import { normalizeExamFilters } from "@/lib/exams/filters";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "ResultPulse AI — Exam Results, Admit Cards & Notifications",
  description: "Official-source exam results, admit cards, answer keys, applications, deadlines and notifications across India.",
  alternates: { canonical: `${SITE_URL}/exams` },
};

export default async function Page({ searchParams }) {
  const filters = normalizeExamFilters((await searchParams) || {});
  return <ExamUpdatesPage filters={filters} />;
}
