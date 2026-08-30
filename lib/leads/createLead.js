// lib/leads/createLead.js
//
// The one way to create a LeadRequest, so every inbound source (self-quote,
// kitchen designer, embed form, portal, phone agent, funnel) triages the lead
// the same way. Before this, each route hand-rolled its own db.leadRequest.create
// and none of them scored — the copy that rots is the one nobody looks at
// (AGENTS.md recurring failure #4). Structured intake is stored ALONGSIDE the
// readable message so scoring has typed inputs and staff still get a summary.

import { db } from "@/lib/db";
import { scoreLead } from "@/lib/leads/score";
import { cleanBudgetBand, cleanTimeline } from "@/lib/leads/qualifiers";
import { isSupported } from "@/app/i18n/languages";

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
 */
/**
 * Questions a given intake channel cannot put to somebody.
 *
 * Only the phone, and only budget. Everything else on the score is either
 * observable (a number, an email, an address) or askable in any channel.
 */
export const UNASKABLE_BY_SOURCE = {
  phone_agent: ["budget"],
};

export async function createScoredLead(input) {
  const budgetBand = cleanBudgetBand(input.budgetBand);
  const timeline = cleanTimeline(input.timeline);

  const scored = scoreLead(
    {
      budgetBand,
      timeline,
      phone: input.phone,
      email: input.email,
      clientPhotos: input.clientPhotos,
      kitchenDesign: input.kitchenDesign,
      message: input.message,
      intake: input.intake,
    },
    // ── What this CHANNEL could never ask ──────────────────────────────
    //
    // The phone receptionist is forbidden to discuss money at all (absolute
    // rule 1), so a phone lead has no budget and never could. Counting its 30
    // points against the lead marked every call the assistant ever took as
    // cold — a name, an email, an address and thirty-seven cabinet doors came
    // out below a web form where somebody ticked a box.
    //
    // Named by SOURCE rather than by "is the field empty", because those are
    // different facts: a web visitor who skipped the budget question DID
    // decline to answer, and that is worth knowing about them.
    { unasked: UNASKABLE_BY_SOURCE[input.source] || [] },
  );

  return db.leadRequest.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      email: input.email || null,
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
      score: scored.score,
      temperature: scored.temperature,
      scoreReasons: scored.reasons,
      ...(Array.isArray(input.clientPhotos) && input.clientPhotos.length
        ? { clientPhotos: input.clientPhotos }
        : {}),
      ...(input.kitchenDesign ? { kitchenDesign: input.kitchenDesign } : {}),
      ...(input.intake && typeof input.intake === "object"
        ? { intake: input.intake }
        : {}),
    },
  });
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
    },
  });
  if (!lead) return null;
  const scored = scoreLead(lead, { unasked: UNASKABLE_BY_SOURCE[lead.source] || [] });
  return db.leadRequest.update({
    where: { id: leadId },
    data: {
      score: scored.score,
      temperature: scored.temperature,
      scoreReasons: scored.reasons,
    },
  });
}
