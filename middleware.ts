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
  return protectAdminResponse(NextResponse.redirect(loginUrl));
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return protectAdminResponse(NextResponse.next());
  }

  // Middleware only performs the cheap presence check. It must not call
  // Supabase or destroy the login cookie: edge/runtime auth validation can
  // disagree with the server-side session endpoint and previously caused a
  // valid freshly-created admin session to be erased during navigation.
  // Sensitive admin APIs continue to perform full token/email validation via
  // requireAuthenticatedAdmin()/authenticateAdminToken() in lib/adminAuth.
  const accessToken = request.cookies.get(ADMIN_ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return redirectToLogin(request);
  }

  return protectAdminResponse(NextResponse.next());
}

export const config = {
  matcher: ["/admin/:path*"],
};
