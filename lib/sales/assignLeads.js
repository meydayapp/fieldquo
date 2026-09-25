// lib/sales/assignLeads.js
//
// The platform console handing a rep their next leads — and taking them back.
//
// ══ The owner's question ══════════════════════════════════════════════════
//
// "Can I assign the next leads to the sales rep from /platform?" Until this
// file the answer was no: claiming was rep-side only, one press on the
// rep's own screen, and the console could release a queue or move it to
// another rep (lib/sales/reassign.js) but never fill one.
//
// ══ The rule that decides everything here: the SAME next leads ════════════
//
// "The next leads" has a precise meaning in this product. lib/sales/
// queueBatch.js's header spends four sections on it: the calling window
// open NOW and inside the rep's shift, a due retry before a fresh row, the
// best-window score, researched before unresearched, the pool's own order,
// the language rule (a Quebec row only to a rep who sells in French), the
// do-not-contact flag, the retry pool, the daily cap. A console copy of
// that — even a faithful one — would be the copy that rots, because it is
// the one nobody dials from. So assignBatchToRep() below calls
// selectClaimBatch() and writeClaimBatch(), the two halves the rep's own
// "Claim the next 25" is composed of, imported by name. What the console
// adds is a NARROWING (a province, one of the rep's languages), AND-ed onto
// the same WHERE; it never widens what the rep could have claimed
// themselves. scripts/check-sales-assign.mjs holds the import to the file.
//
// ══ Hand-picked rows, and why they are refused row by row ═════════════════
//
// assignProspectsToRep() is the prospects list's checkboxes: a superadmin
// looking at a row and saying "Rachel, this one". Those rows were not
// chosen by the selection, so each is judged by the same predicates the
// selection is built from — assignRefusalFor(), pure — and the ones that
// fail are returned with the reason in words ("claimed by Daniel until…",
// "in Quebec — Rachel does not sell in French", "do not contact"). Row by
// row rather than all-or-nothing, the opposite of reassign.js's Move: a
// Move that left half a leaving rep's work behind would strand it, whereas
// a hand-pick that assigns eight of ten and names the two it would not is
// exactly what the person clicking wants to read.
//
// ══ Taking back ═══════════════════════════════════════════════════════════
//
// unassignFromRep() is lib/sales/queueBatch.js's releaseUntouched() with
// `reason: "admin"` and `onlyIds` — the ONE function that puts a Prospect
// back in the pool, the same one behind the rep's own button, the hourly
// sweep and the console's "Release all held". Nothing here writes
// `assignedRepId: null` of its own. A worked row (claimExpiresAt null — "a
// real conversation is not a lease") is not released and the answer says
// so per row.
//
// ══ What a console assignment writes, and how the sweeps read it ══════════
//
// The same Prospect columns the rep's claim writes (assignedRepId,
// assignedAt, claimExpiresAt — 48 hours) and the same SalesQueueClaim rows,
// with `mode: "admin"` and a batchId naming the admin
// (`assigned_by:<platformAdminId>:<instant>`), the way a reassignment's
// batchId names the rep it came from. The mode is what
// queueBatch.autoReleaseProtected() reads: the day-end sweep and the
// closed-window release leave a console assignment alone on the day it was
// made and the next, because the rep may not have been at their desk when
// it was made. The zone on the claim is the rep's LAST KNOWN browser zone
// (their most recent claim's), so the day is judged where they are; a rep
// who has never claimed is judged in UTC, the only day anybody can name.
//
// Every assignment and every unassignment writes a PlatformAuditLog row
// (`leads_assigned` / `leads_unassigned`, worded in lib/platform/
// auditActions.js) with the rep, the trade, the filters and the prospect
// ids — the row is how the rep, or the owner a week later, reads why a
// queue filled or emptied without a press.
//
// ══ Telling the rep ═══════════════════════════════════════════════════════
//
// A rep who did not press anything has to hear that their list changed.
// Two mechanisms the portal already has, and no new one: a Web Push through
// lib/notify/push.js's pushToReps (best-effort, off the request path, in
// the rep's language — the same call the payout notice makes), and a line
// on the Today screen read from adminAssignedSummary() by GET /api/sales/
// queue: "Emilio assigned you 25 flooring leads (Quebec) — open the queue".
// The queue's own "Yours to work" list needs nothing: it lists every row
// where assignedRepId is the rep, whoever wrote it.
//
// ══ Why the db is a parameter ═════════════════════════════════════════════
//
// Same reason queueBatch.js gives: scripts/check-sales-assign.mjs runs every
// function here against a scripted db under bare node. The routes pass the
// real one. Nothing here imports from next or React.

import { DISCOVERY_TRADES, discoveryTradeKeys } from "./discovery/trades";
import { SUBDIVISION_TIME_ZONES, subdivisionOptions } from "./callingRules";
import { effectiveSellsIn, languageExcludedWhereFor, repCanTake, requiredLanguageFor } from "./leadLanguage";
import { CLAIMABLE_STATUSES, claimCandidateWhere, claimExpiryFrom, claimState, queueWhere } from "./prospectView";
import {
  BATCH_REASON_KEYS,
  QUEUE_BATCH_MAX,
  assignFilterWhere,
  batchShortfallReason,
  localDateIn,
  releaseUntouched,
  selectClaimBatch,
  shiftEndFrom,
  shiftStartFor,
  usableTimeZone,
  writeClaimBatch,
} from "./queueBatch";

/** The claim-log mode a console assignment is written with. */
export const ASSIGN_MODE = "admin";
/**
 * The audit actions this file writes; lib/platform/auditActions.js words
 * them. The writes below spell the literal beside `action:` rather than
 * these names because scripts/check-platform-truth.mjs reads the literal
 * — a constant would read as "an action nothing writes".
 */
export const AUDIT_LEADS_ASSIGNED = "leads_assigned";
export const AUDIT_LEADS_UNASSIGNED = "leads_unassigned";

const when = (v) => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (v == null) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** The batchId a console assignment carries: who did it, and when. */
export function assignBatchId({ adminId, at = new Date() } = {}) {
  return `assigned_by:${adminId || "unknown"}:${(when(at) || new Date()).getTime().toString(36)}`;
}

/** The admin id back out of an assignBatchId(), or null for any other batch. */
export function adminIdFromBatchId(batchId) {
  const m = typeof batchId === "string" && batchId.match(/^assigned_by:([^:]+):[0-9a-z]+$/);
  return m && m[1] !== "unknown" ? m[1] : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// What the panel offers: pool counts, provinces, languages
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Per-trade counts for THIS rep: what they hold, and what the pool would
 * offer them. The same two counts the rep's own ClaimCard reads from GET
 * /api/sales/queue — `claimCandidateWhere({ tradeKey: key, now, rep })`,
 * with the rep, so a Quebec row an anglophone rep cannot be handed is not
 * "available" here either. The rep's route asks the same WHERE once,
 * grouped by trade (its tradeKey dropped for the GROUP BY); the check
 * holds both sites to it.
 */
export async function poolCountsFor({ db, rep, now = new Date() } = {}) {
  if (!db || !rep?.id) throw new Error("poolCountsFor needs a db and a rep");
  return Promise.all(
    discoveryTradeKeys().map(async (key) => {
      const [held, available] = await Promise.all([
        db.prospect.count({ where: { ...queueWhere(rep.id, { now }), tradeKey: key } }),
        db.prospect.count({ where: claimCandidateWhere({ tradeKey: key, now, rep }) }),
      ]);
      return { key, label: DISCOVERY_TRADES[key].label, held, available };
    }),
  );
}

/**
 * The province filter's options, from the calling-rules table, and the
 * language filter's, from the rep's own selling languages — the console may
 * narrow to one of THEM, never to a language the rep has not stated.
 */
export function assignOptionsFor(rep) {
  return {
    provinces: subdivisionOptions(),
    languages: effectiveSellsIn(rep),
    batchMax: QUEUE_BATCH_MAX,
  };
}

/**
 * Validate what the console asked for, against what the rep may be handed.
 * Pure. `{ error }` for a refusal, else the cleaned request.
 */
export function assignRequest({ rep, tradeKey, count = QUEUE_BATCH_MAX, province = null, language = null } = {}) {
  if (!rep?.id) return { error: "Choose a rep to assign to." };
  if (rep.active === false) return { error: "That rep is deactivated. Leads can only be assigned to an active rep." };
  const trade = typeof tradeKey === "string" ? tradeKey.trim() : "";
  if (!DISCOVERY_TRADES[trade]) return { error: "Choose a trade. A queue is one trade." };
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) return { error: "How many? At least one." };
  const code = typeof province === "string" && province.trim() ? province.trim().toUpperCase() : null;
  if (code && !SUBDIVISION_TIME_ZONES[code]) return { error: `"${province}" is not a province or state the calling rules know.` };
  const lang = typeof language === "string" && language.trim() ? language.trim().toLowerCase() : null;
  if (lang && !effectiveSellsIn(rep).includes(lang)) {
    return {
      error: `${rep.name || "That rep"} does not sell in "${lang}". Set it under "Sells in" on their card first, or leave the language open.`,
    };
  }
  return { tradeKey: trade, count: Math.min(n, QUEUE_BATCH_MAX), province: code, language: lang };
}

/**
 * The zone the rep's browser last reported with a claim, or null. The
 * console has no browser zone for somebody else; this is the best-known
 * one, and the day-end sweep judges the assignment in it.
 */
export async function lastKnownZoneFor({ db, salesRepId, now = new Date() } = {}) {
  if (!salesRepId || typeof db?.salesQueueClaim?.findFirst !== "function") return null;
  const row = await db.salesQueueClaim.findFirst({
    where: { salesRepId, repTimeZone: { not: null } },
    orderBy: { claimedAt: "desc" },
    select: { repTimeZone: true },
  });
  return usableTimeZone(row?.repTimeZone, now);
}

// ═══════════════════════════════════════════════════════════════════════════
// The batch: the rep's own selection, narrowed
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hand a rep the next `count` leads of one trade — the rows the rep's own
 * "Claim the next 25" would have handed them at this instant, optionally
 * narrowed to a province and to one of the rep's languages.
 *
 * Caps: `count` at QUEUE_BATCH_MAX, and nothing on the day — the daily
 * ceiling went on 2026-09-14 (see queueBatch.js at SHIFT_HOURS). The shift
 * bound is the rep's real one
 * (shiftStartFor reads their Available ledger), so the console cannot hand
 * them a row that opens after they have gone home any more than they could
 * take one.
 *
 * @returns `{ assigned, assignedIds, researched, unresearched,
 *            skippedForWindow, skippedForLanguage, reason,
 *            reasonKey, nextOpensAt, batchId, timeZone }` — the rep's own
 *            result shape, so the console can say the same sentence.
 */
export async function assignBatchToRep({
  db,
  rep,
  admin,
  tradeKey,
  count = QUEUE_BATCH_MAX,
  province = null,
  language = null,
  now = new Date(),
  policyContext = null,
  // Injected by the check; the route lets the defaults import lazily.
  notify = null,
} = {}) {
  if (!db) throw new Error("assignBatchToRep needs a db");
  if (!admin?.id) throw new Error("assignBatchToRep needs the admin doing it");
  const request = assignRequest({ rep, tradeKey, count, province, language });
  if (request.error) return { error: request.error };

  const zone = await lastKnownZoneFor({ db, salesRepId: rep.id, now });
  const localDate = localDateIn(zone, now) || now.toISOString().slice(0, 10);
  const shiftStart = await shiftStartFor({ db, salesRepId: rep.id, timeZone: zone, now });
  const shiftEnd = shiftEndFrom({ shiftStart, now });

  const filters = assignFilterWhere({ province: request.province, language: request.language });
  // What the language rule kept from this rep inside the slice asked for —
  // the "3 not offered (language)" in the result line. Counted against the
  // unrestricted pool AND the province narrowing, never the language one:
  // that one is the console's own choice, not a rule.
  const excluded = languageExcludedWhereFor(rep);
  const provinceOnly = assignFilterWhere({ province: request.province });
  const skippedForLanguage = excluded
    ? await db.prospect.count({
        where: { AND: [claimCandidateWhere({ tradeKey: request.tradeKey, now }), ...provinceOnly, excluded] },
      })
    : 0;
  const empty = (reason, extra = {}) => ({
    assigned: 0,
    assignedIds: [],
    researched: 0,
    unresearched: 0,
    skippedForWindow: 0,
    skippedForLanguage,
    reason,
    reasonKey: BATCH_REASON_KEYS[reason] || null,
    nextOpensAt: null,
    batchId: null,
    timeZone: zone,
    tradeKey: request.tradeKey,
    province: request.province,
    language: request.language,
    ...extra,
  });
  const want = Math.min(request.count, QUEUE_BATCH_MAX);
  if (want <= 0) return empty("pool_empty");

  const { candidates, picked } = await selectClaimBatch({
    db,
    rep,
    tradeKey: request.tradeKey,
    now,
    shiftEnd,
    want,
    policyContext,
    filters,
  });
  if (!picked) return empty("pool_empty");
  if (picked.ids.length === 0) return empty("none_open_now", { nextOpensAt: picked.nextOpensAt });

  const at = now;
  const batchId = assignBatchId({ adminId: admin.id, at });
  const won = await writeClaimBatch({
    db,
    rep,
    tradeKey: request.tradeKey,
    picked,
    at,
    zone,
    localDate,
    batchId,
    mode: ASSIGN_MODE,
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const researched = won.filter((id) => byId.get(id)?.researched).length;
  const reason = batchShortfallReason({ won: won.length, want, picked });

  if (won.length > 0) {
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "leads_assigned",
        details: {
          repId: rep.id,
          repEmail: rep.email || null,
          tradeKey: request.tradeKey,
          count: won.length,
          asked: request.count,
          province: request.province,
          language: request.language,
          prospectIds: won,
          batchId,
          how: "batch",
        },
      },
    });
    await notifyRepAssigned({
      db,
      rep,
      admin,
      count: won.length,
      tradeKey: request.tradeKey,
      province: request.province,
      notify,
    });
  }

  return {
    assigned: won.length,
    assignedIds: won,
    researched,
    unresearched: won.length - researched,
    skippedForWindow: picked.skippedForWindow,
    skippedForLanguage,
    reason,
    reasonKey: reason ? BATCH_REASON_KEYS[reason] : null,
    nextOpensAt: reason === "partial_open" ? picked.nextOpensAt : null,
    batchId: won.length ? batchId : null,
    timeZone: zone,
    tradeKey: request.tradeKey,
    province: request.province,
    language: request.language,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Hand-picked rows
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Why THIS row may not be handed to THIS rep right now, in words — or null
 * when it may. Pure: the same predicates claimCandidateWhere() puts in the
 * database, asked of a row already in hand, so the sentence can name what
 * the WHERE would silently have skipped.
 *
 * `prospect` carries `assignedRep: { name }` when held, for "claimed by
 * Daniel". A row that is already the rep's is refused too — assigning what
 * they hold would re-issue a lease they have and write a second claim row.
 */
export function assignRefusalFor(prospect, rep, { now = new Date() } = {}) {
  if (!prospect) return "This prospect no longer exists.";
  if (when(prospect.doNotContactAt)) return "Do not contact — a human said never to ring this business.";
  if (!CLAIMABLE_STATUSES.includes(prospect.status)) {
    return prospect.status === "rejected"
      ? "Rejected by a human — held out of every queue."
      : "Needs review — held out of every queue until somebody confirms it.";
  }
  if (!prospect.tradeKey || !DISCOVERY_TRADES[prospect.tradeKey]) {
    return "No trade on this record — it is in the Review folder, and a queue is one trade.";
  }
  const claim = claimState(prospect, { repId: rep?.id || null, now });
  if (claim.state === "mine" || claim.state === "mine_worked") return `Already ${rep?.name || "this rep"}'s.`;
  if (claim.state === "held" || claim.state === "held_worked") {
    const who = prospect.assignedRep?.name || "another rep";
    return claim.state === "held_worked"
      ? `Worked by ${who} — a conversation is not a lease, so it does not lapse.`
      : `Claimed by ${who}${claim.expiresAt ? ` until ${claim.expiresAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}.`;
  }
  if (!repCanTake(rep, prospect)) {
    const need = requiredLanguageFor(prospect);
    return need === "fr"
      ? `In Quebec — ${rep?.name || "this rep"} does not sell in French.`
      : `Outside Quebec — ${rep?.name || "this rep"} does not sell in English.`;
  }
  const exhausted = when(prospect.exhaustedAt);
  if (exhausted) return "Exhausted by the retry rules — recycle it from the retry pool first.";
  const next = when(prospect.nextAttemptAt);
  if (next && next.getTime() >= now.getTime()) {
    return `Not before ${next.toISOString().slice(0, 16).replace("T", " ")} UTC — a retry or a callback is scheduled.`;
  }
  return null;
}

/** The `select` assignProspectsToRep reads a candidate row with. */
export function pickedSelect() {
  return {
    id: true,
    businessName: true,
    tradeKey: true,
    province: true,
    status: true,
    doNotContactAt: true,
    assignedRepId: true,
    assignedAt: true,
    claimExpiresAt: true,
    nextAttemptAt: true,
    exhaustedAt: true,
  };
}

/**
 * Put `assignedRep: { name }` on each row from its assignedRepId.
 *
 * Prospect.assignedRepId is a plain column with NO relation on the model
 * (the schema says why beside the field), so selecting the relation is
 * not a thing Prisma will run — it refuses the whole findMany, which is how
 * the console's hand-pick assignment and the prospects list both answered
 * 500 on 2026-09-15 (the scripted db in the checks never validates a
 * select, so nothing caught it). One lookup by id, every rep including a
 * deactivated one — a live claim held by someone who has since left still
 * has a name.
 */
export async function withHolderNames(db, rows) {
  const ids = [...new Set(rows.map((r) => r.assignedRepId).filter(Boolean))];
  if (ids.length === 0) return rows.map((r) => ({ ...r, assignedRep: null }));
  const reps = await db.salesRep.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
  const byId = new Map(reps.map((r) => [r.id, { name: r.name }]));
  return rows.map((r) => ({ ...r, assignedRep: (r.assignedRepId && byId.get(r.assignedRepId)) || null }));
}

/**
 * Hand a rep the rows a superadmin ticked. Each is judged by
 * assignRefusalFor(); the ones that pass are leased in one transaction,
 * each write guarded by claimCandidateWhere() for ITS trade so a row that
 * changed hands between the read and the write is refused by Postgres and
 * reported as such. Claim rows continue the rep's own open `position` order,
 * the way a reassignment does, so hand-picked rows dial after what the rep
 * already had.
 *
 * @returns `{ assigned, assignedIds, refused: [{ id, businessName, reason }],
 *            batchId }` or `{ error }`.
 */
export async function assignProspectsToRep({ db, rep, admin, ids = [], now = new Date(), notify = null } = {}) {
  if (!db) throw new Error("assignProspectsToRep needs a db");
  if (!admin?.id) throw new Error("assignProspectsToRep needs the admin doing it");
  if (!rep?.id) return { error: "Choose a rep to assign to." };
  if (rep.active === false) return { error: "That rep is deactivated. Leads can only be assigned to an active rep." };
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((v) => typeof v === "string" && v.length > 0))].slice(0, 200);
  if (wanted.length === 0) return { error: "Tick at least one prospect." };

  const zone = await lastKnownZoneFor({ db, salesRepId: rep.id, now });
  const localDate = localDateIn(zone, now) || now.toISOString().slice(0, 10);
  const [rows, last] = await Promise.all([
    db.prospect.findMany({ where: { id: { in: wanted } }, select: pickedSelect() }).then((r) => withHolderNames(db, r)),
    db.salesQueueClaim.aggregate({
      where: { salesRepId: rep.id, releasedAt: null, workedAt: null },
      _max: { position: true },
    }),
  ]);
  const byId = new Map(rows.map((r) => [r.id, r]));

  const refused = [];
  const accepted = [];
  for (const id of wanted) {
    const row = byId.get(id) || null;
    const reason = assignRefusalFor(row, rep, { now });
    if (reason) refused.push({ id, businessName: row?.businessName || null, reason });
    else accepted.push(row);
  }
  // No daily ceiling (queueBatch.js at SHIFT_HOURS): every row the rules
  // accepted is handed over.
  const room = accepted;
  if (room.length === 0) {
    return { assigned: 0, assignedIds: [], refused, batchId: null };
  }

  const at = now;
  const batchId = assignBatchId({ adminId: admin.id, at });
  const startPosition = Number.isInteger(last?._max?.position) ? last._max.position + 1 : 0;
  const won = await db.$transaction(async (tx) => {
    const ordered = [];
    for (const row of room) {
      // Guarded by the trade's own candidate WHERE, the rep included: the
      // language rule and the lease clause decide in Postgres, not here.
      await tx.prospect.updateMany({
        where: { id: row.id, ...claimCandidateWhere({ tradeKey: row.tradeKey, now: at, rep }) },
        data: { assignedRepId: rep.id, assignedAt: at, claimExpiresAt: claimExpiryFrom(at) },
      });
    }
    const winners = await tx.prospect.findMany({
      where: { id: { in: room.map((r) => r.id) }, assignedRepId: rep.id, assignedAt: at },
      select: { id: true },
    });
    const wonIds = new Set(winners.map((w) => w.id));
    for (const row of room) if (wonIds.has(row.id)) ordered.push(row.id);
    if (ordered.length > 0) {
      await tx.salesQueueClaim.createMany({
        data: ordered.map((prospectId, i) => ({
          salesRepId: rep.id,
          prospectId,
          claimedAt: at,
          mode: ASSIGN_MODE,
          batchId,
          position: startPosition + i,
          repTimeZone: zone,
          localDate,
        })),
      });
    }
    return ordered;
  });
  const wonSet = new Set(won);
  for (const row of room) {
    if (!wonSet.has(row.id)) {
      refused.push({ id: row.id, businessName: row.businessName, reason: "Claimed by another rep just now." });
    }
  }

  if (won.length > 0) {
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "leads_assigned",
        details: {
          repId: rep.id,
          repEmail: rep.email || null,
          tradeKey: null,
          count: won.length,
          asked: wanted.length,
          province: null,
          language: null,
          prospectIds: won,
          refused: refused.length,
          batchId,
          how: "picked",
        },
      },
    });
    // The trade and the province the push names: only when the rows agree
    // on one — a mixed hand-pick is "25 leads", never a guessed trade.
    const trades = new Set(room.filter((r) => wonSet.has(r.id)).map((r) => r.tradeKey));
    const provinces = new Set(room.filter((r) => wonSet.has(r.id)).map((r) => r.province || null));
    await notifyRepAssigned({
      db,
      rep,
      admin,
      count: won.length,
      tradeKey: trades.size === 1 ? [...trades][0] : null,
      province: provinces.size === 1 ? [...provinces][0] : null,
      notify,
    });
  }

  return {
    assigned: won.length,
    assignedIds: won,
    refused,
    batchId: won.length ? batchId : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Taking back
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Put ticked rows a rep holds back in the pool. releaseUntouched() with
 * `includeDialled` — the console is taking the row back whether or not the
 * rep dialled it; the attempts and notes stay on the prospect — and
 * `onlyIds`, so nothing else the rep holds moves. A worked row is not a
 * lease and is reported, not released; a row somebody else holds, or nobody
 * does, likewise.
 */
export async function unassignFromRep({ db, rep, admin, ids = [], now = new Date(), how = null } = {}) {
  if (!db) throw new Error("unassignFromRep needs a db");
  if (!admin?.id) throw new Error("unassignFromRep needs the admin doing it");
  if (!rep?.id) return { error: "Choose the rep to take the leads back from." };
  const wanted = [...new Set((Array.isArray(ids) ? ids : []).filter((v) => typeof v === "string" && v.length > 0))].slice(0, 200);
  if (wanted.length === 0) return { error: "Tick at least one prospect." };

  const rows = await withHolderNames(
    db,
    await db.prospect.findMany({
      where: { id: { in: wanted } },
      select: { id: true, businessName: true, assignedRepId: true, claimExpiresAt: true },
    }),
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  const refused = [];
  const candidates = [];
  for (const id of wanted) {
    const row = byId.get(id);
    if (!row) refused.push({ id, businessName: null, reason: "This prospect no longer exists." });
    else if (row.assignedRepId !== rep.id) {
      refused.push({
        id,
        businessName: row.businessName,
        reason: row.assignedRepId ? `Held by ${row.assignedRep?.name || "another rep"}, not ${rep.name || "this rep"}.` : "Not held by anybody — already in the pool.",
      });
    } else if (row.claimExpiresAt == null) {
      refused.push({ id, businessName: row.businessName, reason: "Worked — a conversation is not a lease, so it stays with the rep." });
    } else candidates.push(row.id);
  }
  let released = { released: 0, releasedIds: [] };
  if (candidates.length > 0) {
    released = await releaseUntouched({ db, rep, reason: "admin", onlyIds: candidates, includeDialled: true, now });
    const releasedSet = new Set(released.releasedIds);
    for (const id of candidates) {
      if (!releasedSet.has(id)) {
        refused.push({ id, businessName: byId.get(id)?.businessName || null, reason: "Changed hands before the release — nothing was written." });
      }
    }
  }
  if (released.released > 0) {
    await db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "leads_unassigned",
        details: {
          repId: rep.id,
          repEmail: rep.email || null,
          count: released.released,
          asked: wanted.length,
          prospectIds: released.releasedIds,
          refused: refused.length,
          // Which screen took it back ("signup_take_back" from
          // /platform/signups, lib/signup/assignment.js), and the instant
          // the claim rows were closed with — the signup history matches
          // the release to this row by it.
          ...(how ? { how } : {}),
          at: now.toISOString(),
        },
      },
    });
  }
  return { unassigned: released.released, unassignedIds: released.releasedIds, refused };
}

// ═══════════════════════════════════════════════════════════════════════════
// Telling the rep
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The push. Best-effort and never awaited for its outcome: lib/notify/
 * push.js swallows and records its own failures, and the assignment is
 * already written. The sentence is looked up in the rep's language through
 * the same appSentence the payout notice uses.
 */
export async function notifyRepAssigned({ db, rep, admin, count, tradeKey = null, province = null, notify = null } = {}) {
  const push = notify?.push || (await import("@/lib/notify/push")).pushToReps;
  const sentence = notify?.appSentence || (await import("@/lib/notify/push")).appSentence;
  const adminName = adminDisplayName(admin);
  const tradeLabel = tradeKey && DISCOVERY_TRADES[tradeKey] ? DISCOVERY_TRADES[tradeKey].label : null;
  const where = provinceName(province);
  const promise = push({
    salesRepIds: [rep.id],
    payload: async (language) => ({
      title: await sentence(language, "app.salesToday.assignedPushTitle"),
      body: await sentence(language, tradeLabel ? "app.salesToday.assignedLine" : "app.salesToday.assignedLineNoTrade", {
        admin: adminName,
        count: await sentence(language, "app.salesToday.assignedCount", { value: count }),
        trade: tradeLabel || "",
        // "(Flooring, Quebec)" beside a trade; " · Quebec" without one — the
        // same shape the Today line draws.
        where: where ? `${tradeLabel ? ", " : " · "}${where}` : "",
      }),
      tag: "sales-leads-assigned",
      url: "/sales/queue",
    }),
  });
  // Fire-and-forget on the request path; awaited by the check, which injects
  // a push that resolves at once.
  if (notify?.push) return promise;
  void promise;
  return null;
}

/**
 * "Emilio Boves" from a PlatformAdmin row. PlatformAdmin has no name column
 * — only a sign-in email — so the local part is read as a name: split on
 * dots, underscores and hyphens, each piece capitalised. "emilio.boves" →
 * "Emilio Boves"; "ops" → "Ops". A row with neither is "FieldQuo", which is
 * who the rep is actually hearing from.
 */
export function adminDisplayName(admin) {
  if (admin?.name && String(admin.name).trim()) return String(admin.name).trim();
  const email = typeof admin?.email === "string" ? admin.email.trim() : "";
  const local = email.includes("@") ? email.slice(0, email.indexOf("@")) : "";
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.length ? words.join(" ") : "FieldQuo";
}

/** A subdivision code's name from the calling-rules table, else the code, else null. */
export function provinceName(code) {
  if (typeof code !== "string" || !code.trim()) return null;
  const c = code.trim().toUpperCase();
  return subdivisionOptions().find((o) => o.code === c)?.name || code.trim();
}

/**
 * What the Today screen says: how many rows the rep holds from a console
 * assignment, and the latest such assignment (who, how many, which trade,
 * where, when). Null when there is none open — the card renders nothing
 * rather than "0 assigned".
 *
 * Read from the claim log by mode, joined to the prospect so a row that
 * lapsed or went back is not counted; the admin's name from the batchId.
 */
export async function adminAssignedSummary({ db, salesRepId, now = new Date() } = {}) {
  if (!db || !salesRepId) return null;
  const open = await db.salesQueueClaim.findMany({
    where: { salesRepId, mode: ASSIGN_MODE, releasedAt: null, workedAt: null },
    orderBy: [{ claimedAt: "desc" }, { position: "asc" }],
    take: 500,
    select: {
      batchId: true,
      claimedAt: true,
      prospect: { select: { assignedRepId: true, claimExpiresAt: true, tradeKey: true, province: true } },
    },
  });
  const held = open.filter(
    (c) => c.prospect?.assignedRepId === salesRepId && (c.prospect.claimExpiresAt == null || c.prospect.claimExpiresAt.getTime() > now.getTime()),
  );
  if (held.length === 0) return null;
  const latestBatch = held[0].batchId;
  const latest = held.filter((c) => c.batchId === latestBatch);
  const trades = new Set(latest.map((c) => c.prospect.tradeKey || null));
  const provinces = new Set(latest.map((c) => c.prospect.province || null));
  const adminId = adminIdFromBatchId(latestBatch);
  let adminName = "FieldQuo";
  if (adminId && typeof db.platformAdmin?.findUnique === "function") {
    const row = await db.platformAdmin.findUnique({ where: { id: adminId }, select: { email: true } });
    if (row) adminName = adminDisplayName(row);
  }
  const tradeKey = trades.size === 1 ? [...trades][0] : null;
  const province = provinces.size === 1 ? [...provinces][0] : null;
  return {
    held: held.length,
    latest: {
      count: latest.length,
      at: held[0].claimedAt?.toISOString?.() || null,
      adminName,
      tradeKey,
      tradeLabel: tradeKey && DISCOVERY_TRADES[tradeKey] ? DISCOVERY_TRADES[tradeKey].label : null,
      province,
      provinceName: provinceName(province),
    },
  };
}
