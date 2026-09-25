// app/api/signup/sample-services/route.js
//
// GET /api/signup/sample-services?industry=<slug>&lang=<code>&currency=<USD|CAD>
//
// The sample quote drawn beside the Trades step of /signup (app/components/
// auth/samples/QuoteSample.js): two of the trade's seed services with the
// price a company in that trade STARTS with (the seed median in the
// visitor's currency — the owner's call of 2026-09-25, see
// lib/signup/sampleServices.js), and the scope wording and "what happens
// next" the real client quote page prints for the trade. Public — nobody
// has an account yet.
//
// What it never answers: a benchmark range, a source, any third service, or
// anything for an industry that is not on the list. An unknown industry, or
// one with no seed, answers an empty list rather than an error: the panel
// falls back and the form is never blocked on a picture.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { isSupported } from "@/app/i18n/languages";
import { cleanIndustrySlug, cleanSampleCurrency, sampleQuoteForIndustry } from "@/lib/signup/sampleServices";

/** A visitor clicks through a dozen trades at most; a hundred a minute is a scraper. */
const LIMIT = { limit: 120, windowMs: 10 * 60 * 1000 };

export async function GET(request) {
  const limited = rateLimit(request, "signup-sample-services", LIMIT);
  if (limited) return limited;

  const params = new URL(request.url).searchParams;
  const industry = cleanIndustrySlug(params.get("industry"));
  const lang = params.get("lang");
  const language = isSupported(lang) ? lang : "en";
  const currency = cleanSampleCurrency(params.get("currency"));
  const sample = industry ? sampleQuoteForIndustry(industry, language, currency) : null;
  return NextResponse.json(
    {
      services: sample?.services || [],
      // The seed's trade key ("hvac_install"): which trade's wording the
      // sample email's scope breakdown and steps read, as a quote's category
      // does. A catalogue key, not data about anybody.
      categoryKey: sample?.categoryKey || null,
      currency: sample?.currency || null,
      group: sample?.group || null,
      processSteps: sample?.processSteps || [],
      glossary: sample?.glossary || [],
    },
    // The words and the starting prices change when the seed or the
    // conversion rate changes, which is a deploy; a browser and a CDN may
    // keep them for a day.
    { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } },
  );
}
