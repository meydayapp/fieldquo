// lib/reviews/googleBusiness/availability.js
//
// Can a company on this deployment actually connect Google reviews? The ONE
// answer every surface that offers "Connect Google reviews" asks: the home
// page's set-up row (lib/setupSteps.js, through lib/setupStepsSnapshot.js),
// and so the onboarding next-steps email that lists the rows still on that
// card; Settings › Reviews and the home dialog around the same card
// (GoogleBusiness.js, fed by GET /api/settings/reviews); and the connect
// route itself, which refuses before sending anyone to Google.
//
// ── Two things, both needed ─────────────────────────────────────────────────
//
//   1. The OAuth client — googleCalendarConfigured(), the same client id,
//      secret and token key the calendar connect uses. Measured from env.
//   2. Google's approval of the Business Profile API "Basic API Access"
//      application. Until Google grants it, every project's quota is 0 and
//      the very first call answers 429 (docs/GOOGLE-BUSINESS-PROFILE.md).
//      NOTHING on our side can observe that approval — no env var appears
//      and no endpoint says "approved" short of making a real call on a real
//      company's token — so it is one flag the owner sets on the day Google's
//      email arrives: GOOGLE_BUSINESS_API_APPROVED=1 (docs/VERCEL.md).
//
// Why a flag and not "try a call and see": the only call that could tell is
// one made with a connected company's refresh token, and getting that token
// is the very step this gates. Why not reuse GOOGLE_OAUTH_CLIENT_ID alone:
// it is set today (the calendar works), so it says "yes" while every
// connection would dead-end on Google's quota refusal — 2026-09-28, the
// owner: "because we cannot integrate Google reviews yet we should remove it
// from the additional set-ups."
//
// Exactly "1" turns it on. "true", "yes" and "0" do not: one spelling, so a
// row in the Vercel dashboard can be read at a glance and never half-means.

import { googleCalendarConfigured } from "@/lib/calendar/googleClient";

/** Google has approved the Business Profile API for FieldQuo's project. */
export function googleBusinessApiApproved() {
  return String(process.env.GOOGLE_BUSINESS_API_APPROVED ?? "").trim() === "1";
}

/**
 * True only when connecting Google reviews can work end to end on this
 * deployment: the OAuth client is configured AND Google has approved the API.
 */
export function googleBusinessAvailable() {
  return googleBusinessApiApproved() && googleCalendarConfigured();
}
