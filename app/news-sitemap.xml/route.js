import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/siteUrl";

// This legacy URL was manually submitted to Search Console but its Google News
// payload is legitimately empty whenever no eligible PB-SHABD story exists in
// the rolling two-day window. An empty submitted sitemap is reported as an
// error. The canonical sitemap already includes every indexable News URL, so
// keep this address as a permanent compatibility redirect rather than serving
// an intermittently empty sitemap.
export function GET() {
  return NextResponse.redirect(`${SITE_URL}/sitemap.xml`, 308);
}
