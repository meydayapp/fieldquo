// lib/businessNumber/lineType.js
//
// What kind of line is this, and therefore which way can it come into
// FieldQuo? PURE — the Lookup call is in ./provider.js; this file only reads
// the answer, so scripts/check-bring-your-number.mjs can drive every type.
//
// ══ The type decides the path, not the company ═════════════════════════════
//
// The two ways in are not interchangeable, and picking the wrong one costs a
// contractor their phone line for a week:
//
//   hosted_sms  Twilio Hosted SMS. Only the TEXTING half of the number moves;
//               calls keep ringing wherever they ring today. Twilio accepts it
//               for a US or Canadian LANDLINE or TOLL-FREE number that is not
//               already text-enabled somewhere else.
//   port        The whole number moves to FieldQuo's Twilio account. The only
//               way in for a CELL — Twilio's own FAQ: "Mobile numbers are not
//               supported" for hosting.
//
// ══ VoIP goes to `port`, not `hosted_sms` — and that is Twilio's rule ══════
//
// The brief grouped VoIP with landlines. Twilio does not: its Hosted Numbers
// FAQ says "The carrier type listed as `voip` makes a number ineligible for
// hosting", and the order is refused at its eligibility step. Offering hosted
// texting for a VoIP line would be a form that fills in, submits, and fails a
// day later with a reason the contractor cannot act on — the dead control
// AGENTS.md forbids. So a VoIP line is offered the port (VoIP numbers port
// like any local number) with the reason said plainly, and `HOSTED_REFUSES`
// below names the rule so the check can hold it.
//
// ══ Only the US and Canada ══════════════════════════════════════════════════
//
// Hosted SMS is US/Canada only, the porting guidance below is written for the
// two, and the A2P/CASL rules FieldQuo knows are theirs. Any other country is
// an honest "not available yet", never a form.

import { TOLL_FREE_PREFIXES } from "@/lib/voice/numbers";
import { countryForAreaCode } from "@/lib/voice/nanp";

/** Countries this feature serves. */
export const SUPPORTED_COUNTRIES = Object.freeze(["US", "CA"]);

/** Our five kinds of line. */
export const LINE_KINDS = Object.freeze(["mobile", "landline", "voip", "toll_free", "unknown"]);

/** The line kinds Twilio refuses to host for SMS, with its own words. */
export const HOSTED_REFUSES = Object.freeze({
  mobile: "Mobile numbers are not supported.",
  voip: "The carrier type listed as voip makes a number ineligible for hosting.",
});

/**
 * Twilio Lookup v2 line_type_intelligence.type → our kind.
 *
 * Twilio's vocabulary (docs, 2026): landline, mobile, fixedVoip, nonFixedVoip,
 * personal, tollFree, premium, sharedCost, uan, voicemail, pager, unknown.
 * Everything we cannot route is `unknown` rather than guessed at — a pager
 * classified as a landline would be sent down a path Twilio then refuses.
 */
export function kindFromLookup(type) {
  switch (String(type || "").trim()) {
    case "mobile":
      return "mobile";
    case "landline":
      return "landline";
    case "fixedVoip":
    case "nonFixedVoip":
      return "voip";
    case "tollFree":
      return "toll_free";
    default:
      return "unknown";
  }
}

/** Which way(s) in, for a kind. An empty list means none. */
export function pathsForKind(kind) {
  switch (kind) {
    case "mobile":
    case "voip":
      return ["port"];
    case "landline":
    case "toll_free":
      return ["hosted_sms"];
    case "unknown":
      // Lookup could not say. Both are offered, each with what it is for,
      // rather than a guess presented as a fact — the company knows whether
      // the thing in their pocket is a cell.
      return ["hosted_sms", "port"];
    default:
      return [];
  }
}

/**
 * The verdict the settings screen renders. PURE.
 *
 * @param e164     the normalised number
 * @param lookup   { countryCode, valid, lineTypeIntelligence: { type, carrierName, errorCode } }
 *                 — the Lookup response, or null when Lookup could not be asked
 * @returns {{ ok, e164, country, kind, carrierName, paths, reason, reasonKey }}
 */
export function classifyNumber({ e164, lookup = null } = {}) {
  const base = { e164: e164 || null, country: null, kind: "unknown", carrierName: null, paths: [] };
  if (!e164 || !/^\+\d{8,15}$/.test(String(e164))) {
    return { ...base, ok: false, reasonKey: "invalid", reason: "That doesn't look like a phone number." };
  }

  // Country: Lookup's own answer first, then the NANP area code. A +1 number
  // outside the US/Canada set (Jamaica, Puerto Rico's neighbours) answers
  // from Lookup, which is why the area-code table is only the fallback.
  const fromLookup = lookup?.countryCode ? String(lookup.countryCode).toUpperCase() : null;
  const nanp = /^\+1(\d{3})\d{7}$/.exec(String(e164));
  const country = fromLookup || (nanp ? countryForAreaCode(nanp[1]) : null);
  if (!country || !SUPPORTED_COUNTRIES.includes(country)) {
    return {
      ...base,
      country,
      ok: false,
      reasonKey: "country",
      reason: "Bringing a number is available for US and Canadian numbers only, for now.",
    };
  }

  if (lookup && lookup.valid === false) {
    return { ...base, country, ok: false, reasonKey: "invalid", reason: "That number isn't in service, according to the carrier database." };
  }

  const lti = lookup?.lineTypeIntelligence || null;
  let kind = kindFromLookup(lti?.type);
  // A toll-free prefix is a fact about the number itself, not a guess: if
  // Lookup was unavailable or said nothing, the prefix still decides.
  const tollFree = nanp && TOLL_FREE_PREFIXES.includes(nanp[1]);
  if (kind === "unknown" && tollFree) kind = "toll_free";

  return {
    ok: true,
    e164,
    country,
    kind,
    carrierName: lti?.carrierName ? String(lti.carrierName).slice(0, 120) : null,
    paths: pathsForKind(kind),
    reasonKey: kind === "voip" ? "voip_ports" : kind === "unknown" ? "unknown_kind" : null,
    reason:
      kind === "voip"
        ? "Twilio won't host texts on a VoIP line, so the number has to move to FieldQuo instead."
        : kind === "unknown"
          ? "We couldn't tell what kind of line this is. If it's a cell phone, move it; if it's a landline or toll-free, keep calls where they are and move texts."
          : null,
  };
}

/**
 * A demo company's classification — no Lookup is made (a lookup is a paid
 * call on FieldQuo's account). The toll-free prefix still decides toll-free;
 * everything else is shown as a cell, the case the owner's walkthrough is
 * about. Marked simulated so the screen can say so.
 */
export function simulatedClassification(e164) {
  const nanp = /^\+1(\d{3})\d{7}$/.exec(String(e164 || ""));
  const tollFree = nanp && TOLL_FREE_PREFIXES.includes(nanp[1]);
  const v = classifyNumber({
    e164,
    lookup: nanp
      ? { countryCode: countryForAreaCode(nanp[1]) || null, valid: true, lineTypeIntelligence: { type: tollFree ? "tollFree" : "mobile", carrierName: "Demo carrier" } }
      : null,
  });
  return { ...v, simulated: true };
}
