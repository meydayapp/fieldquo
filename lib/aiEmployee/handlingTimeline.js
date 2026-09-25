// lib/aiEmployee/handlingTimeline.js
//
// "How this was handled" — the AI team's work on one conversation, as steps a
// contractor can read, built ONLY from rows that already exist.
//
// ══ Why rows and not a new log ═════════════════════════════════════════════
//
// Every decision the AI team makes about a thread is already written down, in
// three places, for three other readers:
//
//   AiEmployeeRoutingEvent  who held the thread and why (routing.js) — read
//                           today by the flow view's counts and the ping-pong
//                           guard;
//   AiEmployeeReply         every reply, sent or not, with its tools, model,
//                           cost and the named reason it stayed quiet
//                           (respond.js) — read by the suggestions queue;
//   AiEmployeeProposal      every action a mode would not let run alone, and
//                           who said yes or no (proposals.js).
//
// A fourth table recording the same things a second time would be a copy, and
// the copy is the one that rots (AGENTS.md failure class 4). So this reads the
// three and turns them into sentences. The design doc's AiRunStep (§2.4) is a
// later release; this is the part that needs no schema.
//
// ══ Pure, and why ══════════════════════════════════════════════════════════
//
// No database, no clock, no translation, no imports. The route does the
// company-scoped reads and hands rows in; this returns `{ key, params }` per
// step — the shape lib/messaging/activity.js returns — and the screen
// translates. That split is what lets scripts/check-handling-timeline.mjs feed
// it the rows the database would never produce on a good day: an employee
// deleted since, timestamps out of order, a toolsUsed column holding a string,
// two employees bouncing a thread until the guard fires.
//
// ══ What a viewer may see ═════════════════════════════════════════════════
//
// The route decides two things about the viewer and passes them in:
//
//   canSeeCost           the per-reply cost. Same rung as the AI credit top-up
//                        and the AI employee settings screen (`user:manage`),
//                        where the rest of the AI spend is already shown.
//   canSeeClientDetails  the arguments a proposal carries (a name, a phone, an
//                        email, an address) — clientsProperties ≥ full_view,
//                        the rung lib/permissions/enforce.js's redactClient
//                        withholds contact details below. Below it, only the
//                        fields in SAFE_ARG_FIELDS survive, and the step says
//                        something was hidden rather than looking complete.
//
// The free-text reasons (the front desk's one line, a model's hand-off
// reason) are written by a model that has just read the customer's messages,
// so they can carry a phone number. For a viewer below full_view they pass
// through scrubContact first. A denylist of patterns, which is weaker than the
// allowlist the arguments get — but a reason is a sentence, and a sentence has
// no fields to allow.

/** Every step kind this builder emits. The screen's icon map reads it. */
export const HANDLING_STEP_KINDS = Object.freeze([
  "front_desk",
  "handed_off",
  "escalated",
  "human_took_over",
  "resumed",
  "burst_merged",
  "reply",
  "quiet",
  "proposal",
]);

/** The routing-log kinds this builder understands (routing.js's
 *  ROUTING_EVENT_KINDS). The check asserts the two lists agree, so a new kind
 *  added there fails the build here instead of silently vanishing from the
 *  timeline. */
export const HANDLED_ROUTING_KINDS = Object.freeze([
  "assigned",
  "handed_off",
  "human_took_over",
  "resumed",
  "escalated",
  "burst_merged",
]);

/** Why a reply stayed quiet — every reason with its own sentence. Anything
 *  else gets the generic sentence with the code beside it, never a guess. The
 *  check asserts decide.js's SKIP_REASONS are all here. */
export const QUIET_REASONS = Object.freeze([
  "no_employee",
  "disabled",
  "ai_unavailable",
  "not_inbound",
  "empty_message",
  "thread_closed",
  "handed_off",
  "human_replied",
  "cap_reached",
  "outside_hours",
  "no_credit",
  "outside_service_window",
  "human_took_over",
  "not_assignee",
  "burst_merged",
  "provider_error",
  "no_text",
  "send_failed",
  "claimed_media_not_received",
  "dismissed_by_user",
]);

/** Proposal statuses with their own sentence (proposals.js PROPOSAL_STATUS,
 *  plus "expired": a pending row whose moment has passed). */
export const PROPOSAL_OUTCOMES = Object.freeze(["pending", "expired", "approved", "declined", "stale", "failed"]);

/** Proposal argument fields that carry nothing about who the customer is or
 *  how to reach them. An ALLOWLIST: a field a new tool adds is hidden from a
 *  restricted viewer until somebody decides it is safe, which is the direction
 *  a mistake should fail in. `slot_id` is not here because it is never shown
 *  raw — its time is lifted into `slotAt` for everybody. */
export const SAFE_ARG_FIELDS = Object.freeze(["trade", "square_footage", "query", "preferred_date", "mode", "role"]);

/** The two hand-off tools are their own steps (a routing event, or the
 *  reply's own handedOff flag), so listing them again as a tool chip would
 *  say the same thing twice on one row. */
const STEP_TOOLS = new Set(["hand_off_to_employee", "hand_off_to_human"]);

/** Front-desk reasons routing.js writes itself, in English, as machine
 *  strings — each has a sentence of its own rather than being printed. */
const SYSTEM_ASSIGN_REASONS = Object.freeze({
  "only one employee on the team": "app.messages.handling.frontDeskOnly",
  "previous assignee is no longer on the team": "app.messages.handling.reassigned",
});
const TRIAGE_FAILURE = /^(no AI credit for triage|triage failed|triage unavailable\b|empty first message)/;

/** Same tie-break order a single turn happens in, for rows stamped in the
 *  same millisecond. A hand-off and a ping-pong escalation are written by the
 *  tool DURING the turn; the reply row after the loop; the proposals after
 *  the reply row exists (respond.js). */
const KIND_ORDER = Object.freeze({
  front_desk: 0,
  resumed: 1,
  human_took_over: 2,
  burst_merged: 3,
  handed_off: 4,
  escalated: 4,
  reply: 5,
  quiet: 5,
  proposal: 6,
});

const NOTE_MAX = 300;
const ARG_MAX = 200;

/** ms since epoch, or null for anything that is not a real instant. */
function instant(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

function iso(ms) {
  return ms === null ? null : new Date(ms).toISOString();
}

function oneLine(value, max = NOTE_MAX) {
  if (typeof value !== "string") return null;
  const s = value.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
}

/**
 * Email addresses and phone-shaped digit runs, replaced. Seven digits is the
 * shortest local number; an ISO date (8 digits with dashes) is left alone
 * because "call after 2026-09-30" is a date, not a number to ring.
 */
export function scrubContact(text) {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(/[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g, "•••")
    .replace(/\+?\(?\d[\d\s().-]{5,}\d/g, (run) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(run.trim())) return run;
      const digits = run.replace(/\D/g, "").length;
      return digits >= 7 ? "•••" : run;
    });
}

/** The person behind "member:<userId>", which is how routing.js records who
 *  took over or handed back. */
function memberIdOf(reason) {
  if (typeof reason !== "string") return null;
  const m = /^member:(.+)$/.exec(reason.trim());
  return m ? m[1] : null;
}

function asMap(value) {
  if (value instanceof Map) return value;
  const out = new Map();
  if (Array.isArray(value)) {
    for (const row of value) if (row && row.id) out.set(row.id, row);
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) out.set(k, v);
  }
  return out;
}

/**
 * The tools a reply ran, grouped by name and outcome, first appearance first.
 * toolsUsed is Json: anything that is not an array of objects with a string
 * name is skipped rather than trusted.
 */
export function toolChips(toolsUsed) {
  if (!Array.isArray(toolsUsed)) return [];
  const chips = [];
  const byKey = new Map();
  for (const call of toolsUsed) {
    if (!call || typeof call !== "object" || typeof call.name !== "string" || !call.name) continue;
    if (STEP_TOOLS.has(call.name)) continue;
    const state =
      call.summary === "proposed" || call.summary === "would_propose"
        ? "proposed"
        : call.ok === false
          ? "failed"
          : "ok";
    const key = `${call.name}|${state}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      const chip = { name: call.name, state, count: 1 };
      byKey.set(key, chip);
      chips.push(chip);
    }
  }
  return chips;
}

/** A booking proposal's slot start, from the id check_availability issued
 *  (`<something>_<ms>`) — the same parse tools.js's proposalExpiry makes. */
function slotAtOf(args) {
  const raw = args && typeof args === "object" ? args.slot_id : null;
  const ms = Number(String(raw || "").split("_")[1]);
  return Number.isFinite(ms) && ms > 0 ? iso(ms) : null;
}

function argText(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return oneLine(value, ARG_MAX);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return oneLine(JSON.stringify(value), ARG_MAX);
  } catch {
    return null;
  }
}

/**
 * What a proposal wanted to do, shaped for this viewer.
 *
 * @returns {{ args: {field, value}[], argsHidden: boolean }}
 */
export function proposalArgs(args, { canSeeClientDetails = false } = {}) {
  if (!args || typeof args !== "object" || Array.isArray(args)) return { args: [], argsHidden: false };
  const out = [];
  let hidden = false;
  for (const [field, raw] of Object.entries(args)) {
    if (field === "slot_id") continue;
    const value = argText(raw);
    if (!value) continue;
    if (!canSeeClientDetails && !SAFE_ARG_FIELDS.includes(field)) {
      hidden = true;
      continue;
    }
    out.push({ field, value });
  }
  return { args: out, argsHidden: hidden };
}

/**
 * Rows → steps.
 *
 * @param thread     { routingIntent, routingReason, routedAt, humanTookOverAt, createdAt }
 * @param events     AiEmployeeRoutingEvent rows for the thread
 * @param replies    AiEmployeeReply rows for the thread
 * @param proposals  AiEmployeeProposal rows for the thread
 * @param employees  the company's AiEmployee rows (array, Map or id→row object).
 *                   An id that is not in here is an employee deleted since —
 *                   the reply and routing rows keep plain-string ids on
 *                   purpose (see the schema), so this is a normal state.
 * @param people     userId → display name, company-scoped by the caller
 * @param viewer     { canSeeCost, canSeeClientDetails }
 * @param now        ms or Date — only used to tell a pending proposal whose
 *                   moment has passed ("expired") from one still waiting
 * @param truncated  passed through: the route read a capped window
 *
 * @returns {{ steps: object[], truncated: boolean }}
 */
export function buildHandlingTimeline({
  thread = null,
  events = [],
  replies = [],
  proposals = [],
  employees = [],
  people = {},
  viewer = {},
  now = Date.now(),
  truncated = false,
} = {}) {
  const team = asMap(employees);
  const names = asMap(people);
  const canSeeCost = viewer?.canSeeCost === true;
  const canSeeClientDetails = viewer?.canSeeClientDetails === true;
  const nowMs = instant(now) ?? Date.now();

  /** { name, role, missing } — never an id: the screen gets a name, the ids
   *  stay server-side, the same rule the thread GET's aiState keeps. */
  const actor = (id) => {
    // "unknown" is what respond.js writes when a refusal happened before any
    // employee was resolved — nobody, not somebody who left.
    if (!id || typeof id !== "string" || id === "unknown") return null;
    const e = team.get(id);
    if (!e) return { name: null, role: null, missing: true };
    const name = oneLine(e.displayName, 80) || oneLine(e.name, 80) || null;
    return { name, role: typeof e.role === "string" ? e.role : null, missing: false };
  };
  const person = (userId) => {
    if (!userId || typeof userId !== "string") return null;
    const n = names.get(userId);
    return typeof n === "string" ? oneLine(n, 80) : oneLine(n?.name, 80);
  };
  const note = (text) => {
    const line = oneLine(text);
    if (!line) return null;
    return canSeeClientDetails ? line : scrubContact(line);
  };

  const raw = [];
  const seen = new Set();
  const push = (step, sortMs, group = null) => {
    if (seen.has(step.id)) return;
    seen.add(step.id);
    raw.push({ step, sortMs, group, index: raw.length });
  };

  // ── Routing events ──────────────────────────────────────────────────────
  let sawAssigned = false;
  let sawTakeover = false;
  for (const ev of Array.isArray(events) ? events : []) {
    if (!ev || typeof ev !== "object" || !ev.id) continue;
    const at = instant(ev.createdAt);
    const base = { id: `ev:${ev.id}`, at: iso(at) };
    switch (ev.kind) {
      case "assigned": {
        sawAssigned = true;
        const to = actor(ev.toEmployeeId);
        const reason = oneLine(ev.reason);
        const systemKey = reason ? SYSTEM_ASSIGN_REASONS[reason] : null;
        if (systemKey) {
          push({ ...base, kind: "front_desk", key: systemKey, params: { to }, note: null }, at);
        } else if (reason && TRIAGE_FAILURE.test(reason)) {
          push({ ...base, kind: "front_desk", key: "app.messages.handling.frontDeskUnread", params: { to }, note: null }, at);
        } else {
          push(
            {
              ...base,
              kind: "front_desk",
              key: ev.intent ? "app.messages.handling.frontDesk" : "app.messages.handling.assigned",
              params: { to, intent: typeof ev.intent === "string" ? ev.intent : null },
              note: note(reason),
            },
            at,
          );
        }
        break;
      }
      case "handed_off":
        push(
          {
            ...base,
            kind: "handed_off",
            key: "app.messages.handling.handedOff",
            params: { from: actor(ev.fromEmployeeId), to: actor(ev.toEmployeeId) },
            note: note(ev.reason),
          },
          at,
        );
        break;
      case "escalated": {
        const reason = typeof ev.reason === "string" ? ev.reason : "";
        const pingPong = reason.startsWith("ping_pong");
        push(
          {
            ...base,
            kind: "escalated",
            key: pingPong ? "app.messages.handling.escalatedPingPong" : "app.messages.handling.escalated",
            params: { from: actor(ev.fromEmployeeId) },
            // "ping_pong: <why>" — the why is the hand-off that was refused.
            note: note(pingPong ? reason.replace(/^ping_pong:?\s*/, "") : reason),
          },
          at,
        );
        break;
      }
      case "human_took_over": {
        sawTakeover = true;
        const who = person(memberIdOf(ev.reason));
        push(
          {
            ...base,
            kind: "human_took_over",
            key: who ? "app.messages.handling.tookOver" : "app.messages.handling.tookOverAnon",
            params: { person: who, from: actor(ev.fromEmployeeId) },
            note: null,
          },
          at,
        );
        break;
      }
      case "resumed": {
        const who = person(memberIdOf(ev.reason));
        push(
          {
            ...base,
            kind: "resumed",
            key: who ? "app.messages.handling.resumed" : "app.messages.handling.resumedAnon",
            params: { person: who, to: actor(ev.toEmployeeId) },
            note: null,
          },
          at,
        );
        break;
      }
      case "burst_merged":
        push(
          { ...base, kind: "burst_merged", key: "app.messages.handling.burst", params: { count: 1 }, note: null },
          at,
          "burst",
        );
        break;
      default:
        // A kind this version does not know. Silent, not guessed — the same
        // rule activitySentence follows. The check keeps the lists in step.
        break;
    }
  }

  // ── Replies ─────────────────────────────────────────────────────────────
  for (const r of Array.isArray(replies) ? replies : []) {
    if (!r || typeof r !== "object" || !r.id) continue;
    const at = instant(r.createdAt);
    const who = actor(r.employeeId);
    const meta = {
      tools: toolChips(r.toolsUsed),
      model: oneLine(r.model, 60),
      confidence: ["high", "medium", "low"].includes(r.confidence) ? r.confidence : null,
      // Absent, not zero, for a viewer who may not see it: a "$0.00" beside
      // every reply would be a statement about the bill.
      ...(canSeeCost ? { costCents: Number.isFinite(Number(r.costCents)) ? Math.max(0, Math.round(Number(r.costCents))) : 0 } : {}),
    };
    const suppressed = typeof r.suppressedReason === "string" && r.suppressedReason ? r.suppressedReason : null;
    if (suppressed) {
      const code = suppressed.startsWith("send_failed") ? "send_failed" : suppressed;
      const known = QUIET_REASONS.includes(code);
      push(
        {
          id: `re:${r.id}`,
          at: iso(at),
          kind: "quiet",
          key: "app.messages.handling.quiet",
          params: { who, reason: known ? code : null, code: known ? null : oneLine(code, 60), count: 1 },
          note: null,
          ...meta,
        },
        at,
        // Consecutive identical stops collapse: a thread a person has taken
        // over records one quiet row per inbound message, and ten lines
        // saying so is noise that hides the one that matters.
        // A stop that spent money or ran a tool is never folded into another:
        // it is a charge, and each charge keeps its own line.
        meta.tools.length || Number(r.costCents) > 0 ? null : `quiet|${r.employeeId || "?"}|${code}`,
      );
      continue;
    }
    const sent = instant(r.sentAt) !== null;
    let key;
    let why = null;
    if (r.handedOff === true) {
      key = sent ? "app.messages.handling.replyHandedOffSent" : "app.messages.handling.replyHandedOff";
      // ping_pong is explained by its own escalated step.
      why = r.handoffReason === "ping_pong" ? null : note(r.handoffReason);
    } else if (sent) {
      key = "app.messages.handling.replySent";
    } else {
      key = "app.messages.handling.replyDraft";
    }
    push({ id: `re:${r.id}`, at: iso(at), kind: "reply", key, params: { who }, note: why, ...meta }, at);
  }

  // ── Proposals ───────────────────────────────────────────────────────────
  for (const p of Array.isArray(proposals) ? proposals : []) {
    if (!p || typeof p !== "object" || !p.id) continue;
    const at = instant(p.createdAt);
    const expires = instant(p.expiresAt);
    let outcome = PROPOSAL_OUTCOMES.includes(p.status) ? p.status : null;
    if (outcome === "pending" && expires !== null && expires <= nowMs) outcome = "expired";
    const decidedBy = person(p.decidedByUserId);
    const slotAt = p.tool === "book_appointment" ? slotAtOf(p.args) : null;
    const shaped = proposalArgs(p.args, { canSeeClientDetails });
    push(
      {
        id: `pr:${p.id}`,
        at: iso(at),
        kind: "proposal",
        key: slotAt ? "app.messages.handling.proposalSlot" : "app.messages.handling.proposal",
        params: {
          who: actor(p.employeeId),
          tool: typeof p.tool === "string" ? p.tool : null,
          slotAt,
        },
        outcome: {
          key: outcomeKey(outcome, decidedBy),
          params: { person: decidedBy, status: outcome ? null : oneLine(String(p.status ?? ""), 40) },
          at: iso(instant(p.decidedAt)),
        },
        note: p.status === "failed" ? note(p.failureReason) : null,
        args: shaped.args,
        argsHidden: shaped.argsHidden,
      },
      at,
    );
  }

  // ── The thread's own columns, for what the log does not hold ────────────
  //
  // logRouting is best effort (a failed write must never fail a reply), and
  // threads routed before the log existed have none. When there is no
  // "assigned" row, the thread's routingIntent is the only record of what the
  // front desk decided; when there is no take-over row, humanTookOverAt is the
  // only record that a person has the thread. Only then — a synthesised step
  // beside a real one would be the same event twice.
  if (thread && typeof thread === "object") {
    if (!sawAssigned && typeof thread.routingIntent === "string" && thread.routingIntent) {
      const at = instant(thread.routedAt) ?? instant(thread.createdAt);
      push(
        {
          id: "th:intent",
          at: iso(at),
          kind: "front_desk",
          key: "app.messages.handling.frontDeskIntentOnly",
          params: { intent: thread.routingIntent },
          note: note(thread.routingReason),
        },
        at,
      );
    }
    const took = instant(thread.humanTookOverAt);
    if (!sawTakeover && took !== null) {
      push(
        { id: "th:takeover", at: iso(took), kind: "human_took_over", key: "app.messages.handling.tookOverAnon", params: { person: null, from: null }, note: null },
        took,
      );
    }
  }

  // ── Time order ──────────────────────────────────────────────────────────
  //
  // Sorted here rather than trusted from three queries: the rows come from
  // three tables, and a clock skew of a few ms between a routing write and a
  // reply write is normal. Rows with no usable time go last, in the order
  // they arrived, and are drawn without a time rather than with an invented
  // one.
  raw.sort((a, b) => {
    if (a.sortMs === null && b.sortMs === null) return a.index - b.index;
    if (a.sortMs === null) return 1;
    if (b.sortMs === null) return -1;
    if (a.sortMs !== b.sortMs) return a.sortMs - b.sortMs;
    const k = (KIND_ORDER[a.step.kind] ?? 9) - (KIND_ORDER[b.step.kind] ?? 9);
    return k || a.index - b.index;
  });

  const steps = [];
  let last = null;
  for (const item of raw) {
    if (item.group && last && last.group === item.group) {
      last.step.params = { ...last.step.params, count: (last.step.params.count || 1) + 1 };
      continue;
    }
    steps.push(item.step);
    last = item;
  }

  return { steps, truncated: Boolean(truncated) };
}

function outcomeKey(outcome, decidedBy) {
  const anon = decidedBy ? "" : "Anon";
  switch (outcome) {
    case "pending":
      return "app.messages.handling.proposalPending";
    case "expired":
      return "app.messages.handling.proposalExpired";
    case "approved":
      return `app.messages.handling.proposalApproved${anon}`;
    case "declined":
      return `app.messages.handling.proposalDeclined${anon}`;
    case "stale":
      return `app.messages.handling.proposalStale${anon}`;
    case "failed":
      return `app.messages.handling.proposalFailed${anon}`;
    default:
      return "app.messages.handling.proposalUnknown";
  }
}

/** Every catalogue key this builder can emit — the check asserts each exists
 *  in all nine languages, so a sentence cannot ship in English only. */
export const HANDLING_KEYS = Object.freeze([
  "app.messages.handling.frontDesk",
  "app.messages.handling.frontDeskOnly",
  "app.messages.handling.frontDeskUnread",
  "app.messages.handling.frontDeskIntentOnly",
  "app.messages.handling.reassigned",
  "app.messages.handling.assigned",
  "app.messages.handling.handedOff",
  "app.messages.handling.escalated",
  "app.messages.handling.escalatedPingPong",
  "app.messages.handling.tookOver",
  "app.messages.handling.tookOverAnon",
  "app.messages.handling.resumed",
  "app.messages.handling.resumedAnon",
  "app.messages.handling.burst",
  "app.messages.handling.quiet",
  "app.messages.handling.replySent",
  "app.messages.handling.replyDraft",
  "app.messages.handling.replyHandedOff",
  "app.messages.handling.replyHandedOffSent",
  "app.messages.handling.proposal",
  "app.messages.handling.proposalSlot",
  "app.messages.handling.proposalPending",
  "app.messages.handling.proposalExpired",
  "app.messages.handling.proposalApproved",
  "app.messages.handling.proposalApprovedAnon",
  "app.messages.handling.proposalDeclined",
  "app.messages.handling.proposalDeclinedAnon",
  "app.messages.handling.proposalStale",
  "app.messages.handling.proposalStaleAnon",
  "app.messages.handling.proposalFailed",
  "app.messages.handling.proposalFailedAnon",
  "app.messages.handling.proposalUnknown",
]);
