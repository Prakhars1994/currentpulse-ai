import { createBrowserClient } from "@supabase/ssr";

export function createMemberBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Member authentication is not configured.");
  return createBrowserClient(url, key);
}
