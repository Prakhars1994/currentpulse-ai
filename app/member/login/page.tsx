"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMemberBrowserClient } from "@/lib/supabase/browser";

export default function MemberLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createMemberBrowserClient();
      if (mode === "signup") {
        const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${location.origin}/member` } });
        if (error) throw error;
        if (!data.session) { setMessage("Account created. Check your email to confirm your account, then sign in."); return; }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.replace("/member"); router.refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#07111f] px-5 py-16 text-white"><div className="mx-auto max-w-md">
    <Link href="/member" className="text-sm font-bold text-emerald-300">← Member area</Link>
    <div className="mt-6 rounded-3xl border border-slate-700 bg-slate-900 p-7 shadow-2xl">
      <div className="text-xs font-black uppercase tracking-[.18em] text-amber-300">CurrentPulse Student Account</div>
      <h1 className="mt-2 text-3xl font-black">{mode === "login" ? "Sign in" : "Create account"}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">One account protects your purchases, test credits, answer PDFs and evaluation history.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400" />
        <input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400" />
        <button disabled={busy} className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{busy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create student account"}</button>
      </form>
      {message && <div className="mt-4 rounded-xl bg-amber-300/10 p-3 text-sm text-amber-200">{message}</div>}
      <button onClick={()=>{setMode(mode === "login" ? "signup" : "login");setMessage("")}} className="mt-5 text-sm font-bold text-cyan-300">{mode === "login" ? "New student? Create an account" : "Already registered? Sign in"}</button>
    </div>
  </div></main>;
}
