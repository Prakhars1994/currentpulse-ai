import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const ADMIN_ACCESS_COOKIE = "currentpulse_admin_access";
export const ADMIN_AUTOMATION_HEADER = "x-currentpulse-automation-key";

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return "";
  return authorization.slice("Bearer ".length).trim();
}

function cookieToken(request) {
  if (request.cookies?.get) return request.cookies.get(ADMIN_ACCESS_COOKIE)?.value || "";
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_ACCESS_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function safeSecretMatch(provided = "", expected = "") {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  return a.length === b.length && timingSafeEqual(a, b);
}

function automationToken(request) {
  return request.headers.get(ADMIN_AUTOMATION_HEADER)?.trim() || "";
}

function isPdfPublishAutomationRequest(request) {
  try {
    return new URL(request.url).pathname === "/api/admin/pdf-import/publish";
  } catch {
    return false;
  }
}

export function adminAccessToken(request) {
  return bearerToken(request) || cookieToken(request);
}

export async function authenticateAdminToken(accessToken) {
  const allowedAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!allowedAdminEmail || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, status: 500, message: "Admin authentication is not configured." };
  }
  if (!accessToken) return { ok: false, status: 401, message: "Authentication required." };

  const supabase = createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return { ok: false, status: 401, message: "Invalid or expired login session." };
  if (user.email?.trim().toLowerCase() !== allowedAdminEmail) return { ok: false, status: 403, message: "This account is not authorised as an administrator." };
  return { ok: true, user, supabase, authMode: "user" };
}

export async function requireAuthenticatedAdmin(request, { allowAutomation = false } = {}) {
  const automationAllowed = allowAutomation || isPdfPublishAutomationRequest(request);
  if (automationAllowed) {
    const configuredKey = process.env.ADMIN_AUTOMATION_KEY?.trim() || "";
    const suppliedKey = automationToken(request);
    if (configuredKey && safeSecretMatch(suppliedKey, configuredKey)) {
      return { ok: true, user: null, supabase: createServerSupabase(), authMode: "automation" };
    }
  }

  const result = await authenticateAdminToken(adminAccessToken(request));
  if (!result.ok) {
    return {
      ...result,
      response: NextResponse.json(
        { success: false, message: result.message },
        { status: result.status, headers: { "Cache-Control": "no-store" } }
      ),
    };
  }
  return result;
}
