"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function restoreExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active || !session) return;

      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: session.access_token,
          expires_in: session.expires_in,
        }),
      });

      if (active && response.ok) {
        router.replace("/admin");
        router.refresh();
      }
    }

    restoreExistingSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event) {
    event.preventDefault();

    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error("Unable to create a login session.");
      }

      const sessionResponse = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          access_token: data.session.access_token,
          expires_in: data.session.expires_in,
        }),
      });

      const sessionResult = await sessionResponse.json();

      if (!sessionResponse.ok) {
        await supabase.auth.signOut();
        throw new Error(
          sessionResult.message || "This account is not authorised as admin."
        );
      }

      router.replace("/admin");
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);
      setErrorMessage(error?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f1f5f9",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "430px",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "36px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
        }}
      >
        <h1
          style={{
            margin: 0,
            color: "#111827",
            fontSize: "28px",
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          Admin Login
        </h1>

        <p
          style={{
            marginTop: "10px",
            marginBottom: "28px",
            color: "#64748b",
            textAlign: "center",
          }}
        >
          UPSC Current Affairs Platform
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "18px" }}>
            <label
              htmlFor="admin-email"
              style={{
                display: "block",
                marginBottom: "7px",
                color: "#374151",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Email address
            </label>

            <input
              id="admin-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                height: "48px",
                padding: "10px 14px",
                border: "1px solid #94a3b8",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                color: "#111827",
                WebkitTextFillColor: "#111827",
                caretColor: "#111827",
                fontSize: "16px",
                outline: "none",
                opacity: 1,
                pointerEvents: "auto",
                userSelect: "text",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              htmlFor="admin-password"
              style={{
                display: "block",
                marginBottom: "7px",
                color: "#374151",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Password
            </label>

            <input
              id="admin-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              style={{
                display: "block",
                width: "100%",
                boxSizing: "border-box",
                height: "48px",
                padding: "10px 14px",
                border: "1px solid #94a3b8",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                color: "#111827",
                WebkitTextFillColor: "#111827",
                caretColor: "#111827",
                fontSize: "16px",
                outline: "none",
                opacity: 1,
                pointerEvents: "auto",
                userSelect: "text",
              }}
            />
          </div>

          {errorMessage && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 12px",
                borderRadius: "7px",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                fontSize: "14px",
              }}
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: "48px",
              border: "none",
              borderRadius: "8px",
              backgroundColor: loading ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              fontSize: "16px",
              fontWeight: "600",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <div style={{ marginTop: "18px", textAlign: "center" }}>
            <Link
              href="/admin/forgot-password"
              style={{
                color: "#2563eb",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </Link>
          </div>
        </form>

        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            display: "block",
            width: "100%",
            marginTop: "20px",
            border: "none",
            background: "transparent",
            color: "#2563eb",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          ← Back to Home
        </button>
      </section>
    </main>
  );
}
