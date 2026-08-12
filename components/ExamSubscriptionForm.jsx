"use client";
import { useState } from "react";

const TOPICS = [
  ["exam_result", "Results"], ["exam_admit_card", "Admit cards"], ["exam_notification", "Exam notifications"],
  ["exam_answer_key", "Answer keys"], ["exam_application", "Applications"], ["exam_deadline", "Deadlines"],
  ["exam_exam_date", "Exam dates"], ["exam_cut_off", "Cut-offs"], ["exam_counselling", "Counselling"],
  ["current_affairs", "Important Current Affairs"], ["news", "Important News"],
];

export default function ExamSubscriptionForm({ compact = false }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [topics, setTopics] = useState(["exam_result", "exam_admit_card", "exam_notification", "exam_deadline"]);
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [website, setWebsite] = useState("");
  const toggleTopic = (topic) => setTopics((current) => current.includes(topic) ? current.filter((x) => x !== topic) : [...current, topic]);

  async function submit(event) {
    event.preventDefault(); setBusy(true); setStatus("");
    try {
      const response = await fetch("/api/notifications/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, phone, emailEnabled, whatsappEnabled, topics, consent, website }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Subscription failed");
      setStatus("Alerts saved. You can update the same email/phone later.");
    } catch (error) { setStatus(error.message || "Could not save alerts."); }
    finally { setBusy(false); }
  }

  return (
    <form id="alerts" onSubmit={submit} className={`rounded-3xl border border-cyan-400/15 bg-slate-900/80 ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-400">Instant alerts</p><h2 className="mt-2 text-2xl font-black text-white">Never miss a result or deadline</h2></div><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">Opt-in only</span></div>
      <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e)=>setWebsite(e.target.value)} /></label></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email address" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
        <input type="tel" value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="WhatsApp number e.g. +9198..." className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-400" />
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold text-slate-300">
        <label className="flex items-center gap-2"><input type="checkbox" checked={emailEnabled} onChange={(e)=>setEmailEnabled(e.target.checked)} /> Email</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={whatsappEnabled} onChange={(e)=>setWhatsappEnabled(e.target.checked)} /> WhatsApp</label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{TOPICS.map(([topic,label]) => <button type="button" key={topic} onClick={()=>toggleTopic(topic)} className={`rounded-full border px-3 py-1.5 text-xs font-black ${topics.includes(topic) ? "border-cyan-400 bg-cyan-400/10 text-cyan-300" : "border-slate-700 text-slate-400"}`}>{label}</button>)}</div>
      <label className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-400"><input className="mt-1" type="checkbox" checked={consent} onChange={(e)=>setConsent(e.target.checked)} required /><span>I agree to receive the selected CurrentPulse/ResultPulse alerts. I can unsubscribe at any time.</span></label>
      <button disabled={busy || !topics.length || (!emailEnabled && !whatsappEnabled)} className="mt-5 w-full rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 disabled:opacity-50">{busy ? "Saving…" : "Save my alerts"}</button>
      {status && <p className="mt-3 text-sm font-semibold text-slate-300">{status}</p>}
    </form>
  );
}
