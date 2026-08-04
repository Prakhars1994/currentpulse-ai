"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendRecovery(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const redirectTo = `${window.location.origin}/admin/reset-password`;
      const { error: recoveryError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo,
        });

      if (recoveryError) throw recoveryError;

      setMessage(
        "If this is your registered admin email, a password-reset link has been sent. Check Spam as well."
      );
    } catch (recoveryError) {
      console.error("Password recovery error:", recoveryError);
      setError(
        recoveryError?.message || "Unable to send the password-reset email."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <p className="text-sm font-bold uppercase tracking-widest text-cyan-600">
          CurrentPulse AI
        </p>
        <h1 className="mt-3 text-3xl font-black text-slate-900">
          Reset admin password
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter the email configured as your CurrentPulse administrator.
        </p>

        <form onSubmit={sendRecovery} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="recovery-email"
              className="block text-sm font-semibold text-slate-700"
            >
              Admin email
            </label>
            <input
              id="recovery-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          {message && (
            <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              {message}
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <Link
          href="/admin/login"
          className="mt-6 block text-center text-sm font-semibold text-blue-600 hover:text-blue-700"
        >
          Back to admin login
        </Link>
      </section>
    </main>
  );
}
