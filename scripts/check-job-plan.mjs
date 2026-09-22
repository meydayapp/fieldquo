// scripts/check-job-plan.mjs
//
//   npm run check:job-plan
//
// The job plan, change-order approval and client progress view, executed:
//
//   1. lib/jobs/plan.js — a real paint takeoff becomes steps with hours per
//      line, default dependencies, derived "waiting on" status and the gate
//      that refuses a start; cycles refused; the crew day view invents no time.
//   2. lib/jobs/buildPlan.js — idempotent creation: run twice on the same
//      quote, one plan; a hand-added step survives a rebuild; a P2002 race
//      is read as "already there".
//   3. lib/jobs/changeOrderAddendum.js — the sanitiser against XSS payloads,
//      the signature refused without a name / mark / consent, the hash, the
//      money on the addendum, hostile form input.
//   4. lib/jobs/changeOrderDecision.js — send puts the step on hold, the
//      client's approval releases it and writes the change into the step; a
//      change order against a line adds ONE step, after that line's step;
//      the finish moves once.
//   5. lib/jobs/changeOrderValue.js — the invoice line is labelled with the
//      change order's number and the approval; a waiting change order is not
//      billed.
//   6. The public and portal payloads never carry an internal note, an hour
//      figure or a price per step — asserted against the route sources,
//      since both routes read the live database.
//
// Same reasoning as scripts/check-task-suggestions.mjs: pure, security-
// relevant logic gets executed against hostile input, not read.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  planFromQuote,
  paintDependencyDefaults,
  planStatus,
  dependencyGate,
  gateMessage,
  wouldCycle,
  crewDayLanes,
  clockedByTask,
  planSummary,
  planProgress,
  orderPlan,
  lineKey,
  planSourceKey,
  takeoffLinesForGroup,
} from "@/lib/jobs/plan";
import { ensurePlanForJob } from "@/lib/jobs/buildPlan";
import {
  sanitiseChangeOrderBody,
  changeOrderBodyText,
  changeOrderLabel,
  hashChangeOrder,
  buildChangeOrderSignature,
  verifyChangeOrderSignature,
  addendumMoney,
  quoteTaxRate,
  normaliseChangeOrderInput,
  snapshotQuoteLine,
  SIGNATURE_MAX_BYTES,
} from "@/lib/jobs/changeOrderAddendum";
import { applyChangeOrderDecision } from "@/lib/jobs/changeOrderDecision";
import { billChangeOrders, changeOrderSummary, CHANGE_ORDER_STATUSES } from "@/lib/jobs/changeOrderValue";
import { normalisePlanFields } from "@/lib/tasks/planFields";
import { attachSteps, buildJobOptions } from "@/lib/timeclock/jobChoices";
import { newPaintArea, newPaintSubstrate, PAINT_TAKEOFF_DEFAULTS } from "@/lib/pricing/paintTakeoff";
import { buildTradeLineItems } from "@/lib/pricing/tradeScope";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";

let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (!cond) {
    failures.push(name);
    console.error(`  FAIL ${name}${detail !== undefined ? `\n       ${detail}` : ""}`);
    return;
  }
  passed += 1;
  console.log(`  ok   ${name}`);
}
const eq = (name, actual, expected) => ok(name, JSON.stringify(actual) === JSON.stringify(expected), `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const section = (t) => console.log(`\n${t}\n`);

// ── A tiny Prisma for the two db helpers ───────────────────────────────────
//
// Only what buildPlan.js and changeOrderDecision.js call: findUnique/First/
// Many with the where shapes they use, create (with the nested dependsOn
// create), createMany skipDuplicates, update, updateMany, aggregate _max,
// count. Task.sourceKey and TaskDependency (taskId, dependsOnId) are unique,
// and a second insert throws { code: "P2002" } exactly as Prisma does — the
// idempotency claim is a property of that constraint.
function miniDb() {
  let seq = 0;
  const id = (p) => `${p}_${++seq}`;
  const T = { job: [], quote: [], companyServiceCategory: [], member: [], task: [], taskDependency: [], changeOrder: [] };
  const UNIQ = { task: [["sourceKey"]], taskDependency: [["taskId", "dependsOnId"]] };
  const matchVal = (rowVal, cond) => {
    if (cond && typeof cond === "object" && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ("in" in cond) return cond.in.includes(rowVal);
      if ("not" in cond) return rowVal !== cond.not;
      throw new Error(`miniDb: unsupported ${JSON.stringify(cond)}`);
    }
    return rowVal === cond || (rowVal == null && cond == null);
  };
  const matches = (t, row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "NOT") return !matches(t, row, v);
      if (k === "task" && t === "taskDependency") return matches("task", T.task.find((x) => x.id === row.taskId) || {}, v);
      if (k === "job" && t === "changeOrder") return matches("job", T.job.find((x) => x.id === row.jobId) || {}, v);
      return matchVal(row[k], v);
    });
  const shape = (t, row, { select, include } = {}) => {
    if (!row) return null;
    const out = {};
    const keys = select ? Object.keys(select).filter((k) => select[k]) : Object.keys(row);
    for (const k of keys) {
      const spec = select?.[k];
      if (k === "quote" && t === "job") out.quote = row.quoteId ? shape("quote", T.quote.find((q) => q.id === row.quoteId), typeof spec === "object" ? spec : {}) : null;
      else if (k === "job" && t === "changeOrder") out.job = shape("job", T.job.find((j) => j.id === row.jobId), typeof spec === "object" ? spec : {});
      else if (k === "scopeGroups" && t === "quote") out.scopeGroups = (row.scopeGroups || []).map((g) => ({ ...g }));
      else if (k === "addOns" && t === "quote") out.addOns = (row.addOns || []).map((a) => ({ ...a }));
      else if (k === "client" && t === "quote") out.client = row.client || null;
      else if (k === "user" && t === "member") out.user = row.user || null;
      else out[k] = row[k];
    }
    if (include?.dependsOn && t === "task") out.dependsOn = T.taskDependency.filter((d) => d.taskId === row.id).map((d) => ({ dependsOn: T.task.find((x) => x.id === d.dependsOnId) }));
    return out;
  };
  const insert = (t, data) => {
    for (const cols of UNIQ[t] || []) {
      if (T[t].some((r) => cols.every((c) => r[c] != null && r[c] === data[c]))) {
        const err = new Error(`Unique constraint failed on ${cols.join(",")}`);
        err.code = "P2002";
        throw err;
      }
    }
    const { dependsOn, ...rest } = data;
    const row = { id: id(t), createdAt: new Date(), updatedAt: new Date(), ...rest };
    if (t === "task") row.status = row.status || "open";
    T[t].push(row);
    if (dependsOn?.create) for (const d of dependsOn.create) insert("taskDependency", { taskId: row.id, dependsOnId: d.dependsOnId });
    return row;
  };
  const api = {};
  for (const t of Object.keys(T)) {
    api[t] = {
      findUnique: async ({ where, select, include }) => shape(t, T[t].find((r) => matches(t, r, where)) || null, { select, include }),
      findFirst: async ({ where, select, include }) => shape(t, T[t].find((r) => matches(t, r, where)) || null, { select, include }),
      findMany: async ({ where, select, include, orderBy } = {}) => {
        let rows = T[t].filter((r) => matches(t, r, where || {}));
        const ob = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        for (const o of ob.reverse()) {
          const [k, dir] = Object.entries(o)[0];
          rows = [...rows].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (dir === "desc" ? -1 : 1));
        }
        return rows.map((r) => shape(t, r, { select, include }));
      },
      create: async ({ data, select, include }) => shape(t, insert(t, data), { select, include }),
      createMany: async ({ data, skipDuplicates }) => {
        let count = 0;
        for (const d of data) {
          try {
            insert(t, d);
            count += 1;
          } catch (err) {
            if (!(skipDuplicates && err.code === "P2002")) throw err;
          }
        }
        return { count };
      },
      update: async ({ where, data, select, include }) => {
        const row = T[t].find((r) => matches(t, r, where));
        if (!row) throw new Error(`${t}.update: no row`);
        Object.assign(row, data, { updatedAt: new Date() });
        return shape(t, row, { select, include });
      },
      updateMany: async ({ where, data }) => {
        const hits = T[t].filter((r) => matches(t, r, where));
        for (const r of hits) Object.assign(r, data);
        return { count: hits.length };
      },
      aggregate: async ({ where, _max }) => {
        const rows = T[t].filter((r) => matches(t, r, where));
        const k = Object.keys(_max)[0];
        return { _max: { [k]: rows.length ? Math.max(...rows.map((r) => r[k])) : null } };
      },
      count: async ({ where } = {}) => T[t].filter((r) => matches(t, r, where || {})).length,
    };
  }
  api.tables = T;
  return api;
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. From the quote — a real paint takeoff becomes a plan");

const B = PAINT_TAKEOFF_DEFAULTS;
const sub = (key, patch = {}) => ({ ...newPaintSubstrate(key, B), ...patch });
const takeoff = {
  model: "area_substrate",
  areas: [
    { ...newPaintArea("den", B), label: "Living room", lengthFt: 14, widthFt: 16, heightFt: 9, prepHours: 2, substrates: [sub("ceiling"), sub("walls"), sub("baseboard"), sub("door", { quantity: 2 })] },
    { ...newPaintArea("den", B), label: "Hallway", lengthFt: 4, widthFt: 12, heightFt: 9, substrates: [sub("walls"), sub("ceiling")] },
  ],
};
const lines = buildTradeLineItems("interior_painting", takeoff, null);
ok("the builder emits priced lines for the takeoff", lines.length >= 7, `${lines.length} lines`);

const quote = {
  id: "q1",
  scopeGroups: [
    { id: "g1", sortOrder: 0, categoryId: "c1", category: { key: "interior_painting" }, takeoff, lineItems: [...lines, { description: "Haul away and site clean", quantity: 1, amount: 120 }] },
    { id: "g2", sortOrder: 1, categoryId: "c2", category: { key: "general" }, takeoff: null, lineItems: [{ description: "Subcontracted electrical", quantity: 1, amount: 900 }] },
  ],
  addOns: [
    { id: "a1", description: "Accent wall — Hale Navy", detail: "Dining", selected: true, sortOrder: 0 },
    { id: "a2", description: "Ceiling medallion", selected: false, sortOrder: 1 },
  ],
};

const { specs, edges } = planFromQuote(quote);
eq("one step per visible line plus each TICKED option", specs.length, lines.length + 1 + 1 + 1);
ok("the unticked option is not work", !specs.some((s) => s.title === "Ceiling medallion"));
const withHours = specs.filter((s) => s.estimatedHours !== null);
eq("every takeoff line carries hours; the hand-typed and subcontract lines do not", withHours.length, lines.length);
ok("hours are positive and rounded", withHours.every((s) => s.estimatedHours > 0 && Math.round(s.estimatedHours * 100) === s.estimatedHours * 100));
ok("a wall line carries its product key for the buy list", specs.some((s) => s.materialKeys.includes("wall_interior")));
ok("line numbers run 1..N across groups", specs.filter((s) => s.quoteLineNo).map((s) => s.quoteLineNo).join(",") === Array.from({ length: lines.length + 2 }, (_, i) => i + 1).join(","));
eq("source keys are unique", new Set(specs.map((s) => s.sourceKey)).size, specs.length);
ok("a line's sourceKey names the quote, the group and the ordinal", specs[0].sourceKey === planSourceKey.line("q1", lineKey("g1", 0)));

// Dependencies: prep → ceiling → walls → trim within the living room; the
// hallway is its own area; the hand-typed line and the option get none.
const bySrc = Object.fromEntries(specs.map((s) => [s.sourceKey, s]));
const dep = (title) => edges.filter(([from]) => bySrc[from].title.startsWith(title)).map(([, to]) => bySrc[to].title);
ok("the living-room ceiling waits on the prep", dep("Living room — Ceiling").some((t) => t.includes("additional prep")));
ok("the living-room walls wait on the ceiling", dep("Living room — Walls").some((t) => t.includes("Ceiling")));
ok("the baseboard waits on the walls", dep("Living room — Baseboard").some((t) => t.includes("Walls")));
ok("the doors wait on the walls too", dep("Living room — Door").some((t) => t.includes("Walls")));
ok("the hallway walls wait on the HALLWAY ceiling, not the living room's", dep("Hallway — Walls").every((t) => t.startsWith("Hallway")));
eq("the hand-typed line has no invented dependency", dep("Haul away").length, 0);
eq("the ticked option has no invented dependency", dep("Accent wall").length, 0);
ok("no edge points at itself", edges.every(([a, b]) => a !== b));

// Ordinal safety: a stored line that no longer matches the takeoff's own
// description gets NO hours rather than a neighbour's.
{
  const drift = JSON.parse(JSON.stringify(quote));
  drift.scopeGroups[0].lineItems[1].description = "Somebody edited this line";
  const s2 = planFromQuote(drift).specs;
  eq("an edited line is withheld hours instead of taking the next line's", s2[1].estimatedHours, null);
  ok("its neighbours keep theirs", s2[0].estimatedHours > 0 && s2[2].estimatedHours > 0);
}
{
  const legacy = { ...quote, scopeGroups: [{ id: "g9", category: { key: "interior_painting" }, takeoff: { rooms: [{ title: "Room" }] }, lineItems: [{ description: "Interior painting", amount: 1000 }] }] };
  eq("a pre-model takeoff yields a step with no hours, not a crash", planFromQuote(legacy).specs[0].estimatedHours, null);
}
eq("no quote at all is an empty plan", planFromQuote(null).specs.length, 0);
eq("hostile line items are skipped, not thrown on", planFromQuote({ id: "q", scopeGroups: [{ id: "g", lineItems: [null, 7, "x", { description: "" }, { description: "ok", amount: 1 }] }] }).specs.length, 1);
eq("takeoffLinesForGroup on garbage is null", takeoffLinesForGroup({ category: { key: "interior_painting" }, takeoff: "nope" }), null);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Waiting on, derived — and the gate");

const walls = { id: "t2", title: "Walls", status: "open" };
const ceiling = { id: "t1", title: "Ceilings", status: "open" };
eq("a step whose blocker is open is waiting on it", planStatus(walls, [ceiling]).status, "waiting");
eq("…and names it", planStatus(walls, [ceiling]).waitingOn[0].label, "Ceilings");
eq("the blocker done → not started", planStatus(walls, [{ ...ceiling, status: "done" }]).status, "not_started");
eq("the blocker CANCELLED also releases it", planStatus(walls, [{ ...ceiling, status: "cancelled" }]).status, "not_started");
eq("a hold reason makes it waiting even in progress", planStatus({ ...walls, status: "in_progress", waitingReason: "paint delivery" }, []).status, "waiting");
eq("an unsigned change order holds the step", planStatus({ ...walls, waitingOnChangeOrderId: "co1" }, [], { id: "co1", status: "waiting_client", label: "CO-2" }).waitingOn[0].kind, "change_order");
eq("a signed one releases it", planStatus({ ...walls, waitingOnChangeOrderId: "co1" }, [], { id: "co1", status: "approved", label: "CO-2" }).status, "not_started");
eq("a rejected one releases it too", planStatus({ ...walls, waitingOnChangeOrderId: "co1" }, [], { id: "co1", status: "rejected" }).status, "not_started");
eq("a change order that cannot be found still holds (fail closed)", planStatus({ ...walls, waitingOnChangeOrderId: "co9" }, [], null).status, "waiting");
eq("done is done whatever it waits on", planStatus({ ...walls, status: "done", waitingReason: "x" }, [ceiling]).status, "done");
eq("garbage in → not started, no throw", planStatus(null, "nope", 5).status, "not_started");

let g = dependencyGate(walls, "in_progress", [ceiling]);
eq("start refused while the ceiling is open", g.ok, false);
eq("the refusal names the blocker", gateMessage(g.blockedBy), "Waiting on Ceilings.");
eq("done refused for the same reason", dependencyGate(walls, "done", [ceiling]).ok, false);
eq("start allowed once the ceiling is done", dependencyGate(walls, "in_progress", [{ ...ceiling, status: "done" }]).ok, true);
eq("an external hold does NOT block a start — starting is how the hold ends", dependencyGate({ ...walls, waitingReason: "delivery" }, "in_progress", []).ok, true);
eq("the client's unsigned change order blocks", dependencyGate({ ...walls, waitingOnChangeOrderId: "co1" }, "in_progress", [], { status: "waiting_client", label: "CO-2" }).ok, false);
ok("…and the message says so", gateMessage(dependencyGate({ ...walls, waitingOnChangeOrderId: "co1" }, "in_progress", [], { status: "waiting_client", label: "CO-2" }).blockedBy).includes("client approval of CO-2"));
eq("reopening is never gated", dependencyGate({ ...walls, status: "done" }, "open", [ceiling]).ok, true);
eq("cancelling is never gated", dependencyGate(walls, "cancelled", [ceiling]).ok, true);

eq("a self-edge is a cycle", wouldCycle([], [["a", "a"]]), true);
eq("a → b, then b → a is a cycle", wouldCycle([["a", "b"]], [["b", "a"]]), true);
eq("a → b → c, then c → a is a cycle", wouldCycle([["a", "b"], ["b", "c"]], [["c", "a"]]), true);
eq("a → b, c → b is fine", wouldCycle([["a", "b"]], [["c", "b"]]), false);

// ═══════════════════════════════════════════════════════════════════════════
section("3. Reading a plan: order, summary, hours, the day view");

const steps = [
  { id: "s1", title: "Prep", status: "done", sortOrder: 0, estimatedHours: 3, clockedHours: 2.5, dueDate: "2026-09-21T13:00:00Z", assignedTo: { id: "u1", name: "Marco" } },
  { id: "s2", title: "Ceilings", status: "in_progress", sortOrder: 1, estimatedHours: 6, clockedHours: 4, dueDate: "2026-09-23T13:00:00Z", assignedTo: { id: "u2", name: "Dani" } },
  { id: "s3", title: "Walls", status: "open", sortOrder: 2, estimatedHours: 8, scheduledStart: "2026-09-23T12:00:00Z", scheduledEnd: "2026-09-23T16:00:00Z", assignedTo: { id: "u1", name: "Marco" } },
  { id: "s4", title: "Trim", status: "open", sortOrder: 3, estimatedHours: 7, dueDate: "2026-09-23T13:00:00Z" },
  { id: "s5", title: "Cancelled thing", status: "cancelled", sortOrder: 4, estimatedHours: 99, dueDate: "2026-09-23T13:00:00Z" },
];
eq("summary: cancelled steps count toward nothing", planSummary(steps), { count: 4, done: 1, estimatedHours: 24, clockedHours: 6.5 });
eq("progress fractions", planProgress(steps), { done: 0.25, inProgress: 0.25, total: 4 });
eq("orderPlan honours sortOrder", orderPlan([steps[2], steps[0]]).map((s) => s.id), ["s1", "s3"]);
const entries = [
  { taskId: "s1", hours: 2.5, clockOut: "2026-09-21T20:00:00Z" },
  { taskId: "s1", hours: 1, clockOut: null }, // still open: not worked yet
  { taskId: null, hours: 3, clockOut: "2026-09-21T20:00:00Z" },
  { taskId: "s2", hours: "4.00", clockOut: "2026-09-22T20:00:00Z" },
  { taskId: "s2", hours: NaN, clockOut: "2026-09-22T20:00:00Z" },
];
const clocked = clockedByTask(entries);
eq("clocked per step: open entries and NaN hours contribute nothing", [clocked.perTask.get("s1"), clocked.perTask.get("s2")], [2.5, 4]);
eq("the job total includes hours booked to no step", clocked.total, 9.5);

const lanes = crewDayLanes(steps, { day: "2026-09-23", timezone: "America/Toronto" });
eq("lanes: Dani, Marco, then Unassigned; the cancelled step is not drawn", lanes.map((l) => [l.name, l.blocks.map((b) => b.id)]), [["Dani", ["s2"]], ["Marco", ["s3"]], [null, ["s4"]]]);
eq("planned hours per lane", lanes.map((l) => l.plannedHours), [6, 8, 7]);
ok("a block without scheduled times has no invented start", lanes[0].blocks[0].scheduledStart === undefined);
eq("a day with nothing has no lanes", crewDayLanes(steps, { day: "2026-10-01" }).length, 0);
eq("hostile steps do not throw", crewDayLanes([null, 3, { dueDate: "garbage" }], { day: "2026-09-23" }).length, 0);

// ═══════════════════════════════════════════════════════════════════════════
section("4. buildPlan — idempotent, and a hand-added step survives");

{
  const db = miniDb();
  db.tables.quote.push({ ...quote, companyId: "co", clientId: "cl" });
  db.tables.job.push({ id: "j1", companyId: "co", clientId: "cl", quoteId: "q1", historicalImportedAt: null });
  db.tables.member.push({ companyId: "co", active: true, role: "owner", userId: "owner1", user: { id: "owner1", name: "Owner" } });

  const first = await ensurePlanForJob("j1", { db });
  eq("first run creates every step", [first.ok, first.created, first.existing, first.reason], [true, specs.length, 0, null]);
  ok("edges were written", first.edges > 0);
  const second = await ensurePlanForJob("j1", { db });
  eq("second run creates nothing", [second.ok, second.created, second.existing], [true, 0, specs.length]);
  eq("still one row per source key", db.tables.task.length, specs.length);
  eq("steps are born visible to the client and flagged as plan steps", db.tables.task.every((t) => t.planStep && t.clientVisible), true);
  ok("every step has an author", db.tables.task.every((t) => t.createdById === "owner1"));

  // A hand-added step, then the quote gains a line: rebuild adds only the
  // new line, keeps the hand-added one, and keeps a deleted default edge gone.
  db.tables.task.push({ id: "hand", companyId: "co", jobId: "j1", planStep: true, title: "Extra step somebody typed", sortOrder: 99, status: "open", createdAt: new Date() });
  const removedEdge = db.tables.taskDependency.pop();
  db.tables.quote[0].scopeGroups[1].lineItems.push({ description: "New line added later", amount: 50 });
  const third = await ensurePlanForJob("j1", { db });
  eq("rebuild adds exactly the new line", third.created, 1);
  ok("the hand-added step is still there", db.tables.task.some((t) => t.id === "hand"));
  ok("the edge somebody deleted did not come back", !db.tables.taskDependency.some((d) => d.taskId === removedEdge.taskId && d.dependsOnId === removedEdge.dependsOnId));
  ok("the new step sorts after everything", db.tables.task.find((t) => t.title === "New line added later").sortOrder > 99);

  // A race: another request inserted the row between our read and our write.
  const db2 = miniDb();
  db2.tables.quote.push({ ...quote, companyId: "co", clientId: "cl" });
  db2.tables.job.push({ id: "j1", companyId: "co", clientId: "cl", quoteId: "q1" });
  db2.tables.member.push({ companyId: "co", active: true, role: "owner", userId: "owner1", user: { id: "owner1", name: "Owner" } });
  const realCreate = db2.task.create;
  let raced = false;
  db2.task.create = async (args) => {
    if (!raced) {
      raced = true;
      await realCreate({ data: { ...args.data, title: "the other request's row" } });
    }
    return realCreate(args);
  };
  const r = await ensurePlanForJob("j1", { db: db2 });
  eq("P2002 is read as 'already there', not a failure", [r.ok, r.existing], [true, 1]);
  eq("…and the plan has one row for that key", db2.tables.task.filter((t) => t.sourceKey === specs[0].sourceKey).length, 1);

  eq("a historical job gets no plan", (await ensurePlanForJob("jh", { db: Object.assign(miniDb(), {}) })).reason, "no_job");
  const db3 = miniDb();
  db3.tables.job.push({ id: "jh", companyId: "co", quoteId: null, historicalImportedAt: new Date() });
  eq("a past job entered after the fact gets no plan", (await ensurePlanForJob("jh", { db: db3 })).reason, "historical");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The addendum — sanitiser, signature, money, form input");

const XSS = [
  ['<script>alert(1)</script>bold', "bold"],
  ['<b onclick="x()">safe</b>', "<b>safe</b>"],
  ['<a href="javascript:alert(1)">x</a>', "<span>x</span>"],
  ['<a href="java&#115;cript:alert(1)">x</a>', "<span>x</span>"],
  ['<a href="https://example.com/p?a=1&b=2">x</a>', '<a href="https://example.com/p?a=1&amp;b=2" rel="noopener noreferrer">x</a>'],
  ['<img src=x onerror=alert(1)>text', "text"],
  ["<iframe src=//evil></iframe>ok", "ok"],
  ["<b>unclosed <i>nested", "<b>unclosed <i>nested</i></b>"],
  ["</b>stray closer", "stray closer"],
  ["<ul><li>one</li><li>two</li></ul>", "<ul><li>one</li><li>two</li></ul>"],
  ["<p style=\"color:red\">p</p>", "<p>p</p>"],
  ["a < b and c > d", "a &lt; b and c &gt; d"],
  ["x <b y", "x &lt;b y"],
  ["<b>ok</b> < not a tag", "<b>ok</b> &lt; not a tag"],
  ['"quotes" & ampersands', "&quot;quotes&quot; &amp; ampersands"],
  ["<style>body{display:none}</style>visible", "visible"],
  ["   ", ""],
  ["<b></b><i></i>", ""],
  ["<BR>line<Br/>", "<br>line<br>"],
];
for (const [input, expected] of XSS) eq(`sanitise ${JSON.stringify(input).slice(0, 48)}`, sanitiseChangeOrderBody(input), expected);
eq("sanitise: non-string → empty", sanitiseChangeOrderBody({ toString: () => "<script>" }), "");
ok("sanitise: output never contains a script or an event handler", !/on\w+=|<script|javascript:/i.test(sanitiseChangeOrderBody('<div onload="x"><script>1</script><a href="JAVASCRIPT:1">l</a></div>')));
ok("sanitise: bounded length", sanitiseChangeOrderBody("x".repeat(100000)).length <= 8000);
eq("body → text keeps the reading order", changeOrderBodyText("<p>Crack ran <b>1.2 m</b> further.</p><ul><li>taped</li><li>skimmed</li></ul>"), "Crack ran 1.2 m further.\n• taped\n• skimmed");

const rows = [{ id: "c1", createdAt: "2026-09-18" }, { id: "c2", createdAt: "2026-09-21" }];
eq("labels from seq", changeOrderLabel({ id: "x", seq: 3 }), "CO-3");
eq("legacy rows are numbered by age", [changeOrderLabel(rows[0], rows), changeOrderLabel(rows[1], rows)], ["CO-1", "CO-2"]);
eq("an unknown row is not given a number", changeOrderLabel({ id: "zz" }, rows), "CO-?");

const co = { id: "co1", jobId: "j1", description: "Second coat", bodyHtml: "<b>x</b>", priceDelta: "640.00", scheduleDeltaDays: 1, quoteLineKey: "g1:2", taskId: null, photos: [] };
const h = hashChangeOrder(co);
eq("the hash is sha256 hex", h.length, 64);
ok("the hash is stable across key order", hashChangeOrder({ photos: [], taskId: null, quoteLineKey: "g1:2", scheduleDeltaDays: 1, priceDelta: "640.00", bodyHtml: "<b>x</b>", description: "Second coat", jobId: "j1", id: "co1" }) === h);
ok("changing the delta changes the hash", hashChangeOrder({ ...co, priceDelta: 641 }) !== h);
ok("changing the body changes the hash", hashChangeOrder({ ...co, bodyHtml: "<b>y</b>" }) !== h);
ok("matches a hand computation", createHash("sha256").update(JSON.stringify([["id", "co1"], ["jobId", "j1"], ["description", "Second coat"], ["bodyHtml", "<b>x</b>"], ["priceDelta", "640.00"], ["scheduleDeltaDays", 1], ["quoteLineKey", "g1:2"], ["taskId", null], ["photos", []]])).digest("hex") === h);

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const sig = buildChangeOrderSignature({ changeOrder: co, name: " Libby Angelos ", signatureDataUrl: png, consent: true, ip: "1.2.3.4", userAgent: "UA" });
ok("a full signature is built", sig && sig.name === "Libby Angelos" && sig.consent === true && sig.documentHash === h && sig.ip === "1.2.3.4");
eq("no name → refused", buildChangeOrderSignature({ changeOrder: co, name: "  ", signatureDataUrl: png, consent: true }), null);
eq("no mark → refused", buildChangeOrderSignature({ changeOrder: co, name: "L", signatureDataUrl: "", consent: true }), null);
eq("consent as a string is not consent", buildChangeOrderSignature({ changeOrder: co, name: "L", signatureDataUrl: png, consent: "true" }), null);
eq("consent false → refused", buildChangeOrderSignature({ changeOrder: co, name: "L", signatureDataUrl: png, consent: false }), null);
eq("a data URL that is not an image → refused", buildChangeOrderSignature({ changeOrder: co, name: "L", signatureDataUrl: "data:text/html;base64,PHNjcmlwdD4=", consent: true }), null);
eq("an SVG (scriptable) → refused", buildChangeOrderSignature({ changeOrder: co, name: "L", signatureDataUrl: "data:image/svg+xml;base64,PHN2Zz4=", consent: true }), null);
eq("a mark bigger than the cap → refused", buildChangeOrderSignature({ changeOrder: co, name: "L", signatureDataUrl: `data:image/png;base64,${"A".repeat(SIGNATURE_MAX_BYTES)}`, consent: true }), null);
eq("verify: untouched → true", verifyChangeOrderSignature(co, sig), true);
eq("verify: the delta was edited after signing → false", verifyChangeOrderSignature({ ...co, priceDelta: 900 }, sig), false);
eq("verify: no hash → false", verifyChangeOrderSignature(co, { name: "x" }), false);

eq("quote tax rate from accepted figures", quoteTaxRate({ acceptedSubtotal: 1000, acceptedTax: 130, discount: 0, subtotal: 999, tax: 1 }), 0.13);
eq("no tax → 0", quoteTaxRate({ subtotal: 1000, tax: 0 }), 0);
eq("tax with nothing to have charged it on → null", quoteTaxRate({ subtotal: 0, tax: 50 }), null);
eq("addendum money at 13%", addendumMoney({ quoteTotal: 5472.1, priorApproved: 0, delta: 640, taxRate: 0.13 }), { quoteTotal: 5472.1, priorApproved: 0, change: 640, taxRate: 0.13, tax: 83.2, changeWithTax: 723.2, newTotal: 6195.3, taxKnown: true });
eq("prior approved changes carry their tax into the base", addendumMoney({ quoteTotal: 1000, priorApproved: 100, delta: 100, taxRate: 0.1 }).newTotal, 1220);
eq("unknown rate: no tax line, and it says so", [addendumMoney({ quoteTotal: 100, delta: 10, taxRate: null }).tax, addendumMoney({ quoteTotal: 100, delta: 10, taxRate: null }).taxKnown], [null, false]);
eq("a credit is a negative change with negative tax", addendumMoney({ quoteTotal: 1000, delta: -100, taxRate: 0.1 }).changeWithTax, -110);
eq("garbage in → zeros, no NaN", JSON.stringify(addendumMoney({ quoteTotal: "abc", delta: undefined, taxRate: "x" })).includes("null") === false && !JSON.stringify(addendumMoney({ quoteTotal: "abc", delta: undefined, taxRate: "x" })).includes("NaN"), true);

let n = normaliseChangeOrderInput({ description: " Second coat ", priceDelta: "640.004", scheduleDeltaDays: "1", photos: ["https://a/b.jpg", "http://insecure/x.jpg", "javascript:1", 7], bodyHtml: "<script>x</script>ok", quoteLineKey: "g1:2" });
eq("form input normalised", n, { ok: true, value: { description: "Second coat", priceDelta: 640, scheduleDeltaDays: 1, photos: ["https://a/b.jpg"], bodyHtml: "ok", quoteLineKey: "g1:2", taskId: null } });
eq("blank description refused", normaliseChangeOrderInput({ description: "", priceDelta: 1 }).ok, false);
eq("non-numeric delta refused", normaliseChangeOrderInput({ description: "x", priceDelta: "lots" }).ok, false);
eq("fractional days refused", normaliseChangeOrderInput({ description: "x", priceDelta: 1, scheduleDeltaDays: 1.5 }).ok, false);
eq("a year+ of days refused", normaliseChangeOrderInput({ description: "x", priceDelta: 1, scheduleDeltaDays: 400 }).ok, false);
eq("blank days is 'not stated', not zero", normaliseChangeOrderInput({ description: "x", priceDelta: 1, scheduleDeltaDays: "" }).value.scheduleDeltaDays, null);
eq("line AND task refused", normaliseChangeOrderInput({ description: "x", priceDelta: 1, quoteLineKey: "a:1", taskId: "t" }).ok, false);
eq("photos capped", normaliseChangeOrderInput({ description: "x", priceDelta: 1, photos: Array(20).fill("https://a/b.jpg") }).value.photos.length, 6);
eq("snapshot of a line", snapshotQuoteLine(quote, "g2:0"), { description: "Subcontracted electrical", amount: 900, quantity: 1 });
eq("snapshot of a missing line is null", snapshotQuoteLine(quote, "g2:9"), null);
eq("snapshot of garbage is null", snapshotQuoteLine(quote, "::"), null);

// ═══════════════════════════════════════════════════════════════════════════
section("6. The decision reaches the plan");

{
  const db = miniDb();
  db.tables.job.push({ id: "j1", companyId: "co", clientId: "cl", quoteId: "q1", endDate: new Date("2026-09-22T12:00:00Z") });
  db.tables.member.push({ companyId: "co", active: true, role: "owner", userId: "owner1", user: { id: "owner1" } });
  const lineStep = insertTask(db, { id: "t_line", title: "Hallway ceiling crack — skim, sand, prime", quoteLineKey: "g1:2", sortOrder: 4 });
  const trim = insertTask(db, { id: "t_trim", title: "Trim & doors", sortOrder: 5 });

  // Against a line, sent then signed: ONE new step, after the line's step.
  db.tables.changeOrder.push({ id: "co2", jobId: "j1", seq: 2, description: "Second coat on hallway ceiling", bodyHtml: "<b>full</b> second coat", quoteLineKey: "g1:2", taskId: null, scheduleDeltaDays: 1, status: "waiting_client", createdAt: new Date() });
  await applyChangeOrderDecision("co2", "waiting_client", { db, previousStatus: "pending" });
  eq("sending a line change order creates no step", db.tables.task.length, 2);
  await applyChangeOrderDecision("co2", "approved", { db, previousStatus: "waiting_client" });
  await applyChangeOrderDecision("co2", "approved", { db, previousStatus: "approved" }); // a retry
  const added = db.tables.task.filter((t) => t.sourceKey === planSourceKey.changeOrder("co2"));
  eq("approval adds exactly one step, twice applied", added.length, 1);
  eq("the step is titled after the change order and carries the body as scope", [added[0].title, added[0].description], ["Second coat on hallway ceiling", "full second coat"]);
  ok("it sorts after the existing steps", added[0].sortOrder > trim.sortOrder);
  ok("it waits on the line's own step", db.tables.taskDependency.some((d) => d.taskId === added[0].id && d.dependsOnId === lineStep.id));
  eq("the finish moved by one day, once", db.tables.job[0].endDate.toISOString(), "2026-09-23T12:00:00.000Z");

  // Against a step: sent → on hold; signed → released, change written in.
  db.tables.changeOrder.push({ id: "co3", jobId: "j1", seq: 3, description: "Add pull-out shelf paint in pantry", bodyHtml: null, quoteLineKey: null, taskId: "t_trim", scheduleDeltaDays: null, status: "waiting_client", createdAt: new Date() });
  await applyChangeOrderDecision("co3", "waiting_client", { db, previousStatus: "pending" });
  eq("the step is on hold for the change order", db.tables.task.find((t) => t.id === "t_trim").waitingOnChangeOrderId, "co3");
  eq("…and the gate refuses a start", dependencyGate(db.tables.task.find((t) => t.id === "t_trim"), "in_progress", [], { status: "waiting_client", label: "CO-3" }).ok, false);
  await applyChangeOrderDecision("co3", "approved", { db, previousStatus: "waiting_client" });
  const trimNow = db.tables.task.find((t) => t.id === "t_trim");
  eq("approval releases the hold", trimNow.waitingOnChangeOrderId, null);
  ok("the change is written into the step", trimNow.description.includes("CO-3 · Add pull-out shelf paint in pantry"));
  await applyChangeOrderDecision("co3", "approved", { db, previousStatus: "approved" });
  eq("…once", trimNow.description.split("CO-3 ·").length - 1, 1);
  eq("no new step for a change against a step", db.tables.task.length, 3);
  eq("no schedule impact stated → the finish did not move again", db.tables.job[0].endDate.toISOString(), "2026-09-23T12:00:00.000Z");

  // Rejected while on hold releases without editing.
  db.tables.changeOrder.push({ id: "co4", jobId: "j1", seq: 4, description: "Nope", taskId: "t_trim", status: "waiting_client", createdAt: new Date() });
  await applyChangeOrderDecision("co4", "waiting_client", { db });
  await applyChangeOrderDecision("co4", "rejected", { db, previousStatus: "waiting_client" });
  eq("rejection releases the hold and adds nothing", [db.tables.task.find((t) => t.id === "t_trim").waitingOnChangeOrderId, db.tables.task.length], [null, 3]);
  ok("…and writes nothing into the step", !db.tables.task.find((t) => t.id === "t_trim").description.includes("Nope"));
  eq("a pending change order against a line adds no step", (await applyChangeOrderDecision("co2", "pending", { db })).taskId, null);
  eq("an unknown change order is reported, not thrown", (await applyChangeOrderDecision("nope", "approved", { db })).ok, false);
}
function insertTask(db, data) {
  const row = { companyId: "co", jobId: "j1", planStep: true, clientVisible: true, status: "open", description: "", createdAt: new Date(), ...data };
  db.tables.task.push(row);
  return row;
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The invoice line, and what is not billed");

{
  const invoice = { subtotal: 1000, discount: 0, tax: 130, taxEnabled: true, total: 1130, lineItems: [{ description: "Interior painting", quantity: 1, amount: 1000 }] };
  const orders = [
    { id: "co1", seq: 1, description: "Add pull-out shelf", priceDelta: 180, status: "approved", invoiceId: null, decidedAt: "2026-09-21T18:14:00Z", signature: { name: "L. Angelos", signedAt: "2026-09-21T18:14:00Z" } },
    { id: "co2", seq: 2, description: "Second coat", priceDelta: 640, status: "waiting_client", invoiceId: null },
    { id: "co3", seq: 3, description: "Staff-agreed", priceDelta: 100, status: "approved", invoiceId: null, decidedAt: "2026-09-20T10:00:00Z", decidedBy: { name: "Dan N." } },
  ];
  const r = billChangeOrders({ invoice, changeOrders: orders, wording: { changeOrder: "Change order", approvedBy: (name, date) => `Approved by ${name} on ${date}`, date: (at) => new Date(at).toISOString().slice(0, 10) } });
  eq("only the approved ones are billed — waiting_client is not money", r.changeOrderIds, ["co1", "co3"]);
  eq("the line names the change order", r.newLineItems[0].description, "Change order CO-1 · Add pull-out shelf");
  eq("…and who approved it, the client's signature first", r.newLineItems[0].detail, "Approved by L. Angelos on 2026-09-21");
  eq("a staff-agreed one names the staff member", r.newLineItems[1].detail, "Approved by Dan N. on 2026-09-20");
  eq("tax follows at the invoice's own rate", r.tax, 166.4);
  eq("a French invoice gets French words", billChangeOrders({ invoice, changeOrders: orders, wording: { changeOrder: "Avenant", approvedBy: (n, d) => `Approuvé par ${n} le ${d}`, date: (at) => "21 sept." } }).newLineItems[0].description, "Avenant CO-1 · Add pull-out shelf");
  eq("the summary counts waiting_client apart, as awaiting agreement", [changeOrderSummary(orders).counts.waiting_client, changeOrderSummary(orders).pendingTotal], [1, 640]);
  eq("the closed set", CHANGE_ORDER_STATUSES, ["pending", "waiting_client", "approved", "rejected"]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Task plan fields and the clock's step picker");

eq("plan fields: omitted means untouched", normalisePlanFields({}).data, {});
eq("estimatedHours as an array is refused", normalisePlanFields({ estimatedHours: [3] }).ok, false);
eq("estimatedHours true is refused", normalisePlanFields({ estimatedHours: true }).ok, false);
eq("estimatedHours blank → null", normalisePlanFields({ estimatedHours: "" }).data.estimatedHours, null);
eq("estimatedHours rounded to 2dp", normalisePlanFields({ estimatedHours: "2.456" }).data.estimatedHours, 2.46);
eq("negative hours refused", normalisePlanFields({ estimatedHours: -1 }).ok, false);
eq("waitingReason trimmed and capped", normalisePlanFields({ waitingReason: ` ${"x".repeat(400)} ` }).data.waitingReason.length, 300);
eq("waitingReason blank → null", normalisePlanFields({ waitingReason: "  " }).data.waitingReason, null);
eq("clientVisible must be boolean", normalisePlanFields({ clientVisible: "yes" }).ok, false);
eq("a block that ends before it starts is refused", normalisePlanFields({ scheduledStart: "2026-09-23T12:00:00Z", scheduledEnd: "2026-09-23T11:00:00Z" }).ok, false);
eq("dependsOn must be a list of strings", normalisePlanFields({ dependsOn: [1, "a"] }).ok, false);
eq("dependsOn null → empty", normalisePlanFields({ dependsOn: null }).value.dependsOn, []);

const built = buildJobOptions([{ jobId: "j1", scheduledAt: "2026-09-23T13:00:00Z", job: { id: "j1", title: "Angelos" } }], [{ id: "j2", title: "Other" }]);
const withSteps = attachSteps(built, [{ id: "s1", jobId: "j1", title: "Walls" }, { id: "s9", jobId: "zzz", title: "Not ours" }]);
eq("steps hang on their own job", withSteps.options.map((o) => o.steps.map((s) => s.id)), [["s1"], []]);

// ═══════════════════════════════════════════════════════════════════════════
section("9. What leaves the building — source-level assertions");

const portal = readFileSync(new URL("../app/api/portal/[token]/route.js", import.meta.url), "utf8");
const portalTasks = portal.slice(portal.indexOf("tasks: {"), portal.indexOf("changeOrders: {", portal.indexOf("tasks: {")));
ok("portal: the task select has no description (staff notes)", !/\bdescription: true/.test(portalTasks));
ok("portal: the task select has no estimatedHours", !/estimatedHours/.test(portalTasks));
ok("portal: the task select has no assignee id", !/assignedToId/.test(portalTasks));
ok("portal: only client-visible plan steps", /planStep: true, clientVisible: true/.test(portalTasks));
ok("portal: issue-stage photos never shown", /stage: \{ not: "issue" \}/.test(portalTasks));
const portalCo = portal.slice(portal.indexOf("changeOrders: {"), portal.indexOf("timeEntries: {"));
ok("portal: change orders carry no priceDelta", !/priceDelta/.test(portalCo));
ok("portal: only change orders waiting on the client, with a link", /status: "waiting_client", shareToken: \{ not: null \}/.test(portalCo));
const card = readFileSync(new URL("../app/portal/[token]/JobProgressCard.js", import.meta.url), "utf8");
ok("the card draws no description, hours or money", !/\.description\b|estimatedHours|priceDelta|money\(/.test(card.replace(/co\.description/g, "")));
ok("the card never says FieldQuo", !/FieldQuo/.test(card));
const pub = readFileSync(new URL("../app/api/public/change-orders/[token]/route.js", import.meta.url), "utf8");
ok("public route: POST refuses without a signature record", /if \(!signature\)/.test(pub) && /needsSignature: true/.test(pub));
ok("public route: only waiting_client can be signed", /status !== "waiting_client"/.test(pub));
ok("public route: the amount is read from the row, never the body", !/body\?\.priceDelta|body\.priceDelta|body\?\.amount/.test(pub));
ok("public route: the race is closed by the status predicate", /where: \{ id: co\.id, status: "waiting_client" \}/.test(pub));
ok("public route: decidedById is null for a client decision", /decidedById: null/.test(pub));
const patch = readFileSync(new URL("../app/api/tasks/[id]/route.js", import.meta.url), "utf8");
ok("PATCH /api/tasks/[id] runs the dependency gate before writing", patch.indexOf("dependencyGate(") < patch.indexOf("db.task.update(") && patch.indexOf("dependencyGate(") > 0);
ok("…and answers 409 with the blockers", /blockedBy: gate\.blockedBy/.test(patch) && /status: 409/.test(patch));
const coPatch = readFileSync(new URL("../app/api/jobs/[id]/change-orders/[changeOrderId]/route.js", import.meta.url), "utf8");
ok("staff cannot 'Mark agreed' a change order out for signature", /existing\.status === "waiting_client" && status === "approved"/.test(coPatch));
ok("staff cannot set waiting_client by hand", /status === "waiting_client"\)/.test(coPatch));
const send = readFileSync(new URL("../lib/jobs/changeOrderSend.js", import.meta.url), "utf8");
ok("send: the SMS passes the opt-out gate", /maySms\(/.test(send));
ok("send: nothing is stamped sent unless a channel accepted", /if \(!via\.length\) return \{ ok: false/.test(send));
ok("send: the from-number is the company's line", /clientSmsFrom\(company\)/.test(send));
for (const lang of Object.keys(CLIENT_DOC_COPY)) {
  const c = CLIENT_DOC_COPY[lang];
  ok(`clientDocCopy ${lang}: job and changeOrder blocks present and free of the word FieldQuo`, c.job && c.changeOrder && !JSON.stringify(Object.values(c.changeOrder).map((f) => (typeof f === "function" ? f("a", "b", "c") : f))).includes("FieldQuo"));
}
const lifecycle = readFileSync(new URL("../lib/quotes/quoteLifecycle.js", import.meta.url), "utf8");
ok("acceptance builds the plan on the one path both doors take", /ensurePlanForJob\(job\.id/.test(lifecycle));
const clock = readFileSync(new URL("../app/api/time-clock/route.js", import.meta.url), "utf8");
ok("the clock writes taskId on clock-in and switch", (clock.match(/taskId: step\.taskId/g) || []).length >= 3);

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
