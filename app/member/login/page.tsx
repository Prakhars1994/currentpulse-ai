"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createMemberBrowserClient } from "@/lib/supabase/browser";

type SocialProvider = "google" | "facebook";

export default function MemberLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState<SocialProvider | null>(null);
  const [message, setMessage] = useState("");
  const callbackUrl = () => `${location.origin}/auth/callback?next=/member`;

  async function socialSignIn(provider: SocialProvider) {
    setSocialBusy(provider); setMessage("");
    try {
      const supabase = createMemberBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl() } });
      if (error) throw error;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `${provider} sign-in could not start.`);
      setSocialBusy(null);
    }
  }

  async function sendMagicLink() {
    if (!email) { setMessage("Enter your email first, then choose Email me a sign-in link."); return; }
    setBusy(true); setMessage("");
    try {
      const supabase = createMemberBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl() } });
      if (error) throw error;
      setMessage("Secure sign-in link sent. Check your email and open the link on this device.");
    } catch (err) { setMessage(err instanceof Error ? err.message : "Could not send the sign-in link."); }
    finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const supabase = createMemberBrowserClient();
      if (mode === "signup") {
        const { error, data } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackUrl() } });
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

  return <main className="min-h-screen bg-[#07111f] px-5 py-12 text-white"><div className="mx-auto max-w-md">
    <Link href="/member" className="text-sm font-bold text-emerald-300">← Member area</Link>
    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
      <div className="border-b border-slate-800 bg-gradient-to-br from-emerald-400/10 via-cyan-400/5 to-transparent p-7">
        <div className="text-xs font-black uppercase tracking-[.18em] text-amber-300">CurrentPulse Student Account</div>
        <h1 className="mt-2 text-3xl font-black">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">One secure account for purchases, test credits, answer PDFs, evaluations and your paid library.</p>
      </div>
      <div className="p-7">
        <div className="grid gap-3">
          <button type="button" disabled={!!socialBusy} onClick={()=>socialSignIn("google")} className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600 bg-white px-4 py-3 font-black text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"><span className="text-lg font-black text-blue-600">G</span>{socialBusy === "google" ? "Connecting…" : "Continue with Google"}</button>
          <button type="button" disabled={!!socialBusy} onClick={()=>socialSignIn("facebook")} className="flex w-full items-center justify-center gap-3 rounded-xl border border-blue-500/40 bg-blue-600 px-4 py-3 font-black text-white transition hover:bg-blue-500 disabled:opacity-60"><span className="text-lg font-black">f</span>{socialBusy === "facebook" ? "Connecting…" : "Continue with Facebook"}</button>
        </div>
        <div className="my-6 flex items-center gap-3"><div className="h-px flex-1 bg-slate-700"/><span className="text-xs font-bold uppercase tracking-widest text-slate-500">or use email</span><div className="h-px flex-1 bg-slate-700"/></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-400">Email address</span><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400" /></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-slate-400">Password</span><input required minLength={8} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8+ characters" className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none focus:border-emerald-400" /></label>
          <button disabled={busy||!!socialBusy} className="w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-slate-950 disabled:opacity-60">{busy ? "Please wait…" : mode === "login" ? "Sign in securely" : "Create student account"}</button>
        </form>
        {mode === "login" && <button type="button" disabled={busy} onClick={sendMagicLink} className="mt-3 w-full rounded-xl border border-slate-700 px-4 py-3 text-sm font-bold text-cyan-300 disabled:opacity-60">Email me a sign-in link</button>}
        {message && <div aria-live="polite" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-100">{message}</div>}
        <button type="button" onClick={()=>{setMode(mode === "login" ? "signup" : "login");setMessage("")}} className="mt-5 text-sm font-bold text-cyan-300">{mode === "login" ? "New student? Create an account" : "Already registered? Sign in"}</button>
        <p className="mt-6 text-xs leading-5 text-slate-500">By continuing, you agree to <Link href="/terms" className="underline">CurrentPulse Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>. Social providers are used only for authentication unless you explicitly grant additional access.</p>
      </div>
    </div>
  </div></main>;
}
