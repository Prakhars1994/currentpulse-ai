import { NextRequest, NextResponse } from "next/server";

const ADMIN_ACCESS_COOKIE = "currentpulse_admin_access";
const CANONICAL_HOST = "currentpulse-ai.vercel.app";
const LEGACY_HOSTS = new Set(["currentpulse-ai-kl7x.vercel.app"]);
const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

function redirectToLogin(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const requestHost = (forwardedHost || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .split(":")[0];

  // Keep one indexable production origin. This is also a runtime fallback for
  // the host-specific Vercel redirect declared in vercel.json.
  if (LEGACY_HOSTS.has(requestHost)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.hostname = CANONICAL_HOST;
    canonicalUrl.port = "";
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  if (!accessToken || !supabaseUrl || !anonKey || !adminEmail) {
    return redirectToLogin(request);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!authResponse.ok) {
      return redirectToLogin(request);
    }

    const user = await authResponse.json();

    if (user?.email?.trim().toLowerCase() !== adminEmail) {
      return redirectToLogin(request);
    }

    const response = NextResponse.next();
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  } catch (error) {
    console.error("Admin route authentication error:", error);
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
