import { NextRequest, NextResponse } from "next/server";

const ADMIN_ACCESS_COOKIE = "currentpulse_admin_access";
const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

function protectAdminResponse(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

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

  return protectAdminResponse(response);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return protectAdminResponse(NextResponse.next());
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

    return protectAdminResponse(NextResponse.next());
  } catch (error) {
    console.error("Admin route authentication error:", error);
    return redirectToLogin(request);
  }
}

export const config = {
  matcher: ["/admin/:path*"],
};
