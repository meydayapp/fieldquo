// lib/jobs/plan.js
//
// The job plan: an approved quote's lines turned into ordered steps with
// dependencies. The PURE half — no database, no request. lib/jobs/buildPlan.js
// reads and writes rows; everything that decides what a step IS, what it is
// waiting on and whether it may start lives here, so it can be executed
// against hostile input (scripts/check-job-plan.mjs) the way AGENTS.md asks.
//
// ── What existed, and the gap ──────────────────────────────────────────────
//
// A quote that converts to a job leaves one to-do behind ("Schedule the job",
// lib/tasks/autoCreate.js) and a job page whose tasks are whatever somebody
// typed. The lines the client signed — the actual scope, the hours the takeoff
// computed, the options they ticked — never became work anyone was assigned.
// The plan is generated from those lines, one Task per line and per ticked
// option, with hours from the takeoff where there is one and a dependency
// order a painter would recognise.
//
// ── Status is derived, not stored ──────────────────────────────────────────
//
// A step is "waiting on" something when one of three facts holds: a step it
// depends on is not done, the change order it was raised under is not signed,
// or somebody wrote a reason ("paint delivery, due Sep 24"). None of those is
// a value of TaskStatus, and adding one would have been the wrong fix: the
// moment the blocker clears, a stored `waiting` becomes a lie until someone
// remembers to flip it. planStatus() reads the three facts fresh every time,
// so the pill on the page and the gate on the PATCH route cannot disagree.

import { paintTakeoff } from "@/lib/pricing/paintTakeoff";
import { tradeLabourHours } from "@/lib/pricing/tradeScope";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { visibleLineItems } from "@/lib/quotes/scopeGroupDisplay";
import { groupProduction } from "@/lib/services/productionRates";

// ── Identity ───────────────────────────────────────────────────────────────

/** The key of one scope-group line: the group's id plus the line's ordinal. */
export function lineKey(groupId, index) {
  return `${String(groupId)}:${Number(index)}`;
}

/** The key of a ticked option. */
export function addOnKey(addOnId) {
  return `addon:${String(addOnId)}`;
}

/**
 * The idempotent sourceKey of a machine-made step. Exported as functions for
 * the same reason autoCreate.js exports invoiceChaseKey: a key spelled
 * slightly differently at one call site fails silently as a duplicate step.
 */
export const planSourceKey = {
  line: (quoteId, key) => `quote_line:${quoteId}:${key}`,
  addOn: (addOnId) => `quote_addon:${addOnId}`,
  changeOrder: (changeOrderId) => `change_order_approved:${changeOrderId}`,
};

/** Whether a sourceKey names a step this file generates (vs. a to-do). */
export function isPlanSourceKey(sourceKey) {
  const s = String(sourceKey || "");
  return (
    s.startsWith("quote_line:") ||
    s.startsWith("quote_addon:") ||
    s.startsWith("change_order_approved:")
  );
}

// ── Painting order ─────────────────────────────────────────────────────────
//
// Tiers within ONE area. Each line depends on the last line of the nearest
// lower tier present in the same area: prep before anything, ceiling after
// prep, walls after the ceiling (cutting in is easier against a finished
// ceiling than the other way round), trim and doors after the walls. Areas
// do not depend on each other — two rooms are two rooms, and a crew of two
// works them in parallel.
//
// Substrate keys are lib/pricing/paintTakeoff.js's PAINT_SUBSTRATE_DEFAULTS.
// Anything this table has not heard of is trim: a new substrate is far more
// likely to be a piece of woodwork than a new kind of ceiling.
const PAINT_TIER = Object.freeze({
  __prep: 0,
  ceiling: 1,
  walls: 2,
  wall_two_storey: 2,
});
const PAINT_TRIM_TIER = 3;

export function paintTier(takeoffKey) {
  if (!takeoffKey) return null;
  const t = PAINT_TIER[String(takeoffKey)];
  return t === undefined ? PAINT_TRIM_TIER : t;
}

/**
 * Default dependency edges for a list of step specs.
 *
 * Only specs that carry a takeoff key and an area index participate — a line
 * typed by hand under a painting group has no tier and gets no edge, because
 * inventing one ("after the walls") would be a statement the quote never made.
 *
 * @returns Array<[fromSourceKey, dependsOnSourceKey]>
 */
export function paintDependencyDefaults(specs = []) {
  const byArea = new Map();
  for (const s of Array.isArray(specs) ? specs : []) {
    if (!s || s.areaKey === null || s.areaKey === undefined) continue;
    const tier = paintTier(s.takeoffKey);
    if (tier === null) continue;
    if (!byArea.has(s.areaKey)) byArea.set(s.areaKey, []);
    byArea.get(s.areaKey).push({ ...s, tier });
  }

  const edges = [];
  for (const rows of byArea.values()) {
    rows.sort((a, b) => a.tier - b.tier || a.ordinal - b.ordinal);
    for (const row of rows) {
      // The nearest lower tier that exists in this area; its LAST line, so a
      // room with two wall lines (one per colour) is finished before the trim.
      let dep = null;
      for (const other of rows) {
        if (other.tier >= row.tier) continue;
        if (!dep || other.tier > dep.tier || (other.tier === dep.tier && other.ordinal > dep.ordinal)) dep = other;
      }
      if (dep) edges.push([row.sourceKey, dep.sourceKey]);
    }
  }
  return edges;
}

// ── From the quote ─────────────────────────────────────────────────────────

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (n) => Math.round(num(n) * 100) / 100;
const text = (v) => String(v ?? "").trim();

/**
 * Hours per PRICED line for a takeoff-backed group, in the order the builder
 * emitted them, or null when this group cannot answer.
 *
 * Painting on the area/substrate model: paintTakeoff() is re-run against the
 * stored takeoff and the group's rate overrides, and its non-optional priced
 * lines come out in the exact order buildPaintAreas() wrote them to the quote
 * — so the Nth takeoff line IS the Nth stored line. That is verified, not
 * assumed: each takeoff line's rebuilt description must equal the stored
 * description, or the hours are withheld for that group. A rate card edited
 * since the quote changes the hours; it never changes the price on a stored
 * line, and the plan's estimate is allowed to be today's estimate.
 *
 * Other trades yield a group total (tradeLabourHours), which is only a
 * per-line figure when the group has exactly one priced line.
 */
export function takeoffLinesForGroup(group) {
  const categoryKey = group?.category?.key || group?.categoryKey || null;
  const takeoff = group?.takeoff;
  if (!categoryKey || !takeoff || typeof takeoff !== "object") return null;
  const overrides = group?.companySettings?.rates || group?.rates || null;

  const isPaint = categoryKey === "interior_painting" || categoryKey === "exterior_painting";
  if (isPaint && takeoff.model === "area_substrate") {
    const book = getPriceBook(categoryKey, overrides);
    let result;
    try {
      result = paintTakeoff(takeoff, book?.takeoff);
    } catch {
      return null;
    }
    const lines = [];
    for (const area of result?.areas || []) {
      for (const l of area.lines || []) {
        if (l.optional || num(l.amount) <= 0) continue;
        const measure = l.kind === "prep" ? `${l.displayHours} h` : `${l.quantity} ${l.unit}`;
        lines.push({
          description: `${area.label} — ${l.label} (${measure})`,
          hours: num(l.hours) > 0 ? round2(l.hours) : null,
          takeoffKey: l.key || null,
          areaKey: area.index ?? area.label ?? null,
          productKey: l.productKey || null,
        });
      }
    }
    return lines;
  }

  const stored = visibleLineItems(group);
  if (stored.length !== 1) return null;
  let total = 0;
  try {
    total = tradeLabourHours(categoryKey, takeoff, overrides);
  } catch {
    return null;
  }
  if (!(num(total) > 0)) return null;
  return [{ description: text(stored[0]?.description), hours: round2(total), takeoffKey: null, areaKey: null, productKey: null }];
}

/**
 * The step specs an approved quote produces, and the default edges between
 * them. Pure: `quote` carries `id`, `scopeGroups` (with `category.key`,
 * `takeoff`, `lineItems`, optional `companySettings.rates`) and `addOns`.
 *
 * One step per VISIBLE line (visibleLineItems — the one-line-equals-header
 * case a "Subcontracted work" group produces is not a second piece of work)
 * and per add-on with `selected: true`. Nothing else: an unticked option is
 * work the client declined.
 */
export function planFromQuote(quote, { productionById = null } = {}) {
  const q = quote || {};
  const specs = [];
  let lineNo = 0;

  const groups = Array.isArray(q.scopeGroups) ? [...q.scopeGroups] : [];
  groups.sort((a, b) => num(a?.sortOrder) - num(b?.sortOrder));

  for (const group of groups) {
    const categoryKey = group?.category?.key || group?.categoryKey || null;
    const visible = visibleLineItems(group);
    const all = Array.isArray(group?.lineItems) ? group.lineItems : [];
    // A group whose services carry production rates (lib/services/
    // productionRates.js) takes its hours from them, pinned to each
    // service's own line, and the takeoff's per-line hours for that group are
    // withheld — the same precedence the cost panel applies, so the plan's
    // total and the panel's hours agree. No map, or no rate that answers,
    // and `serviceHours` is null: the group is planned exactly as before.
    const production = productionById instanceof Map && productionById.size ? groupProduction(group, productionById) : null;
    const serviceHours = production && production.hours !== null ? new Map() : null;
    if (serviceHours) {
      for (const s of production.services) {
        if (s.hours === null || s.anchorIndex === null || s.anchorIndex === undefined) continue;
        serviceHours.set(s.anchorIndex, round2((serviceHours.get(s.anchorIndex) || 0) + s.hours));
      }
    }
    // Still read with a rate in force: the takeoff also names each line's
    // substrate, area and material, which the dependency order and the buy
    // list need whoever supplied the hours.
    const takeoffLines = takeoffLinesForGroup(group);

    // Takeoff lines are the LEADING lines of the group (builderPayload.js
    // prepends them ahead of hand-typed ones), so ordinal i of the takeoff
    // list is ordinal i of the stored list — checked by description below.
    for (let index = 0; index < all.length; index += 1) {
      const line = all[index];
      if (!visible.includes(line)) continue;
      const description = text(line?.description || line?.name || line?.title);
      if (!description) continue;
      lineNo += 1;

      const t = takeoffLines && takeoffLines[index];
      const matched = t && t.description === description ? t : null;

      const key = lineKey(group.id, index);
      specs.push({
        sourceKey: planSourceKey.line(q.id, key),
        quoteLineKey: key,
        quoteLineNo: lineNo,
        title: description,
        description: text(line?.detail) || null,
        estimatedHours: serviceHours ? serviceHours.get(index) ?? null : matched?.hours ?? null,
        categoryKey,
        materialKeys: matched?.productKey ? [matched.productKey] : [],
        takeoffKey: matched?.takeoffKey ?? null,
        areaKey: matched ? `${group.id}:${matched.areaKey}` : null,
        ordinal: specs.length,
        kind: "line",
      });
    }
  }

  const addOns = Array.isArray(q.addOns) ? [...q.addOns] : [];
  addOns.sort((a, b) => num(a?.sortOrder) - num(b?.sortOrder));
  for (const a of addOns) {
    if (!a || a.selected !== true) continue;
    const description = text(a.description);
    if (!description) continue;
    specs.push({
      sourceKey: planSourceKey.addOn(a.id),
      quoteLineKey: addOnKey(a.id),
      quoteLineNo: null,
      title: description,
      description: text(a.detail) || null,
      estimatedHours: null,
      categoryKey: null,
      materialKeys: [],
      takeoffKey: null,
      areaKey: null,
      ordinal: specs.length,
      kind: "addon",
    });
  }

  return { specs, edges: paintDependencyDefaults(specs) };
}

// ── Status ─────────────────────────────────────────────────────────────────

export const PLAN_STATUSES = Object.freeze(["not_started", "in_progress", "waiting", "done", "cancelled"]);

/** True when a blocker no longer blocks: done, or cancelled (nobody will do it). */
export function blockerCleared(task) {
  return task?.status === "done" || task?.status === "cancelled";
}

/**
 * What a step is waiting on RIGHT NOW, from the three facts.
 *
 * @param task      the step: status, waitingReason, waitingOnChangeOrderId
 * @param blockers  the steps it depends on: { id, title, status }
 * @param changeOrder the change order it waits on, or null: { id, status, label }
 * @returns Array<{ kind: "task"|"change_order"|"external", id, label }>
 */
export function waitingOn(task, blockers = [], changeOrder = null) {
  const out = [];
  for (const b of Array.isArray(blockers) ? blockers : []) {
    if (!b || blockerCleared(b)) continue;
    out.push({ kind: "task", id: b.id, label: text(b.title) });
  }
  if (task?.waitingOnChangeOrderId) {
    // A change order that was rejected releases the step — there is nothing
    // left to wait for, and the step itself is cancelled by the decision.
    const s = changeOrder?.status;
    if (!changeOrder || (s !== "approved" && s !== "rejected")) {
      out.push({ kind: "change_order", id: task.waitingOnChangeOrderId, label: text(changeOrder?.label) });
    }
  }
  if (text(task?.waitingReason)) {
    out.push({ kind: "external", id: null, label: text(task.waitingReason) });
  }
  return out;
}

/** The derived status a step shows. */
export function planStatus(task, blockers = [], changeOrder = null) {
  const status = task?.status;
  if (status === "done") return { status: "done", waitingOn: [] };
  if (status === "cancelled") return { status: "cancelled", waitingOn: [] };
  // A step in progress with a hold written on it IS waiting — the person who
  // wrote "paint delivery, due tomorrow" put it on hold on purpose.
  const waits = waitingOn(task, blockers, changeOrder);
  if (waits.length) return { status: "waiting", waitingOn: waits };
  return { status: status === "in_progress" ? "in_progress" : "not_started", waitingOn: [] };
}

/**
 * May this step move to `nextStatus`? The server-side gate — the PATCH route
 * calls it with fresh rows, and a "Start" tapped on a phone against a step
 * whose walls are not prepped gets the reason back, not a silent success.
 *
 * Only forward moves are gated. Reopening (done → open), cancelling, and
 * putting a step back are always allowed: undoing is not starting.
 *
 * The external `waitingReason` does NOT block a start. It is a note somebody
 * wrote; starting the step is how they say the delivery arrived, and the
 * route clears the reason on that transition.
 */
export function dependencyGate(task, nextStatus, blockers = [], changeOrder = null) {
  const forward = nextStatus === "in_progress" || nextStatus === "done";
  if (!forward) return { ok: true, blockedBy: [] };
  if (task?.status === "done") return { ok: true, blockedBy: [] };
  const blockedBy = waitingOn(task, blockers, changeOrder).filter((w) => w.kind !== "external");
  return { ok: blockedBy.length === 0, blockedBy };
}

/** A sentence for the refusal: "Waiting on Prep & patch walls." */
export function gateMessage(blockedBy = []) {
  const labels = blockedBy.map((b) => (b.kind === "change_order" ? `client approval of ${b.label || "the change order"}` : b.label || "another step"));
  if (!labels.length) return "";
  return `Waiting on ${labels.join(", ")}.`;
}

// ── Cycles ─────────────────────────────────────────────────────────────────

/**
 * Whether adding edges `task → dependsOn` would make the plan circular.
 * `edges` is the plan's current list of [taskId, dependsOnId]; `candidate`
 * the new pairs. A step waiting on itself, directly or around a loop, could
 * never start — the gate would refuse forever with a reason that names the
 * step itself.
 */
export function wouldCycle(edges = [], candidate = []) {
  const adj = new Map();
  const add = ([from, to]) => {
    if (!adj.has(from)) adj.set(from, new Set());
    adj.get(from).add(to);
  };
  for (const e of edges) add(e);
  for (const e of candidate) add(e);
  for (const [from, to] of candidate) {
    if (from === to) return true;
    // Can we reach `from` starting at `to`?
    const seen = new Set();
    const stack = [to];
    while (stack.length) {
      const cur = stack.pop();
      if (cur === from) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const next of adj.get(cur) || []) stack.push(next);
    }
  }
  return false;
}

// ── Reading a plan ─────────────────────────────────────────────────────────

/** Plan order: sortOrder, then the quote's own line order, then age. */
export function orderPlan(steps = []) {
  return [...(Array.isArray(steps) ? steps : [])].sort(
    (a, b) =>
      num(a?.sortOrder) - num(b?.sortOrder) ||
      (a?.quoteLineNo ?? 1e9) - (b?.quoteLineNo ?? 1e9) ||
      new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0),
  );
}

/**
 * The header numbers: "9 steps · 3 done · 47.0 h estimated · 19.5 h clocked".
 * Cancelled steps count toward neither total.
 */
export function planSummary(steps = []) {
  const rows = (Array.isArray(steps) ? steps : []).filter((s) => s && s.status !== "cancelled");
  let estimated = 0;
  let clocked = 0;
  let done = 0;
  for (const s of rows) {
    if (s.status === "done") done += 1;
    estimated += num(s.estimatedHours);
    clocked += num(s.clockedHours);
  }
  return { count: rows.length, done, estimatedHours: round2(estimated), clockedHours: round2(clocked) };
}

/**
 * Hours from time entries per step, and the job's own total. An open entry
 * (no clockOut) contributes nothing yet: the hour is not worked until it is.
 */
export function clockedByTask(entries = []) {
  const perTask = new Map();
  let total = 0;
  for (const e of Array.isArray(entries) ? entries : []) {
    const h = num(e?.hours);
    if (!(h > 0) || !e?.clockOut) continue;
    total += h;
    if (e.taskId) perTask.set(e.taskId, round2((perTask.get(e.taskId) || 0) + h));
  }
  return { perTask, total: round2(total) };
}

/** The progress bar: done, in progress, and the rest, as fractions of 1. */
export function planProgress(steps = []) {
  const rows = (Array.isArray(steps) ? steps : []).filter((s) => s && s.status !== "cancelled");
  if (!rows.length) return { done: 0, inProgress: 0, total: 0 };
  const done = rows.filter((s) => s.status === "done").length;
  const inProgress = rows.filter((s) => s.status === "in_progress").length;
  return { done: done / rows.length, inProgress: inProgress / rows.length, total: rows.length };
}

// ── The crew day view ──────────────────────────────────────────────────────

/**
 * The calendar day (YYYY-MM-DD in `timezone`) a date falls on.
 */
export function dayOf(value, timezone) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * One lane per crew member for one day: the steps whose scheduled start or
 * due date falls on `day`, unassigned ones in their own lane. Blocks are
 * ordered by scheduled start when there is one, else by plan order; no start
 * time is invented for a step that has none.
 *
 * @param steps  plan rows with assignedTo, dueDate, scheduledStart/End,
 *               estimatedHours, planStatus
 * @param day    "YYYY-MM-DD"
 */
export function crewDayLanes(steps = [], { day, timezone } = {}) {
  const lanes = new Map();
  for (const s of orderPlan(steps)) {
    if (!s || s.status === "cancelled") continue;
    const onDay = dayOf(s.scheduledStart, timezone) === day || (!s.scheduledStart && dayOf(s.dueDate, timezone) === day);
    if (!onDay) continue;
    const key = s.assignedTo?.id || s.assignedToId || "__unassigned";
    if (!lanes.has(key)) {
      lanes.set(key, { id: key, name: s.assignedTo?.name || null, plannedHours: 0, blocks: [] });
    }
    const lane = lanes.get(key);
    lane.plannedHours = round2(lane.plannedHours + num(s.estimatedHours));
    lane.blocks.push(s);
  }
  for (const lane of lanes.values()) {
    lane.blocks.sort((a, b) => {
      const as = a.scheduledStart ? new Date(a.scheduledStart).getTime() : Infinity;
      const bs = b.scheduledStart ? new Date(b.scheduledStart).getTime() : Infinity;
      return as - bs;
    });
  }
  // Named lanes first, alphabetical; the unassigned lane last.
  return [...lanes.values()].sort((a, b) => {
    if (a.id === "__unassigned") return 1;
    if (b.id === "__unassigned") return -1;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}
