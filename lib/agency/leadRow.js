// lib/agency/leadRow.js
//
// THE privacy boundary for a marketing agency. Every lead an agency sees —
// the API's lead list and lead detail, every webhook payload, every Zapier
// sample — is built by buildLeadRow below and by nothing else, so the two
// switches (Company.agencyShareContacts, Company.agencyShareMoney) cannot be
// honoured on one path and forgotten on another. Pure.
//
// ══ What a row carries by default (contact sharing OFF) ════════════════════
//
//   * the pseudonymous reference (lib/agency/leadRef.js) and its "L-7F3A"
//   * the FIRST name only
//   * when they first made contact, the channel, and the ad that brought
//     them where it is known (campaign / ad set / ad, fbclid / gclid, UTMs)
//   * tier and temperature, and every stage timestamp
//   * the service asked for and the service sold
//   * a partial postal code (US ZIP5, Canadian FSA — lib/agency/postal.js)
//   * money (quote, won, collected) — only while "Share job values" is on
//   * the lost reason, from the pipeline's closed vocabulary
//
// Never: a surname, a phone, an email, a street address, a note, a message
// body. A quote's decline reason is the client's own words, so with contact
// sharing off it is shared with every email, phone number, postcode and
// street address in it blanked.
//
// The shape is the same whichever switch is on — a field that is not shared
// is null, never absent — so a Zap mapped while sharing was on does not
// break when it is turned off, it just receives nothing.

import { displayRef } from "@/lib/agency/leadRef";
import { postalForAgency } from "@/lib/agency/postal";
import { freshPatterns } from "@/lib/attribution/contactPatterns";

export const QUALIFIED_TEMPERATURES = Object.freeze(["warm", "hot"]);

/** "upcoming" | "held" | "cancelled" | "unmarked" — see appointmentOutcome. */
export const APPOINTMENT_OUTCOMES = Object.freeze(["upcoming", "held", "cancelled", "unmarked"]);

/**
 * What became of an appointment. FieldQuo records an appointment as
 * scheduled, completed or cancelled; it has no "no-show" status, so none is
 * reported — a visit whose date has passed and that nobody marked done or
 * cancelled is "unmarked", which is what it is, rather than a no-show this
 * product cannot know about.
 */
export function appointmentOutcome(appt, now = new Date()) {
  if (!appt) return null;
  if (appt.status === "cancelled") return "cancelled";
  if (appt.status === "completed") return "held";
  const at = appt.scheduledAt ? new Date(appt.scheduledAt).getTime() : NaN;
  if (Number.isFinite(at) && at > now.getTime()) return "upcoming";
  return "unmarked";
}

/** The first name, or null when the "name" is really a phone or an email. */
export function firstNameOf(name) {
  const s = String(name ?? "").normalize("NFC").trim();
  if (!s || /@/.test(s) || /\d{3,}/.test(s)) return null;
  const first = s.split(/\s+/)[0].replace(/[^\p{L}\p{M}'’.-]/gu, "");
  return first ? first.slice(0, 40) : null;
}

/** A client's own words with every contact detail blanked. */
export function scrubContactDetails(text) {
  if (typeof text !== "string" || !text.trim()) return null;
  const p = freshPatterns();
  const out = text
    .replace(p.email, "[email]")
    .replace(p.phone, "[phone]")
    .replace(p.address, "[address]")
    .replace(p.postcode, "[postal code]")
    .trim();
  return out.slice(0, 300) || null;
}

const isoOrNull = (d) => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString();
};
const money = (n) => (n === null || n === undefined || !Number.isFinite(Number(n)) ? null : Math.round(Number(n) * 100) / 100);

/**
 * The stages a lead has reached — MONOTONIC: a lead counted at a later stage
 * is counted at every earlier one. A booked visit, a sent quote or a win is
 * proof the lead was qualified whatever its temperature said (the same rule
 * lib/analytics/adFunnel.js uses: "a quote is proof").
 */
export function stagesOf(fact) {
  const won = Boolean(fact?.won);
  const quoteSent = won || Boolean(fact?.quote && (fact.quote.sentAt || ["sent", "accepted", "declined"].includes(fact.quote.status)));
  const appointment = Boolean(fact?.appointment);
  const qualified = won || quoteSent || appointment || QUALIFIED_TEMPERATURES.includes(fact?.temperature);
  return { lead: true, qualified, appointment, quoteSent, won };
}

/** The furthest stage, in the agency's words. A lost lead says so. */
export function stageOf(fact) {
  const s = stagesOf(fact);
  if (s.won) return "won";
  if (fact?.status === "lost") return "lost";
  if (s.quoteSent) return "quote_sent";
  if (s.appointment) return "appointment";
  if (s.qualified) return "qualified";
  return "lead";
}

/**
 * @param fact  one lead as lib/agency/leadFacts.js loads it (holds PII —
 *              never returned as-is from anywhere)
 * @param opts  { shareContacts, shareMoney, currency, country, now }
 */
export function buildLeadRow(fact, { shareContacts = false, shareMoney = true, currency = null, country = null, now = new Date() } = {}) {
  const contacts = shareContacts === true;
  const withMoney = shareMoney !== false;
  const stages = stagesOf(fact);
  const appt = fact.appointment || null;
  const quote = fact.quote || null;
  const attr = fact.attribution || {};
  const postal = postalForAgency({ candidates: fact.postalCandidates || [], country, full: contacts });
  const firstResponseAt = fact.firstResponseAt ? new Date(fact.firstResponseAt) : null;
  const firstContactAt = fact.firstContactAt ? new Date(fact.firstContactAt) : null;
  const speed =
    firstResponseAt && firstContactAt && firstResponseAt.getTime() >= firstContactAt.getTime()
      ? Math.round((firstResponseAt.getTime() - firstContactAt.getTime()) / 60000)
      : null;

  return {
    ref: fact.ref || null,
    displayRef: displayRef(fact.ref),
    firstName: firstNameOf(fact.name),
    firstContactAt: isoOrNull(fact.firstContactAt || fact.createdAt),
    leadCreatedAt: isoOrNull(fact.createdAt),
    channel: fact.channel || "organic",
    campaignId: attr.campaignId || null,
    campaignName: attr.campaignName || null,
    adsetId: attr.adsetId || null,
    adsetName: attr.adsetName || null,
    adId: attr.adId || null,
    adName: attr.adName || null,
    fbclid: attr.fbclid || null,
    gclid: attr.gclid || null,
    utmSource: attr.utmSource || null,
    utmMedium: attr.utmMedium || null,
    utmCampaign: attr.utmCampaign || null,
    utmContent: attr.utmContent || null,
    utmTerm: attr.utmTerm || null,
    adRepliedAt: isoOrNull(attr.adRepliedAt),
    tier: fact.tier || null,
    temperature: fact.temperature || null,
    qualified: stages.qualified,
    qualifiedAt: stages.qualified ? isoOrNull(fact.qualifiedAt) : null,
    firstResponseAt: isoOrNull(firstResponseAt),
    speedToLeadMinutes: speed,
    stage: stageOf(fact),
    pipelineStatus: fact.status || null,
    appointmentBookedAt: isoOrNull(appt?.bookedAt),
    appointmentAt: isoOrNull(appt?.scheduledAt),
    appointmentOutcome: appt ? appointmentOutcome(appt, now) : null,
    appointmentType: appt?.type || null,
    requestedVisitFrom: isoOrNull(fact.requestedVisit?.from),
    requestedVisitTo: isoOrNull(fact.requestedVisit?.to),
    quoteCreatedAt: isoOrNull(quote?.createdAt),
    quoteSentAt: isoOrNull(quote?.sentAt || (stages.quoteSent && quote?.acceptedAt) || null),
    quoteViewedAt: isoOrNull(quote?.viewedAt),
    quoteDeclinedAt: isoOrNull(quote?.declinedAt),
    quoteDeclineReason: quote?.declineReason ? (contacts ? String(quote.declineReason).slice(0, 500) : scrubContactDetails(quote.declineReason)) : null,
    wonAt: isoOrNull(fact.wonAt),
    closedWithoutVisit: stages.won && !stages.appointment,
    invoicedAt: isoOrNull(fact.invoicedAt),
    paidAt: isoOrNull(fact.paidAt),
    jobCompletedAt: isoOrNull(fact.jobCompletedAt),
    moneyShared: withMoney,
    currency: withMoney ? currency || null : null,
    quoteAmount: withMoney ? money(quote?.amount) : null,
    wonAmount: withMoney && stages.won ? money(fact.wonAmount) : null,
    invoicedAmount: withMoney ? money(fact.invoicedAmount) : null,
    collectedAmount: withMoney ? money(fact.collectedAmount) : null,
    serviceRequested: fact.serviceRequested || null,
    serviceSold: fact.serviceSold || null,
    postalCode: postal.postalCode,
    postalCountry: postal.postalCountry,
    lostReason: fact.status === "lost" ? fact.lostReason || null : null,
    contactsShared: contacts,
    fullName: contacts ? fact.name || null : null,
    phone: contacts ? fact.phone || null : null,
    email: contacts ? fact.email || null : null,
    updatedAt: isoOrNull(fact.updatedAt || fact.createdAt),
  };
}

/** The keys every row carries — the Zapier output fields and the OpenAPI schema list these. */
export const LEAD_ROW_KEYS = Object.freeze(
  Object.keys(
    buildLeadRow({ id: "x", ref: "lr_0000000000000000", createdAt: new Date(0), name: "A" }, { now: new Date(0) }),
  ),
);

/** The keys that carry contact details — null unless contact sharing is on. */
export const CONTACT_KEYS = Object.freeze(["fullName", "phone", "email"]);
/** The keys that carry money — null unless "Share job values" is on. */
export const MONEY_KEYS = Object.freeze(["quoteAmount", "wonAmount", "invoicedAmount", "collectedAmount", "currency"]);
