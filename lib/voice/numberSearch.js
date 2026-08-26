// lib/voice/numberSearch.js
//
// Which numbers a company can actually have, and which area code to open on.
//
// ══ The hole this fills ════════════════════════════════════════════════════
//
// The buy route has always forwarded an `areaCode` to Retell, and Retell has
// always documented it as:
//
//     "Area code of the number to obtain. Format is a 3 digit integer.
//      Currently only supports US area code."
//
// This product sells into Quebec. So for every Canadian company that parameter
// was inert — a contractor in Gatineau asked for nothing and received whatever
// Retell's pool handed out, which is how a Drummondville business ends up with
// a Toronto number on its van. Worse, NUMBER_TYPES.local has been advertising
// "A number in your own area code" the whole time, so the screen promised the
// one thing the request could not deliver.
//
// ══ Why Twilio, and not a better hint ══════════════════════════════════════
//
// Retell's create-phone-number takes `phone_number` — "The number you are
// trying to purchase in E.164 format" — and `number_provider`, which "Default[s]
// to twilio". So a NAMED number is buyable, and the naming can be exact rather
// than a preference. FieldQuo already holds Twilio credentials for SMS
// (lib/sms/twilioClient.js), and Twilio's available-number inventory is the same
// pool Retell buys out of. Searching it ourselves turns "please try for 819"
// into "here are four real 819 numbers, pick one" — which is a control that
// does what it says.
//
// It is still not a guarantee, and nothing here pretends otherwise: a number
// listed as available can be bought by somebody else in the seconds between the
// list and the click. The buy route re-checks immediately before it spends
// anything, and reports a substitution loudly if one somehow happens. See
// app/api/settings/voice/number/route.js.
//
// ══ What this file will NOT do ═════════════════════════════════════════════
//
// It will not invent an area code. There is no city→area-code table here and
// there should not be one: Quebec alone runs 418/438/450/514/579/581/819/873,
// a province cannot pick between them, and a wrong default here is not a
// cosmetic error — it is a number that gets BOUGHT and printed. So the only
// thing treated as a statement of area code is the company's OWN phone number,
// where the digits are simply present. Everything else (city, province) is
// handed to Twilio as a search, and whatever area codes come back come back
// from real inventory rather than from a guess of ours.
import { twilioRest, twilioConfigured } from "@/lib/sms/twilioClient";

/**
 * The NANP area code in a number, or null.
 *
 * Deliberately strict. `+1` plus ten digits and nothing else — a seven-digit
 * local string has no area code in it, and reading the first three digits of one
 * would produce a confident wrong answer, which is the failure this whole file
 * is built to avoid.
 *
 * The N11 codes (211, 311 … 911) are service codes and are never assigned to
 * subscribers, so a number that appears to carry one is a parse error rather
 * than a location.
 */
export function areaCodeOf(phone) {
  const digits = String(phone || "").replace(/[^\d]/g, "");
  let ten = null;
  if (digits.length === 10) ten = digits;
  else if (digits.length === 11 && digits.startsWith("1")) ten = digits.slice(1);
  if (!ten) return null;

  const code = ten.slice(0, 3);
  // NANP: first digit 2-9, and not an N11 service code.
  if (!/^[2-9]\d\d$/.test(code)) return null;
  if (/^\d11$/.test(code)) return null;
  return code;
}

/** Is this something a caller could have typed as an area code? */
export function isUsableAreaCode(input) {
  const code = String(input || "").replace(/[^\d]/g, "");
  return code.length === 3 && /^[2-9]\d\d$/.test(code) && !/^\d11$/.test(code);
}

/**
 * Where to open the picker — and, just as often, the honest answer that we
 * don't know.
 *
 * Only `company.phone` can answer this. A city or a province narrows a SEARCH
 * (see searchLocalNumbers) but does not name an area code, and padding the
 * absent case with a plausible-looking default is exactly the failure class
 * AGENTS.md calls out: absence of a statement is not a statement. An empty box
 * makes the contractor type three digits. A wrong default makes them buy the
 * wrong number.
 *
 * @returns { areaCode, from } — `from` is "phone" or null, and the UI says which
 *          so the contractor can see why we opened where we did.
 */
export function defaultAreaCode(company) {
  const fromPhone = areaCodeOf(company?.phone);
  if (fromPhone) return { areaCode: fromPhone, from: "phone" };
  return { areaCode: null, from: null };
}

/**
 * Can the contractor be offered a real choice at all?
 *
 * Gated on Twilio credentials, because without them there is no inventory to
 * show and the only remaining lever is Retell's `area_code` — which is
 * US-only and therefore silently ignored for the Canadian companies this
 * product mostly serves. A picker that quietly does nothing is worse than no
 * picker, so the UI falls back to saying we'll get the closest we can.
 */
export function numberChoiceAvailable() {
  return twilioConfigured();
}

/**
 * One row of the picker, from a Twilio AvailablePhoneNumber instance.
 *
 * `locality` is genuinely null for part of the inventory — several 873 numbers
 * come back with no city and `region: "CA"` rather than a province. Passed
 * through as null rather than filled in with the province or the area code's
 * "usual" city; the UI omits the line instead of printing an invented place.
 */
function toChoice(item) {
  return {
    e164: item.phoneNumber,
    display: item.friendlyName || item.phoneNumber,
    areaCode: areaCodeOf(item.phoneNumber),
    locality: item.locality || null,
    region: item.region || null,
  };
}

/**
 * Real, buyable local numbers — by area code, or failing that near a city.
 *
 * ── Every filter here is load-bearing ─────────────────────────────────────
 *
 * `voiceEnabled` — it is a phone receptionist. A number that cannot take a call
 *   is not the product.
 *
 * `smsEnabled` — the crew inbox resolves a company from the `To` of an inbound
 *   text and matches it against VoicePhoneNumber.e164 (app/api/crew/inbound).
 *   Hand a company a voice-only number and crew texting breaks months later,
 *   silently, on the one screen nobody associates with this purchase.
 *
 * `excludeAllAddressRequired` — a number that needs a registered address is
 *   bought by RETELL, on Retell's account, with Retell's addresses. We cannot
 *   know whether that would satisfy the carrier, so offering one risks showing
 *   a number that cannot be bought. Canadian local inventory reports
 *   `addressRequirements: "none"` in practice, so this costs nothing today and
 *   protects the day it changes.
 *
 * Beta numbers are dropped for the same reason: "new to the Twilio platform" is
 * not a property to discover on a contractor's main line.
 *
 * ── An empty result is an ANSWER ──────────────────────────────────────────
 *
 * Checked live against Twilio: `areaCode: 416` and `areaCode: 514` both return
 * zero — Toronto and Montreal local inventory is exhausted, routinely. That is
 * not an error and must not be rendered as one. The caller gets `[]` and a
 * `searched` description, and the screen says the area code has nothing free
 * rather than spinning or blaming the connection.
 *
 * @param areaCode  three digits, or null to fall back to city/province
 * @returns { numbers, searched: { areaCode, locality, region }, configured }
 */
export async function searchLocalNumbers({
  country = "CA",
  areaCode = null,
  locality = null,
  region = null,
  limit = 6,
} = {}) {
  if (!twilioConfigured()) {
    return { numbers: [], searched: null, configured: false };
  }

  const iso = String(country || "CA").toUpperCase();
  const code = isUsableAreaCode(areaCode) ? String(areaCode).replace(/[^\d]/g, "") : null;

  // An area code is the most specific thing anyone can ask for, so it wins
  // outright. City and province are only consulted when no area code was given
  // — combining them would silently drop results (a Gatineau company whose 819
  // inventory is dry has 873 numbers in the same city, and an AND would hide
  // them).
  const query = { voiceEnabled: true, smsEnabled: true, excludeAllAddressRequired: true };
  const searched = { areaCode: null, locality: null, region: null };

  if (code) {
    query.areaCode = Number(code);
    searched.areaCode = code;
  } else if (locality) {
    query.inLocality = String(locality);
    searched.locality = String(locality);
  } else if (region) {
    query.inRegion = String(region);
    searched.region = String(region);
  } else {
    // Nothing to search on. Not an error and not an empty list dressed up as
    // one — the caller has to be able to tell "we looked and found nothing"
    // apart from "we had nothing to look with".
    return { numbers: [], searched: null, configured: true };
  }

  const items = await twilioRest
    .availablePhoneNumbers(iso)
    .local.list({ ...query, limit: Math.min(20, Math.max(1, Number(limit) || 6)) });

  const numbers = (items || [])
    .filter((item) => !item.beta && item.phoneNumber)
    .map(toChoice)
    // A row we cannot parse an area code out of is a row whose area code we
    // would have to display as a guess. Dropped instead.
    .filter((n) => n.areaCode);

  return { numbers, searched, configured: true };
}

/**
 * Is this exact number still free, right now?
 *
 * The gap between listing a number and clicking Buy is real, and on the other
 * side of that gap is money: the buy route reserves a month's rental from the
 * company's balance BEFORE it calls the provider. Catching "somebody took it"
 * here means the refusal costs the contractor nothing and reads as what it is,
 * instead of arriving as a provider error after a reserve-and-refund round trip.
 *
 * It is also the only validation standing between a posted E.164 and a purchase.
 * The browser sends a number, and a number is not an amount — but it IS a thing
 * we are about to buy, so it gets checked against the real inventory rather than
 * trusted because it came back from our own picker a minute ago.
 *
 * `contains` with a full E.164 is an exact match; verified live against Twilio,
 * where a real available number returns exactly one row and a fabricated one in
 * the same area code returns zero.
 *
 * Returns null — not false — when Twilio cannot answer at all. "I don't know"
 * and "it's gone" call for different behaviour, and collapsing them would either
 * block every purchase during a Twilio outage or wave through a number that has
 * already been sold.
 */
export async function isStillAvailable(e164, { country = "CA" } = {}) {
  if (!twilioConfigured()) return null;
  const wanted = String(e164 || "");
  if (!/^\+\d{8,15}$/.test(wanted)) return false;

  try {
    const items = await twilioRest
      .availablePhoneNumbers(String(country || "CA").toUpperCase())
      .local.list({ contains: wanted, limit: 1 });
    return (items || []).some((item) => item.phoneNumber === wanted);
  } catch (err) {
    console.error("[voice/numberSearch] availability re-check failed", err?.message || err);
    return null;
  }
}
