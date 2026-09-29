// lib/company/profileReadiness.js
//
// Is this company able to put its name on something a client will read?
//
// ══ Why this exists ════════════════════════════════════════════════════════
//
// Since 2026-09-29 the company is created the moment "Start my free trial" is
// pressed — before the owner has said what the business is called or where it
// is (lib/signup/welcome.js). Such a company has name "" and country null,
// deliberately: the alternative is a placeholder name and the schema's
// "CA"/"CAD"/Toronto defaults, which would be FieldQuo inventing a business.
//
// Every client-facing surface assumes both. With no name the From line falls
// back to a sender that is not the contractor's (lib/email/resend.js), the
// quote's header and subject go blank, SMS templates read "Hi, this is  —";
// with no country the currency would fall back to CAD and a document sent in
// it would re-render in another currency the day the country is set, because
// quotes and invoices carry no currency column of their own. So nothing goes
// out until both are stated — refused, with a link to the screen that asks.
//
// Existing companies have both (POST /api/companies has required a name and
// refused a missing country for months), so this refuses nobody who could
// send yesterday. Pure, so scripts/check-welcome-flow.mjs runs it.

import { welcomePath } from "@/lib/signup/welcome";

/** The fields every client-facing send needs, in the order they are asked. */
export const CLIENT_FACING_FIELDS = Object.freeze(["name", "country"]);

/**
 * What is missing, as field names — [] when the company may send.
 * @param company  { name, country } — anything else is ignored.
 */
export function clientFacingGaps(company) {
  const c = company && typeof company === "object" ? company : {};
  const gaps = [];
  if (!String(c.name || "").trim()) gaps.push("name");
  if (!String(c.country || "").trim()) gaps.push("country");
  return gaps;
}

/** Where the owner answers the missing fields: the welcome business screen. */
export const FINISH_SETUP_PATH = welcomePath("business");

export const PROFILE_INCOMPLETE_CODE = "business_profile_incomplete";

/**
 * The refusal every gated route returns, in one shape: a sentence, a code the
 * screen can recognise, and the link. `null` when the company may send.
 */
export function clientFacingRefusal(company) {
  const gaps = clientFacingGaps(company);
  if (!gaps.length) return null;
  return {
    error: "Finish setting up your business first — clients see your business name and prices in your currency, and we don't have them yet.",
    code: PROFILE_INCOMPLETE_CODE,
    missing: gaps,
    fixUrl: FINISH_SETUP_PATH,
    fixLabel: "Finish setting up your business →",
  };
}

/** The select a caller needs for the check — nothing more. */
export const PROFILE_READINESS_SELECT = Object.freeze({ name: true, country: true });
