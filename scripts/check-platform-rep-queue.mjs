#!/usr/bin/env node
//
// scripts/check-platform-rep-queue.mjs
//
//   npm run check:platform-rep-queue
//
// The platform console's hand on a rep's queue — executed, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. planReassign(), pure: same rep refused; inactive target refused; only
//      the rows the old rep HOLDS are planned (a lapsed lease is already in
//      the pool; another rep's row is not ours to move); a lease gets a fresh
//      expiry, a worked row keeps none and arrives worked; positions continue
//      the target's own order; a converted or lost lead stays put.
//   2. reassignHeld() against a scripted db: every WHERE is scoped to the old
//      rep, so a row that changed hands between the read and the write is not
//      moved and not counted; the old claim closes "reassigned", the new one
//      opens "reassigned" with the batch naming where it came from.
//   3. deactivationGate(), pure: work held and no hand-off → 409 with the
//      counts; nothing held → proceeds whatever the body says; leads can only
//      be moved; "move" without a target is a 400.
//   4. Release is reused, source-asserted: the admin routes import
//      releaseUntouched and define no release of their own — the only
//      `assignedRepId: null` write in the repo's sales code is in
//      lib/sales/queueBatch.js and the rep's own queue route.
//   5. Attribution untouched: no salesAttribution write anywhere on the
//      reassign path, and the audit row says attributionsMoved: 0.
//   6. Audit wording: both new actions are in lib/platform/auditActions.js
//      and both are what the routes actually write.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed.
// Sources are decommented before a regex touches them.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOSED_LEAD_STATUSES,
  deactivationGate,
  handoffTargets,
  heldBy,
  isOpenLead,
  openLeadWhere,
  planReassign,
  reassignHeld,
  summariseHeld,
} from "@/lib/sales/reassign";
import { RELEASE_REASONS, DEPRIORITISING_RELEASES, releaseUntouched } from "@/lib/sales/queueBatch";
import { CLAIM_HOURS, queueWhere } from "@/lib/sales/prospectView";
import { AUDIT_ACTIONS } from "@/lib/platform/auditActions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

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
const NOW = new Date("2026-09-11T15:00:00Z");

// ═══════════════════════════════════════════════════════════════════════════
section("1. planReassign — pure");
// ═══════════════════════════════════════════════════════════════════════════
{
  const prospects = [
    { id: "p1", assignedRepId: "dan", assignedAt: new Date(NOW - 3 * HOUR), claimExpiresAt: new Date(NOW.getTime() + 45 * HOUR) },
    { id: "p2", assignedRepId: "dan", assignedAt: new Date(NOW - 20 * HOUR), claimExpiresAt: new Date(NOW.getTime() + 28 * HOUR) },
    // Worked: a conversation, not a lease.
    { id: "p3", assignedRepId: "dan", assignedAt: new Date(NOW - 50 * HOUR), claimExpiresAt: null },
    // Lapsed: already back in the pool.
    { id: "p4", assignedRepId: "dan", assignedAt: new Date(NOW - 60 * HOUR), claimExpiresAt: new Date(NOW - 12 * HOUR) },
    // Somebody else's.
    { id: "p5", assignedRepId: "eve", assignedAt: new Date(NOW - HOUR), claimExpiresAt: new Date(NOW.getTime() + 47 * HOUR) },
    // Nobody's.
    { id: "p6", assignedRepId: null, assignedAt: null, claimExpiresAt: null },
  ];
  const leads = [
    { id: "l1", salesRepId: "dan", status: "new", convertedCompanyId: null },
    { id: "l2", salesRepId: "dan", status: "demoed", convertedCompanyId: null },
    { id: "l3", salesRepId: "dan", status: "signed", convertedCompanyId: "c1" },
    { id: "l4", salesRepId: "dan", status: "lost", convertedCompanyId: null },
    { id: "l5", salesRepId: "eve", status: "new", convertedCompanyId: null },
  ];

  ok("same rep is refused", Boolean(planReassign({ prospects, leads, fromRepId: "dan", toRepId: "dan", now: NOW }).error));
  ok("an inactive target is refused",
    /deactivated/.test(planReassign({ prospects, leads, fromRepId: "dan", toRepId: "gone", toRep: { id: "gone", active: false }, now: NOW }).error || ""));
  ok("a missing target is refused", Boolean(planReassign({ prospects, leads, fromRepId: "dan", toRepId: "", now: NOW }).error));
  ok("a missing source is refused", Boolean(planReassign({ prospects, leads, fromRepId: null, toRepId: "eve", now: NOW }).error));

  const plan = planReassign({ prospects, leads, fromRepId: "dan", toRepId: "eve", toRep: { id: "eve", active: true }, now: NOW, startPosition: 7 });
  ok("a plan comes back for an active target", !plan.error, plan.error);
  ok("only the two live leases are re-issued", plan.leases.map((r) => r.id).join(",") === "p1,p2", plan.leases);
  ok("the worked row moves as worked", plan.worked.map((r) => r.id).join(",") === "p3", plan.worked);
  ok("the lapsed lease is NOT moved — it is already in the pool", !JSON.stringify(plan).includes('"p4"'));
  ok("another rep's row is NOT moved", !JSON.stringify(plan).includes('"p5"'));
  ok("an unclaimed row is NOT moved", !JSON.stringify(plan).includes('"p6"'));

  const fresh = new Date(NOW.getTime() + CLAIM_HOURS * HOUR);
  ok("a lease's expiry is refreshed from now, not carried over",
    plan.leases.every((r) => r.data.claimExpiresAt.getTime() === fresh.getTime()), plan.leases.map((r) => r.data.claimExpiresAt));
  ok("…and the lease's assignedAt is now", plan.leases.every((r) => r.data.assignedAt.getTime() === NOW.getTime()));
  ok("…and every moved row is assigned to the target", [...plan.leases, ...plan.worked].every((r) => r.data.assignedRepId === "eve"));
  ok("a worked row gets no expiry — a conversation is not a lease", !("claimExpiresAt" in plan.worked[0].data), plan.worked[0].data);

  ok("open leads move: new and demoed", plan.leadIds.join(",") === "l1,l2", plan.leadIds);
  ok("a converted lead stays", !plan.leadIds.includes("l3"));
  ok("a lost lead stays", !plan.leadIds.includes("l4"));
  ok("another rep's lead stays", !plan.leadIds.includes("l5"));
  ok("counts say what moved", plan.counts.prospects === 3 && plan.counts.leases === 2 && plan.counts.worked === 1 && plan.counts.leads === 2, plan.counts);

  ok("positions continue the target's order from startPosition",
    plan.newClaims.map((c) => c.position).join(",") === "7,8,9", plan.newClaims.map((c) => c.position));
  ok("every new claim is the target's, mode reassigned",
    plan.newClaims.every((c) => c.salesRepId === "eve" && c.mode === "reassigned"));
  ok("the batch names the rep it came from", plan.batchId.startsWith("reassigned_from:dan:"), plan.batchId);
  ok("…and every new claim carries it", plan.newClaims.every((c) => c.batchId === plan.batchId));
  ok("the worked row's new claim arrives worked", plan.newClaims.find((c) => c.prospectId === "p3")?.workedAt?.getTime() === NOW.getTime());
  ok("a lease's new claim arrives open", plan.newClaims.filter((c) => c.prospectId !== "p3").every((c) => c.workedAt === null));
  ok("the old claims close as reassigned", plan.closeReason === "reassigned");
  ok("…which is a release reason the log accepts", RELEASE_REASONS.includes("reassigned"));
  ok("…and does NOT de-prioritise the row for the old rep — they did not give it back", !DEPRIORITISING_RELEASES.includes("reassigned"));
  ok('"admin" is a release reason too, for the console\'s release', RELEASE_REASONS.includes("admin") && !DEPRIORITISING_RELEASES.includes("admin"));

  const bad = planReassign({ prospects, leads, fromRepId: "dan", toRepId: "eve", now: NOW, startPosition: -3 });
  ok("a nonsense startPosition falls back to 0", bad.newClaims[0].position === 0, bad.newClaims[0].position);

  const none = planReassign({ prospects: [], leads: [], fromRepId: "dan", toRepId: "eve", now: NOW });
  ok("nothing held plans nothing, and is not an error", !none.error && none.counts.prospects === 0 && none.counts.leads === 0, none);

  ok("heldBy agrees with queueWhere: live lease", heldBy(prospects[0], "dan", NOW) === true);
  ok("heldBy: worked", heldBy(prospects[2], "dan", NOW) === true);
  ok("heldBy: lapsed is not held", heldBy(prospects[3], "dan", NOW) === false);
  ok("heldBy: other rep's is not held", heldBy(prospects[4], "dan", NOW) === false);
  ok("queueWhere with no rep matches nothing", queueWhere(null).assignedRepId === "__none__");
  ok("openLeadWhere with no rep matches nothing", openLeadWhere(null).salesRepId === "__none__");
  ok("openLeadWhere excludes converted and lost", openLeadWhere("dan").convertedCompanyId === null && openLeadWhere("dan").status.notIn.includes("lost"));
  ok("isOpenLead agrees with openLeadWhere", isOpenLead(leads[0]) && isOpenLead(leads[1]) && !isOpenLead(leads[2]) && !isOpenLead(leads[3]));
  ok("only 'lost' closes a lead — 'signed' without a company is still a job", CLOSED_LEAD_STATUSES.length === 1 && isOpenLead({ status: "signed", convertedCompanyId: null }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. summariseHeld — the card's numbers");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rows = [
    { id: "a", assignedRepId: "dan", assignedAt: new Date(NOW - 3 * HOUR), claimExpiresAt: new Date(NOW.getTime() + HOUR), callAttempts: [] },
    { id: "b", assignedRepId: "dan", assignedAt: new Date(NOW - 6 * HOUR), claimExpiresAt: new Date(NOW.getTime() + HOUR), callAttempts: [{ dialledAt: new Date(NOW - HOUR) }] },
    // Dialled BEFORE the claim — an earlier hold — is untouched now.
    { id: "c", assignedRepId: "dan", assignedAt: new Date(NOW - 2 * HOUR), claimExpiresAt: new Date(NOW.getTime() + HOUR), callAttempts: [{ dialledAt: new Date(NOW - 30 * HOUR) }] },
    { id: "d", assignedRepId: "dan", assignedAt: new Date(NOW - 40 * HOUR), claimExpiresAt: null, callAttempts: [{ dialledAt: new Date(NOW - 39 * HOUR) }] },
    { id: "e", assignedRepId: "dan", assignedAt: new Date(NOW - 60 * HOUR), claimExpiresAt: new Date(NOW - HOUR), callAttempts: [] },
    { id: "f", assignedRepId: "eve", assignedAt: new Date(NOW - HOUR), claimExpiresAt: new Date(NOW.getTime() + HOUR), callAttempts: [] },
  ];
  const s = summariseHeld(rows, { salesRepId: "dan", now: NOW });
  ok("held = leased + worked, lapsed and others excluded", s.held === 4 && s.leased === 3 && s.worked === 1, s);
  ok("untouched counts a row dialled only before the claim", s.untouched === 2, s);
  ok("dialled counts the row with an attempt since the claim", s.dialled === 1, s);
  ok("the oldest LIVE lease is reported, not the lapsed one", s.oldestClaimMs === 6 * HOUR, s.oldestClaimMs);
  const empty = summariseHeld([], { salesRepId: "dan", now: NOW });
  ok("nothing held is zeros and a null age, not an invented one", empty.held === 0 && empty.oldestClaimMs === null, empty);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. reassignHeld — a scripted db, and a row that changed hands");
// ═══════════════════════════════════════════════════════════════════════════

function matches(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!cond.some((w) => matches(row, w))) return false;
      continue;
    }
    if (key === "AND") {
      if (!cond.every((w) => matches(row, w))) return false;
      continue;
    }
    const v = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond && !cond.in.includes(v)) return false;
      if ("notIn" in cond && cond.notIn.includes(v)) return false;
      if ("not" in cond) {
        if (cond.not === null ? v == null : v === cond.not) return false;
      }
      if ("gt" in cond && !(v instanceof Date && v.getTime() > cond.gt.getTime())) return false;
      if ("lt" in cond && !(v instanceof Date && v.getTime() < cond.lt.getTime())) return false;
      continue;
    }
    if (cond instanceof Date) {
      if (!(v instanceof Date) || v.getTime() !== cond.getTime()) return false;
      continue;
    }
    if (v !== cond) return false;
  }
  return true;
}

function scriptedDb({ prospects, leads, claims, between = null }) {
  const state = {
    prospects: prospects.map((p) => ({ ...p })),
    leads: leads.map((l) => ({ ...l })),
    claims: claims.map((c) => ({ ...c })),
    log: [],
    attributionsTouched: 0,
  };
  const table = (name) => ({
    async findMany({ where, select }) {
      state.log.push(`${name}.findMany`);
      return state[name].filter((r) => matches(r, where)).map((r) => {
        if (!select) return { ...r };
        const out = {};
        for (const k of Object.keys(select)) {
          if (k === "callAttempts") out.callAttempts = r.callAttempts || [];
          else out[k] = r[k];
        }
        return out;
      });
    },
    async updateMany({ where, data }) {
      state.log.push(`${name}.updateMany`);
      if (between && !between.done) {
        between.done = true;
        between.run(state);
      }
      let count = 0;
      for (const r of state[name]) {
        if (matches(r, where)) {
          Object.assign(r, data);
          count++;
        }
      }
      return { count };
    },
    async createMany({ data }) {
      state.log.push(`${name}.createMany`);
      for (const d of data) state[name].push({ id: `${name}_${state[name].length + 1}`, ...d });
      return { count: data.length };
    },
    async aggregate({ where }) {
      const rows = state[name].filter((r) => matches(r, where));
      return { _max: { position: rows.length ? Math.max(...rows.map((r) => r.position)) : null } };
    },
    async count({ where }) {
      return state[name].filter((r) => matches(r, where)).length;
    },
    async groupBy({ by, where }) {
      const rows = state[name].filter((r) => matches(r, where));
      const m = new Map();
      for (const r of rows) m.set(r[by[0]], (m.get(r[by[0]]) || 0) + 1);
      return [...m].map(([k, n]) => ({ [by[0]]: k, _count: { _all: n } }));
    },
  });
  const db = {
    state,
    prospect: table("prospects"),
    salesLead: table("leads"),
    salesQueueClaim: table("claims"),
    salesAttribution: {
      async updateMany() {
        state.attributionsTouched++;
        return { count: 0 };
      },
      async update() {
        state.attributionsTouched++;
      },
    },
    async $transaction(fn) {
      state.log.push("$transaction");
      return fn(db);
    },
  };
  return db;
}

const fixture = () => ({
  prospects: [
    { id: "p1", assignedRepId: "dan", assignedAt: new Date(NOW - 3 * HOUR), claimExpiresAt: new Date(NOW.getTime() + 45 * HOUR) },
    { id: "p2", assignedRepId: "dan", assignedAt: new Date(NOW - 20 * HOUR), claimExpiresAt: new Date(NOW.getTime() + 28 * HOUR) },
    { id: "p3", assignedRepId: "dan", assignedAt: new Date(NOW - 50 * HOUR), claimExpiresAt: null },
    { id: "p4", assignedRepId: "dan", assignedAt: new Date(NOW - 60 * HOUR), claimExpiresAt: new Date(NOW - 12 * HOUR) },
    { id: "p5", assignedRepId: "eve", assignedAt: new Date(NOW - HOUR), claimExpiresAt: new Date(NOW.getTime() + 47 * HOUR) },
  ],
  leads: [
    { id: "l1", salesRepId: "dan", status: "new", convertedCompanyId: null, prospectId: "p3" },
    { id: "l3", salesRepId: "dan", status: "signed", convertedCompanyId: "c1", prospectId: null },
    { id: "l5", salesRepId: "eve", status: "new", convertedCompanyId: null, prospectId: null },
  ],
  claims: [
    { id: "c1", salesRepId: "dan", prospectId: "p1", claimedAt: new Date(NOW - 3 * HOUR), mode: "batch", position: 0, releasedAt: null, workedAt: null },
    { id: "c2", salesRepId: "dan", prospectId: "p2", claimedAt: new Date(NOW - 20 * HOUR), mode: "batch", position: 1, releasedAt: null, workedAt: null },
    { id: "c3", salesRepId: "dan", prospectId: "p3", claimedAt: new Date(NOW - 50 * HOUR), mode: "single", position: 0, releasedAt: null, workedAt: new Date(NOW - 49 * HOUR) },
    { id: "c5", salesRepId: "eve", prospectId: "p5", claimedAt: new Date(NOW - HOUR), mode: "batch", position: 4, releasedAt: null, workedAt: null },
    { id: "c6", salesRepId: "eve", prospectId: "px", claimedAt: new Date(NOW - 2 * HOUR), mode: "batch", position: 9, releasedAt: new Date(NOW - HOUR), releaseReason: "rep", workedAt: null },
  ],
});

{
  const db = scriptedDb(fixture());
  const r = await reassignHeld({ db, fromRep: { id: "dan" }, toRep: { id: "eve", active: true }, now: NOW });
  ok("the move ran in a transaction", db.state.log.includes("$transaction"));
  ok("three prospects moved: two leases, one worked", r.prospects === 3 && r.leases === 2 && r.worked === 1, r);
  ok("one open lead moved; the converted one stayed", r.leads === 1 && db.state.leads.find((l) => l.id === "l3").salesRepId === "dan", r);
  const p1 = db.state.prospects.find((p) => p.id === "p1");
  ok("a lease now belongs to the target with a fresh expiry", p1.assignedRepId === "eve" && p1.claimExpiresAt.getTime() === NOW.getTime() + CLAIM_HOURS * HOUR, p1);
  const p3 = db.state.prospects.find((p) => p.id === "p3");
  ok("the worked row belongs to the target and is still worked", p3.assignedRepId === "eve" && p3.claimExpiresAt === null, p3);
  ok("the lapsed row was left alone", db.state.prospects.find((p) => p.id === "p4").assignedRepId === "dan");
  ok("the target's own row was left alone", db.state.prospects.find((p) => p.id === "p5").assignedAt.getTime() === NOW.getTime() - HOUR);
  const closed = db.state.claims.filter((c) => c.salesRepId === "dan" && c.releaseReason === "reassigned");
  ok("the old rep's OPEN claims closed as reassigned — and only those", closed.map((c) => c.id).sort().join(",") === "c1,c2", closed.map((c) => c.id));
  ok("the old rep's worked claim was not re-closed", db.state.claims.find((c) => c.id === "c3").releasedAt === null);
  const fresh = db.state.claims.filter((c) => c.salesRepId === "eve" && c.mode === "reassigned");
  ok("three new claims for the target", fresh.length === 3, fresh.length);
  ok("positions continue after the target's highest OPEN position (4), not the released 9",
    fresh.map((c) => c.position).sort().join(",") === "5,6,7", fresh.map((c) => c.position));
  ok("the new claim on the worked row is already worked", fresh.find((c) => c.prospectId === "p3").workedAt?.getTime() === NOW.getTime());
  ok("no attribution was touched", db.state.attributionsTouched === 0);
  ok("the result names the batch", typeof r.batchId === "string" && r.batchId.startsWith("reassigned_from:dan:"));

  const refused = await reassignHeld({ db: scriptedDb(fixture()), fromRep: { id: "dan" }, toRep: { id: "gone", active: false }, now: NOW });
  ok("an inactive target is refused before any read", Boolean(refused.error));
  const same = await reassignHeld({ db: scriptedDb(fixture()), fromRep: { id: "dan" }, toRep: { id: "dan", active: true }, now: NOW });
  ok("the same rep is refused", Boolean(same.error));
}

{
  // Between the read and the write, the cron releases p1 and somebody else
  // claims p2. Neither may be moved, and neither may be counted.
  const between = {
    done: false,
    run(state) {
      const p1 = state.prospects.find((p) => p.id === "p1");
      Object.assign(p1, { assignedRepId: null, assignedAt: null, claimExpiresAt: null });
      const p2 = state.prospects.find((p) => p.id === "p2");
      Object.assign(p2, { assignedRepId: "zed", assignedAt: new Date(NOW - 1000), claimExpiresAt: new Date(NOW.getTime() + 47 * HOUR) });
    },
  };
  const db = scriptedDb({ ...fixture(), between });
  const r = await reassignHeld({ db, fromRep: { id: "dan" }, toRep: { id: "eve", active: true }, now: NOW });
  ok("a row released between read and write is not moved", db.state.prospects.find((p) => p.id === "p1").assignedRepId === null);
  ok("a row claimed by a third rep between read and write is not overwritten", db.state.prospects.find((p) => p.id === "p2").assignedRepId === "zed");
  ok("…and neither is counted as moved", r.prospects === 1 && r.leases === 0 && r.worked === 1, r);
  ok("…and no claim row is written for them", db.state.claims.filter((c) => c.mode === "reassigned").length === 1);
  ok("…and their old claim rows were not closed as reassigned",
    db.state.claims.filter((c) => c.prospectId !== "p3" && c.releaseReason === "reassigned").length === 0);
}

{
  // releaseUntouched on a caller's transaction: the deactivation flow.
  const db = scriptedDb(fixture());
  for (const p of db.state.prospects) p.callAttempts = p.id === "p2" ? [{ dialledAt: new Date(NOW - HOUR) }] : [];
  const tx = db; // the scripted client doubles as its own transaction
  const r = await releaseUntouched({ db, tx, rep: { id: "dan" }, reason: "admin", includeDialled: true, now: NOW });
  ok("with a tx, releaseUntouched opens no transaction of its own", !db.state.log.includes("$transaction"), db.state.log);
  // p4's lease has lapsed. releaseUntouched has always swept a lapsed lease
  // along with the live ones — the row is already in the pool, so clearing
  // its columns changes nothing for anybody — and the console's release goes
  // through the same function, so it does too. Asserted so a change there is
  // noticed here.
  ok("includeDialled releases the dialled lease as well as the untouched one (and sweeps the lapsed one along, as it always has)",
    r.released === 3 && r.kept === 0 && r.releasedIds.includes("p2"), r);
  ok("…and never the worked row", db.state.prospects.find((p) => p.id === "p3").assignedRepId === "dan");
  ok("…closing the claims with reason admin", db.state.claims.filter((c) => c.releaseReason === "admin").length === 2);
  const db2 = scriptedDb(fixture());
  for (const p of db2.state.prospects) p.callAttempts = p.id === "p2" ? [{ dialledAt: new Date(NOW - HOUR) }] : [];
  const r2 = await releaseUntouched({ db: db2, rep: { id: "dan" }, reason: "admin", now: NOW });
  ok("without includeDialled the dialled lease is kept, as the rep's own button keeps it", r2.kept === 1 && !r2.releasedIds.includes("p2"), r2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. deactivationGate — pure");
// ═══════════════════════════════════════════════════════════════════════════
{
  const held = deactivationGate({ leased: 37, openLeads: 12, worked: 3 });
  ok("work held and no hand-off → 409", held.ok === false && held.status === 409, held);
  ok("…with the counts", held.counts.leased === 37 && held.counts.openLeads === 12 && held.counts.worked === 3, held.counts);
  ok("…and a sentence naming them", /37 prospects/.test(held.error) && /12 open leads/.test(held.error), held.error);

  const nothing = deactivationGate({ leased: 0, openLeads: 0, worked: 5 });
  ok("nothing on a lease and no open leads → proceeds, worked history notwithstanding", nothing.ok === true && nothing.handoff === null, nothing);
  ok("…whatever the body says", deactivationGate({ leased: 0, openLeads: 0, handoff: { prospects: "nonsense" } }).ok === true);

  const leadsOnly = deactivationGate({ leased: 0, openLeads: 2 });
  ok("open leads alone still gate", leadsOnly.ok === false && leadsOnly.status === 409);

  const releaseNoTarget = deactivationGate({ leased: 5, openLeads: 2, handoff: { prospects: "release" } });
  ok("release with open leads and no target → 409: leads can only be moved", releaseNoTarget.ok === false && releaseNoTarget.status === 409 && /only be moved/.test(releaseNoTarget.error), releaseNoTarget);
  const releaseOk = deactivationGate({ leased: 5, openLeads: 0, handoff: { prospects: "release" } });
  ok("release with no open leads needs no target", releaseOk.ok === true && releaseOk.handoff.prospects === "release" && releaseOk.handoff.toRepId === null, releaseOk);
  const releaseWithTarget = deactivationGate({ leased: 5, openLeads: 2, handoff: { prospects: "release", toRepId: "eve" } });
  ok("release plus a target for the leads → proceeds", releaseWithTarget.ok === true && releaseWithTarget.handoff.toRepId === "eve");
  const moveNoTarget = deactivationGate({ leased: 5, openLeads: 0, handoff: { prospects: "move" } });
  ok("move without a target → 400", moveNoTarget.ok === false && moveNoTarget.status === 400, moveNoTarget);
  const move = deactivationGate({ leased: 5, openLeads: 2, handoff: { prospects: "move", toRepId: "eve" } });
  ok("move with a target → proceeds", move.ok === true && move.handoff.prospects === "move" && move.handoff.toRepId === "eve");
  ok("a hostile handoff shape is a 409, not a crash", deactivationGate({ leased: 1, handoff: "release" }).status === 409);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The routes — release reused, attribution untouched, audit wired");
// ═══════════════════════════════════════════════════════════════════════════
{
  const repRoute = decomment(read("app/api/platform/sales/reps/[id]/route.js"));
  const queueRoute = decomment(read("app/api/platform/sales/reps/[id]/queue/route.js"));
  const listRoute = decomment(read("app/api/platform/sales/reps/route.js"));
  const reassign = decomment(read("lib/sales/reassign.js"));
  const page = decomment(read("app/platform/sales/reps/page.js"));

  ok("the queue route imports releaseUntouched from queueBatch",
    /import \{[^}]*\breleaseUntouched\b[^}]*\} from "@\/lib\/sales\/queueBatch"/.test(queueRoute));
  ok("the rep route imports releaseUntouched from queueBatch",
    /import \{[^}]*\breleaseUntouched\b[^}]*\} from "@\/lib\/sales\/queueBatch"/.test(repRoute));
  ok("the queue route calls it with reason admin", /releaseUntouched\(\{[^}]*reason: "admin"/.test(queueRoute));
  ok("…and 'release all' is the same call with includeDialled", /includeDialled/.test(queueRoute) && !/action === "release_all"[^;]*prospect\.updateMany/.test(queueRoute));
  for (const [name, src] of [["queue route", queueRoute], ["rep route", repRoute], ["reassign.js", reassign]]) {
    ok(`${name} defines no second release — never writes assignedRepId: null`, !/assignedRepId:\s*null/.test(src));
  }
  ok("the only sales-side writers of assignedRepId: null are queueBatch and the rep's own queue route",
    /assignedRepId:\s*null/.test(decomment(read("lib/sales/queueBatch.js"))) &&
      /assignedRepId:\s*null/.test(decomment(read("app/api/sales/queue/route.js"))));

  for (const [name, src] of [["queue route", queueRoute], ["rep route", repRoute], ["reassign.js", reassign], ["list route", listRoute]]) {
    ok(`${name} never writes salesAttribution`, !/salesAttribution\.(update|create|delete|upsert)/.test(src));
    ok(`${name} never writes salesCommissionEntry`, !/salesCommissionEntry\.(update|create|delete|upsert)/.test(src));
  }
  ok("the reassign audit row states attributionsMoved: 0", /attributionsMoved: 0/.test(queueRoute) && /attributionsMoved: 0/.test(repRoute));
  ok("the move confirm on the screen says attributions do not move", /attributions and commission do not move/.test(page) || /attributions and\s+commission never move/.test(page));

  ok("the rep route gates active:false through deactivationGate", /deactivationGate\(/.test(repRoute) && /active === false/.test(repRoute));
  ok("…refusing with the gate's status and counts", /status: gate\.status/.test(repRoute) && /counts: gate\.counts/.test(repRoute));
  ok("…counting fresh from the database on the request", /queueCountsFor\(\{ db, repIds: \[existing\.id\]/.test(repRoute));
  ok("…and the hand-off and the rep update ride one $transaction", /db\.\$transaction\(\s*async \(tx\) => \{\s*handled = await performHandoff\(\{ tx/.test(repRoute));
  ok("…with the target refused when inactive", /Work can only be moved to an active rep/.test(repRoute));
  ok("the rep route still has no DELETE", !/export async function DELETE/.test(repRoute));

  ok("the list route returns the counts on every rep", /queue: queueCounts\.get\(r\.id\)/.test(listRoute));
  ok("the queue route answers GET with presence from presenceFor", /presenceFor\(\[rep\.id\]/.test(queueRoute));
  ok("…and the hand-off targets", /handoffTargets\(\{ db, admin/.test(queueRoute));
  ok("both routes are superadmin-only", /admin\.role !== "superadmin"/.test(queueRoute) && /admin\.role !== "superadmin"/.test(repRoute));

  for (const action of ["sales_rep_queue_released", "sales_rep_queue_reassigned"]) {
    ok(`"${action}" has wording on the audit log`, Boolean(AUDIT_ACTIONS[action]), AUDIT_ACTIONS[action]);
    ok(`…and the queue route writes it`, new RegExp(`action: "${action}"`).test(queueRoute));
    ok(`…and the rep route writes it on deactivation`, new RegExp(`action: "${action}"`).test(repRoute));
  }
  ok("the wording says what a release is", /Released a rep's held prospects/.test(AUDIT_ACTIONS.sales_rep_queue_released?.label || ""));
  ok("the wording says what a move is", /Moved a rep's queue and leads/.test(AUDIT_ACTIONS.sales_rep_queue_reassigned?.label || ""));

  ok("the screen opens the hand-off panel on the 409", /err\.status === 409 && err\.data\?\.counts/.test(page));
  ok("the screen sends the hand-off with active: false", /active: false,\s*handoff: \{ prospects: d\.prospects/.test(page));
  ok("the screen's release-all confirm says the dialled rows lose their place, and nothing else", /lose their place in \$\{rep\.name\}'s list/.test(page) && /Nothing is deleted/.test(page));
  ok("the screen prints a stale presence as stale", /stale\. This is the disconnected-and-not-reconnected case/.test(page));
  ok("the screen wires check:platform-rep-queue into check:all", /check:platform-rep-queue/.test(JSON.parse(read("package.json")).scripts["check:all"]));
}

// ═══════════════════════════════════════════════════════════════════════════
section('6. "Me" — a match by sign-in email, or an honest absence');
// ═══════════════════════════════════════════════════════════════════════════
{
  const reps = [
    { id: "dan", name: "Daniel", code: "dan", email: "dan@x.com", active: true },
    { id: "eve", name: "Eve", code: "eve", email: "Owner@FieldQuo.com", active: true },
    { id: "gone", name: "Gone", code: "gone", email: "gone@x.com", active: false },
  ];
  const mk = (adminEmail) => ({
    salesRep: { async findMany({ where }) { return reps.filter((r) => matches(r, where)); } },
    platformAdmin: { async findUnique() { return adminEmail ? { email: adminEmail } : null; } },
  });
  const withMe = await handoffTargets({ db: mk("owner@fieldquo.com"), admin: { id: "a1" }, excludeRepId: "dan" });
  ok("the rep being moved from is not a target", !withMe.targets.some((t) => t.id === "dan"));
  ok("an inactive rep is not a target", !withMe.targets.some((t) => t.id === "gone"));
  ok("the superadmin's own rep row is found by sign-in email, case-insensitively", withMe.me?.id === "eve", withMe.me);
  ok("…and flagged in the list", withMe.targets.find((t) => t.id === "eve")?.isMe === true);
  ok("…and the note says how it was matched", /matched by sign-in email/.test(withMe.meNote));
  const without = await handoffTargets({ db: mk("nobody@fieldquo.com"), admin: { id: "a1" }, excludeRepId: "dan" });
  ok("a superadmin with no rep account gets no 'me'", without.me === null);
  ok("…and is told so rather than shown one", /no sales rep account/.test(without.meNote) && without.targets.every((t) => !t.isMe));
}

console.log(`\n${failures.length === 0 ? "ALL PASS" : "FAILED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
