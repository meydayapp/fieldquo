// lib/leads/convertLead.js
//
// Convert a lead into a DRAFT quote — the real version of the "Start quote"
// button that used to just link to a blank new-quote page and drop the lead's
// name, category, photos and answers on the floor. This carries all of it onto
// the quote and links the two, so the lead reads "quoted" and the quote traces
// back to who asked. It deliberately does NOT advance the lead's status — see
// the note at the update below. Idempotent: a lead already linked to a quote
// returns that quote instead of spawning a second.
//
// The quote lands in `draft` with a zero total — nobody has priced it yet, and a
// number the homeowner could see that the contractor never agreed to is exactly
// what the "lead not quote" rule exists to prevent. The estimator opens it with
// the client, category and the homeowner's own words already filled in.

import { db } from "@/lib/db";
import { demoLiveStamp } from "@/lib/demo/simulatedSpend";
import { nextQuoteNumberForCompany } from "@/lib/quotes/quoteNumber";
import { requireCreatedVia } from "@/lib/quotes/createdVia";
import { BUDGET_LABELS_EN, TIMELINE_LABELS_EN } from "@/lib/leads/qualifiers";
import { leadAddressFromIntake, leadAddressLine } from "@/lib/leads/intakeShape";
import { GC_REQUEST_LEAD_SOURCE } from "@/lib/subRequests/model";
import { normaliseCountry } from "@/lib/tax/jurisdictions";
import { cleanEmail } from "@/lib/validation";
import { linkedClientId } from "@/lib/leads/identityLinks";
import { tradeAnswerLines, questionsFor } from "@/lib/leads/tradeQuestions";
import { scopeCountsLabel } from "@/lib/leads/scopeExtract";
import { leadScopeCounts } from "@/lib/leads/potentialValue";
import { getIntakeFields } from "@/app/data/quoteIntakeFields";
import { normaliseAttachments } from "@/lib/messaging/attachments";

/**
 * The homeowner's trade answers, as the public flows stored them in `intake`:
 * `whenNeeded` (the ladder option tapped) and the trade's one or two
 * questions by key (`activeLeak`, `scope`, …). Picked by the trade's own
 * question list, so a funnel answer that happens to share a key with another
 * trade's question is not printed as that question.
 */
function tradeAnswersFromIntake(tradeKey, intake) {
  const src = intake && typeof intake === "object" ? intake : {};
  const answers = {};
  for (const q of questionsFor(tradeKey)) {
    if (typeof src[q.key] === "string") answers[q.key] = src[q.key];
  }
  return {
    whenNeeded: typeof src.whenNeeded === "string" ? src.whenNeeded : null,
    answers,
  };
}

/**
 * The notes the estimator opens the draft with.
 *
 * `tradeKey` is the lead's category key (the booking page's trade), resolved
 * by the caller. The trade answers come first because they are what changes
 * what the van brings — "Active leak: Yes" belongs above the budget line.
 * "When needed" is the option the homeowner tapped, finer than the scorer's
 * timeline it was folded into; when the intake carries it, the scorer's
 * "Timeline:" line is dropped rather than printed beside it as a second,
 * slightly different answer to the same question. In the company's language
 * (not the homeowner's): these lines are for the estimator, and the quote's
 * client-facing text is written by a person afterwards.
 *
 * `notes` is NOT passed to tradeAnswerLines: the public flows put the
 * homeowner's free text in LeadRequest.message, which is appended below, and
 * printing it twice would be printing it twice.
 */
function buildQuoteNotes(lead, { tradeKey = null, language = "en" } = {}) {
  const lines = [];
  const trade = tradeAnswersFromIntake(tradeKey, lead.intake);
  const tradeLines = tradeAnswerLines(tradeKey, trade, language);
  lines.push(...tradeLines);
  if (lead.budgetBand && lead.budgetBand !== "unsure" && BUDGET_LABELS_EN[lead.budgetBand])
    lines.push(`Budget: ${BUDGET_LABELS_EN[lead.budgetBand]}`);
  if (!trade.whenNeeded && lead.timeline && TIMELINE_LABELS_EN[lead.timeline])
    lines.push(`Timeline: ${TIMELINE_LABELS_EN[lead.timeline]}`);
  if (lead.message) lines.push(lead.message);
  lines.push(...scopeNoteLines(lead));
  return lines.length ? lines.join("\n") : null;
}

/**
 * What the homeowner said about the job in a conversation (intake.scope,
 * lib/leads/scopeExtract.js) — the counts with the sentence they came from,
 * and the colour, hardware and damage in their own words. Pure. Empty for a
 * lead with no conversation scope. English labels, like the Budget and
 * Timeline lines above: the estimator's notes, not the client's copy.
 */
export function scopeNoteLines(lead) {
  const scope = lead?.intake && typeof lead.intake === "object" ? lead.intake.scope : null;
  if (!scope || typeof scope !== "object") return [];
  const out = [];
  const counts = scopeCountsLabel(scope.counts || {});
  if (counts) {
    const said = Object.values(scope.sources || {})[0]?.quote;
    out.push(`From the conversation: ${counts}${said ? ` — “${said}”` : ""}`);
  }
  if (scope.colour?.quote) out.push(`Colour: “${scope.colour.quote}”`);
  if (scope.hardware?.quote) out.push(`Hardware / handles: “${scope.hardware.quote}”`);
  if (scope.damage?.quote) out.push(`Damage: “${scope.damage.quote}”`);
  return out;
}

/** The trade's own intake keys the counts fill, by unit. */
const COUNT_TO_INTAKE = Object.freeze({ doors: "doorCount", drawers: "drawerCount", sqft: "squareFootage" });

/**
 * The scope group's intakeValues from the lead's counts — only the keys the
 * trade's own intake form HAS (app/data/quoteIntakeFields.js), so a count
 * never lands in a field the builder does not draw. Quantities only: no
 * price is written; the builder prices them from the company's book when the
 * estimator opens the draft. Pure.
 */
export function intakeValuesFromScope(tradeKey, counts = {}) {
  const keys = new Set(getIntakeFields(tradeKey).map((f) => f.key));
  const out = {};
  for (const [unit, key] of Object.entries(COUNT_TO_INTAKE)) {
    const n = Number(counts[unit]);
    if (keys.has(key) && Number.isFinite(n) && n > 0) out[key] = n;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Photos and videos the homeowner sent in the lead's conversation(s), in
 * Quote.clientPhotos' shape — only ones already re-hosted on Cloudinary
 * (`url` is never Meta's: lib/messaging/attachments.js). Scoped by company.
 */
async function conversationPhotos(companyId, lead) {
  const evidenceThread = typeof lead?.conversationEvidence?.threadId === "string" ? lead.conversationEvidence.threadId : null;
  const threads = await db.messageThread.findMany({
    where: { companyId, OR: [{ leadId: lead.id }, ...(evidenceThread ? [{ id: evidenceThread }] : [])] },
    select: { id: true },
  });
  if (!threads.length) return [];
  const messages = await db.message.findMany({
    where: { threadId: { in: threads.map((t) => t.id) }, direction: "in", private: false },
    select: { attachments: true },
    orderBy: { sentAt: "asc" },
    take: 200,
  });
  const out = [];
  for (const m of messages) {
    for (const a of normaliseAttachments(m.attachments)) {
      if (a.state !== "ready" || !a.url || (a.type !== "image" && a.type !== "video")) continue;
      out.push({ url: a.url, kind: a.type === "video" ? "video" : "photo", publicId: null });
      if (out.length >= MAX_CONVERSATION_PHOTOS) return out;
    }
  }
  return out;
}

/** A conversation with a hundred photos is not a hundred quote photos. */
export const MAX_CONVERSATION_PHOTOS = 30;

/**
 * The trade key the answers were asked under: the lead's category key, which
 * both public flows set (the booking page from the service picked, the
 * instant estimate from the priced config) and which resolves through the
 * alias table in lib/leads/tradeQuestions.js. Null for a lead with no
 * category, which yields no trade lines rather than invented ones.
 */
async function tradeKeyForLead(lead) {
  if (!lead.categoryId) return null;
  const category = await db.serviceCategory.findUnique({
    where: { id: lead.categoryId },
    select: { key: true },
  });
  return category?.key || null;
}

// Match an existing client (email first, then phone) before creating one, so
// converting a repeat enquirer doesn't spawn a duplicate client record.
async function findOrCreateClient(companyId, lead) {
  // A client the lead was TIED to (lib/leads/identityLinks.js — a Facebook
  // lead the message reviewer or the form matcher recognised as somebody on
  // file) wins over the email/phone lookup below: that lookup only knows an
  // exact column match, and the link may rest on a phone written another way
  // or a name and an address. An undone link is not read.
  const linked = lead?.id ? await linkedClientId(db, { companyId, leadId: lead.id }) : null;
  if (linked) return linked;
  // One normaliser for the MATCH and the WRITE below. They used to disagree —
  // matched on trim+lowercase, stored raw — so " Bob@Example.COM " never
  // matched itself and a repeat enquirer got a second client record.
  const email = cleanEmail(lead.email);
  const phone = lead.phone ? String(lead.phone).trim() : null;
  if (email) {
    const hit = await db.client.findFirst({ where: { companyId, email }, select: { id: true } });
    if (hit) return hit.id;
  }
  if (phone) {
    const hit = await db.client.findFirst({ where: { companyId, phone }, select: { id: true } });
    if (hit) return hit.id;
  }
  // The intake blob carries the address the public form captured, and — since
  // the self-quote form stopped discarding them — the city, province and
  // country Google Places returned alongside it. Reading only `address` here
  // meant a lead with a perfectly structured Ontario address converted into a
  // client the tax resolver could say nothing about, which is most of how
  // production ended up with 55 clients and zero countries.
  //
  // Read through the shared shape rather than by key, so this and the nine
  // routes that WRITE intake cannot drift apart — which is how the instant
  // quote spent its life putting the address in the message prose while this
  // line looked for it here. See lib/leads/intakeShape.js.
  const { address, city, province, country } = leadAddressFromIntake(lead.intake);
  const created = await db.client.create({
    data: {
      companyId,
      name: lead.name || "Website enquiry",
      email,
      phone: lead.phone || null,
      address,
      city,
      province,
      // Normalised rather than trusted: `intake` is a Json column ultimately
      // fed by a public form, and a country that isn't ISO alpha-2 is worse
      // than none — it would sit in the column looking authoritative while
      // every lookup missed it.
      country: normaliseCountry(country),
      // A demo lead a person submitted on the public form converts into a
      // client that can still be written to for real — the quote this lead
      // becomes is the next thing the prospect expects to receive. A seeded
      // lead has no marker and converts into a simulated client, which is the
      // point: its address came from the fixture. Re-checked against the
      // company row so a marker can never cross onto a real tenant's client.
      ...(lead.demoLiveAt ? await demoLiveStamp(companyId) : {}),
    },
    select: { id: true },
  });
  return created.id;
}

/**
 * @param {object} p
 * @param {object} p.lead     LeadRequest row (needs id, companyId, name, email,
 *                            phone, categoryId, message, budgetBand, timeline,
 *                            clientPhotos, intake, language, quoteId)
 * @param {{userId:string}} p.member
 * @param {{id:string, defaultLanguage?:string}} p.company
 * @returns {{ quote:{id:string,quoteNumber:string}, created:boolean }}
 */
export async function convertLeadToQuote({ lead, member, company }) {
  if (lead.quoteId) {
    const existing = await db.quote.findUnique({
      where: { id: lead.quoteId },
      select: { id: true, quoteNumber: true },
    });
    if (existing) return { quote: existing, created: false };
  }

  const clientId = await findOrCreateClient(company.id, lead);
  const quoteNumber = await nextQuoteNumberForCompany(db, company.id);
  // The form's photos, then the ones sent in the conversation (2026-10-05:
  // a Messenger lead's kitchen photos sat in the inbox and the draft opened
  // with none). De-duplicated by URL; best effort — a conversion never fails
  // over a photo.
  const formPhotos = Array.isArray(lead.clientPhotos) ? lead.clientPhotos : [];
  const chatPhotos = await conversationPhotos(company.id, lead).catch(() => []);
  const seenUrls = new Set(formPhotos.map((p) => p?.url).filter(Boolean));
  const photos = [...formPhotos, ...chatPhotos.filter((p) => !seenUrls.has(p.url))];
  const tradeKey = await tradeKeyForLead(lead);
  const intakeValues = tradeKey ? intakeValuesFromScope(tradeKey, leadScopeCounts(lead)) : null;

  const quote = await db.quote.create({
    data: {
      companyId: company.id,
      quoteNumber,
      clientId,
      createdById: member.userId,
      // A person turned an enquiry into a quote. Deliberately NOT the enquiry's
      // own origin — "self_quote", "meta_lead_form", "embed_form" all already
      // live on LeadRequest.source, reachable from here through Quote.lead, and
      // copying one of them onto this column would be the same fact in two
      // places waiting to disagree. See lib/quotes/createdVia.js.
      createdVia: requireCreatedVia("lead_conversion"),
      // The homeowner's own choice wins over the company default. They picked
      // a language on the public form and everything they have been sent since
      // has been in it; converting their enquiry into a quote written in the
      // contractor's language would silently switch it back at the exact
      // moment the document starts to matter. Null (never asked) falls back.
      language: lead.language || company.defaultLanguage || "en",
      // A general contractor's price request: the client is the GC (a
      // business, whose office is not the site), and the site is the job
      // address the request carried. A company client's quote cannot be
      // saved without one (lib/quotes/jobAddress.js siteAddressRequired).
      ...(lead.source === GC_REQUEST_LEAD_SOURCE && leadAddressLine(lead.intake)
        ? { siteAddress: leadAddressLine(lead.intake) }
        : {}),
      subtotal: 0,
      total: 0,
      notes: buildQuoteNotes(lead, { tradeKey, language: company.defaultLanguage || "en" }),
      ...(photos.length ? { clientPhotos: photos } : {}),
      ...(lead.categoryId
        ? {
            scopeGroups: {
              create: [
                {
                  categoryId: lead.categoryId,
                  label: null,
                  lineItems: null,
                  // The counts the homeowner gave (22 doors, 15 drawers) in
                  // the trade's own intake fields; the builder prices them.
                  ...(intakeValues ? { intakeValues } : {}),
                  subtotal: 0,
                  sortOrder: 0,
                },
              ],
            },
          }
        : {}),
    },
    select: { id: true, quoteNumber: true },
  });

  // Link the two, but do NOT declare the lead won here.
  //
  // This used to set status "converted", which the leads board renders as
  // "Won" (app/app/leads/page.js). Drafting a quote is not winning the work:
  // the quote is unpriced, unsent, and the homeowner has not seen it. Every
  // converted lead jumped straight to the Won column and could never pass
  // through "Contacted", so the board stopped describing the pipeline and the
  // win figures counted quotes nobody had answered.
  //
  // The lead now follows the quote's actual fate instead, in
  // lib/quotes/quoteLifecycle.js: sent → contacted, accepted → converted/Won,
  // declined → lost. `quoteId` is what marks a lead as already quoted, and it
  // is set here where it belongs.
  await db.leadRequest.update({
    where: { id: lead.id },
    data: { quoteId: quote.id },
  });

  // Files uploaded against the lead (a drawing read started from it —
  // QuoteDocument.leadId) that no quote has claimed yet become this quote's,
  // so they reach the job's Documents when it is approved. Best-effort: a
  // conversion must not fail over a file.
  try {
    await db.quoteDocument.updateMany({
      where: { companyId: company.id, leadId: lead.id, quoteId: null },
      data: { quoteId: quote.id },
    });
  } catch (err) {
    console.error("[convertLead] lead files:", err?.message);
  }

  return { quote, created: true };
}
