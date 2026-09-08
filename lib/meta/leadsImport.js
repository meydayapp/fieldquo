// lib/meta/leadsImport.js
//
// A Meta lead form submission -> an ordinary FieldQuo lead.
//
// A painter runs a Facebook ad: "Get a free painting estimate." A homeowner
// taps it, Meta shows its own built-in form pre-filled with the name and
// email already on their Facebook account, they tap Submit. That person is a
// lead, and this file is the only thing that turns them into one.
//
// ══ One creator, two intake paths ══════════════════════════════════════════
//
// Meta delivers the same submission two ways, and FieldQuo listens to both:
//
//   1. app/api/meta/leads/webhook — Meta POSTs a leadgen id the moment the
//      form is submitted. Fast, and lossy: Meta's own documentation says a
//      webhook can be dropped, and a dropped one is a homeowner who filled in
//      a form and was never called.
//   2. app/api/cron/meta-leads — polls each active form for anything newer
//      than its cursor. Slower, and complete.
//
// Both call importMetaLead() below and NOTHING else writes a Meta lead. Two
// writers would be two sets of rules that drift, and the drift would show up
// as a lead that scores differently depending on which path happened to
// deliver it first (AGENTS.md failure class #4).
//
// ══ Why it is a normal lead ════════════════════════════════════════════════
//
// createScoredLead() from lib/leads/createLead.js — the same function the
// self-quote form, the kitchen designer, the funnels and the AI receptionist
// use. So a Meta lead is scored by the same scorer, lands on the same board,
// and fires the same `lead.created` notification to the same people. Writing
// a second notification path here would have been a second thing to keep in
// step with the first; there is deliberately no Meta-specific alert.
//
// ══ Nothing is invented ════════════════════════════════════════════════════
//
// Meta's field_data is an array of { name, values } with names the contractor
// chose when they built the form. The standard ones map to real columns; every
// other answer is kept verbatim in the lead's `intake` JSON, which the lead
// screen already renders. A question that was not answered leaves its column
// NULL — never "" — because "" reads as "they gave us an empty phone number"
// to every screen and every export downstream.

import { db } from "@/lib/db";
import { createScoredLead } from "@/lib/leads/createLead";

/** The `source` every lead from this path carries. */
export const META_LEAD_SOURCE = "meta_lead_form";

// ── Meta's own standard field names ────────────────────────────────────────
//
// Meta pre-fills these from the person's Facebook profile, so they arrive with
// these exact names whatever the contractor called the question on screen.
// Anything NOT in here is a custom question the contractor wrote, and is kept
// as an intake answer under its own key rather than guessed into a column.
const STANDARD = {
  full_name: "fullName",
  first_name: "firstName",
  last_name: "lastName",
  email: "email",
  phone_number: "phone",
  // Address parts. `street_address` becomes intake.address because that is the
  // key the lead screen already renders (app/app/leads/page.js reads
  // lead.intake.address) and the key the self-quote form writes — a second
  // spelling for the same fact is a fact that can disagree with itself.
  street_address: "address",
  city: "city",
  state: "province",
  province: "province",
  country: "country",
  post_code: "postalCode",
  zip_code: "postalCode",
};

/**
 * The first answer that is actually an answer.
 *
 * Meta sends `values` as an array — one entry for a text question, several for
 * a multi-select. An unanswered question can arrive as `[]`, as `[""]`, or as
 * `[null]`, and all three mean the same thing: nothing was said. Returns null
 * for all of them, so a caller can never mistake an empty string for a reply.
 */
function firstValue(values) {
  if (!Array.isArray(values)) return null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

/** "roof_type" / "roofType" -> "Roof type", for the readable message blob. */
function humanise(key) {
  return String(key)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Meta's field_data array -> the pieces createScoredLead needs. PURE: no db,
 * no fetch, no clock. Every hostile shape this has to survive is executed in
 * scripts/check-meta-leads.mjs rather than reasoned about here.
 *
 * @param {Array<{name: string, values: any[]}>} fieldData
 * @returns {{
 *   name: string|null, nameSource: string|null,
 *   email: string|null, phone: string|null,
 *   intake: object|null, message: string|null,
 * }}
 *
 * ── Duplicate field names ─────────────────────────────────────────────────
 *
 * Meta permits the same `name` twice on one form (two "city" questions, say).
 * The FIRST answered one wins the column, and the later ones are kept as
 * `city__2`, `city__3` in intake. Dropping them would be discarding something
 * a homeowner typed; overwriting the column with the last one would make the
 * lead's phone number depend on the order Meta happened to serialise the
 * array in.
 */
export function mapLeadFields(fieldData) {
  const seen = new Map(); // meta field name -> how many answered copies so far
  const std = {}; // our key -> value, first answer wins
  const custom = {}; // custom question key -> value

  for (const entry of Array.isArray(fieldData) ? fieldData : []) {
    if (!entry || typeof entry !== "object") continue;
    const rawName = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!rawName) continue;
    const value = firstValue(entry.values);
    if (value === null) continue; // Not answered. Not a column, not an intake key.

    const count = (seen.get(rawName) || 0) + 1;
    seen.set(rawName, count);

    const stdKey = STANDARD[rawName.toLowerCase()];
    if (stdKey && count === 1) {
      // First answered copy of a standard field claims the column, unless an
      // earlier alias already did (state and province both map to `province`).
      if (std[stdKey] === undefined) std[stdKey] = value;
      continue;
    }

    // Everything else — a custom question, or a repeat of a standard one —
    // is kept verbatim under a key that says which copy it was.
    const key = count === 1 ? rawName : `${rawName}__${count}`;
    custom[key] = value;
  }

  // ── The name ────────────────────────────────────────────────────────────
  //
  // LeadRequest.name is NOT NULL, and a Meta form can genuinely omit the name
  // question — a one-field "just give us your email" ad is a real thing
  // contractors run. So there is a fallback ORDER, and every step of it uses
  // something the person actually typed:
  //
  //   full_name -> first + last -> email -> phone
  //
  // and if none of those exist there is no lead to create at all, which the
  // caller refuses rather than inventing a placeholder. "Facebook Lead" or
  // "Unknown" in the name column would be FieldQuo putting words in a
  // stranger's mouth on a screen a contractor works from.
  const joined = [std.firstName, std.lastName].filter(Boolean).join(" ").trim();
  let name = null;
  let nameSource = null;
  if (std.fullName) {
    name = std.fullName;
    nameSource = "full_name";
  } else if (joined) {
    name = joined;
    nameSource = "first_last";
  } else if (std.email) {
    name = std.email;
    nameSource = "email";
  } else if (std.phone) {
    name = std.phone;
    nameSource = "phone";
  }

  // Address parts go in intake beside the custom answers — the same shape
  // app/api/self-quote/route.js writes, and only the keys that arrived.
  const intakeObj = {
    ...custom,
    ...(std.address ? { address: std.address } : {}),
    ...(std.city ? { city: std.city } : {}),
    ...(std.province ? { province: std.province } : {}),
    ...(std.country ? { country: std.country } : {}),
    ...(std.postalCode ? { postalCode: std.postalCode } : {}),
  };

  // The readable blob staff actually read, built the same way the self-quote
  // form builds its own: the address line, then every answer, one per line.
  const answers = Object.entries(custom).map(([k, v]) => `${humanise(k)}: ${v}`);
  const addressLine = [std.address, std.city, std.province, std.postalCode]
    .filter(Boolean)
    .join(", ");
  const message = [addressLine, answers.join("\n")].filter(Boolean).join("\n\n") || null;

  return {
    name,
    nameSource,
    email: std.email || null,
    phone: std.phone || null,
    intake: Object.keys(intakeObj).length ? intakeObj : null,
    message,
  };
}

/**
 * Which company owns a Page — the tenant boundary of this whole feature.
 *
 * ══ Read this before changing it ═══════════════════════════════════════════
 *
 * The webhook is a PUBLIC endpoint. Its body is written by whoever sent the
 * request, and after signature verification it is still only "Meta sent this",
 * never "this is company X's lead". The payload's page_id is therefore used
 * as a LOOKUP KEY into rows FieldQuo already stored, and the companyId comes
 * off OUR row. A payload field named companyId, or a company inferred from
 * anything the sender chose, would let one forged (or replayed) delivery file
 * a lead into another contractor's pipeline.
 *
 * Returns null when no company has ever registered this Page. That is a
 * refusal, not a fallback: there is no "default tenant" to reach for.
 */
export async function resolveCompanyForPage(pageId) {
  if (!pageId) return null;
  const row = await db.metaLeadForm.findFirst({
    where: { pageId: String(pageId) },
    select: { companyId: true },
  });
  return row?.companyId || null;
}

/**
 * THE writer. Both intake paths end here and nothing else creates a Meta lead.
 *
 * @param {object}   args
 * @param {string}   args.companyId    resolved from OUR rows, never the payload
 * @param {object}   args.lead         Meta's leadgen object: { id, created_time,
 *                                     ad_id, form_id, field_data }
 * @param {string}   args.formId       the form this arrived on
 * @param {object}   [args.attribution] { campaignId, campaignName } or null —
 *                                     resolved by the caller, best-effort
 * @param {string}   [args.path]       "webhook" | "cron", for the log line only
 *
 * @returns {{ status: "created", leadId }
 *         | { status: "duplicate", leadId }
 *         | { status: "skipped", reason }}
 *
 * ── Idempotency ───────────────────────────────────────────────────────────
 *
 * `metaLeadId` is Meta's own leadgen id and it is unique per company in the
 * schema. Two things make a re-delivery ordinary rather than exceptional:
 * Meta retries a webhook until it gets a 2xx, and the cron polls the same
 * window the webhook already covered. So the SAME lead arrives twice on a
 * good day.
 *
 * The pre-check below is an optimisation; the unique constraint is the
 * guarantee. The two paths can run concurrently — a webhook landing while the
 * cron is mid-poll — and only the database can settle that race. A P2002 is
 * therefore a normal outcome reported as "duplicate", not an error.
 */
export async function importMetaLead({ companyId, lead, formId, attribution, path = "webhook" }) {
  const metaLeadId = lead?.id ? String(lead.id) : null;
  if (!companyId) return { status: "skipped", reason: "no_company" };
  if (!metaLeadId) return { status: "skipped", reason: "no_leadgen_id" };

  const existing = await db.leadRequest.findFirst({
    where: { companyId, metaLeadId },
    select: { id: true },
  });
  if (existing) return { status: "duplicate", leadId: existing.id };

  const mapped = mapLeadFields(lead.field_data);
  if (!mapped.name) {
    // Nothing identifying at all: no name, no email, no phone. Creating a row
    // would put an unnameable, uncontactable entry on a contractor's board.
    return { status: "skipped", reason: "no_identity" };
  }

  let created;
  try {
    created = await createScoredLead({
      companyId,
      name: mapped.name,
      email: mapped.email,
      phone: mapped.phone,
      message: mapped.message,
      intake: mapped.intake,
      source: META_LEAD_SOURCE,
      // ── No budget band, no timeline, no language ────────────────────────
      //
      // All three are absent on purpose. Meta's form did not ask about budget
      // or timing unless the contractor wrote those questions themselves (in
      // which case the answers are in `intake` above, as their own words, not
      // squeezed into FieldQuo's closed band vocabulary). And Meta does not
      // report which language the form was filled in, so `language` is
      // omitted rather than set to "en" — createScoredLead treats an omitted
      // language as "never asked" and falls back to the company default,
      // which is the honest reading. See LeadRequest.language.
    });
  } catch (err) {
    // The other path won the race between the findFirst above and here. Not
    // an error: exactly one row exists, which is the whole requirement.
    if (err?.code === "P2002") {
      const winner = await db.leadRequest.findFirst({
        where: { companyId, metaLeadId },
        select: { id: true },
      });
      if (winner) return { status: "duplicate", leadId: winner.id };
    }
    throw err;
  }

  // ── Why the Meta columns are a second write ──────────────────────────────
  //
  // createScoredLead is the shared creator for seven inbound sources and it
  // takes no Meta arguments — widening its signature for one caller's four
  // columns would push Meta into every other source's code path. Stamping
  // them immediately after is the smaller change.
  //
  // The cost is a window where the row exists without its metaLeadId, which
  // is exactly the window the unique constraint cannot police. That is
  // acceptable and bounded: the loser of such a race creates a second row
  // rather than being refused, both rows are real leads for the same person,
  // and the duplicate is visible on the board rather than silently swallowed.
  // Closing it properly means a transaction inside createScoredLead, which is
  // a change to the shared creator that belongs to whoever owns it.
  const stamped = await db.leadRequest.update({
    where: { id: created.id },
    data: {
      metaLeadId,
      metaFormId: formId ? String(formId) : null,
      // Null means "we could not resolve it", never "no campaign". See
      // LeadRequest.metaCampaignId.
      metaCampaignId: attribution?.campaignId ? String(attribution.campaignId) : null,
      metaCampaignName: attribution?.campaignName ? String(attribution.campaignName) : null,
    },
    select: { id: true },
  });

  if (formId) {
    // "Last received" on the settings panel — the one fact that tells a
    // contractor the wiring works. updateMany rather than update: the form row
    // is looked up by a compound key the caller may not have, and a missing
    // row must not fail an import that has already succeeded.
    await db.metaLeadForm
      .updateMany({
        where: { companyId, formId: String(formId) },
        data: { lastLeadAt: new Date() },
      })
      .catch(() => {});
  }

  console.log(`[meta/leads] ${path}: created lead ${stamped.id} from leadgen ${metaLeadId}`);
  return { status: "created", leadId: stamped.id };
}

// ── No call consent is recorded, and that is deliberate ─────────────────────
//
// Every other inbound form calls recordConsent() from lib/voice/outbound.js
// when a homeowner leaves a phone number, which is what lets the AI
// receptionist ring them back. This path does not, and the reason is in
// lib/voice/disclosure.js's own header: what a consent row stores is "what we
// can prove somebody saw", and a Meta lead form shows Meta's wording and the
// contractor's privacy policy — never FieldQuo's DISCLOSURE strings. Writing
// DISCLOSURE.lead onto a row for a person who never saw it would put a false
// statement into the evidence record, which is worse than having no row.
//
// CONSENT_SOURCES is a closed vocabulary in a compliance file, so the fix is
// a new source and a new disclosure string worded for Meta's form — that is a
// product and compliance decision, not a code one, and it is flagged rather
// than guessed. Until it is made: a Meta lead still reaches the contractor
// through the same `lead.created` notification as every other enquiry, and a
// human can call. Only the automatic dial is withheld, which is precisely the
// thing that needs consent nobody can prove.
