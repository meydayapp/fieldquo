// app/api/signup/sample-services/route.js
//
// GET /api/signup/sample-services?industry=<slug>&lang=<code>
//
// Two service names and descriptions for the sample quote drawn beside the
// Trades step of /signup (app/components/auth/SignupPreviews.js). Public —
// nobody has an account yet — and priceless by construction:
// lib/signup/sampleServices.js reads the seed on the server and hands back
// words only, so the benchmark beside every seeded service never leaves the
// building (non-negotiable #4; the seeds' own header rule).
//
// An unknown industry, or one with no seed, answers an empty list rather than
// an error: the panel falls back to the quote-type labels the page holds and
// the form is never blocked on a picture.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { isSupported } from "@/app/i18n/languages";
import { cleanIndustrySlug, sampleServicesForIndustry } from "@/lib/signup/sampleServices";

/** A visitor clicks through a dozen trades at most; a hundred a minute is a scraper. */
const LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

export async function GET(request) {
  const limited = rateLimit(request, "signup-sample-services", LIMIT);
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const industry = cleanIndustrySlug(params.get("industry"));
  const lang = params.get("lang");
  const language = isSupported(lang) ? lang : "en";
  const services = industry ? sampleServicesForIndustry(industry, language) : [];
  return NextResponse.json(
    { services },
    // The words change when the seed changes, which is a deploy; a browser
    // and a CDN may keep them for a day.
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
