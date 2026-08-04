import { NextResponse } from "next/server";
import {
  ADMIN_ACCESS_COOKIE,
  authenticateAdminToken,
} from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

function clearAdminCookie(response) {
  response.cookies.set(ADMIN_ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const accessToken = body?.access_token?.trim() || "";
    const result = await authenticateAdminToken(accessToken);

    if (!result.ok) {
      const response = NextResponse.json(
        {
          success: false,
          message: result.message,
        },
        { status: result.status }
      );

      clearAdminCookie(response);
      return response;
    }

    const requestedLifetime = Number(body?.expires_in);
    const maxAge = Number.isFinite(requestedLifetime)
      ? Math.max(60, Math.min(Math.floor(requestedLifetime), 3600))
      : 3600;

    const response = NextResponse.json({
      success: true,
      email: result.user.email,
    });

    response.cookies.set(ADMIN_ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge,
    });

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Admin session creation error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Unable to create the admin session.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  clearAdminCookie(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
