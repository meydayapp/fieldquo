#!/usr/bin/env node
//
// scripts/check-sales-assign.mjs
//
//   npm run check:sales-assign
//
// The platform console handing a rep leads — executed, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. ONE selection. The rep's claim (lib/sales/queueBatch.js claimBatch)
//      and the console's assign (lib/sales/assignLeads.js assignBatchToRep)
//      both go through selectClaimBatch() and writeClaimBatch(), by import
//      — grep-proved on both files — and against the same scripted pool at
//      the same instant they hand the same rep the same rows in the same
//      order. The console's narrowing (province, language) only ever
//      shrinks that set.
//   2. Caps. `count` is held to QUEUE_BATCH_MAX and to nothing else: a rep
//      with 300 claims in today's log is handed the next batch like anyone.
//   3. Refusals, per row: do-not-contact, needs review, no trade, held by
//      another rep (naming them), worked by another rep, already the rep's,
//      the language rule both ways, exhausted, a scheduled retry — each the
//      sentence the screen prints — and a row that changed hands between
//      the read and the write is reported as such, not assigned.
//   4. Unassign is releaseUntouched with reason "admin": nothing here writes
//      `assignedRepId: null` of its own; a worked row and another rep's row
//      are refused with why.
//   5. Audit rows: leads_assigned / leads_unassigned, in the catalogue, with
//      the rep, the trade, the filters and the prospect ids.
//   6. The rep hears: the push is sent to the rep alone, in the rep's
//      language, and the queue GET's adminAssignedSummary names the admin,
//      the count, the trade and the province.
//   7. The sweeps leave a console assignment alone on its day and the next
//      (autoReleaseProtected), and not a day longer.
//   8. Routes and screen: both routes are superadmin-only by the literal
//      role check, the reps and prospects screens derive isSuperadmin from
//      the shared hook, the prospects list carries the reps and the holder.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSIGN_MODE,
  AUDIT_LEADS_ASSIGNED,
  AUDIT_LEADS_UNASSIGNED,
  adminAssignedSummary,
  adminDisplayName,
  adminIdFromBatchId,
  assignBatchId,
  assignBatchToRep,
  assignOptionsFor,
  assignProspectsToRep,
  assignRefusalFor,
  assignRequest,
  poolCountsFor,
  provinceName,
  unassignFromRep,
} from "@/lib/sales/assignLeads";
import {
  CLAIM_OPENS_WITHIN_MS,
  QUEUE_BATCH_MAX,
  RELEASE_REASONS,
  assignFilterWhere,
  autoReleaseProtected,
  claimBatch,
  releaseClosedUntouched,
  releaseDayEnded,
} from "@/lib/sales/queueBatch";
import { subdivisionOptions } from "@/lib/sales/callingRules";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const HOUR = 60 * 60 * 1000;
// 11:30 Eastern on a Friday: Ontario, Quebec and the Atlantic are open, BC
// opens at noon Eastern (within the pre-open hour), Hawaii at 14:00.
const NOW = new Date("2026-09-11T15:30:00Z");
const ADMIN = { id: "adm_1", role: "superadmin", email: "emilio.boves@example.com" };
const RACHEL = { id: "rep_r", name: "Rachel", email: "rachel@example.com", active: true, sellsIn: ["en", "fr"] };
const DANIEL = { id: "rep_d", name: "Daniel", email: "daniel@example.com", active: true, sellsIn: ["en"] };

// ═══════════════════════════════════════════════════════════════════════════
// A scripted Prisma, the same shape check-sales-batch-claim.mjs drives.
// ═══════════════════════════════════════════════════════════════════════════
function matches(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "AND") {
      if (!cond.every((w) => matches(row, w))) return false;
      continue;
    }
    if (key === "OR") {
      if (!cond.some((w) => matches(row, w))) return false;
      continue;
    }
    if (key === "capabilities" || key === "opportunities") {
      const n = row._count?.[key] ?? 0;
      if ("some" in cond && !(n > 0)) return false;
      if ("none" in cond && n > 0) return false;
      continue;
    }
    if (key === "callAttempts" || key === "queueClaims" || key === "prospect") continue;
    const v = row[key];
    if (cond === null) {
      if (v !== null && v !== undefined) return false;
      continue;
    }
    if (typeof cond !== "object" || cond instanceof Date) {
      if (cond instanceof Date ? !(v instanceof Date && v.getTime() === cond.getTime()) : v !== cond) return false;
      continue;
    }
    if ("in" in cond && !cond.in.includes(v)) return false;
    if ("notIn" in cond && (v == null || cond.notIn.includes(v))) return false;
    if ("not" in cond) {
      if (cond.not === null && (v === null || v === undefined)) return false;
      if (cond.not !== null && v === cond.not) return false;
    }
    if ("lt" in cond && !(v instanceof Date && v.getTime() < cond.lt.getTime())) return false;
    if ("gt" in cond && !(v instanceof Date && v.getTime() > cond.gt.getTime())) return false;
    if ("gte" in cond && !(v instanceof Date && v.getTime() >= cond.gte.getTime())) return false;
  }
  return true;
}

function scriptedDb({ prospects, claims = [], attempts = [], reps = [], admins = [], between = null }) {
  const state = {
    prospects: prospects.map((p) => ({ ...p })),
    claims: claims.map((c) => ({ ...c })),
    attempts: attempts.map((a) => ({ ...a })),
    reps: reps.map((r) => ({ ...r })),
    admins: admins.map((a) => ({ ...a })),
    audit: [],
    log: [],
  };
  let nextId = 1;
  const repName = (id) => state.reps.find((r) => r.id === id)?.name || null;
  const db = {
    state,
    prospect: {
      async count({ where }) {
        state.log.push("prospect.count");
        return state.prospects.filter((p) => matches(p, where)).length;
      },
      async findMany({ where, orderBy, take, select }) {
        state.log.push("prospect.findMany");
        let rows = state.prospects.filter((p) => matches(p, where));
        if (orderBy?.[0]?.createdAt === "asc") rows.sort((a, b) => a.createdAt - b.createdAt);
        if (take) rows = rows.slice(0, take);
        return rows.map((p) => {
          const out = { ...p };
          if (select?.queueClaims) {
            out.queueClaims = state.claims
              .filter((c) => c.prospectId === p.id && matches(c, select.queueClaims.where))
              .slice(0, select.queueClaims.take || 1e9);
          }
          if (select?.callAttempts) {
            out.callAttempts = state.attempts.filter((a) => a.prospectId === p.id && matches(a, select.callAttempts.where));
          }
          if (select?.leads) out.leads = p.leads || [];
          // There is no assignedRep relation on Prospect; a select asking for
          // one is exactly the 500 of 2026-09-15. Refuse it here the way
          // Prisma does, so the scripted db can no longer hide it.
          if (select?.assignedRep) throw new Error("Unknown field `assignedRep` for select statement on model `Prospect`");
          return out;
        });
      },
      async updateMany({ where, data }) {
        state.log.push("prospect.updateMany");
        if (between && !between.done) {
          between.done = true;
          between.run(state);
        }
        let count = 0;
        for (const p of state.prospects) {
          if (matches(p, where)) {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      },
    },
    salesRep: {
      async findMany({ where, select }) {
        state.log.push("salesRep.findMany");
        const ids = where?.id?.in || null;
        return state.reps.filter((r) => !ids || ids.includes(r.id)).map((r) => ({ id: r.id, name: r.name }));
      },
    },
    salesQueueClaim: {
      async count({ where }) {
        state.log.push("salesQueueClaim.count");
        return state.claims.filter((c) => matches(c, where)).length;
      },
      async findFirst({ where, orderBy }) {
        state.log.push("salesQueueClaim.findFirst");
        const rows = state.claims.filter((c) => matches(c, where));
        if (orderBy?.claimedAt === "desc") rows.sort((a, b) => b.claimedAt - a.claimedAt);
        return rows[0] || null;
      },
      async aggregate({ where }) {
        const rows = state.claims.filter((c) => matches(c, where));
        return { _max: { position: rows.length ? Math.max(...rows.map((r) => r.position ?? 0)) : null } };
      },
      async createMany({ data }) {
        state.log.push("salesQueueClaim.createMany");
        for (const d of data) state.claims.push({ id: `c${nextId++}`, releasedAt: null, releaseReason: null, workedAt: null, position: 0, ...d });
        return { count: data.length };
      },
      async updateMany({ where, data }) {
        state.log.push("salesQueueClaim.updateMany");
        let count = 0;
        for (const c of state.claims) {
          if (matches(c, where)) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
      async findMany({ where, select, orderBy, take }) {
        state.log.push("salesQueueClaim.findMany");
        let rows = state.claims.filter((c) => matches(c, where));
        if (Array.isArray(orderBy) && orderBy[0]?.claimedAt === "desc") rows.sort((a, b) => b.claimedAt - a.claimedAt || (a.position ?? 0) - (b.position ?? 0));
        if (take) rows = rows.slice(0, take);
        return rows.map((c) => {
          const out = { ...c };
          if (select?.prospect) {
            const p = state.prospects.find((x) => x.id === c.prospectId) || null;
            out.prospect = p ? { assignedRepId: p.assignedRepId, claimExpiresAt: p.claimExpiresAt, tradeKey: p.tradeKey, province: p.province } : null;
          }
          return out;
        });
      },
    },
    salesRepActivity: { async findFirst() { return null; } },
    platformAdmin: {
      async findUnique({ where }) {
        return state.admins.find((a) => a.id === where.id) || null;
      },
    },
    platformAuditLog: {
      async create({ data }) {
        state.log.push("platformAuditLog.create");
        state.audit.push(data);
        return { id: `a${nextId++}`, ...data };
      },
    },
    async $transaction(fn) {
      state.log.push("$transaction");
      return fn(db);
    },
  };
  return db;
}

let seq = 0;
function prospect(over = {}) {
  seq++;
  return {
    id: over.id || `p${seq}`,
    businessName: over.businessName || `Business ${seq}`,
    tradeKey: "flooring",
    status: "discovered",
    doNotContactAt: null,
    assignedRepId: null,
    assignedAt: null,
    claimExpiresAt: null,
    nextAttemptAt: null,
    exhaustedAt: null,
    createdAt: new Date(NOW.getTime() - (1000 - seq) * 60 * 1000),
    country: "CA",
    province: "ON",
    lastCrawledAt: null,
    _count: { capabilities: 0, opportunities: 0 },
    leads: [],
    ...over,
  };
}
const researched = (over = {}) => prospect({ lastCrawledAt: NOW, _count: { capabilities: 2, opportunities: 1 }, ...over });

/** A push that records instead of sending, and resolves the sentence in-process. */
function recordingNotify() {
  const sent = [];
  return {
    sent,
    push: async ({ salesRepIds, payload }) => {
      const p = await payload("fr");
      sent.push({ salesRepIds, ...p });
      return { sent: 1 };
    },
    appSentence: async (language, key, params = {}) => {
      let raw = APP_MESSAGES[language]?.[key] ?? APP_MESSAGES.en[key];
      if (typeof raw === "function") return raw(params);
      for (const [k, v] of Object.entries(params)) raw = String(raw).split(`{${k}}`).join(String(v ?? ""));
      return raw;
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. One selection: the console hands out what the rep would have claimed");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pool = [
    researched({ id: "qc1", province: "QC" }),
    prospect({ id: "on1" }),
    researched({ id: "on2" }),
    researched({ id: "bc1", province: "BC" }), // opens at noon Eastern — within the hour
    researched({ id: "hi1", country: "US", province: "HI" }), // 14:00 Eastern — skipped
    researched({ id: "roof", tradeKey: "roofing" }),
    prospect({ id: "dnc", doNotContactAt: NOW }),
    researched({ id: "held", assignedRepId: "rep_d", assignedAt: NOW, claimExpiresAt: new Date(NOW.getTime() + 40 * HOUR) }),
  ];
  seq = 0;
  const viaRep = await claimBatch({ db: scriptedDb({ prospects: pool }), rep: RACHEL, tradeKey: "flooring", timeZone: "America/Toronto", now: NOW });
  const viaAdmin = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 25, now: NOW, notify: recordingNotify() });
  ok("the console hands out exactly the rows the rep's press would have, in the same order", viaAdmin.assignedIds.join(",") === viaRep.claimedIds.join(","), { rep: viaRep.claimedIds, admin: viaAdmin.assignedIds });
  ok("…which is the researched Ontario and Quebec rows first, then the fresh Ontario row, then BC (opens within the hour)", viaAdmin.assignedIds.join(",") === "qc1,on2,on1,bc1", viaAdmin.assignedIds);
  ok("…never a roofer, never do-not-contact, never a row another rep holds, never Hawaii (opens at 14:00 ET)", ["roof", "dnc", "held", "hi1"].every((id) => !viaAdmin.assignedIds.includes(id)));
  ok("the same shortfall reason and skipped count as the rep's press", viaAdmin.reason === viaRep.reason && viaAdmin.skippedForWindow === viaRep.skippedForWindow, { admin: [viaAdmin.reason, viaAdmin.skippedForWindow], rep: [viaRep.reason, viaRep.skippedForWindow] });
  ok("the language rule holds through the console: an English-only rep is not handed Quebec, and is told how many were kept back",
    (await (async () => {
      const r = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: DANIEL, admin: ADMIN, tradeKey: "flooring", count: 25, now: NOW, notify: recordingNotify() });
      return !r.assignedIds.includes("qc1") && r.skippedForLanguage === 1;
    })()));

  // The narrowing.
  const qcOnly = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 25, province: "qc", now: NOW, notify: recordingNotify() });
  ok("province narrows to that province (lower-case code accepted)", qcOnly.assignedIds.join(",") === "qc1" && qcOnly.province === "QC", qcOnly.assignedIds);
  const frOnly = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 25, language: "fr", now: NOW, notify: recordingNotify() });
  ok("language 'fr' narrows to the rows the rep would sell in French — Quebec", frOnly.assignedIds.join(",") === "qc1", frOnly.assignedIds);
  const enOnly = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 25, language: "en", now: NOW, notify: recordingNotify() });
  ok("language 'en' narrows to everything but Quebec", enOnly.assignedIds.join(",") === "on2,on1,bc1", enOnly.assignedIds);
  ok("a language the rep does not sell in is refused before any read", /does not sell in "es"/.test((await assignBatchToRep({ db: scriptedDb({ prospects: pool }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", language: "es", now: NOW })).error || ""));
  ok("an unknown province is refused", /not a province or state/.test((await assignBatchToRep({ db: scriptedDb({ prospects: pool }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", province: "ZZ", now: NOW })).error || ""));
  ok("an unknown trade is refused", Boolean((await assignBatchToRep({ db: scriptedDb({ prospects: pool }), rep: RACHEL, admin: ADMIN, tradeKey: "nope", now: NOW })).error));
  ok("a deactivated rep is refused", /deactivated/.test((await assignBatchToRep({ db: scriptedDb({ prospects: pool }), rep: { ...RACHEL, active: false }, admin: ADMIN, tradeKey: "flooring", now: NOW })).error || ""));
  ok("assignFilterWhere: QC carries every Quebec spelling, an empty request carries nothing", assignFilterWhere({ province: "QC" })[0].province.in.includes("Québec") && assignFilterWhere({}).length === 0);
  ok("assignFilterWhere: a language fragment is the AND of a one-language rep", assignFilterWhere({ language: "fr" }).length === 1);

  // What the write leaves behind.
  const db = scriptedDb({ prospects: pool, admins: [ADMIN] });
  const notify = recordingNotify();
  // Ontario only, three asked, two in the pool: the researched row first,
  // the pool runs dry, and the sentence says so.
  const r = await assignBatchToRep({ db, rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 3, province: "ON", now: NOW, notify });
  ok("`count` is honoured, and a narrowed pool that runs dry says pool_empty", r.assigned === 2 && r.assignedIds.join(",") === "on2,on1" && r.reason === "pool_empty", r);
  const two = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 2, now: NOW, notify: recordingNotify() });
  ok("`count: 2` takes the first two of the rep's order", two.assignedIds.join(",") === "qc1,on2" && two.reason === null, two.assignedIds);
  const claims = db.state.claims.filter((c) => c.salesRepId === "rep_r");
  ok("every claim row is mode 'admin' with a batchId naming the admin", claims.length === 2 && claims.every((c) => c.mode === ASSIGN_MODE && adminIdFromBatchId(c.batchId) === "adm_1"), claims);
  ok("…in dial order, on the rep's day", claims.map((c) => c.position).join(",") === "0,1" && claims.every((c) => c.localDate === "2026-09-11"));
  ok("the Prospect rows carry the rep, the instant and a 48-hour lease", db.state.prospects.filter((p) => p.assignedRepId === "rep_r").every((p) => p.assignedAt === NOW && p.claimExpiresAt.getTime() === NOW.getTime() + 48 * HOUR));
  const audit = db.state.audit.find((a) => a.action === AUDIT_LEADS_ASSIGNED);
  ok("an audit row leads_assigned names the rep, the trade, the province, the count and every id", audit && audit.platformAdminId === "adm_1" && audit.details.repId === "rep_r" && audit.details.tradeKey === "flooring" && audit.details.province === "ON" && audit.details.count === 2 && audit.details.asked === 3 && audit.details.prospectIds.join(",") === "on2,on1", audit);
  ok("the rep is pushed, alone, in their language, naming the admin, the count, the trade and the province", notify.sent.length === 1 && notify.sent[0].salesRepIds.join() === "rep_r" && /Emilio Boves/.test(notify.sent[0].body) && /2 leads/.test(notify.sent[0].body) && /Flooring, Ontario/.test(notify.sent[0].body) && notify.sent[0].url === "/sales/queue", notify.sent);
  ok("adminDisplayName reads the sign-in email as a name", adminDisplayName(ADMIN) === "Emilio Boves" && adminDisplayName({ email: "ops@x.com" }) === "Ops" && adminDisplayName({}) === "FieldQuo");
  ok("assignBatchId round-trips the admin id", adminIdFromBatchId(assignBatchId({ adminId: "adm_9", at: NOW })) === "adm_9" && adminIdFromBatchId("qb_abc_def") === null && adminIdFromBatchId("reassigned_from:rep_x:1") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Caps");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pool = Array.from({ length: 60 }, (_, i) => researched({ id: `o${i}` }));
  const big = await assignBatchToRep({ db: scriptedDb({ prospects: pool, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 500, now: NOW, notify: recordingNotify() });
  ok("count is capped at QUEUE_BATCH_MAX", big.assigned === QUEUE_BATCH_MAX, big.assigned);
  // No daily ceiling (2026-09-14): 300 claims already in today's log and
  // the console still hands over the full 25, with nothing left unsaid.
  const heavyDay = Array.from({ length: 300 }, (_, i) => ({ id: `k${i}`, salesRepId: "rep_r", prospectId: `x${i}`, claimedAt: NOW, localDate: "2026-09-11", mode: "batch", releasedAt: null, workedAt: null }));
  const full = await assignBatchToRep({ db: scriptedDb({ prospects: pool, claims: heavyDay, admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", count: 25, now: NOW, notify: recordingNotify() });
  ok("…and to nothing else: 300 claims in today's log, the next 25 are still assigned", full.assigned === 25 && full.reason === null && !("remainingToday" in full), { assigned: full.assigned, reason: full.reason });
  ok("assignRequest: zero or garbage counts are refused; 25.9 rounds down; 'count' above the max is trimmed", Boolean(assignRequest({ rep: RACHEL, tradeKey: "flooring", count: 0 }).error) && Boolean(assignRequest({ rep: RACHEL, tradeKey: "flooring", count: "x" }).error) && assignRequest({ rep: RACHEL, tradeKey: "flooring", count: 25.9 }).count === 25 && assignRequest({ rep: RACHEL, tradeKey: "flooring", count: 999 }).count === QUEUE_BATCH_MAX);
  const empty = await assignBatchToRep({ db: scriptedDb({ prospects: [], admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", now: NOW, notify: recordingNotify() });
  ok("an empty pool says pool_empty by key", empty.reason === "pool_empty" && empty.reasonKey === "app.salesQueue.batchReason.poolEmpty");
  const LATE = new Date("2026-09-12T02:00:00Z"); // 22:00 Eastern: Ontario shut
  const shut = await assignBatchToRep({ db: scriptedDb({ prospects: [researched({ id: "on9" })], admins: [ADMIN] }), rep: RACHEL, admin: ADMIN, tradeKey: "flooring", now: LATE, notify: recordingNotify() });
  ok("nothing open now (and nothing within the hour) says none_open_now with the next opening — the same rule as the rep's press", shut.reason === "none_open_now" && typeof shut.nextOpensAt === "string" && CLAIM_OPENS_WITHIN_MS === 60 * 60 * 1000, shut);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Hand-picked rows, refused row by row");
// ═══════════════════════════════════════════════════════════════════════════
{
  const expires = new Date(NOW.getTime() + 30 * HOUR);
  const rows = [
    prospect({ id: "fine", businessName: "Fine Floors" }),
    prospect({ id: "dnc", doNotContactAt: NOW }),
    prospect({ id: "review", status: "needs_review" }),
    prospect({ id: "rejected", status: "rejected" }),
    prospect({ id: "notrade", tradeKey: null }),
    prospect({ id: "dans", assignedRepId: "rep_d", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "dansworked", assignedRepId: "rep_d", assignedAt: NOW, claimExpiresAt: null }),
    prospect({ id: "mine", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "lapsed", assignedRepId: "rep_d", assignedAt: new Date(NOW.getTime() - 50 * HOUR), claimExpiresAt: new Date(NOW.getTime() - HOUR) }),
    prospect({ id: "qc", province: "QC" }),
    prospect({ id: "exhausted", exhaustedAt: NOW }),
    prospect({ id: "retry", nextAttemptAt: new Date(NOW.getTime() + 2 * HOUR) }),
    prospect({ id: "duepast", nextAttemptAt: new Date(NOW.getTime() - HOUR) }),
  ];
  const reps = [RACHEL, DANIEL];
  const withHolder = (p) => ({ ...p, assignedRep: p.assignedRepId ? { name: reps.find((r) => r.id === p.assignedRepId)?.name } : null });
  const say = (id, rep = DANIEL) => assignRefusalFor(withHolder(rows.find((r) => r.id === id)), rep, { now: NOW });
  ok("a clean row has no refusal", say("fine") === null);
  ok("do-not-contact", /Do not contact/.test(say("dnc")));
  ok("needs review", /Needs review/.test(say("review")));
  ok("rejected", /Rejected/.test(say("rejected")));
  ok("no trade → the Review folder", /No trade/.test(say("notrade")));
  ok("claimed by another rep — names them and the expiry", /Claimed by Daniel until 2026-09-12/.test(say("dans", RACHEL)), say("dans", RACHEL));
  ok("worked by another rep — does not lapse", /Worked by Daniel/.test(say("dansworked", RACHEL)));
  ok("already this rep's", /Already Rachel's/.test(say("mine", RACHEL)));
  ok("a lapsed lease is assignable — it is back in the pool", say("lapsed", RACHEL) === null);
  ok("Quebec to a rep without French — names the rep and the language", /In Quebec — Daniel does not sell in French/.test(say("qc", DANIEL)));
  ok("…and is fine for a rep with French", say("qc", RACHEL) === null);
  ok("Ontario to a French-only rep", /Outside Quebec — .* does not sell in English/.test(say("fine", { id: "rep_f", name: "Fabienne", sellsIn: ["fr"] })));
  ok("exhausted by the retry rules", /Exhausted/.test(say("exhausted")));
  ok("a retry scheduled ahead", /Not before/.test(say("retry")));
  ok("a retry whose instant has passed is assignable", say("duepast") === null);
  ok("a missing row", /no longer exists/.test(assignRefusalFor(null, DANIEL)));

  const db = scriptedDb({ prospects: rows, reps, admins: [ADMIN], claims: [{ id: "c0", salesRepId: "rep_r", prospectId: "mine", claimedAt: NOW, localDate: "2026-09-11", mode: "batch", position: 6, releasedAt: null, workedAt: null }] });
  const notify = recordingNotify();
  const r = await assignProspectsToRep({ db, rep: RACHEL, admin: ADMIN, ids: rows.map((x) => x.id).concat(["ghost", "fine"]), now: NOW, notify });
  ok("the clean rows are assigned: fine, lapsed, qc, duepast", r.assignedIds.slice().sort().join(",") === "duepast,fine,lapsed,qc", r.assignedIds);
  ok("…and every other id comes back refused with a reason, once each (duplicates collapse)", r.refused.length === rows.length - 4 + 1 && r.refused.every((x) => typeof x.reason === "string" && x.reason.length > 10) && r.refused.some((x) => x.id === "ghost"), r.refused.map((x) => `${x.id}: ${x.reason}`));
  ok("…with the business name beside each refusal that has one", r.refused.find((x) => x.id === "dans")?.businessName === "Business 6" || Boolean(r.refused.find((x) => x.id === "dans")?.businessName));
  const claims = db.state.claims.filter((c) => c.salesRepId === "rep_r" && c.mode === ASSIGN_MODE);
  ok("claim rows continue the rep's own open position order (6 → 7, 8, 9, 10)", claims.map((c) => c.position).sort((a, b) => a - b).join(",") === "7,8,9,10", claims.map((c) => c.position));
  ok("Daniel's lapsed lease is now Rachel's, and his live one is still his", db.state.prospects.find((p) => p.id === "lapsed").assignedRepId === "rep_r" && db.state.prospects.find((p) => p.id === "dans").assignedRepId === "rep_d");
  ok("an audit row with how: picked, the count and the ids", db.state.audit[0]?.action === AUDIT_LEADS_ASSIGNED && db.state.audit[0].details.how === "picked" && db.state.audit[0].details.count === 4 && db.state.audit[0].details.refused === r.refused.length, db.state.audit[0]);
  ok("a mixed hand-pick pushes '4 leads' with no trade guessed (all flooring → the trade IS named), no single province", notify.sent.length === 1 && /4 leads/.test(notify.sent[0].body) && /Flooring/.test(notify.sent[0].body) && !/Ontario|Quebec/.test(notify.sent[0].body), notify.sent[0]?.body);

  // A row that changes hands between the read and the write.
  const between = { done: false, run: (state) => { const p = state.prospects.find((x) => x.id === "fine"); Object.assign(p, { assignedRepId: "rep_d", assignedAt: NOW, claimExpiresAt: expires }); } };
  const race = await assignProspectsToRep({ db: scriptedDb({ prospects: rows.filter((x) => x.id === "fine" || x.id === "qc"), reps, admins: [ADMIN], between }), rep: RACHEL, admin: ADMIN, ids: ["fine", "qc"], now: NOW, notify: recordingNotify() });
  ok("a row another rep took between the read and the write is refused as such, and the other is assigned", race.assignedIds.join(",") === "qc" && /just now/.test(race.refused.find((x) => x.id === "fine")?.reason || ""), race);
  ok("no ids → refused", Boolean((await assignProspectsToRep({ db: scriptedDb({ prospects: [] }), rep: RACHEL, admin: ADMIN, ids: [], now: NOW })).error));
  ok("an inactive rep → refused", /deactivated/.test((await assignProspectsToRep({ db: scriptedDb({ prospects: [] }), rep: { ...RACHEL, active: false }, admin: ADMIN, ids: ["x"], now: NOW })).error || ""));
  const heavy = await assignProspectsToRep({ db: scriptedDb({ prospects: rows, reps, admins: [ADMIN], claims: Array.from({ length: 300 }, (_, i) => ({ id: `k${i}`, salesRepId: "rep_r", prospectId: `x${i}`, claimedAt: NOW, localDate: "2026-09-11", mode: "batch", releasedAt: null, workedAt: null })) }), rep: RACHEL, admin: ADMIN, ids: ["fine", "lapsed"], now: NOW, notify: recordingNotify() });
  ok("hand-picked rows have no daily ceiling either: 300 claims today, both still assigned, nothing refused for a cap", heavy.assigned === 2 && heavy.refused.length === 0 && !("remainingToday" in heavy), heavy);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Unassign is releaseUntouched, reason admin");
// ═══════════════════════════════════════════════════════════════════════════
{
  const expires = new Date(NOW.getTime() + 30 * HOUR);
  const rows = [
    prospect({ id: "r1", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "r2", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }), // dialled
    prospect({ id: "rw", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: null }), // worked
    prospect({ id: "d1", assignedRepId: "rep_d", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "free" }),
  ];
  const claims = ["r1", "r2", "rw"].map((id, i) => ({ id: `c${i}`, salesRepId: "rep_r", prospectId: id, claimedAt: NOW, localDate: "2026-09-11", mode: ASSIGN_MODE, position: i, releasedAt: null, workedAt: null }));
  const db = scriptedDb({ prospects: rows, claims, reps: [RACHEL, DANIEL], attempts: [{ prospectId: "r2", salesRepId: "rep_r", dialledAt: new Date(NOW.getTime() + 60_000) }] });
  const r = await unassignFromRep({ db, rep: RACHEL, admin: ADMIN, ids: ["r1", "r2", "rw", "d1", "free", "ghost"], now: NOW });
  ok("the two leases go back — the dialled one too (the console is taking it back)", r.unassigned === 2 && r.unassignedIds.slice().sort().join(",") === "r1,r2", r);
  ok("the worked row stays: a conversation is not a lease", /Worked/.test(r.refused.find((x) => x.id === "rw")?.reason || ""));
  ok("Daniel's row is refused by name", /Held by Daniel/.test(r.refused.find((x) => x.id === "d1")?.reason || ""));
  ok("a free row and a missing row are refused with why", /already in the pool/.test(r.refused.find((x) => x.id === "free")?.reason || "") && /no longer exists/.test(r.refused.find((x) => x.id === "ghost")?.reason || ""));
  ok("the claim rows close with reason 'admin' — in RELEASE_REASONS, not de-prioritising", db.state.claims.filter((c) => c.releaseReason === "admin").length === 2 && RELEASE_REASONS.includes("admin"));
  ok("the Prospect rows are back in the pool", ["r1", "r2"].every((id) => db.state.prospects.find((p) => p.id === id).assignedRepId === null));
  ok("an audit row leads_unassigned with the ids", db.state.audit[0]?.action === AUDIT_LEADS_UNASSIGNED && db.state.audit[0].details.prospectIds.length === 2, db.state.audit[0]);
  ok("no ids → refused", Boolean((await unassignFromRep({ db, rep: RACHEL, admin: ADMIN, ids: [], now: NOW })).error));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The rep hears: adminAssignedSummary, and the sentences exist");
// ═══════════════════════════════════════════════════════════════════════════
{
  const expires = new Date(NOW.getTime() + 30 * HOUR);
  const batch = assignBatchId({ adminId: "adm_1", at: NOW });
  const older = assignBatchId({ adminId: "adm_1", at: new Date(NOW.getTime() - 5 * HOUR) });
  const rows = [
    prospect({ id: "a1", province: "QC", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "a2", province: "QC", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "a3", province: "ON", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: new Date(NOW.getTime() - HOUR) }), // lapsed
    prospect({ id: "old", province: "ON", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "own", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
  ];
  const claims = [
    { id: "c1", salesRepId: "rep_r", prospectId: "a1", claimedAt: NOW, localDate: "2026-09-11", mode: ASSIGN_MODE, batchId: batch, position: 0, releasedAt: null, workedAt: null },
    { id: "c2", salesRepId: "rep_r", prospectId: "a2", claimedAt: NOW, localDate: "2026-09-11", mode: ASSIGN_MODE, batchId: batch, position: 1, releasedAt: null, workedAt: null },
    { id: "c3", salesRepId: "rep_r", prospectId: "a3", claimedAt: NOW, localDate: "2026-09-11", mode: ASSIGN_MODE, batchId: batch, position: 2, releasedAt: null, workedAt: null },
    { id: "c4", salesRepId: "rep_r", prospectId: "old", claimedAt: new Date(NOW.getTime() - 5 * HOUR), localDate: "2026-09-11", mode: ASSIGN_MODE, batchId: older, position: 0, releasedAt: null, workedAt: null },
    { id: "c5", salesRepId: "rep_r", prospectId: "own", claimedAt: NOW, localDate: "2026-09-11", mode: "batch", batchId: "qb_x", position: 0, releasedAt: null, workedAt: null },
  ];
  const db = scriptedDb({ prospects: rows, claims, admins: [{ id: "adm_1", email: "emilio.boves@example.com" }] });
  const s = await adminAssignedSummary({ db, salesRepId: "rep_r", now: NOW });
  ok("held counts the console's rows still held (the lapsed one and the rep's own claim are not)", s.held === 3, s);
  ok("the latest batch: 2 flooring leads in Quebec from Emilio Boves", s.latest.count === 2 && s.latest.tradeLabel === "Flooring" && s.latest.province === "QC" && s.latest.provinceName === "Quebec" && s.latest.adminName === "Emilio Boves", s.latest);
  ok("nothing held → null, never a zero", (await adminAssignedSummary({ db: scriptedDb({ prospects: [], claims: [] }), salesRepId: "rep_r", now: NOW })) === null);
  ok("provinceName reads the calling-rules table", provinceName("bc") === "British Columbia" && provinceName(null) === null && subdivisionOptions().some((o) => o.code === "QC" && o.country === "CA"));
  for (const key of ["app.salesToday.assignedPushTitle", "app.salesToday.assignedLine", "app.salesToday.assignedLineNoTrade", "app.salesToday.assignedCount"]) {
    for (const lang of Object.keys(APP_MESSAGES)) {
      const v = APP_MESSAGES[lang][key];
      ok(`${key} exists in ${lang}`, typeof v === "string" || typeof v === "function");
    }
  }
  const options = assignOptionsFor(RACHEL);
  ok("the panel's options: the rep's own languages, the province table, the batch max and no daily ceiling", options.languages.join(",") === "en,fr" && options.provinces.length > 60 && options.batchMax === QUEUE_BATCH_MAX && !("dailyCap" in options));
  ok("…an unset sellsIn reads as English only, the safe default", assignOptionsFor({ id: "x", sellsIn: [] }).languages.join(",") === "en");
  const counts = await poolCountsFor({ db: scriptedDb({ prospects: [prospect({ id: "q", province: "QC" }), prospect({ id: "o" }), prospect({ id: "h", assignedRepId: "rep_d", assignedAt: NOW, claimExpiresAt: expires })] }), rep: DANIEL, now: NOW });
  const flooring = counts.find((c) => c.key === "flooring");
  ok("pool counts are THIS rep's: an English-only rep sees 1 available (the Quebec row is not offered), 1 held", flooring.available === 1 && flooring.held === 1, flooring);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The sweeps leave a console assignment alone on its day and the next");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("autoReleaseProtected: an admin claim made today is protected", autoReleaseProtected({ mode: "admin", localDate: "2026-09-11", repTimeZone: "America/Toronto", now: NOW }));
  ok("…and through the whole of the next local day", autoReleaseProtected({ mode: "admin", localDate: "2026-09-11", repTimeZone: "America/Toronto", now: new Date("2026-09-13T03:30:00Z") })); // 23:30 ET Sept 12
  ok("…but not the day after that", !autoReleaseProtected({ mode: "admin", localDate: "2026-09-11", repTimeZone: "America/Toronto", now: new Date("2026-09-13T04:30:00Z") })); // 00:30 ET Sept 13
  ok("a rep's own batch claim is never protected", !autoReleaseProtected({ mode: "batch", localDate: "2026-09-11", repTimeZone: "America/Toronto", now: NOW }));
  ok("no zone → judged in UTC", autoReleaseProtected({ mode: "admin", localDate: "2026-09-11", repTimeZone: null, now: new Date("2026-09-12T23:59:00Z") }) && !autoReleaseProtected({ mode: "admin", localDate: "2026-09-11", repTimeZone: null, now: new Date("2026-09-13T00:01:00Z") }));
  ok("garbage dates are not protected", !autoReleaseProtected({ mode: "admin", localDate: "nope", now: NOW }) && !autoReleaseProtected({}));

  // The day-end sweep, the next morning UTC: the rep's own untouched row goes
  // back, the console's does not; two days on, both would.
  const expires = new Date(NOW.getTime() + 47 * HOUR);
  const rows = [
    prospect({ id: "own", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
    prospect({ id: "given", assignedRepId: "rep_r", assignedAt: NOW, claimExpiresAt: expires }),
  ];
  const claims = [
    { id: "c1", salesRepId: "rep_r", prospectId: "own", claimedAt: NOW, localDate: "2026-09-11", repTimeZone: "America/Toronto", mode: "batch", releasedAt: null, workedAt: null },
    { id: "c2", salesRepId: "rep_r", prospectId: "given", claimedAt: NOW, localDate: "2026-09-11", repTimeZone: "America/Toronto", mode: "admin", releasedAt: null, workedAt: null },
  ];
  const db = scriptedDb({ prospects: rows, claims });
  const NEXT_MORNING = new Date("2026-09-12T12:00:00Z"); // 08:00 ET Sept 12
  const sweep = await releaseDayEnded({ db, now: NEXT_MORNING });
  ok("the day-end sweep releases the rep's own untouched row and leaves the console's", sweep.released === 1 && db.state.prospects.find((p) => p.id === "own").assignedRepId === null && db.state.prospects.find((p) => p.id === "given").assignedRepId === "rep_r", sweep);
  const db2 = scriptedDb({ prospects: rows, claims });
  const TWO_DAYS = new Date("2026-09-13T12:00:00Z");
  const sweep2 = await releaseDayEnded({ db: db2, now: TWO_DAYS });
  ok("two days on, the console's row goes back too", sweep2.released === 2, sweep2);

  // The closed-window release before a top-up, at 22:00 ET on the day of
  // the assignment: the rep's own shut row is given back as "closed", the
  // console's is kept for the morning.
  const LATE = new Date("2026-09-12T02:00:00Z");
  const db3 = scriptedDb({ prospects: rows, claims });
  const closed = await releaseClosedUntouched({ db: db3, rep: RACHEL, shiftEnd: new Date(LATE.getTime() + HOUR), now: LATE });
  ok("the closed-window release gives back the rep's own shut row and keeps the console's", closed.released === 1 && closed.releasedIds.join(",") === "own", closed);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Source: one selection, two routes, two screens, the catalogue");
// ═══════════════════════════════════════════════════════════════════════════
{
  const lib = decomment(read("lib/sales/assignLeads.js"));
  const qb = decomment(read("lib/sales/queueBatch.js"));
  const repRoute = decomment(read("app/api/sales/queue/route.js"));
  const assignRoute = decomment(read("app/api/platform/sales/reps/[id]/assign/route.js"));
  const unassignRoute = decomment(read("app/api/platform/sales/reps/[id]/unassign/route.js"));
  const repsPage = decomment(read("app/platform/sales/reps/page.js"));
  const prospectsPage = decomment(read("app/platform/sales/prospects/page.js"));
  const prospectsRoute = decomment(read("app/api/platform/sales/prospects/route.js"));
  const salesRoute = decomment(read("app/api/sales/queue/route.js"));

  ok("assignLeads imports selectClaimBatch AND writeClaimBatch from queueBatch", /import \{[^}]*\bselectClaimBatch\b[^}]*\} from "\.\/queueBatch"/.test(lib) && /import \{[^}]*\bwriteClaimBatch\b[^}]*\} from "\.\/queueBatch"/.test(lib));
  ok("…and calls both", /await selectClaimBatch\(\{/.test(lib) && /await writeClaimBatch\(\{/.test(lib));
  ok("the rep's claimBatch is composed of the same two", /export async function claimBatch\([\s\S]*?await selectClaimBatch\(\{[\s\S]*?await writeClaimBatch\(\{/.test(qb));
  ok("the rep route imports claimBatch from queueBatch", /import \{[^}]*\bclaimBatch\b[^}]*\} from "@\/lib\/sales\/queueBatch"/.test(repRoute));
  ok("assignLeads defines no selection of its own: no findMany over the candidate WHERE", !/prospect\.findMany\(\{\s*where: \{ AND: \[base/.test(lib) && !/researchedWhere/.test(lib));
  ok("assignLeads never writes assignedRepId: null — unassign is releaseUntouched", !/assignedRepId:\s*null/.test(lib) && /releaseUntouched\(\{ db, rep, reason: "admin"/.test(lib));
  ok("every admin claim row is written with mode ASSIGN_MODE, never a literal", (lib.match(/mode: ASSIGN_MODE/g) || []).length >= 1 && !/mode: "admin"/.test(lib));
  ok("pool counts use the same expression the rep's ClaimCard counts with", /db\.prospect\.count\(\{ where: claimCandidateWhere\(\{ tradeKey: key, now, rep \}\) \}\)/.test(lib) && /db\.prospect\.count\(\{ where: claimCandidateWhere\(\{ tradeKey: key, now, rep \}\) \}\)/.test(salesRoute));
  ok("both routes are superadmin-only by the literal role check", /role !== "superadmin"/.test(assignRoute) && /role !== "superadmin"/.test(unassignRoute));
  ok("the assign route passes the window-policy context the rep's claim reads", /loadWindowPolicyContext\(\{ now \}\)/.test(assignRoute) && /policyContext,/.test(assignRoute));
  ok("the unassign route calls unassignFromRep and nothing else on the pool", /unassignFromRep\(\{ db, rep, admin/.test(unassignRoute) && !/prospect\.update/.test(unassignRoute));
  ok("both audit actions are in the catalogue", AUDIT_ACTIONS[AUDIT_LEADS_ASSIGNED] && AUDIT_ACTIONS[AUDIT_LEADS_UNASSIGNED]);
  ok("…and are what the library writes, as literals check:platform-truth can read", /action: "leads_assigned"/.test(lib) && /action: "leads_unassigned"/.test(lib) && AUDIT_LEADS_ASSIGNED === "leads_assigned" && AUDIT_LEADS_UNASSIGNED === "leads_unassigned");
  ok("the reps screen has an Assign leads panel that posts to the assign route", /\/api\/platform\/sales\/reps\/\$\{rep\.id\}\/assign/.test(repsPage) && /AssignPanel/.test(repsPage));
  ok("…gated on isSuperadmin, never a guess", /isSuperadmin/.test(repsPage) && /usePlatformAdmin\(\)/.test(repsPage));
  ok("the prospects screen has checkboxes, Assign to rep, Unassign — through the shared gate", /usePlatformAdmin\(\)/.test(prospectsPage) && /<PlatformWriteGate/.test(prospectsPage) && /type="checkbox"/.test(prospectsPage) && /assignTicked\("unassign"\)/.test(prospectsPage) && /assignTicked\("assign"\)/.test(prospectsPage) && /\/api\/platform\/sales\/reps\/\$\{rep\.id\}\/\$\{action\}/.test(prospectsPage));
  ok("…and prints each refusal", /refused/.test(prospectsPage));
  ok("the prospects list route carries the active reps and the holder's name — by id lookup, never a relation select Prospect does not have", /reps:/.test(prospectsRoute) && /holder/.test(prospectsRoute) && /holders\.get\(p\.assignedRepId\)/.test(prospectsRoute) && !/assignedRep: \{ select/.test(prospectsRoute));
  ok("…and neither does lib/sales/assignLeads.js: withHolderNames resolves the name after the read", !/assignedRep: \{ select/.test(read("lib/sales/assignLeads.js")) && /export async function withHolderNames/.test(read("lib/sales/assignLeads.js")));
  ok("the sales queue GET carries adminAssigned for the Today line", /adminAssigned/.test(salesRoute) && /adminAssignedSummary\(\{ db, salesRepId: rep\.id, now \}\)/.test(salesRoute));
  ok("the Today screen prints it", /adminAssigned\.latest/.test(decomment(read("app/sales/page.js"))));
  ok("the day-end sweep and the closed release both ask autoReleaseProtected", (qb.match(/autoReleaseProtected\(/g) || []).length >= 3);
  ok("the schema's mode comment names admin", /"admin"/.test(read("prisma/schema.prisma").split("model SalesQueueClaim")[1].split("\n").slice(0, 20).join("\n")));
  ok("check:platform-truth gates the two screens on the assign route", /reps\/\[id\]\/assign\/route\.js/.test(read("scripts/check-platform-truth.mjs")));
}

console.log(`\n${failures.length ? "✗" : "✓"} sales assign: ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`   - ${f}`);
  process.exit(1);
}
