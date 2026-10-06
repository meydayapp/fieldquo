// lib/leads/conversationReview.js
//
// "Review leads made from conversations" — the owner's clean-up of the leads
// the history backfill made before the tiers existed (TrueFinish: 69 of 80
// leads from Messenger, made on 2026-10-04; Moss Mbaya's triple tap among
// them). Never automatic.
//
//   1. GET  re-runs the classification (lib/leads/qualification.js — rules,
//      the model's stored verdict, a person's tier) on every lead that came
//      from a conversation, WITHOUT writing anything, and returns each with
//      a suggestion: remove (only a tap / not relevant) or keep (a lead, a
//      real conversation, a quote already exists, no conversation found).
//   2. POST with the ids a PERSON confirmed: those leads are deleted through
//      lib/leads/deleteLead.js with "don't create a lead from this
//      conversation again" — the tombstone, the audit row and every pointer
//      cleanup that path already does — and each conversation's tier is
//      stored so the inbox and the ad funnel agree with what was decided.
//
// What is never suggested for removal, whatever the conversation says: a lead
// with a quote (recorded or a confirmed match), a lead marked Won or Lost — a
// person already decided what it was — and a lead whose conversation cannot
// be found (nothing to judge it by).

import { CONVERSATION_LEAD_SOURCES } from "@/lib/leads/conversationSources";
import { qualifyCompanyThreads, storeQualification } from "@/lib/leads/qualifyThreads";
import { reasonInEnglish, publicQualification } from "@/lib/leads/qualification";
import { deleteLeads, cleanLeadIds, MAX_DELETE_BATCH } from "@/lib/leads/deleteLead";
import { inferLeadQuotes } from "@/lib/analytics/campaignRollupData";

export const REVIEW_ACTIONS = Object.freeze(["remove", "keep"]);

/**
 * One lead's suggestion. Pure.
 * @param lead     { id, status, quoteId }
 * @param verdict  the thread's classifyConversation() result, or null
 * @returns {{ action: "remove"|"keep", why: string }}
 */
export function reviewSuggestion(lead, verdict) {
  if (!lead) return { action: "keep", why: "missing" };
  if (lead.quoteId || lead.inferredQuoteId) return { action: "keep", why: "quoted" };
  if (lead.status === "converted" || lead.status === "lost") return { action: "keep", why: "decided" };
  if (!verdict) return { action: "keep", why: "no_conversation" };
  if (verdict.tier === "tap_only") return { action: "remove", why: "tap_only" };
  if (verdict.tier === "not_relevant") return { action: "remove", why: "not_relevant" };
  if (verdict.tier === "lead") return { action: "keep", why: "lead" };
  return { action: "keep", why: "conversation" };
}

/** The counts the screen's header shows. Pure. */
export function summariseReview(rows) {
  const out = { total: 0, remove: 0, keep: 0, byWhy: {} };
  for (const r of Array.isArray(rows) ? rows : []) {
    out.total++;
    out[r.action === "remove" ? "remove" : "keep"]++;
    out.byWhy[r.why] = (out.byWhy[r.why] || 0) + 1;
  }
  return out;
}

/** Leads of ONE company that came from a conversation, with their thread. */
async function conversationLeads(prisma, companyId) {
  // By source (a conversation source) or by link (a conversation points at
  // the lead — a form lead the capture enriched is one too).
  const linkedThreads = await prisma.messageThread.findMany({
    where: { companyId, leadId: { not: null } },
    select: { leadId: true },
  });
  const linkedIds = [...new Set(linkedThreads.map((t) => t.leadId))];
  const leads = await prisma.leadRequest.findMany({
    where: {
      companyId,
      OR: [{ source: { in: [...CONVERSATION_LEAD_SOURCES] } }, ...(linkedIds.length ? [{ id: { in: linkedIds } }] : [])],
    },
    select: { id: true, name: true, email: true, phone: true, intake: true, source: true, status: true, quoteId: true, createdAt: true, conversationEvidence: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const ids = leads.map((l) => l.id);
  const evidence = leads.map((l) => l.conversationEvidence?.threadId).filter((x) => typeof x === "string" && x);
  const threads = ids.length
    ? await prisma.messageThread.findMany({
        where: { companyId, OR: [{ leadId: { in: ids } }, ...(evidence.length ? [{ id: { in: evidence } }] : [])] },
        select: { id: true, leadId: true },
      })
    : [];
  const threadOf = new Map();
  for (const t of threads) if (t.leadId && !threadOf.has(t.leadId)) threadOf.set(t.leadId, t.id);
  for (const l of leads) {
    const t = l.conversationEvidence?.threadId;
    if (!threadOf.has(l.id) && t && threads.some((x) => x.id === t)) threadOf.set(l.id, t);
  }
  return { leads, threadOf };
}

/**
 * The review, read-only. Every query carries companyId.
 * @returns {{ rows: Array<{ id, name, source, status, createdAt, threadId, action, why, qualification, reason }>, summary }}
 */
export async function buildConversationReview(prisma, { companyId, now = new Date(), deps = {} }) {
  const { classify = qualifyCompanyThreads, inferQuotes = inferLeadQuotes } = deps;
  const { leads, threadOf } = await conversationLeads(prisma, companyId);
  // A quote nobody linked, matched by the campaign rollup's own rule — a lead
  // that became a quote is kept whatever its first message was.
  await Promise.resolve(inferQuotes({ db: prisma, companyId, leads })).catch(() => null);
  const threadIds = [...new Set([...threadOf.values()])];
  const run = threadIds.length ? await classify(prisma, { companyId, threadIds, write: false, now }) : { verdicts: new Map() };
  const rows = leads.map((l) => {
    const threadId = threadOf.get(l.id) || null;
    const v = threadId ? run.verdicts.get(threadId) : null;
    const s = reviewSuggestion(l, v?.verdict || null);
    return {
      id: l.id,
      name: l.name,
      source: l.source,
      status: l.status,
      createdAt: l.createdAt,
      threadId,
      action: s.action,
      why: s.why,
      qualification: v ? publicQualification(v.stored) : null,
      reason: v ? reasonInEnglish(v.verdict) : null,
    };
  });
  return { rows, summary: summariseReview(rows) };
}

/**
 * Apply what a person confirmed. Only ids the review itself suggests
 * removing are acted on — a hand-edited request naming a quoted lead, a won
 * one, or another company's is refused for those ids, never "helpfully"
 * deleted. Returns deleteLeads' answer plus what was refused.
 */
export async function applyConversationReview(prisma, { companyId, ids, actor = {}, now = new Date(), deps = {} }) {
  const { ids: wanted, tooMany } = cleanLeadIds(ids);
  if (tooMany) return { ok: false, status: 400, error: `Confirm at most ${MAX_DELETE_BATCH} leads at a time.` };
  if (!wanted.length) return { ok: false, status: 400, error: "No leads confirmed." };
  const review = await buildConversationReview(prisma, { companyId, now, deps });
  const removable = new Map(review.rows.filter((r) => r.action === "remove").map((r) => [r.id, r]));
  const go = wanted.filter((id) => removable.has(id));
  const refused = wanted.filter((id) => !removable.has(id));
  if (!go.length) return { ok: false, status: 409, error: "None of these leads is one the review suggests removing.", refused };

  // The tier each conversation was judged to have, stored before the delete
  // so the inbox and the ad funnel say the same thing the review did.
  const run = await (deps.classify || qualifyCompanyThreads)(prisma, {
    companyId,
    threadIds: go.map((id) => removable.get(id).threadId).filter(Boolean),
    write: false,
    now,
  });
  for (const [threadId, v] of run.verdicts) {
    await storeQualification(prisma, { companyId, threadId, capture: v.thread.leadCapture || {}, stored: v.stored });
  }

  const result = await deleteLeads(prisma, { companyId, ids: go, actor, notALead: true, bulk: true, now });
  return { ok: true, deleted: result.deleted.map((l) => l.id), markedThreads: result.markedThreads, refused, noConversation: result.noConversation, metaDisqualify: result.metaDisqualify || [] };
}
