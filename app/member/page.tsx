import MemberDashboard from "./MemberDashboard";

export const metadata = { title: "Student Member Dashboard | CurrentPulse" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MemberPage() {
  // Keep this route Worker-rendered and uncached: account state must never use a stale static member shell.
  return <MemberDashboard />;
}
