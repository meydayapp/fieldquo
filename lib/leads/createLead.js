// lib/leads/createLead.js
//
// The one way to create a LeadRequest, so every inbound source (self-quote,
// kitchen designer, embed form, portal, phone agent, funnel) triages the lead
// the same way. Before this, each route hand-rolled its own db.leadRequest.create
// and none of them scored — the copy that rots is the one nobody looks at
// (AGENTS.md recurring failure #4). Structured intake is stored ALONGSIDE the
// readable message so scoring has typed inputs and staff still get a summary.

import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { scoreLead } from "@/lib/leads/score";
import { cleanBudgetBand, cleanTimeline, unaskedForScoring } from "@/lib/leads/qualifiers";
import { isSupported } from "@/app/i18n/languages";
import { cleanEmail } from "@/lib/validation";
import { nudgeAgencyEvents } from "@/lib/agency/nudge";
import { QUALIFIED_TEMPERATURES } from "@/lib/agency/leadRow";

/**
 * @param {object} input
 * @param {string} input.companyId
 * @param {string} input.name
 * @param {string} [input.email]
 * @param {string} [input.phone]
 * @param {string} [input.categoryId]
 * @param {string} [input.message]   readable summary (the homeowner's words)
 * @param {string} [input.source]
 * @param {Array}  [input.clientPhotos]
 * @param {object} [input.kitchenDesign]
 * @param {object} [input.intake]    structured answers { fieldKey: value }
 * @param {string} [input.budgetBand]
 * @param {string} [input.timeline]
 * @param {string} [input.language]  the language the homeowner filled the form
 *                                   in. Omit (not "en") when they were never
 *                                   asked — see LeadRequest.language.
 * @param {string} [input.actorUserId] the staff member who typed the lead in by
 *                                   hand (source "manual"). Omitted on every
 *                                   inbound channel, where nobody at the
 *                                   company caused it.
 * @param {boolean} [input.notify]   false = no "New enquiry" alert (a lead made
 *                                   from a booking, which already alerted).
 * @param {Date}   [input.importedAt] set ONLY by a history backfill
 *                                   (lib/meta/leadsImport.js, lib/leads/
 *                                   conversationLead.js): the lead is stamped
 *                                   as history and no "new lead" alert goes out.
 */
/**
 * What the scorer may not hold against a lead from this source — passed to
 * scoreLead by every caller that scores a stored or new lead.
 *
 * This replaced a two-entry map (UNASKABLE_BY_SOURCE: the phone, and budget)
 * on 2026-10-03, when the owner made the call that map's own comment said was
 * his to make: "remove the penalty if they are sourced from somewhere else".
 * The rule now lives in lib/leads/qualifiers.js (ASKED_BY_SOURCE /
 * unaskedForScoring) — an absent budget or timeline counts against a lead only
 * when its channel put the question — and `source` rides along so the phone
 * keeps its own reason wording.
 */
export function scoringOptions(source) {
  return { unasked: unaskedForScoring(source), source: source || null };
}

export async function createScoredLead(input) {
  const budgetBand = cleanBudgetBand(input.budgetBand);
  const timeline = cleanTimeline(input.timeline);

  // ── The address is normalised HERE, refused at the route ─────────────────
  //
  // Two different jobs, in two different places, on purpose.
  //
  // The REFUSAL belongs to the route, because only the route can say the
  // sentence back to the person who is still looking at the form — see
  // lib/validation.js's emailRefusal. A sink that silently dropped a bad
  // address would turn "Macksab  1@hotmail.com" into a lead with no email at
  // all, which is the same lost quote wearing a quieter face.
  //
  // The NORMALISATION belongs here, because this is the sink every one of the
  // nine callers passes through, and because the stored value is a matching
  // key: convertLead and createEstimateQuote both look a client up on
  // `.trim().toLowerCase()`, so storing the raw " Bob@Example.COM " meant the
  // address never matched itself and a second visit made a second client.
  //
  // cleanEmail returns null for an address that could not be delivered to, and
  // null is the honest column value for one — a route that skipped its own
  // refusal still cannot write a bounce into the database from here.
  const email = cleanEmail(input.email);

  const scored = scoreLead(
    {
      budgetBand,
      timeline,
      phone: input.phone,
      email,
      clientPhotos: input.clientPhotos,
      kitchenDesign: input.kitchenDesign,
      message: input.message,
      intake: input.intake,
    },
    // ── What this CHANNEL never asked ──────────────────────────────────
    //
    // The phone receptionist is forbidden to discuss money at all (absolute
    // rule 1), so a phone lead has no budget and never could; a Meta form, a
    // conversation, a hand-typed lead put neither question. Counting those
    // points against the lead marked every one of them cold — a name, an
    // email, an address and thirty-seven cabinet doors came out below a web
    // form where somebody ticked a box.
    //
    // Named by SOURCE rather than by "is the field empty", because those are
    // different facts: a web visitor who skipped the budget question DID
    // decline to answer, and that is worth knowing about them.
    scoringOptions(input.source),
  );

  // History, not somebody enquiring now — see LeadRequest.importedAt.
  const importedAt = input.importedAt instanceof Date ? input.importedAt : null;

  const lead = await db.leadRequest.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      email,
      phone: input.phone || null,
      categoryId: input.categoryId || null,
      message: input.message || null,
      source: input.source || null,
      budgetBand,
      timeline,
      // Validated against the languages FieldQuo actually has copy for, so a
      // crafted POST can't stamp a lead — and the quote it becomes — with a
      // code nothing can render.
      language: isSupported(input.language) ? input.language : null,
      // Only a Date the CALLER computed via demoLiveStamp (the public
      // self-quote route) — a string from a request body is not a Date and
      // is dropped. See LeadRequest.demoLiveAt.
      ...(input.demoLiveAt instanceof Date ? { demoLiveAt: input.demoLiveAt } : {}),
      // A callback the CALLER took (the AI employee's book_callback) — the
      // column the board badges and sorts on. A Date the server computed;
      // a string from a body is not a Date and is dropped, as above.
      ...(input.callbackRequestedAt instanceof Date ? { callbackRequestedAt: input.callbackRequestedAt } : {}),
      score: scored.score,
      temperature: scored.temperature,
      scoreReasons: scored.reasons,
      // The agency funnel's "qualified" moment (LeadRequest.qualifiedAt):
      // a lead that arrives warm or hot was qualified on arrival.
      ...(isQualifiedTemperature(scored.temperature) ? { qualifiedAt: importedAt || new Date() } : {}),
      ...(importedAt ? { importedAt } : {}),
      ...(Array.isArray(input.clientPhotos) && input.clientPhotos.length
        ? { clientPhotos: input.clientPhotos }
        : {}),
      ...(input.kitchenDesign ? { kitchenDesign: input.kitchenDesign } : {}),
      ...(input.intake && typeof input.intake === "object"
        ? { intake: input.intake }
        : {}),
      // Where the visitor came from — only ever built by lib/tracking/
      // visits.js from the server's own FunnelVisit row, never passed
      // through from a request body.
      ...(input.attribution && typeof input.attribution === "object"
        ? { attribution: input.attribution }
        : {}),
    },
  });

  // ── ONE hook, six inbound sources ────────────────────────────────────────
  //
  // Every way a stranger reaches this company funnels through here: the
  // self-quote form, the kitchen designer, the instant quote, the embed/public
  // lead form, a funnel submission, the client portal and the AI receptionist.
  // Five of those told NOBODY at the company today — the homeowner got a
  // confirmation email and the contractor got silence. Response time is what
  // wins the job.
  //
  // Emitting here rather than at the six call sites is the whole point: six
  // hooks would be six copies, and the copy is the one that rots (this file's
  // own header says so about the six hand-rolled leadRequest.create calls this
  // function replaced).
  //
  // Fire-and-forget after the create has committed — the lead is captured
  // whatever happens next, and a notification must never be able to lose one.
  // No actor on the inbound channels: a homeowner filled in a form, and null
  // is the honest answer. The one exception is a lead a staff member typed in
  // (POST /api/leads, source "manual") — they are the actor, and the feed
  // never tells the actor about their own act.
  //
  // And none at all for a lead pulled out of HISTORY (importedAt): a history
  // backfill can create a hundred leads from three months of Facebook forms
  // in one run, and a hundred "New lead" alerts at once is a notification
  // storm about people who enquired in July. The board shows them, marked as
  // imported; nobody is paged.
  //
  // And none for a lead made FROM a booking (lib/booking/bookingLead.js,
  // `notify: false`): the booking already told the company about this
  // person, and a "New enquiry" for them a minute later is the same news
  // twice. Only an explicit false — every inbound form still alerts.
  if (!importedAt && input.notify !== false) notifyEvent({
    companyId: input.companyId,
    type: "lead.created",
    entityId: lead.id,
    params: {
      leadName: lead.name || "",
      // hot / warm / cold — the scorer's own word, so the feed can weight a hot
      // lead without a second scoring pass. Not a figure: the budget BAND is a
      // qualifier, and the lead has no price on it at all.
      temperature: lead.temperature || "",
    },
    actorUserId: input.actorUserId || null,
  }).catch(() => {});

  // The marketing agency's lead.created / lead.qualified hooks — after the
  // response, never in the way of capturing the lead (lib/agency/nudge.js).
  // History is swept too: the sweep only sends what happened after a
  // subscription began, so an import replays nothing at the agency.
  nudgeAgencyEvents(input.companyId);

  return lead;
}

/** Warm or hot — what the agency funnel calls qualified (lib/agency/leadRow.js). */
function isQualifiedTemperature(temperature) {
  return QUALIFIED_TEMPERATURES.includes(temperature);
}

// Recompute a stored lead's score in place — used when a rep edits the qualifiers
// or the intake after the fact. Reads exactly the fields the scorer needs.
export async function rescoreLead(leadId) {
  const lead = await db.leadRequest.findUnique({
    where: { id: leadId },
    select: {
      budgetBand: true,
      timeline: true,
      phone: true,
      email: true,
      clientPhotos: true,
      kitchenDesign: true,
      message: true,
      intake: true,
      // Needed for the same reason it is needed on create: a phone lead is
      // scored without budget, and a rescore that forgot the source would
      // quietly mark it cold again.
      source: true,
      companyId: true,
      qualifiedAt: true,
    },
  });
  if (!lead) return null;
  const scored = scoreLead(lead, scoringOptions(lead.source));
  const updated = await db.leadRequest.update({
    where: { id: leadId },
    data: {
      score: scored.score,
      temperature: scored.temperature,
      scoreReasons: scored.reasons,
      // The FIRST time it turns warm or hot, and never moved after: a lead
      // that cools and warms again was qualified the first time.
      ...(!lead.qualifiedAt && isQualifiedTemperature(scored.temperature) ? { qualifiedAt: new Date() } : {}),
    },
  });
  nudgeAgencyEvents(lead.companyId);
  return updated;
}
