// lib/signup/assignment.js
//
// Who holds a signup row right now, how it got there, and the two console
// actions that change it: take it back to the platform, or move it to
// another rep.
//
// ══ The owner's words, 2026-09-24, on /platform/signups ════════════════════
//
//   · "Do not contact … in the review folder" — a contradiction on one row.
//     Luma Painting (cmuexlkrx000g04l31cjjldy5) unsubscribed from a signup
//     letter at 15:28, which put its address on FieldQuo's do-not-contact
//     list for every channel; at 22:32 the review folder offered its welcome
//     row and it was handed to a rep anyway, because the folder only read
//     Prospect.doNotContactAt — the list itself was never asked. A DNC row
//     must never read as waiting for a call, never sit in the folder and
//     never go down any assign path. signupDoNotContact() below is the one
//     question every one of those asks, fresh.
//   · "I don't see to who has it or if it was assigned" — signupHolderOf()
//     and signupAssignmentHistory().
//   · "assign it back to me, the platform" — takeBackSignup(); and moving a
//     held row straight to another rep — reassignSignup().
//
// ══ Why the history is read from the claim log, not a new table ═══════════
//
// SalesQueueClaim is already written once and closed once per rep per hold,
// by every path that hands a Prospect out or takes it back (the console's
// assign, the rep's own buttons, the day-end and closed-window sweeps, a
// move). A console assignment's batchId names the admin (assignBatchId), and
// a release carries its reason. The one fact the claim cannot hold is WHICH
// admin pressed "take back" — the release is a reason, not a person — and
// that is in the `leads_unassigned` audit row unassignFromRep() writes in the
// same request. A second history table written beside these would be the
// copy that rots: a sweep added next month would close claims and forget the
// history row. So nothing here writes history; it reads what the writers
// already leave.
//
// ══ Non-negotiable #3 ═════════════════════════════════════════════════════
//
// Every write here is to FieldQuo's own sales rows — a Prospect's holder
// columns, a claim, an audit line. Never a Company, never a SignupLead.
//
// ══ `client` is a parameter ═══════════════════════════════════════════════
//
// The salesFloor.js convention: scripts/check-signup-assignment.mjs runs
// every function here against the scripted db. Nothing imports from next.

import { SUPPRESSION_SELECT } from "@/lib/sales/suppression";
import { suppressionLookupKeys, suppressionVerdict } from "@/lib/sales/suppressionRules";
import { claimExpiryFrom } from "@/lib/sales/prospectView";
import { heldBy } from "@/lib/sales/reassign";
import { repCanTake, requiredLanguageFor } from "@/lib/sales/leadLanguage";
import { localDateIn } from "@/lib/sales/queueBatch";
import {
  ASSIGN_MODE,
  adminDisplayName,
  adminIdFromBatchId,
  assignBatchId,
  lastKnownZoneFor,
  notifyRepAssigned,
  unassignFromRep,
} from "@/lib/sales/assignLeads";
import { DISMISSAL_SELECT, isDismissed } from "@/lib/signup/dismissal";

// ═══════════════════════════════════════════════════════════════════════════
// Do not contact
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Channels judged, in order. A signup row's whole purpose on the floor is a
 * phone call, but a person who unsubscribed from the email is not somebody
 * FieldQuo rings either — the unsubscribe that caught Luma closed all three
 * channels, and an email-only opt-out is still a person who said stop.
 * lib/sales/suppression.js firstSuppression states the asymmetry:
 * over-refusing costs a prospect, under-refusing is the violation.
 */
const DNC_CHANNELS = Object.freeze(["phone", "sms", "email"]);

function lookupsFor({ emails = [], phones = [] } = {}) {
  const seen = new Set();
  const out = [];
  const add = (k) => {
    const id = `${k.kind}:${k.value}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(k);
  };
  for (const email of emails) if (email) for (const k of suppressionLookupKeys({ email })) add(k);
  for (const phone of phones) if (phone) for (const k of suppressionLookupKeys({ phone })) add(k);
  return out;
}

/** "Unsubscribed from a FieldQuo signup follow-up email" — a reason a person can read beside "Do not contact —". */
function readableReason(verdict) {
  const stored = typeof verdict?.hit?.reason === "string" ? verdict.hit.reason.trim().replace(/\.$/, "") : "";
  return stored || verdict?.reason || "on FieldQuo's do-not-contact list";
}

/**
 * The verdict for one row, from suppression rows already read and the
 * Prospect's own flag. Pure.
 *
 * @param rows      SalesSuppression rows matching ANY of the row's keys
 * @param prospect  { doNotContactAt, doNotContactReason } or null
 * @returns { dnc, reason, source: "list" | "prospect" | null }
 */
export function signupDncFrom({ rows = [], prospect = null } = {}) {
  for (const channel of DNC_CHANNELS) {
    const verdict = suppressionVerdict({ rows, channel });
    if (verdict.suppressed) return { dnc: true, reason: readableReason(verdict), source: "list", channel };
  }
  if (prospect?.doNotContactAt) {
    return { dnc: true, reason: prospect.doNotContactReason || "a human said never to ring this business", source: "prospect", channel: null };
  }
  return { dnc: false, reason: null, source: null, channel: null };
}

/**
 * Do-not-contact for many rows in ONE read of the list. `contacts` is
 * `[{ key, emails, phones, prospect }]`; the answer is a Map key → the
 * signupDncFrom() verdict. Used by the list screens, where a query per row
 * would be two hundred round trips.
 */
export async function signupSuppressions({ client, contacts = [] } = {}) {
  const per = contacts.map((c) => ({ ...c, lookups: lookupsFor(c) }));
  const all = [];
  const seen = new Set();
  for (const c of per) for (const k of c.lookups) {
    const id = `${k.kind}:${k.value}`;
    if (!seen.has(id)) { seen.add(id); all.push(k); }
  }
  const found = [];
  // Chunked: an OR of a few hundred pairs is fine, of thousands is not.
  for (let i = 0; i < all.length; i += 400) {
    const chunk = all.slice(i, i + 400);
    found.push(...(await client.salesSuppression.findMany({ where: { OR: chunk.map((k) => ({ kind: k.kind, value: k.value })) }, select: SUPPRESSION_SELECT })));
  }
  const out = new Map();
  for (const c of per) {
    const ids = new Set(c.lookups.map((k) => `${k.kind}:${k.value}`));
    const mine = found.filter((r) => ids.has(`${r.kind}:${r.value}`));
    out.set(c.key, signupDncFrom({ rows: mine, prospect: c.prospect || null }));
  }
  return out;
}

/**
 * The fresh, single-row question — asked in the request that writes, never
 * carried from the screen (lib/sales/suppression.js's "re-read at the moment
 * of the send"). An opt-out that arrived while the owner had the page open
 * has to win.
 */
export async function signupDoNotContact({ client, emails = [], phones = [], prospect = null } = {}) {
  const map = await signupSuppressions({ client, contacts: [{ key: "one", emails, phones, prospect }] });
  return map.get("one");
}

/** "Do not contact — {reason}", the one sentence every screen and refusal prints. */
export function dncSentence(dnc) {
  return `Do not contact — ${dnc?.reason || "on FieldQuo's do-not-contact list"}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Who holds it now
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Who holds a signup row right now. Pure.
 *
 *   rep_own     came in on a rep's link — theirs by attribution, offered to
 *               nobody else (the owner's 2026-09-21 rule)
 *   rep         a rep holds the floor row: an unlapsed lease, or worked
 *   platform    a floor row nobody holds — FieldQuo's. `inFolder` says
 *               whether the review folder offers it; a do-not-contact or
 *               removed row is the platform's and is NOT offered.
 *   unassigned  no floor row written yet (the cron's thirty minutes, no
 *               phone, a company whose welcome row is not written)
 *
 * @param prospect   the floor row { assignedRepId, assignedAt, claimExpiresAt, mergedIntoId } or null
 * @param referredRep { id, name } when the row is a rep's own, else null
 * @param dnc        signupDncFrom()'s answer
 * @param dismissed  removed from /platform/signups
 * @param repName    Map id → name
 */
export function signupHolderOf({ prospect = null, referredRep = null, dnc = null, dismissed = false, repName = new Map(), now = new Date() } = {}) {
  if (referredRep?.id) {
    return { kind: "rep_own", rep: { id: referredRep.id || null, name: referredRep.name || "a rep" }, text: `${referredRep.name || "A rep"}'s — came in on their link`, inFolder: false };
  }
  if (prospect && prospect.assignedRepId && heldBy(prospect, prospect.assignedRepId, now)) {
    const name = repName.get(prospect.assignedRepId) || "a rep";
    const worked = prospect.claimExpiresAt == null;
    return {
      kind: "rep",
      rep: { id: prospect.assignedRepId, name },
      since: prospect.assignedAt || null,
      worked,
      leaseUntil: worked ? null : prospect.claimExpiresAt,
      text: worked ? `Held by ${name} — worked (they spoke to them)` : `Held by ${name}`,
      inFolder: false,
    };
  }
  if (prospect) {
    if (dnc?.dnc) return { kind: "platform", text: "Platform — kept out of the review folder", inFolder: false };
    if (dismissed) return { kind: "platform", text: "Platform — removed from the list", inFolder: false };
    if (prospect.mergedIntoId) return { kind: "platform", text: "Platform — merged into another record", inFolder: false };
    return { kind: "platform", text: "Platform — in the review folder", inFolder: true };
  }
  return { kind: "unassigned", text: "Unassigned — no floor row yet", inFolder: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// How it got there
// ═══════════════════════════════════════════════════════════════════════════

const RELEASE_WORDS = {
  rep: (rep) => `${rep} gave it back`,
  rest: (rep) => `${rep} released the rest of their queue`,
  day_end: (rep) => `Released at the end of ${rep}'s day`,
  lapsed: (rep) => `${rep}'s 48-hour lease lapsed`,
  closed: (rep) => `Released from ${rep} — calling window closed`,
  admin: (rep) => `Taken back from ${rep} to Platform`,
  reassigned: (rep) => `Moved off ${rep}`,
};

const time = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Same instant, to the second — a move closes one claim and opens the next with one `now`. */
const sameInstant = (a, b) => a && b && Math.abs(a.getTime() - b.getTime()) < 1000;

/**
 * The assignment history of ONE floor row, oldest first. Pure.
 *
 * @param claims   SalesQueueClaim rows for the prospect
 *                 { salesRepId, claimedAt, mode, batchId, workedAt, releasedAt, releaseReason }
 * @param audits   PlatformAuditLog rows that may concern it
 *                 { action, platformAdminId, details, createdAt } —
 *                 `leads_unassigned` naming this prospect and the rep says
 *                 WHO took a row back; `signup_reassigned` names the rep a
 *                 worked row was moved from
 * @param prospect the row now { assignedRepId, claimExpiresAt } — tells a
 *                 lapsed lease from a live one
 * @param referred { rep: { id, name }, at } — a rep's own lead, first line
 * @param repName  Map id → name
 * @param adminName Map id → how an admin is named (their sign-in address)
 * @returns [{ at, type, repId, text, by }]
 */
export function signupAssignmentHistory({ claims = [], audits = [], prospect = null, prospectId = null, referred = null, repName = new Map(), adminName = new Map(), now = new Date() } = {}) {
  const events = [];
  const nameOf = (id) => repName.get(id) || "a rep";
  if (referred?.rep) {
    events.push({ at: time(referred.at), type: "referred", repId: referred.rep.id || null, text: `Came in on ${referred.rep.name || "a rep"}'s link — theirs`, by: null, rank: 0 });
  }
  const sorted = [...claims].filter((c) => time(c.claimedAt)).sort((a, b) => time(a.claimedAt) - time(b.claimedAt));
  for (const c of sorted) {
    const rep = nameOf(c.salesRepId);
    const at = time(c.claimedAt);
    const adminId = adminIdFromBatchId(c.batchId);
    const by = adminId ? adminName.get(adminId) || "a platform admin" : null;
    // A move: the previous holder's lease closed "reassigned" in the same
    // instant — or, for a WORKED row (whose claim is closed by workedAt and
    // is never released), the signup_reassigned audit row naming both reps.
    const movedFromId =
      sorted.find((o) => o !== c && o.salesRepId !== c.salesRepId && o.releaseReason === "reassigned" && sameInstant(time(o.releasedAt), at))?.salesRepId ||
      audits.find((a) => a.action === "signup_reassigned" && a.details?.prospectId === prospectId && a.details?.toRepId === c.salesRepId && sameInstant(time(a.details?.at), at))?.details?.fromRepId ||
      null;
    let text;
    if (movedFromId) text = `Reassigned from ${nameOf(movedFromId)} to ${rep}`;
    else if (c.mode === "admin" || c.mode === "reassigned") text = `Assigned to ${rep}`;
    else text = `Claimed by ${rep}`;
    events.push({ at, type: movedFromId ? "reassigned" : "assigned", repId: c.salesRepId, text, by, rank: 2 });

    const worked = time(c.workedAt);
    // A claim that opens already worked is a moved conversation, not a new one.
    if (worked && !sameInstant(worked, at)) events.push({ at: worked, type: "worked", repId: c.salesRepId, text: `${rep} worked it — spoke to them`, by: null, rank: 3 });

    const released = time(c.releasedAt);
    if (released) {
      const words = RELEASE_WORDS[c.releaseReason] || ((r) => `Released from ${r} (${c.releaseReason || "no reason recorded"})`);
      let releasedBy = null;
      let releaseText = words(rep);
      if (c.releaseReason === "admin") {
        // Who pressed it: the unassign audit row for this prospect and rep,
        // written in the same request — the nearest one at or after the release.
        const hit = audits
          .filter((a) => a.action === "leads_unassigned" && a.details?.repId === c.salesRepId && (a.details?.prospectIds || []).includes(prospectId))
          // `details.at` is the instant the claim was closed with (exact);
          // older rows have only createdAt, a moment after it.
          .map((a) => ({ a, d: (time(a.details?.at) || time(a.createdAt) || new Date(0)).getTime() - released.getTime() }))
          .filter((x) => x.d > -5000 && x.d < 10 * 60 * 1000)
          .sort((x, y) => Math.abs(x.d) - Math.abs(y.d))[0];
        if (hit?.a?.platformAdminId) releasedBy = adminName.get(hit.a.platformAdminId) || "a platform admin";
      }
      if (c.releaseReason === "reassigned") {
        const to = sorted.find((o) => o !== c && o.salesRepId !== c.salesRepId && sameInstant(time(o.claimedAt), released));
        // The "Reassigned from … to …" line above already says it when the
        // next claim is in hand; this line is only for a move whose new
        // claim is not.
        if (to) continue;
        releaseText = `Moved off ${rep} to another rep`;
      }
      events.push({ at: released, type: "released", repId: c.salesRepId, text: releaseText, by: releasedBy, reason: c.releaseReason || null, rank: 1 });
    } else if (!worked) {
      // Open and never worked: live, or a lease that ran out with nobody
      // closing the claim (the lease is the Prospect's; the log is only
      // closed by the paths that release). Lapsed when the row is no longer
      // this rep's, or is theirs under a LATER claim.
      const expiry = claimExpiryFrom(at);
      const stillThis =
        prospect?.assignedRepId === c.salesRepId &&
        heldBy(prospect, c.salesRepId, now) &&
        !sorted.some((o) => o !== c && o.salesRepId === c.salesRepId && time(o.claimedAt) > at);
      if (!stillThis && expiry.getTime() <= now.getTime()) {
        events.push({ at: expiry, type: "released", repId: c.salesRepId, text: RELEASE_WORDS.lapsed(rep), by: null, reason: "lapsed", rank: 1 });
      }
    }
  }
  return events
    .sort((a, b) => ((a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0)) || a.rank - b.rank)
    .map(({ rank, ...e }) => e);
}

/**
 * The histories for every floor row on a screen, in three reads: the claims,
 * the unassign audit rows since the oldest claim, and the names.
 *
 * @returns { histories: Map prospectId → events, repName }
 */
export async function loadSignupHistories({ client, prospects = [], referredById = new Map(), repName = new Map(), now = new Date() } = {}) {
  const ids = [...new Set(prospects.map((p) => p?.id).filter(Boolean))];
  const histories = new Map();
  if (!ids.length && referredById.size === 0) return { histories, repName };
  const claims = ids.length
    ? await client.salesQueueClaim.findMany({
        where: { prospectId: { in: ids } },
        orderBy: { claimedAt: "asc" },
        select: { prospectId: true, salesRepId: true, claimedAt: true, mode: true, batchId: true, workedAt: true, releasedAt: true, releaseReason: true },
      })
    : [];
  // Only the two console actions a claim cannot name the actor of, and only
  // since the oldest claim on the screen.
  const oldest = claims.reduce((m, c) => (!m || c.claimedAt < m ? c.claimedAt : m), null);
  const audits = oldest
    ? await client.platformAuditLog.findMany({
        where: { action: { in: ["leads_unassigned", "signup_reassigned"] }, createdAt: { gte: new Date(new Date(oldest).getTime() - 5000) } },
        orderBy: { createdAt: "asc" },
        take: 2000,
        select: { action: true, platformAdminId: true, details: true, createdAt: true },
      })
    : [];
  const missingReps = [...new Set(claims.map((c) => c.salesRepId).filter((id) => id && !repName.has(id)))];
  if (missingReps.length) {
    for (const r of await client.salesRep.findMany({ where: { id: { in: missingReps } }, select: { id: true, name: true } })) repName.set(r.id, r.name);
  }
  const adminIds = [...new Set([...claims.map((c) => adminIdFromBatchId(c.batchId)), ...audits.map((a) => a.platformAdminId)].filter(Boolean))];
  const adminName = new Map();
  if (adminIds.length) {
    for (const a of await client.platformAdmin.findMany({ where: { id: { in: adminIds } }, select: { id: true, email: true } })) adminName.set(a.id, a.email || adminDisplayName(a));
  }
  const byProspect = new Map();
  for (const c of claims) {
    if (!byProspect.has(c.prospectId)) byProspect.set(c.prospectId, []);
    byProspect.get(c.prospectId).push(c);
  }
  for (const p of prospects) {
    if (!p?.id) continue;
    histories.set(p.id, signupAssignmentHistory({ claims: byProspect.get(p.id) || [], audits, prospect: p, prospectId: p.id, referred: referredById.get(p.id) || null, repName, adminName, now }));
  }
  return { histories, repName };
}

// ═══════════════════════════════════════════════════════════════════════════
// Resolving a row on /platform/signups to its floor row — read only
// ═══════════════════════════════════════════════════════════════════════════

const PROSPECT_SELECT = {
  id: true, businessName: true, email: true, phoneE164: true, province: true, country: true, tradeKey: true, signupKind: true,
  assignedRepId: true, assignedAt: true, claimExpiresAt: true, doNotContactAt: true, doNotContactReason: true, mergedIntoId: true,
};

/**
 * The floor row behind a lead or a company, and what the actions need to
 * judge it — never written here: taking back a row with no floor row is a
 * no-op, not a reason to create one.
 */
export async function signupTargetFor({ client, leadId = null, companyId = null } = {}) {
  if (leadId) {
    const lead = await client.signupLead.findUnique({
      where: { id: leadId },
      select: { id: true, email: true, phoneE164: true, prospectId: true, promotedLeadId: true, referredRepId: true, ...DISMISSAL_SELECT },
    });
    if (!lead) return { error: "That signup no longer exists." };
    const prospect = lead.prospectId ? await client.prospect.findUnique({ where: { id: lead.prospectId }, select: PROSPECT_SELECT }) : null;
    return {
      prospect,
      // A rep's own lead: promoted on their link, their SalesLead written.
      referredRepId: lead.promotedLeadId && lead.referredRepId ? lead.referredRepId : null,
      dismissed: isDismissed(lead),
      emails: [lead.email, prospect?.email],
      phones: [lead.phoneE164, prospect?.phoneE164],
    };
  }
  if (companyId) {
    const company = await client.company.findUnique({
      where: { id: companyId },
      select: {
        id: true, email: true, phone: true, isDemo: true, referredByCode: true,
        salesAttribution: { select: { salesRepId: true } },
        members: { where: { role: "owner" }, take: 1, select: { user: { select: { email: true } } } },
        ...DISMISSAL_SELECT,
      },
    });
    if (!company || company.isDemo) return { error: "That company no longer exists." };
    const prospect = await client.prospect.findFirst({ where: { companyId: company.id, signupKind: { not: null } }, select: PROSPECT_SELECT });
    return {
      prospect,
      referredRepId: company.salesAttribution?.salesRepId || null,
      referredByCode: company.referredByCode || null,
      dismissed: isDismissed(company),
      emails: [company.email, company.members?.[0]?.user?.email, prospect?.email],
      phones: [company.phone, prospect?.phoneE164],
    };
  }
  return { error: "Pick a signup." };
}

// ═══════════════════════════════════════════════════════════════════════════
// Telling the rep
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "Emilio took back Luma Painting — it is off your queue." The same two
 * mechanisms notifyRepAssigned uses (a Web Push in the rep's language, best
 * effort, off the request path). The queue itself needs nothing: the row is
 * no longer assignedRepId = them, so it is gone from "Yours to work" on the
 * next read.
 */
export async function notifyRepTakenBack({ rep, admin, businessName = null, notify = null } = {}) {
  if (!rep?.id) return null;
  const push = notify?.push || (await import("@/lib/notify/push")).pushToReps;
  const sentence = notify?.appSentence || (await import("@/lib/notify/push")).appSentence;
  const promise = push({
    salesRepIds: [rep.id],
    payload: async (language) => ({
      title: await sentence(language, "app.salesToday.takenBackPushTitle"),
      body: await sentence(language, "app.salesToday.takenBackLine", { admin: adminDisplayName(admin), business: businessName || "—" }),
      tag: "sales-leads-taken-back",
      url: "/sales/queue",
    }),
  });
  if (notify?.push) return promise;
  void promise;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Take back to the platform
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "Assign it back to me, the platform." The rep's lease on the floor row is
 * released through unassignFromRep() — which is releaseUntouched() with
 * reason "admin", the ONE function that puts a Prospect back in the pool —
 * and the audit row names the admin. The row is the platform's again: in the
 * review folder when it may be rung, out of it when it may not.
 *
 * Idempotent: a row nobody holds (already the platform's, or never placed)
 * answers `already` and writes nothing.
 *
 * Refused: a rep's own signup (their link — commission hangs on it; move it
 * from the rep's page if it must move), and a WORKED row — a conversation is
 * not a lease (lib/sales/assignLeads.js); reassign it instead, which moves
 * the conversation with its history.
 */
export async function takeBackSignup({ client, admin, leadId = null, companyId = null, now = new Date(), notify = null } = {}) {
  if (!client) throw new Error("takeBackSignup needs a client");
  if (!admin?.id) throw new Error("takeBackSignup needs the admin doing it");
  const target = await signupTargetFor({ client, leadId, companyId });
  if (target.error) return { error: target.error, refused: true };
  if (target.referredRepId) {
    const owner = await client.salesRep.findUnique({ where: { id: target.referredRepId }, select: { name: true } }).catch(() => null);
    return { error: `Came in on ${owner?.name || "a rep"}'s link — it is theirs by attribution, not the platform's to take back.`, refused: true };
  }
  const p = target.prospect;
  if (!p || !p.assignedRepId || !heldBy(p, p.assignedRepId, now)) {
    return { already: true, takenBack: 0, prospectId: p?.id || null, note: p ? "Nobody holds it — it is already the platform's." : "No floor row yet — nobody holds it." };
  }
  const rep = await client.salesRep.findUnique({ where: { id: p.assignedRepId }, select: { id: true, name: true, email: true } });
  if (p.claimExpiresAt == null) {
    return { error: `Worked — ${rep?.name || "the rep"} spoke to them, and a conversation is not a lease. Reassign it to move it with its history.`, refused: true, worked: true };
  }
  const r = await unassignFromRep({ db: client, rep: rep || { id: p.assignedRepId }, admin, ids: [p.id], now, how: "signup_take_back" });
  if (r.error) return { error: r.error, refused: true };
  if (r.unassigned !== 1) return { error: r.refused?.[0]?.reason || "Changed hands before the take-back — nothing was written.", refused: true };
  await notifyRepTakenBack({ rep, admin, businessName: p.businessName, notify });
  return { takenBack: 1, prospectId: p.id, fromRep: { id: p.assignedRepId, name: rep?.name || null } };
}

// ═══════════════════════════════════════════════════════════════════════════
// Reassign to another rep
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Move a held signup row from its rep to another, in one transaction.
 *
 * The write is compare-and-set on the old holder (a row that changed hands
 * between the page and the press is not overwritten), closes the old rep's
 * open claim "reassigned" — which does NOT de-prioritise it for them; they
 * did not give it back — and opens the new rep's claim in mode "admin" with
 * the admin in its batchId, the shape the console's own assign writes, so
 * the day-end sweep protects it and the new rep's Today line says who sent
 * it. A lease gets a fresh 48 hours; a worked row stays worked
 * (lib/sales/reassign.js's rule for a move).
 *
 * A row nobody holds is not "re"-assigned: `unheld: true` tells the caller to
 * use the ordinary assign, which carries the folder's own guards.
 *
 * Every refusal the assign gives applies: do-not-contact (read fresh), a
 * removed row, a merged row, the language rule, an inactive target.
 */
export async function reassignSignup({ client, admin, rep, leadId = null, companyId = null, now = new Date(), notify = null } = {}) {
  if (!client) throw new Error("reassignSignup needs a client");
  if (!admin?.id) throw new Error("reassignSignup needs the admin doing it");
  if (!rep?.id) return { error: "Choose a rep to move it to.", refused: true };
  if (rep.active === false || rep.endedAt) return { error: "That rep is deactivated. Leads can only go to an active rep.", refused: true };
  const target = await signupTargetFor({ client, leadId, companyId });
  if (target.error) return { error: target.error, refused: true };
  if (target.referredRepId) {
    const owner = await client.salesRep.findUnique({ where: { id: target.referredRepId }, select: { name: true } }).catch(() => null);
    return { error: `Came in on ${owner?.name || "a rep"}'s link — it is already theirs.`, refused: true };
  }
  const p = target.prospect;
  if (!p || !p.assignedRepId || !heldBy(p, p.assignedRepId, now)) return { unheld: true, prospectId: p?.id || null };
  const fromRepId = p.assignedRepId;
  if (fromRepId === rep.id) return { error: `Already ${rep.name || "this rep"}'s.`, refused: true };
  if (target.dismissed) return { error: "Removed from the signups list — restore it first.", refused: true };
  if (p.mergedIntoId) return { error: "Merged into another record.", refused: true };
  const dnc = await signupDoNotContact({ client, emails: target.emails, phones: target.phones, prospect: p });
  if (dnc.dnc) return { error: `${dncSentence(dnc)}. Take it back to the platform instead.`, refused: true, doNotContact: true };
  if (!repCanTake(rep, p)) {
    return { error: requiredLanguageFor(p) === "fr" ? `In Quebec — ${rep.name || "this rep"} does not sell in French.` : `Outside Quebec — ${rep.name || "this rep"} does not sell in English.`, refused: true };
  }

  const worked = p.claimExpiresAt == null;
  const zone = await lastKnownZoneFor({ db: client, salesRepId: rep.id, now });
  const localDate = localDateIn(zone, now) || now.toISOString().slice(0, 10);
  const last = await client.salesQueueClaim.aggregate({ where: { salesRepId: rep.id, releasedAt: null, workedAt: null }, _max: { position: true } });
  const position = Number.isInteger(last?._max?.position) ? last._max.position + 1 : 0;
  const batchId = assignBatchId({ adminId: admin.id, at: now });

  const won = await client.$transaction(async (tx) => {
    const moved = await tx.prospect.updateMany({
      where: { id: p.id, assignedRepId: fromRepId, claimExpiresAt: worked ? null : { not: null } },
      data: { assignedRepId: rep.id, assignedAt: now, ...(worked ? {} : { claimExpiresAt: claimExpiryFrom(now) }) },
    });
    if (moved.count === 0) return false;
    // The open lease only — a worked claim is closed by its workedAt and
    // stays as it is, the convention lib/sales/reassign.js's move keeps;
    // the history names the move from the audit row below.
    await tx.salesQueueClaim.updateMany({
      where: { prospectId: p.id, salesRepId: fromRepId, releasedAt: null, workedAt: null },
      data: { releasedAt: now, releaseReason: "reassigned" },
    });
    await tx.salesQueueClaim.create({
      data: { salesRepId: rep.id, prospectId: p.id, claimedAt: now, mode: ASSIGN_MODE, batchId, position, repTimeZone: zone, localDate, workedAt: worked ? now : null },
    });
    return true;
  });
  if (!won) return { error: "Changed hands just now — nothing was written. Refresh and try again.", refused: true };

  await client.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "signup_reassigned",
      details: { prospectId: p.id, fromRepId, toRepId: rep.id, repEmail: rep.email || null, worked, batchId, at: now.toISOString() },
    },
  });
  const fromRep = await client.salesRep.findUnique({ where: { id: fromRepId }, select: { id: true, name: true } }).catch(() => null);
  await notifyRepAssigned({ db: client, rep, admin, count: 1, tradeKey: p.tradeKey || null, province: p.province || null, notify });
  await notifyRepTakenBack({ rep: fromRep || { id: fromRepId }, admin, businessName: p.businessName, notify });
  return { reassigned: 1, prospectId: p.id, fromRep: { id: fromRepId, name: fromRep?.name || null }, rep: { id: rep.id, name: rep.name } };
}
