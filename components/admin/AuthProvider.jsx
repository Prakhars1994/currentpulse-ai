"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const AuthContext = createContext(null);

async function syncServerSession(session) {
  if (!session) {
    await fetch("/api/admin/session", { method: "DELETE" });
    return false;
  }

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

  return response.ok;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function applySession(session) {
      const authorised = await syncServerSession(session);

      if (!active) return;

      if (!authorised) {
        setUser(null);
        setLoading(false);
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      setUser(session.user);
      setLoading(false);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Admin session check failed:", error);
      }

      applySession(data?.session || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_OUT"
      ) {
        applySession(session);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
