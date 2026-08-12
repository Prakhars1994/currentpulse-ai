export const revalidate = 60;
import ExamUpdatesPage from "@/components/ExamUpdatesPage";
import { SITE_URL } from "@/lib/siteUrl";
export const metadata = { title: "ResultPulse AI — Exam Results, Admit Cards & Notifications", description: "Official-source exam results, admit cards, answer keys, applications, deadlines and notifications across India.", alternates: { canonical: `${SITE_URL}/exams` } };
export default function Page(){ return <ExamUpdatesPage />; }
