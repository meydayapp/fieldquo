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
 */
export async function createScoredLead(input) {
  const budgetBand = cleanBudgetBand(input.budgetBand);
  const timeline = cleanTimeline(input.timeline);

  const scored = scoreLead({
    budgetBand,
    timeline,
    phone: input.phone,
    email: input.email,
    clientPhotos: input.clientPhotos,
    kitchenDesign: input.kitchenDesign,
    message: input.message,
    intake: input.intake,
  });

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
    },
  });
  if (!lead) return null;
  const scored = scoreLead(lead);
  return db.leadRequest.update({
    where: { id: leadId },
    data: {
      score: scored.score,
      temperature: scored.temperature,
      scoreReasons: scored.reasons,
    },
  });
}
