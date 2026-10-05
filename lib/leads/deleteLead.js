// lib/leads/deleteLead.js
//
// Deleting a lead — one, or a selection — and everything that has to happen
// so the delete is neither destructive beyond the lead nor silently undone.
//
// ══ Why delete exists at all (owner, 2026-10-05) ═══════════════════════════
//
// "There should be a way to delete leads… I have a few test ones there, and
// some that were imported from (I think) conversations that may not have been
// a lead." Lost is a pipeline outcome — it says a real enquiry went nowhere,
// and it stays in the win/loss numbers on purpose. A test row, or a chat that
// was never an enquiry, is not an outcome; it should never have counted. So
// deleted leads DROP OUT of every count (the board, the KPI cards, the
// campaign rollup, Won averages): all of those read LeadRequest live, and no
// figure FieldQuo computes is a stored copy of a lead count. MarketingSpend.
// leads is the AD PLATFORM's own claim, never ours, and is not touched.
//
// ══ What goes with the lead, and what never does ═══════════════════════════
//
// Goes (no meaning without it):
//   * LeadNote rows — the call-back log on this lead (schema: onDelete Cascade).
//   * LeadIdentityLink rows whose surviving lead is this one (Cascade). Their
//     Meta leadgen ids are carried into the audit row first — see "Why the
//     audit row is also a tombstone" below.
//   * The lead's own columns, including clientPhotos / kitchenDesign JSON.
//
// Survives, with its pointer to the lead cleared (plain columns, no FK):
//   * MessageThread.leadId — the conversation and every message in it stay.
//   * VoiceCall.leadId, CallConsent.leadId — a call that happened and a
//     consent someone gave are records of fact, not of the lead.
//   * VoiceCallTask.leadId — and a task still QUEUED for this lead is
//     cancelled, because the speed-to-lead call (lib/voice/triggers.js
//     onLeadCreated) would otherwise ring the number of a lead that the
//     company just said was a test or not a lead at all.
//   * FunnelResponse.leadId, FunnelVisit.leadId — traffic analytics; the visit
//     stays a visit, it just no longer produced a lead.
//   * QuoteDocument.leadId, PlanRead.leadId — a drawing read and its files are
//     a quote's working papers (the read may already have a quote), not the
//     lead's attachments.
//   * LeadIdentityLink.splitLeadId on OTHER leads' links — the link stays; it
//     just no longer names the lead its undo created.
//
// Never touched: Client, Quote, Job, Invoice, payments, messages. A Quote is
// linked by LeadRequest.quoteId — the foreign key is on the LEAD's row — so
// deleting the lead removes the link from the quote's side and the quote is
// otherwise untouched. Nothing here is declared onDelete: Cascade towards a
// record that must survive; the two cascades are both the lead's own children.
//
// Cloudinary: the lead's photos are NOT deleted remotely. The same files are
// carried onto the quote when a lead is converted (Quote.clientPhotos), and
// lib/cloudinary.js deleteAsset has no caller anywhere that proves it safe
// for a shared asset. Removing the row stops FieldQuo showing them; the files
// themselves stay in the company's Cloudinary folder.
//
// ══ Why the audit row is also a tombstone ══════════════════════════════════
//
// Three paths re-create leads on their own, and a delete must not be undone
// by the next tick of any of them:
//
//   1. A Meta lead FORM. Meta re-delivers by design and the cron polls back
//      ninety days (lib/meta/leadsImport.js): the leadgen id was the
//      idempotency key, and it lived on the row being deleted. The ActivityLog
//      row written here carries it (`metadata.metaLeadIds`), and
//      importMetaLead asks isDeletedMetaLead() before creating anything.
//      ActivityLog rows are never deleted by anything in this codebase, which
//      is what makes them a sound place for it — and it needs no new column.
//   2. A conversation (lib/leads/conversationLead.js, and the AI employee's
//      book_callback). With "don't create a lead from this conversation
//      again", the thread's leadCapture carries `notALead`, and both stop.
//      Without it, the next message from that person may make a NEW lead —
//      which is what the confirm dialog says.
//   3. Call recovery (lib/ai/callLeadRecovery.js) re-reads a transcript for a
//      recovered call with no lead. It now also refuses a call whose lead it
//      already recovered once (leadRecoveredAt), so clearing VoiceCall.leadId
//      here does not invite it back.
//
// That is also why the audit row is written INSIDE the transaction, unlike
// lib/activity/log.js's best-effort rows: here the row is the only trace left
// of the record and the guard against its resurrection, so a delete that
// cannot write it does not happen.
//
// ══ No undo ════════════════════════════════════════════════════════════════
//
// This is a hard delete. An "Undo" toast would have to rebuild the row and its
// notes from a copy, and the conversation/Meta guards above would then be
// stating something untrue. The confirm dialog carries the weight instead.

import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { leadSourceLabelKey } from "@/lib/leads/sourceLabel";
import { isMarkedNotALead, withNotALeadMark } from "@/lib/leads/conversationSources";

import { LEAD_DELETED_ACTION, isDeletedMetaLead } from "@/lib/leads/leadTombstone";

export { isMarkedNotALead, withNotALeadMark, LEAD_DELETED_ACTION, isDeletedMetaLead };

/** The most leads one request may delete. A board selection, not an import. */
export const MAX_DELETE_BATCH = 100;

/**
 * The ids a request may act on. Pure.
 *
 * Strings only — an object or a number is dropped, never coerced into a
 * `where` — trimmed, de-duplicated, at most 64 characters (a cuid is 25).
 * @returns {{ ids: string[], tooMany: boolean }}
 */
export function cleanLeadIds(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  for (const v of list) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id || id.length > 64) continue;
    seen.add(id);
  }
  const ids = [...seen];
  return { ids: ids.slice(0, MAX_DELETE_BATCH), tooMany: ids.length > MAX_DELETE_BATCH };
}

/** "Facebook", "Instant estimate" — the English label the audit row's sentence uses. */
function englishSourceLabel(source) {
  const key = leadSourceLabelKey(source);
  return key ? APP_MESSAGES.en[key] || source : null;
}

/** The audit sentence, in English (lib/activity/log.js: `summary` is always English). Pure. */
export function leadDeletedSummary({ name, source, createdAt }) {
  const label = englishSourceLabel(source);
  const date = createdAt ? new Date(createdAt).toISOString().slice(0, 10) : null;
  const tail = [label ? `from ${label}` : null, date ? `received ${date}` : null].filter(Boolean).join(", ");
  return `Deleted lead ${name || "(no name)"}${tail ? ` (${tail})` : ""}`;
}

/**
 * Delete leads of ONE company. Every read and write is scoped by companyId;
 * an id that is not this company's is reported in `notFound` and nothing is
 * done to it — the caller turns that into a 404, never into "deleted".
 *
 * @param prisma   the client (a scripted one in scripts/check-lead-delete.mjs)
 * @param actor    { userId, memberId, role } — who is deleting
 * @param notALead true: mark every conversation these leads came from so no
 *                 lead is created from it again
 * @returns {{ deleted: {id,name}[], notFound: string[], markedThreads: number,
 *             noConversation: string[] }}
 */
export async function deleteLeads(prisma, { companyId, ids, actor = {}, notALead = false, bulk = false, now = new Date() }) {
  if (!companyId) throw new Error("deleteLeads needs a companyId");
  const { ids: wanted } = cleanLeadIds(ids);
  if (!wanted.length) return { deleted: [], notFound: [], markedThreads: 0, noConversation: [] };

  const leads = await prisma.leadRequest.findMany({
    where: { companyId, id: { in: wanted } },
    select: {
      id: true,
      name: true,
      source: true,
      status: true,
      createdAt: true,
      quoteId: true,
      metaLeadId: true,
      conversationEvidence: true,
    },
  });
  const found = leads.map((l) => l.id);
  const foundSet = new Set(found);
  const notFound = wanted.filter((id) => !foundSet.has(id));
  if (!found.length) return { deleted: [], notFound, markedThreads: 0, noConversation: [] };

  // ── The conversations these leads came from ──────────────────────────────
  //
  // Three ways a thread names its lead: the link (leadId), the lead's own
  // evidence (conversationEvidence.threadId), and the capture's memory of a
  // lead it made (leadCapture.leadId — still set after somebody unlinked it).
  const evidenceThread = new Map(); // threadId -> leadId
  for (const l of leads) {
    const t = l.conversationEvidence && typeof l.conversationEvidence === "object" ? l.conversationEvidence.threadId : null;
    if (typeof t === "string" && t) evidenceThread.set(t, l.id);
  }
  const threads = await prisma.messageThread.findMany({
    where: {
      companyId,
      OR: [
        { leadId: { in: found } },
        ...(evidenceThread.size ? [{ id: { in: [...evidenceThread.keys()] } }] : []),
        ...found.map((id) => ({ leadCapture: { path: ["leadId"], equals: id } })),
      ],
    },
    select: { id: true, leadId: true, leadCapture: true },
  });
  const threadLead = (t) =>
    (t.leadId && foundSet.has(t.leadId) && t.leadId) ||
    evidenceThread.get(t.id) ||
    (t.leadCapture && foundSet.has(t.leadCapture.leadId) && t.leadCapture.leadId) ||
    null;

  // ── Meta leadgen ids, for the tombstone ──────────────────────────────────
  const folded = await prisma.leadIdentityLink.findMany({
    where: { companyId, leadId: { in: found }, metaLeadId: { not: null } },
    select: { leadId: true, metaLeadId: true },
  });
  const foldedBy = new Map();
  for (const f of folded) {
    if (!foldedBy.has(f.leadId)) foldedBy.set(f.leadId, []);
    foldedBy.get(f.leadId).push(String(f.metaLeadId));
  }

  // Resolved once, at write time — the same reason lib/activity/log.js does.
  let actorName = null;
  if (actor.userId && prisma.user?.findUnique) {
    const u = await prisma.user.findUnique({ where: { id: actor.userId }, select: { name: true, email: true } }).catch(() => null);
    actorName = u?.name || u?.email || null;
  }

  const byLead = new Map(leads.map((l) => [l.id, l]));
  const markedLeads = new Set();
  let markedThreads = 0;

  await prisma.$transaction(async (tx) => {
    // Pointers cleared, records kept. Every updateMany is scoped by company.
    await tx.messageThread.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    if (notALead) {
      for (const t of threads) {
        const leadId = threadLead(t);
        if (!leadId) continue;
        await tx.messageThread.updateMany({
          where: { id: t.id, companyId },
          data: {
            leadCapture: withNotALeadMark(t.leadCapture, {
              at: now,
              byUserId: actor.userId || null,
              byName: actorName,
              leadId,
              leadName: byLead.get(leadId)?.name || null,
            }),
          },
        });
        markedThreads++;
        markedLeads.add(leadId);
      }
    }
    await tx.voiceCall.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    await tx.callConsent.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    await tx.voiceCallTask.updateMany({
      where: { companyId, leadId: { in: found }, status: "queued" },
      data: { status: "cancelled", lastError: "lead_deleted" },
    });
    await tx.voiceCallTask.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    // FunnelResponse has no companyId of its own; it is scoped through its
    // funnel. The ids were proved to be this company's leads above.
    await tx.funnelResponse.updateMany({ where: { leadId: { in: found }, funnel: { companyId } }, data: { leadId: null } });
    await tx.funnelVisit.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    await tx.quoteDocument.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    await tx.planRead.updateMany({ where: { companyId, leadId: { in: found } }, data: { leadId: null } });
    await tx.leadIdentityLink.updateMany({ where: { companyId, splitLeadId: { in: found } }, data: { splitLeadId: null } });

    // LeadNote and LeadIdentityLink go by their declared cascade.
    await tx.leadRequest.deleteMany({ where: { companyId, id: { in: found } } });

    for (const l of leads) {
      const metaLeadIds = [...(l.metaLeadId ? [String(l.metaLeadId)] : []), ...(foldedBy.get(l.id) || [])];
      const sourceLabel = englishSourceLabel(l.source);
      const received = l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : null;
      await tx.activityLog.create({
        data: {
          companyId,
          actorUserId: actor.userId || null,
          actorMemberId: actor.memberId || null,
          actorName,
          actorRole: actor.role || null,
          viaImpersonation: false,
          action: LEAD_DELETED_ACTION,
          entityType: "lead",
          entityId: l.id,
          summary: leadDeletedSummary(l),
          metadata: {
            name: l.name || null,
            source: l.source || null,
            receivedAt: l.createdAt ? new Date(l.createdAt).toISOString() : null,
            status: l.status || null,
            quoteId: l.quoteId || null,
            metaLeadIds,
            notALead: markedLeads.has(l.id),
            bulk: Boolean(bulk),
            i18n: {
              key: "app.activity.event.leadDeleted",
              params: { name: l.name || "", source: sourceLabel || "—", date: received || "—" },
            },
          },
        },
      });
    }
  });

  return {
    deleted: leads.map((l) => ({ id: l.id, name: l.name })),
    notFound,
    markedThreads,
    // Asked to mark, and no conversation was found for these — said back, so
    // the screen never claims a guard that was not put in place.
    noConversation: notALead ? found.filter((id) => !markedLeads.has(id)) : [],
  };
}

/**
 * The refusal for a support session, or null. Pure.
 *
 * A read-only "View as company" session is already refused twice before a
 * handler runs (middleware.js, then lib/currentMember.js assertReadOnly); this
 * is a third check on purpose, at the one route family that destroys rows a
 * customer cannot get back. The demo sandbox is the write-capable session
 * (assertReadOnly's own exception) and passes, as it does everywhere.
 */
export function supportSessionRefusal(member) {
  if (!member?.impersonation) return null;
  if (member.impersonationMode === "demo_sandbox") return null;
  return {
    status: 403,
    body: {
      error:
        "You're viewing this account read-only. Support access can't change a customer's data — talk them through the change, or ask them to make it.",
    },
  };
}
