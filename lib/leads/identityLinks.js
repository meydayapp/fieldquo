// lib/leads/identityLinks.js
//
// The writes behind "this is the same person as that lead" — and the undo.
//
// lib/leads/identityMatch.js decides (pure). This file records the decision
// as a LeadIdentityLink row and makes the one change the link implies, and
// nothing else:
//
//   meta_lead_form  a Facebook form submission folded into an existing lead
//                   instead of becoming a second lead. The submission is kept
//                   whole on the row (`payload`); the lead gains only what it
//                   did not have (an empty phone / email column, an unknown
//                   campaign), each recorded with what was there before.
//   thread          a conversation joined to an existing lead.
//   client          a lead tied to a client already on file, so converting it
//                   reuses that client (lib/leads/convertLead.js reads this)
//                   instead of making a second client record.
//
// ══ The undo is the point ══════════════════════════════════════════════════
//
// The owner asked for no destructive merge, and a matcher that is wrong once
// in fifty is wrong every week for a busy painter. undoIdentityLink() is
// "Not the same person": a folded form lead becomes its own lead again (from
// `payload`, through the ordinary creator, so it is scored like any other), a
// field the link filled is put back ONLY if it still holds what the link
// wrote (a person's edit since then stands), a thread is unlinked only if it
// still points at this lead, and the row stays — status "undone" — so the
// matcher never proposes the same pair again (rejectedPairs below).
//
// Every query carries companyId. Every function takes `prisma` so the check
// script can drive it with an in-memory database.
import { db } from "@/lib/db";
import { planFoldIn } from "./identityMatch";
import { CLIENT_MATCH_SELECT, CANDIDATE_SCAN_LIMIT } from "@/lib/contacts/matchContact";
import { createScoredLead } from "@/lib/leads/createLead";
import { buildLeadIntake } from "@/lib/leads/intakeShape";

/** Which records a person has said are NOT the same as `leadId` / `threadId`. */
export async function rejectedPairs(prisma = db, { companyId, leadId = null, threadId = null } = {}) {
  const out = new Set();
  if (!companyId || (!leadId && !threadId)) return out;
  const rows = await prisma.leadIdentityLink
    .findMany({
      where: {
        companyId,
        status: "undone",
        OR: [...(leadId ? [{ leadId }] : []), ...(threadId ? [{ threadId }] : [])],
      },
      select: { leadId: true, threadId: true, clientId: true, splitLeadId: true },
      take: 200,
    })
    .catch(() => []);
  for (const r of rows) {
    if (r.leadId && r.leadId !== leadId) out.add(`lead:${r.leadId}`);
    if (r.threadId && r.threadId !== threadId) out.add(`thread:${r.threadId}`);
    if (r.clientId) out.add(`client:${r.clientId}`);
    if (r.splitLeadId) out.add(`lead:${r.splitLeadId}`);
  }
  return out;
}

/** How far back an open lead or a conversation is a candidate. */
export const IDENTITY_WINDOW_DAYS = 180;

/**
 * The contact details a thread's lead capture has seen, as values the matcher
 * can compare. `contacts` is written by lib/leads/conversationLead.js since
 * 2026-10-03; older captures only carry the normalised signature list, whose
 * phone and email entries are values in their own right. Pure.
 */
export function threadContacts(leadCapture) {
  const c = leadCapture && typeof leadCapture === "object" ? leadCapture : {};
  const out = { phone: null, email: null, address: null };
  if (c.contacts && typeof c.contacts === "object") {
    out.phone = typeof c.contacts.phone === "string" ? c.contacts.phone : null;
    out.email = typeof c.contacts.email === "string" ? c.contacts.email : null;
    out.address = typeof c.contacts.address === "string" ? c.contacts.address : null;
  }
  for (const s of Array.isArray(c.contactsSeen) ? c.contactsSeen : []) {
    if (typeof s !== "string") continue;
    if (!out.phone && s.startsWith("phone:")) out.phone = s.slice(6) || null;
    if (!out.email && s.startsWith("email:")) out.email = s.slice(6) || null;
  }
  return out;
}

/**
 * Everything a new form lead could be: open leads, Meta conversations, and
 * clients — all this company's, all bounded. Reads; never writes.
 */
export async function loadIdentityCandidates(prisma = db, { companyId, now = new Date() }) {
  const since = new Date(now.getTime() - IDENTITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [leads, threads, clients] = await Promise.all([
    prisma.leadRequest.findMany({
      where: { companyId, status: { in: ["new", "contacted"] }, createdAt: { gte: since } },
      select: { id: true, companyId: true, name: true, email: true, phone: true, intake: true, conversationEvidence: true, createdAt: true, source: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.messageThread.findMany({
      where: { companyId, lastMessageAt: { gte: since }, channel: { platform: { in: ["facebook", "instagram", "whatsapp"] } } },
      select: { id: true, companyId: true, leadId: true, participantName: true, participantExternalId: true, leadCapture: true, channel: { select: { platform: true } } },
      orderBy: { lastMessageAt: "desc" },
      take: 500,
    }),
    prisma.client.findMany({ where: { companyId }, select: { ...CLIENT_MATCH_SELECT }, orderBy: { createdAt: "desc" }, take: CANDIDATE_SCAN_LIMIT }),
  ]);
  return {
    leads,
    threads: threads.map((t) => ({ ...t, platform: t.channel?.platform || null, contacts: threadContacts(t.leadCapture) })),
    clients,
  };
}

const evidenceOf = (match, extra = {}) => ({
  why: match?.why || null,
  conflicts: match?.conflicts || [],
  possible: match?.possible || [],
  ...extra,
});

/**
 * Fold a Meta form submission into an existing lead. Idempotent on the
 * leadgen id: a second call with the same id finds the row and does nothing.
 *
 * @param mapped  lib/meta/leadsImport.js's mapLeadFields() output
 * @returns {{ status: "linked"|"duplicate", leadId, linkId }}
 */
export async function foldFormLeadInto(prisma = db, { companyId, leadId, metaLeadId, formId = null, mapped, attribution = null, match, importedAt = null, rawCreatedTime = null }) {
  const existing = await prisma.leadIdentityLink.findFirst({
    where: { companyId, metaLeadId: String(metaLeadId) },
    select: { id: true, leadId: true },
  });
  if (existing) return { status: "duplicate", leadId: existing.leadId, linkId: existing.id };

  const lead = await prisma.leadRequest.findFirst({
    where: { id: leadId, companyId },
    select: { id: true, phone: true, email: true, metaCampaignId: true, metaCampaignName: true },
  });
  if (!lead) return { status: "missing_lead", leadId: null, linkId: null };

  const plan = planFoldIn(lead, mapped);
  const wrote = { ...plan.wrote };
  const data = { ...plan.data };
  // The campaign that paid for the form, when the surviving lead does not
  // know its own — the conversation came off the same ad more often than not.
  if (!lead.metaCampaignId && attribution?.campaignId) {
    data.metaCampaignId = String(attribution.campaignId);
    data.metaCampaignName = attribution.campaignName ? String(attribution.campaignName) : null;
    wrote.metaCampaignId = { before: null, after: data.metaCampaignId };
    wrote.metaCampaignName = { before: lead.metaCampaignName ?? null, after: data.metaCampaignName };
  }

  let link;
  try {
    link = await prisma.leadIdentityLink.create({
      data: {
        companyId,
        leadId: lead.id,
        kind: "meta_lead_form",
        metaLeadId: String(metaLeadId),
        metaFormId: formId ? String(formId) : null,
        confidence: match.confidence,
        matchedOn: match.matchedOn || [],
        evidence: evidenceOf(match, { via: match.kind, viaId: match.id }),
        payload: {
          name: mapped.name || null,
          email: mapped.email || null,
          phone: mapped.phone || null,
          message: mapped.message || null,
          intake: mapped.intake || null,
          formId: formId ? String(formId) : null,
          campaignId: attribution?.campaignId ? String(attribution.campaignId) : null,
          campaignName: attribution?.campaignName ? String(attribution.campaignName) : null,
          createdTime: rawCreatedTime || null,
          importedAt: importedAt instanceof Date ? importedAt.toISOString() : null,
        },
        wrote: Object.keys(wrote).length ? wrote : null,
        method: "deterministic",
        // Written, not left to the column default: rejectedPairs and the undo
        // read it, and a row that depended on a default would be the one
        // shape a test database could disagree about.
        status: "linked",
      },
      select: { id: true },
    });
  } catch (err) {
    // The webhook and the cron raced on the same leadgen id — the unique
    // (companyId, metaLeadId) settled it, exactly one row exists.
    if (err?.code === "P2002") {
      const winner = await prisma.leadIdentityLink.findFirst({ where: { companyId, metaLeadId: String(metaLeadId) }, select: { id: true, leadId: true } });
      if (winner) return { status: "duplicate", leadId: winner.leadId, linkId: winner.id };
    }
    throw err;
  }
  if (Object.keys(data).length) {
    await prisma.leadRequest.update({ where: { id: lead.id }, data, select: { id: true } });
  }
  return { status: "linked", leadId: lead.id, linkId: link.id };
}

/**
 * Record that a thread and a lead are one person, and point the thread at the
 * lead when nobody has pointed it anywhere. Idempotent: an existing live link
 * for the same pair is returned as it is.
 */
export async function linkThreadToLead(prisma = db, { companyId, threadId, leadId, match, method = "deterministic", wroteFields = null, pointed = null }) {
  if (!companyId || !threadId || !leadId) return null;
  const live = await prisma.leadIdentityLink.findFirst({
    where: { companyId, leadId, threadId, kind: "thread", status: "linked" },
    select: { id: true },
  });
  if (live) return live;
  // `pointed` is the caller's answer when it already pointed the thread
  // itself (lib/leads/conversationLead.js does, so the link survives even if
  // this row cannot be written); otherwise it is done here.
  const didPoint =
    typeof pointed === "boolean"
      ? pointed
      : Boolean((await prisma.messageThread.updateMany({ where: { id: threadId, companyId, leadId: null }, data: { leadId } }))?.count);
  const wrote = {
    ...(didPoint ? { "thread.leadId": { before: null, after: leadId } } : {}),
    ...(wroteFields || {}),
  };
  return prisma.leadIdentityLink.create({
    data: {
      companyId,
      leadId,
      kind: "thread",
      threadId,
      confidence: match?.confidence || "certain",
      matchedOn: match?.matchedOn || [],
      evidence: evidenceOf(match),
      wrote: Object.keys(wrote).length ? wrote : null,
      method,
      status: "linked",
    },
    select: { id: true },
  });
}

/** Record that a lead is a client already on file. Idempotent per pair. */
export async function linkLeadToClient(prisma = db, { companyId, leadId, clientId, threadId = null, match, method = "deterministic", documents = [] }) {
  if (!companyId || !leadId || !clientId) return null;
  const live = await prisma.leadIdentityLink.findFirst({
    where: { companyId, leadId, clientId, kind: "client", status: "linked" },
    select: { id: true },
  });
  if (live) return live;
  return prisma.leadIdentityLink.create({
    data: {
      companyId,
      leadId,
      kind: "client",
      clientId,
      threadId,
      confidence: match?.confidence || "certain",
      matchedOn: match?.matchedOn || [],
      evidence: evidenceOf(match, { documents: (documents || []).slice(0, 6) }),
      method,
      status: "linked",
    },
    select: { id: true },
  });
}

/** The client a lead has been tied to, for convertLead — null when none. */
export async function linkedClientId(prisma = db, { companyId, leadId }) {
  if (!companyId || !leadId) return null;
  const link = await prisma.leadIdentityLink
    .findFirst({
      where: { companyId, leadId, kind: "client", status: "linked" },
      orderBy: { createdAt: "desc" },
      select: { clientId: true },
    })
    .catch(() => null);
  if (!link?.clientId) return null;
  // The client must still exist in THIS company — a link is trusted only as
  // far as it points inside the tenant.
  const client = await prisma.client.findFirst({ where: { id: link.clientId, companyId }, select: { id: true } }).catch(() => null);
  return client?.id || null;
}

/** The links on one lead, for the drawer. Shaped; never the raw payload. */
export async function listIdentityLinks(prisma = db, { companyId, leadId }) {
  const rows = await prisma.leadIdentityLink.findMany({
    where: { companyId, leadId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      kind: true,
      metaLeadId: true,
      metaFormId: true,
      threadId: true,
      clientId: true,
      confidence: true,
      matchedOn: true,
      evidence: true,
      payload: true,
      method: true,
      status: true,
      createdAt: true,
      undoneAt: true,
      splitLeadId: true,
    },
  });
  return rows.map(shapeLink);
}

/** One row as the drawer reads it. Pure. */
export function shapeLink(r) {
  const payload = r?.payload && typeof r.payload === "object" ? r.payload : {};
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    confidence: r.confidence,
    matchedOn: Array.isArray(r.matchedOn) ? r.matchedOn : [],
    method: r.method || "deterministic",
    why: r.evidence?.why || null,
    conflicts: Array.isArray(r.evidence?.conflicts) ? r.evidence.conflicts : [],
    documents: Array.isArray(r.evidence?.documents) ? r.evidence.documents : [],
    threadId: r.threadId || null,
    clientId: r.clientId || null,
    // What the folded form said, so a person can judge "same person?" with
    // the evidence in front of them. Contact details only — they are already
    // this company's own lead data.
    form: r.kind === "meta_lead_form" ? { name: payload.name || null, email: payload.email || null, phone: payload.phone || null, message: payload.message || null } : null,
    createdAt: r.createdAt,
    undoneAt: r.undoneAt || null,
    splitLeadId: r.splitLeadId || null,
  };
}

/**
 * "Not the same person." Reverses one link, non-destructively.
 *
 * @param createLead  lib/leads/createLead.js's createScoredLead (a seam)
 * @returns {{ ok: true, splitLeadId?: string } | { ok: false, reason }}
 */
export async function undoIdentityLink(prisma = db, { companyId, leadId, linkId, userId = null, createLead = createScoredLead, now = new Date() }) {
  const link = await prisma.leadIdentityLink.findFirst({
    where: { id: linkId, companyId, leadId },
  });
  if (!link) return { ok: false, reason: "not_found" };
  if (link.status !== "linked") return { ok: false, reason: "already_undone" };

  // Fields the link filled, put back only while they still hold its value.
  const wrote = link.wrote && typeof link.wrote === "object" ? link.wrote : {};
  const leadFields = Object.entries(wrote).filter(([k]) => !k.includes("."));
  if (leadFields.length) {
    const lead = await prisma.leadRequest.findFirst({
      where: { id: leadId, companyId },
      select: Object.fromEntries([["id", true], ...leadFields.map(([k]) => [k, true])]),
    });
    const revert = {};
    for (const [k, v] of leadFields) {
      if (lead && String(lead[k] ?? "") === String(v?.after ?? "")) revert[k] = v?.before ?? null;
    }
    if (lead && Object.keys(revert).length) {
      await prisma.leadRequest.update({ where: { id: leadId }, data: revert, select: { id: true } });
    }
  }

  if (link.threadId && wrote["thread.leadId"]) {
    await prisma.messageThread.updateMany({ where: { id: link.threadId, companyId, leadId }, data: { leadId: null } });
  }

  // A folded form lead becomes its own lead again, through the ordinary
  // creator — scored, and announced to nobody but the person who pressed
  // the button (they are the actor).
  let splitLeadId = null;
  if (link.kind === "meta_lead_form") {
    const p = link.payload && typeof link.payload === "object" ? link.payload : {};
    const name = p.name || p.email || p.phone;
    if (name && typeof createLead === "function") {
      const made = await createLead({
        companyId,
        name: String(name).slice(0, 120),
        email: p.email || undefined,
        phone: p.phone || undefined,
        message: p.message || undefined,
        // The Meta mapping's own blob (lib/meta/leadsImport.js mapLeadFields),
        // put back through the shared shape so the reserved address keys land
        // where convertLead reads them.
        intake:
          buildLeadIntake({
            address: p.intake?.address,
            city: p.intake?.city,
            province: p.intake?.province,
            country: p.intake?.country,
            details: p.intake && typeof p.intake === "object" ? p.intake : null,
          }) || undefined,
        source: "meta_lead_form",
        actorUserId: userId,
        ...(p.importedAt ? { importedAt: new Date(p.importedAt) } : {}),
      });
      splitLeadId = made?.id || null;
      if (splitLeadId) {
        // The Meta columns, the same second write leadsImport makes. The
        // leadgen id moves to the new lead, so a re-delivery of the same
        // submission finds IT (leadsImport checks LeadRequest.metaLeadId
        // before the link table).
        await prisma.leadRequest.update({
          where: { id: splitLeadId },
          data: {
            metaLeadId: link.metaLeadId || null,
            metaFormId: link.metaFormId || p.formId || null,
            metaCampaignId: p.campaignId || null,
            metaCampaignName: p.campaignName || null,
          },
          select: { id: true },
        });
      }
    }
  }

  await prisma.leadIdentityLink.update({
    where: { id: link.id },
    data: { status: "undone", undoneAt: now, undoneById: userId, splitLeadId },
    select: { id: true },
  });
  return { ok: true, splitLeadId };
}
