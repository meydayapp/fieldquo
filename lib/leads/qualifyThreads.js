// lib/leads/qualifyThreads.js
//
// The database half of lib/leads/qualification.js: the company's templates
// (which first messages are quick-reply buttons), its enabled services, and
// classifying many threads at once for the review action and the ad funnel.
//
// Every read and write carries companyId — the templates a thread is judged
// against are ITS company's threads, never another tenant's (non-negotiable
// #8). No model is called from here: the bulk pass is deterministic and free,
// and a thread the rules cannot place keeps the model's verdict if one was
// already stored (lib/leads/conversationLead.js runs the model, metered, on a
// live message).

import { classifyConversation, countFirstKeys, firstInboundKey, storableQualification, effectiveTier, TIERS } from "@/lib/leads/qualification";

/** lib/leads/conversationLead.js's CAPTURE_PLATFORMS, restated rather than
 *  imported: that module imports this one, and the check asserts the two
 *  lists are equal. */
export const QUALIFY_PLATFORMS = Object.freeze(["facebook", "instagram", "whatsapp"]);

/** Threads classified per page of the bulk pass. */
export const BULK_PAGE = 100;

/** Messages of a thread read per classification — the opening matters most. */
export const MESSAGES_PER_THREAD = 80;

/**
 * key → how many of the company's threads open with it. One query: the first
 * three inbound messages of every thread (three, because the first may be
 * Meta's "replied to an ad" line), reduced in JS by the same firstInboundKey
 * the classifier uses — so the counting and the matching cannot disagree on
 * what "the first message" is.
 */
export async function loadTemplateCounts(prisma, companyId) {
  if (!companyId || typeof prisma?.$queryRaw !== "function") return new Map();
  const rows = await prisma.$queryRaw`
    SELECT x."threadId", x.body, x.direction, x.private
    FROM (
      SELECT m."threadId", m.body, m.direction, m.private,
             ROW_NUMBER() OVER (PARTITION BY m."threadId" ORDER BY m."sentAt" ASC) AS n
      FROM "Message" m
      JOIN "MessageThread" t ON t.id = m."threadId"
      WHERE t."companyId" = ${companyId} AND m.direction = 'in' AND m.private = false
    ) x
    WHERE x.n <= 3`;
  const byThread = new Map();
  for (const r of rows || []) {
    if (!byThread.has(r.threadId)) byThread.set(r.threadId, []);
    byThread.get(r.threadId).push(r);
  }
  const first = new Map();
  for (const [id, msgs] of byThread) first.set(id, firstInboundKey(msgs));
  return countFirstKeys(first);
}

/** The company's enabled services — label and key, never a price. */
export async function loadQualificationServices(prisma, companyId) {
  if (!companyId) return [];
  const rows = await prisma.companyServiceCategory.findMany({
    where: { companyId, enabled: true },
    select: { category: { select: { id: true, label: true, key: true } } },
  });
  return rows.map((r) => r.category).filter(Boolean);
}

const THREAD_SELECT = Object.freeze({
  id: true,
  leadId: true,
  clientId: true,
  createdAt: true,
  participantName: true,
  adReferral: true,
  leadCapture: true,
  channel: { select: { platform: true } },
});

const MESSAGE_SELECT = Object.freeze({ id: true, direction: true, private: true, body: true, attachments: true, sentAt: true });

/**
 * The verdict for one loaded thread, with the model's stored verdict kept
 * where the rules alone are unsure. Pure.
 */
export function verdictForThread(thread, messages, { templateCounts, services }) {
  const capture = thread?.leadCapture && typeof thread.leadCapture === "object" ? thread.leadCapture : {};
  const prev = capture.qualification && typeof capture.qualification === "object" ? capture.qualification : null;
  const rules = classifyConversation({
    messages,
    adReferral: thread.adReferral || null,
    templateCounts,
    services,
    override: prev?.override || null,
  });
  // The model already read this thread (on a live message) and the rules
  // still cannot place it: the model's verdict stands.
  if (rules.needsAi && prev && prev.method === "ai" && TIERS.includes(prev.tier)) {
    return { ...rules, tier: prev.tier, method: "ai", needsAi: false, unsure: false, reasonKey: prev.reasonKey, params: prev.params || {} };
  }
  return rules;
}

/**
 * Classify every Meta conversation of ONE company, deterministically, and
 * (when `write`) store each verdict on MessageThread.leadCapture.qualification
 * — merged, never replacing the capture's other keys, and carrying a person's
 * override. Free: no model.
 *
 * @returns {{ threads: number, byTier: Record<string, number>, byOrigin: Record<string, number>,
 *             needsAi: number, verdicts: Map<string, object> }}
 */
export async function qualifyCompanyThreads(prisma, { companyId, write = true, threadIds = null, now = new Date() }) {
  if (!companyId) throw new Error("qualifyCompanyThreads needs a companyId");
  const [templateCounts, services] = await Promise.all([
    loadTemplateCounts(prisma, companyId).catch(() => new Map()),
    loadQualificationServices(prisma, companyId).catch(() => []),
  ]);
  const byTier = Object.fromEntries(TIERS.map((t) => [t, 0]));
  const byOrigin = { ad: 0, organic: 0 };
  const verdicts = new Map();
  let needsAi = 0;
  let threads = 0;
  let cursor = null;

  for (;;) {
    const page = await prisma.messageThread.findMany({
      where: {
        companyId,
        channel: { platform: { in: [...QUALIFY_PLATFORMS] } },
        ...(Array.isArray(threadIds) ? { id: { in: threadIds } } : {}),
      },
      select: THREAD_SELECT,
      orderBy: { id: "asc" },
      take: BULK_PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!page.length) break;
    cursor = page[page.length - 1].id;
    const msgs = await prisma.message.findMany({
      where: { threadId: { in: page.map((t) => t.id) } },
      select: { ...MESSAGE_SELECT, threadId: true },
      orderBy: { sentAt: "asc" },
    });
    const byThread = new Map();
    for (const m of msgs) {
      if (!byThread.has(m.threadId)) byThread.set(m.threadId, []);
      const list = byThread.get(m.threadId);
      if (list.length < MESSAGES_PER_THREAD) list.push(m);
    }
    for (const t of page) {
      const v = verdictForThread(t, byThread.get(t.id) || [], { templateCounts, services });
      const capture = t.leadCapture && typeof t.leadCapture === "object" && !Array.isArray(t.leadCapture) ? t.leadCapture : {};
      const stored = storableQualification(v, { previous: capture.qualification || null, at: now });
      const tier = effectiveTier(stored);
      threads++;
      if (tier) byTier[tier]++;
      byOrigin[stored.origin === "ad" ? "ad" : "organic"]++;
      if (stored.needsAi) needsAi++;
      verdicts.set(t.id, { thread: t, verdict: v, stored, tier });
      if (write) await storeQualification(prisma, { companyId, threadId: t.id, capture, stored });
    }
    if (page.length < BULK_PAGE) break;
  }
  return { threads, byTier, byOrigin, needsAi, verdicts };
}

/**
 * Write ONE key of the thread's leadCapture. In SQL where the client allows
 * it (jsonb_set: the capture's other keys — the model's run count, the
 * reviewer's verdict, a "not a lead" mark — are never rewritten from a copy
 * read a moment earlier, which a live message may have changed since).
 * Scoped by company either way.
 */
export async function storeQualification(prisma, { companyId, threadId, capture = {}, stored }) {
  if (typeof prisma?.$executeRaw === "function") {
    const json = JSON.stringify(stored);
    return prisma.$executeRaw`
      UPDATE "MessageThread"
      SET "leadCapture" = jsonb_set(
        CASE WHEN jsonb_typeof("leadCapture") = 'object' THEN "leadCapture" ELSE '{}'::jsonb END,
        '{qualification}', ${json}::jsonb, true)
      WHERE id = ${threadId} AND "companyId" = ${companyId}`;
  }
  return prisma.messageThread.updateMany({
    where: { id: threadId, companyId },
    data: { leadCapture: { ...(capture || {}), qualification: stored } },
  });
}
