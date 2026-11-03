// lib/notifications/alertFacts.js
//
// The facts a staff ALERT TEXT carries that the feed row does not store.
//
// ══ Why these are read fresh instead of being catalog params ══════════════
//
// The owner, 2026-11-03: "a text notification to the company owner for when a
// lead arrives and their collected information — Name, Email, phone, Intent
// etc." A text to somebody in a van is only worth sending if they can act on
// it without opening a laptop, which means the number is IN the message.
//
// Those details are deliberately NOT added to the type's `params` in
// lib/notifications/catalog.js. That list is stored on the NotificationEvent
// row and rendered to every member the audience admits, and the catalog's own
// comment on lead.created explains why it stays minimal. A homeowner's phone
// and email in a stored feed row, for everybody who can see Requests, is a
// different decision from a text to the one person who asked for it.
//
// So the send reads the record itself, once, immediately before writing the
// message: one query on a server that is already in a database call, and the
// text cannot carry a name that was corrected five minutes ago.
//
// ══ Shape ═════════════════════════════════════════════════════════════════
//
//   loadAlertFacts()   one await, keyed by event — null for an event with no
//                      enricher, which is every event but lead.created today
//   factsForReader()   PURE: the same facts in ONE reader's language, as an
//                      overlay on the feed row's params
//
// Two halves because the query is per send and the language is per reader:
// the service name has translations (ServiceCategory.labelTranslations) and
// a French dispatcher and an English owner get the same lead described in
// their own words off one read.
//
// Keyed by event in a table rather than branched inside the copy function:
// lib/i18n/clientAlertCopy.js is nine languages of wording and has no
// business knowing what a LeadRequest is.

import { categoryLabelIn } from "@/lib/ai/quoteSuggestions";
import { leadIntakeDetails, formatIntakeValue } from "@/lib/leads/intakeShape";

/** One line of a text message: no newlines, no runs of space, clipped. */
function clip(value, max) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/**
 * The intake keys that hold "what they want" by name, in the order a reader
 * would want them. `serviceType` and `workType` are real keys in
 * app/data/quoteIntakeFields.js; `service` and `intent` are what a funnel or
 * a conversation writes.
 *
 * Not a closed list, on purpose: `intake` is a Json column whose keys belong
 * to whichever channel wrote them (lib/leads/intakeShape.js says so), and a
 * closed list would silently fold every unknown channel into "nothing to
 * say". So a named key is tried first and INTAKE_WANT_PATTERN sweeps the rest.
 */
const INTAKE_WANT_KEYS = Object.freeze(["serviceType", "workType", "service", "intent", "projectType"]);
const INTAKE_WANT_PATTERN = /service|work|intent|project/i;

/**
 * What this person wants, in the reader's language — the first of:
 *
 *   1. the service category they picked (a trade name, translated);
 *   2. an intake answer that names the service or the work;
 *   3. the opening of what they typed.
 *
 * Null when the lead holds none of them. NOT a default: "absence of a
 * statement is not a statement" (AGENTS.md failure class 5), and a text
 * reading "Wants: General enquiry" would be FieldQuo inventing the one fact
 * the person reading it is about to ring up and ask about.
 */
export function leadWant(lead, language = "en") {
  const fromCategory = clip(categoryLabelIn(lead?.category || null, language), 40);
  if (fromCategory) return fromCategory;

  const intake = lead?.intake && typeof lead.intake === "object" && !Array.isArray(lead.intake) ? lead.intake : null;
  if (intake) {
    for (const key of INTAKE_WANT_KEYS) {
      const value = clip(formatIntakeValue(intake[key]), 40);
      if (value) return value;
    }
    // leadIntakeDetails drops the address keys, the panels of their own and
    // every empty — the same entries the lead drawer lists, so the text says
    // what the screen says.
    for (const [key, value] of leadIntakeDetails(intake)) {
      if (!INTAKE_WANT_PATTERN.test(key)) continue;
      const shown = clip(formatIntakeValue(value), 40);
      if (shown) return shown;
    }
  }

  return clip(lead?.message, 60) || null;
}

/**
 * A phone worth printing, or null. "Worth printing" is "has digits in it":
 * the column is free text on most channels, and a text message that reads
 * "Tel: n/a" wastes a line and a segment to say nothing.
 */
export function leadPhoneLine(lead) {
  const phone = clip(lead?.phone, 24);
  return /\d/.test(phone) ? phone : null;
}

/**
 * An email worth printing, or null.
 *
 * createScoredLead stores null for an address that could not be delivered to
 * (cleanEmail), so this is about rows older than that rule and about imports:
 * something with no "@" is not an address, and printing it would look like a
 * typo FieldQuo made.
 */
export function leadEmailLine(lead) {
  const email = clip(lead?.email, 48);
  return /^[^\s@]+@[^\s@]+$/.test(email) ? email : null;
}

/** The columns the lead text needs, and nothing else. */
const LEAD_SELECT = Object.freeze({
  id: true,
  companyId: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  temperature: true,
  intake: true,
  category: { select: { label: true, labelTranslations: true } },
});

/**
 * Per-event loaders. An event with no entry here has no enricher and its
 * text is built from the feed row's params exactly as before.
 */
const LOADERS = Object.freeze({
  "lead.created": async (prisma, companyId, entityId) => {
    // Scoped by companyId as well as id: an entityId is passed in from the
    // caller, and a notification for company A must not be able to read
    // company B's lead even if the id were wrong.
    const lead = await prisma.leadRequest.findFirst({ where: { id: entityId, companyId }, select: LEAD_SELECT });
    return lead ? { event: "lead.created", lead } : null;
  },
});

/**
 * The facts for one send, or null. Never throws: a text is worth sending with
 * the feed row's params alone, and the thing this reports has already
 * happened.
 */
export async function loadAlertFacts({ prisma, companyId, type, entityId }) {
  const load = Object.prototype.hasOwnProperty.call(LOADERS, type) ? LOADERS[type] : null;
  if (!load || !companyId || !entityId) return null;
  try {
    return await load(prisma, companyId, entityId);
  } catch (err) {
    console.error(`[alert facts] ${type} ${entityId}:`, err?.message);
    return null;
  }
}

/**
 * The params overlay for ONE reader. PURE — the check executes it against a
 * 300-character name, an email with no "@" and null everything.
 *
 * Keys that are null are OMITTED rather than nulled, so the copy's own "is
 * this line present" test is the only place that decides, and a params key
 * never arrives as the string "null".
 */
export function factsForReader(facts, language = "en") {
  if (!facts || facts.event !== "lead.created") return null;
  const lead = facts.lead || {};
  const out = {};
  const name = clip(lead.name, 40);
  if (name) out.leadName = name;
  const phone = leadPhoneLine(lead);
  if (phone) out.leadPhone = phone;
  const email = leadEmailLine(lead);
  if (email) out.leadEmail = email;
  const want = leadWant(lead, language);
  if (want) out.leadWant = want;
  const temperature = clip(lead.temperature, 10);
  if (temperature) out.temperature = temperature;
  return out;
}
