import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const enabled = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  return NextResponse.json(
    { enabled, provider: enabled ? "razorpay" : null },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
