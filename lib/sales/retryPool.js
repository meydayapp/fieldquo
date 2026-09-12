// lib/sales/retryPool.js
//
// The retry rule, wired to the rows: what a disposition writes on the
// Prospect, and how a rep's held list is re-ordered by it.
//
// ══ Two modules, on purpose ═══════════════════════════════════════════════
//
// lib/sales/retryRules.js is the rule and imports nothing but the window. This
// file is the glue: it resolves the prospect's zone the way the rest of the
// sales surface does (lib/sales/leadTimeZone.js), picks the jurisdiction's
// window the way the batch claim does (lib/sales/queueBatch.js nextClosing),
// and turns the answer into a Prisma `data` fragment and a screen's group
// order. Keeping the glue out of the rule keeps the rule executable against
// a bare instant; keeping the rule out of the glue keeps the glue honest
// about what it decided and what it merely copied.
//
// ══ A due retry outranks a fresh lead ═════════════════════════════════════
//
// Both here (the rep's held list) and in lib/sales/queueBatch.js's selection
// (the pool). A fresh row is a guess about a business; a due retry is a row
// somebody already spent a dial on, aimed by the rotation at THIS part of the
// day. If it waits behind the fresh rows it slips past the block it was aimed
// at and the rotation's whole point — try a different hour — is lost. The
// cost is that the pool drains a little slower; the alternative is a pool
// that never finishes anything it starts.

import { FIELDQUO_COURTESY_WINDOW, jurisdictionFor } from "./callingRules";
import { SALES_CALL_WINDOW } from "./callingWindow";
import { resolveLeadTimeZone } from "./leadTimeZone";
import { WINDOW_GROUP_LATER, WINDOW_GROUP_NOW, WINDOW_GROUP_OPENS, repClock } from "./queueWindows";
import { nextAttempt, retryStateOf } from "./retryRules";

const isDate = (v) => v instanceof Date && !Number.isNaN(v.getTime());

/**
 * The window a retry for this prospect must land inside.
 *
 * The jurisdiction's own when the row has one (a verified-but-unrestricted
 * state gets FieldQuo's courtesy window, the same substitution the dial gate
 * makes); the Canadian B2B window when the row has no jurisdiction at all.
 * Never null: a retry with no window would be scheduled at 03:00.
 */
export function retryWindowFor(prospect = {}) {
  const j = jurisdictionFor(prospect);
  if (!j) return SALES_CALL_WINDOW;
  return j.window || FIELDQUO_COURTESY_WINDOW;
}

/**
 * The Prisma `data` a disposition writes on the Prospect, and the decision
 * behind it.
 *
 * @param outcome    the DISPOSITIONS code just recorded.
 * @param prospect   `{ attemptCount, retryBlock, exhaustedAt, country, province }`
 *                   — the row as read INSIDE the transaction, never from an
 *                   earlier request.
 * @param timeZone   a zone somebody stated for the prospect (SalesLead.timeZone),
 *                   or null; the province derives one when it can.
 * @param callbackAt for the callback outcome, the agreed time.
 *
 * @returns {{ decision, data, timeZone }} — `data` is what to write;
 *          `decision` is nextAttempt()'s answer, for the response.
 */
export function retryWriteFor({ outcome, prospect = {}, timeZone = null, callbackAt = null, now = new Date() } = {}) {
  const zone = resolveLeadTimeZone({ timeZone, country: prospect.country, province: prospect.province });
  const decision = nextAttempt({
    outcome,
    attemptCount: prospect.attemptCount,
    now,
    // A resolved zone, or — for a split subdivision nobody has resolved —
    // every candidate, so the rule schedules an hour both halves allow
    // rather than falling back to a bare delay in no zone at all.
    timeZone: zone.timeZone || (zone.candidates.length > 1 ? zone.candidates : null),
    lastBlock: prospect.retryBlock,
    window: retryWindowFor(prospect),
    callbackAt,
  });
  const data = {
    attemptCount: decision.attemptCount,
    lastOutcome: outcome,
    nextAttemptAt: decision.nextAttemptAt,
    retryBlock: decision.block,
  };
  // Set on the way in, never cleared on the way out: clearing is the
  // recycle's job, and a rep dialling an exhausted row by hand and getting
  // "not interested" has not un-exhausted it — they have finished it.
  if (decision.exhausted && !prospect.exhaustedAt) data.exhaustedAt = now;
  return { decision, data, timeZone: zone.timeZone, zoneSource: zone.source, candidates: zone.candidates };
}

/**
 * The retry state a row carries to the screen: retryStateOf() plus the
 * instant on the rep's clock, so the row can say "next at 14:30" in the
 * rep's zone and language without the browser formatting a date.
 */
export function retryViewFor(prospect = {}, { repZone = null, language = "en", now = new Date() } = {}) {
  const s = retryStateOf(prospect, now);
  return {
    attemptCount: s.attemptCount,
    maxAttempts: s.maxAttempts,
    nextAttemptAtIso: s.nextAttemptAt ? s.nextAttemptAt.toISOString() : null,
    nextAttemptAtLocal: s.nextAttemptAt ? repClock(s.nextAttemptAt, { repZone, language, now }) : null,
    due: s.due,
    scheduled: s.scheduled,
    exhausted: s.exhausted,
    exhaustedAtIso: s.exhaustedAt ? s.exhaustedAt.toISOString() : null,
    block: s.block,
    lastOutcome: s.lastOutcome,
    recycledAtIso: s.recycledAt ? s.recycledAt.toISOString() : null,
  };
}

/**
 * Re-order lib/sales/queueWindows.js groupByWindow()'s answer by the pool:
 *
 *   - a DUE retry moves to the front of "Callable now" (before the
 *     shuts-soonest sort — the header says why);
 *   - a SCHEDULED retry leaves whatever group the window put it in and lands
 *     in an "opens at" group keyed by its own instant, or in "later" when
 *     that instant is past the shift's end — the same shape the window
 *     groups have, so the screen draws it with the same header and the
 *     autodialler waits at it the same way;
 *   - an EXHAUSTED row lands in "later" with reasonCode "exhausted".
 *
 * A scheduled instant that lands inside a shut window is rolled by the rule
 * at write time, so the group's instant IS a callable one. Pure; executed by
 * scripts/check-sales-retry-pool.mjs.
 *
 * @param windows  groupByWindow()'s `{ groups, order, byId }`.
 * @param retries  `{ [id]: retryViewFor() }` for the same rows.
 */
export function regroupForRetry(windows, retries = {}, { shiftEnd = null, now = new Date() } = {}) {
  if (!windows || !Array.isArray(windows.groups)) return windows;
  const byId = { ...(windows.byId || {}) };
  const nowMs = isDate(now) ? now.getTime() : Date.now();
  const endMs = isDate(shiftEnd) ? shiftEnd.getTime() : null;

  const held = new Map(); // id → { iso, local } for scheduled retries
  const later = [];
  for (const [id, r] of Object.entries(retries || {})) {
    if (!r || !byId[id]) continue;
    if (r.exhausted) {
      later.push(id);
      byId[id] = { ...byId[id], callableNow: false, kind: WINDOW_GROUP_LATER, reasonCode: "exhausted", retryHold: true };
      continue;
    }
    if (r.scheduled && r.nextAttemptAtIso) {
      const at = Date.parse(r.nextAttemptAtIso);
      if (!Number.isFinite(at) || at <= nowMs) continue;
      // The window's own opening may be LATER than the retry's instant (a
      // retry written for 09:00 on a row whose state opens at 10:00 — the
      // rule rolls to the window it was given, the group to the state's);
      // the later of the two is when the row can actually be rung.
      const w = byId[id];
      const opens = w?.opensAtIso ? Date.parse(w.opensAtIso) : null;
      const effective = Number.isFinite(opens) && opens > at ? opens : at;
      const iso = new Date(effective).toISOString();
      const local = effective === at ? r.nextAttemptAtLocal : w?.opensAtLocal || r.nextAttemptAtLocal;
      if (endMs !== null && effective >= endMs) {
        later.push(id);
        byId[id] = { ...byId[id], callableNow: false, kind: WINDOW_GROUP_LATER, reasonCode: "retry_after_shift", opensAtIso: iso, opensAtLocal: local, retryHold: true };
      } else {
        held.set(id, { iso, local });
        byId[id] = { ...byId[id], callableNow: false, kind: WINDOW_GROUP_OPENS, opensAtIso: iso, opensAtLocal: local, reasonCode: null, retryHold: true };
      }
    }
  }
  const moved = new Set([...held.keys(), ...later]);

  const groups = [];
  const opensGroups = new Map();
  for (const g of windows.groups) {
    const ids = g.ids.filter((id) => !moved.has(id));
    if (g.kind === WINDOW_GROUP_NOW) {
      // Due retries first, in the order the window sort left them; then the rest.
      const due = ids.filter((id) => retries[id]?.due);
      const rest = ids.filter((id) => !retries[id]?.due);
      const now_ = [...due, ...rest];
      if (now_.length) groups.push({ ...g, ids: now_, count: now_.length });
      continue;
    }
    if (g.kind === WINDOW_GROUP_OPENS) {
      if (ids.length) opensGroups.set(g.opensAtIso, { ...g, ids, count: ids.length });
      continue;
    }
    // "later" is rebuilt below with the retry rows added.
    if (g.kind === WINDOW_GROUP_LATER) {
      later.unshift(...ids.filter((id) => !later.includes(id)));
      continue;
    }
    if (ids.length) groups.push({ ...g, ids, count: ids.length });
  }
  for (const [id, h] of held) {
    if (!opensGroups.has(h.iso)) {
      opensGroups.set(h.iso, {
        key: `retry:${h.iso}`,
        kind: WINDOW_GROUP_OPENS,
        opensAtIso: h.iso,
        opensAtLocal: h.local,
        zoneLabel: null,
        zones: [],
        count: 0,
        ids: [],
        retry: true,
      });
    }
    const g = opensGroups.get(h.iso);
    g.ids.push(id);
    g.count = g.ids.length;
  }
  const opens = [...opensGroups.values()].sort((a, b) => Date.parse(a.opensAtIso) - Date.parse(b.opensAtIso));
  groups.push(...opens);
  if (later.length) {
    groups.push({ key: WINDOW_GROUP_LATER, kind: WINDOW_GROUP_LATER, opensAtIso: null, opensAtLocal: null, zoneLabel: null, zones: [], count: later.length, ids: later });
  }
  const order = groups.flatMap((g) => g.ids);
  for (const g of groups) for (const id of g.ids) if (byId[id]) byId[id] = { ...byId[id], group: g.key };
  return { groups, order, byId };
}
