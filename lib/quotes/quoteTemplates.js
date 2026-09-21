// lib/quotes/quoteTemplates.js
//
// A quote → a template snapshot, and a template → the groups a new quote
// opens with. Pure, so scripts/check-quote-text-blocks.mjs can execute both
// directions against a hostile row.
//
// ── What a template carries ─────────────────────────────────────────────────
//
// The SHAPE of a quote: its scope groups with the stored line items, takeoff
// and intake answers, its client-facing notes and its process notes. Not the
// client, not the job address, not the dates, not the share token, not the
// signature, not the costing — those are facts about one quote to one
// person, and a template is applied to somebody else. The same copy list
// lib/quotes/duplicateQuote.js uses for the groups, so the two cannot drift
// on what a group IS.
//
// ── Why the groups open as persisted ────────────────────────────────────────
//
// A template's line items were priced against the rate card of the day it
// was saved. Opening them as fresh groups would re-derive every takeoff line
// from today's book and double the total (lib/quotes/builderPayload.js on
// `persisted`); opening them as persisted groups keeps the numbers and lets
// the estimator edit them as numbers — the way a reopened quote works. The
// builder's `groupFromStored` does that conversion; this file hands it rows
// in the stored shape with no id, so POST /api/quotes creates them.

const MAX_NAME = 120;

function cloneJson(value) {
  return value === null || value === undefined ? null : JSON.parse(JSON.stringify(value));
}

const amount = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v) * 100) / 100 : 0);

/** The stored group list a quote's groups become. */
export function templateGroupsFrom(scopeGroups) {
  return (Array.isArray(scopeGroups) ? scopeGroups : [])
    .filter((g) => g && typeof g === "object" && g.categoryId)
    .map((g, i) => ({
      categoryId: g.categoryId,
      label: g.label || null,
      lineItems: Array.isArray(g.lineItems) ? cloneJson(g.lineItems) : [],
      takeoff: cloneJson(g.takeoff),
      intakeValues: cloneJson(g.intakeValues),
      subtotal: amount(g.subtotal),
      sortOrder: i,
    }));
}

/**
 * The create() data for a QuoteTemplate from a quote row (with scopeGroups).
 * Returns { ok:false, error } when there is nothing worth saving.
 */
export function templateFromQuote(quote, { name, userId = null } = {}) {
  const title = String(name ?? "").trim().slice(0, MAX_NAME);
  if (!title) return { ok: false, error: "Give the template a name." };
  const scopeGroups = templateGroupsFrom(quote?.scopeGroups);
  if (!scopeGroups.length) return { ok: false, error: "This quote has no services to save as a template." };
  return {
    ok: true,
    data: {
      name: title,
      language: quote?.language || "en",
      scopeGroups,
      notes: quote?.notes || null,
      processNotes: quote?.processNotes || null,
      sourceQuoteId: quote?.id || null,
      createdById: userId,
    },
  };
}

/**
 * What the builder receives for a template: the stored groups exactly as a
 * QuoteScopeGroup row would read, each with the category attached by the
 * caller, plus the notes. `id: null` on every group so a save creates them.
 */
export function templateToBuilder(template, categoriesById = new Map()) {
  const groups = (Array.isArray(template?.scopeGroups) ? template.scopeGroups : [])
    .filter((g) => g && typeof g === "object" && g.categoryId)
    .map((g) => ({
      id: null,
      categoryId: g.categoryId,
      category: categoriesById.get(g.categoryId) || null,
      label: g.label || null,
      lineItems: Array.isArray(g.lineItems) ? g.lineItems : [],
      takeoff: g.takeoff ?? null,
      intakeValues: g.intakeValues ?? null,
      subtotal: amount(g.subtotal),
    }));
  return {
    id: template?.id || null,
    name: template?.name || "",
    language: template?.language || "en",
    groups,
    notes: template?.notes || "",
    processNotes: template?.processNotes || "",
  };
}
