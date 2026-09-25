// scripts/check-handling-timeline.mjs
//
//   npm run check:handling-timeline
//
// "How this was handled" (lib/aiEmployee/handlingTimeline.js) turns three
// tables of AI-team rows into sentences a contractor reads. Four things about
// that are worth failing over, and all four are executed here against rows
// the database would never hand over on a good day:
//
//   1. It never throws and never prints "undefined" — an employee deleted
//      since, a reply whose toolsUsed is a string, a timestamp that is not a
//      date, the same row twice.
//   2. Time order is the rows' time, not the order three queries returned
//      them in.
//   3. What a viewer may not see does not leave the builder: no cost without
//      the cost rung, no phone or email in a proposal or a reason without the
//      client rung.
//   4. Every sentence it can emit exists in all nine languages, and every
//      routing kind and stop reason the AI team can record has one.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildHandlingTimeline,
  scrubContact,
  toolChips,
  proposalArgs,
  HANDLED_ROUTING_KINDS,
  QUIET_REASONS,
  HANDLING_KEYS,
  HANDLING_STEP_KINDS,
  SAFE_ARG_FIELDS,
  PROPOSAL_OUTCOMES,
} from "../lib/aiEmployee/handlingTimeline.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const T0 = Date.parse("2026-09-24T15:00:00.000Z");
const at = (min) => new Date(T0 + min * 60_000);

const NORA = { id: "emp_nora", name: "closer", displayName: "Nora", role: "closer" };
const SAM = { id: "emp_sam", name: "Sam", displayName: null, role: "receptionist" };
const EMPLOYEES = [NORA, SAM];
const PEOPLE = { user_emilio: "Emilio" };
const FULL = { canSeeCost: true, canSeeClientDetails: true };
const CREW = { canSeeCost: false, canSeeClientDetails: false };

/** The owner's own example, as rows. */
function story() {
  return {
    thread: { routingIntent: "price", routingReason: "asks what a deck stain costs", routedAt: at(0), humanTookOverAt: at(12), createdAt: at(0) },
    events: [
      { id: "e1", kind: "assigned", fromEmployeeId: null, toEmployeeId: NORA.id, intent: "price", reason: "asks what a deck stain costs", createdAt: at(0) },
      { id: "e2", kind: "handed_off", fromEmployeeId: NORA.id, toEmployeeId: SAM.id, intent: null, reason: "wants to book", createdAt: at(5) },
      { id: "e3", kind: "human_took_over", fromEmployeeId: SAM.id, toEmployeeId: null, reason: "member:user_emilio", createdAt: at(12) },
    ],
    replies: [
      {
        id: "r1",
        employeeId: NORA.id,
        model: "gpt-5.5",
        costCents: 7,
        toolsUsed: [
          { name: "look_up_service_prices", ok: true, summary: null },
          { name: "look_up_service_prices", ok: true, summary: null },
          { name: "send_instant_quote_link", ok: true, summary: null },
        ],
        confidence: "high",
        sentAt: at(1),
        suppressedReason: null,
        handedOff: false,
        handoffReason: null,
        createdAt: at(1),
      },
      {
        id: "r2",
        employeeId: SAM.id,
        model: "gpt-5.5",
        costCents: 9,
        toolsUsed: [{ name: "check_availability", ok: true }, { name: "book_appointment", ok: true, summary: "proposed" }],
        confidence: "medium",
        sentAt: at(6),
        suppressedReason: null,
        handedOff: false,
        handoffReason: null,
        createdAt: at(6),
      },
    ],
    proposals: [
      {
        id: "p1",
        employeeId: SAM.id,
        tool: "book_appointment",
        args: { slot_id: `slot_${Date.parse("2026-09-25T13:00:00.000Z")}`, name: "Sandra Cole", phone: "(604) 555-0199", email: "sandra@example.com", address: "12 Elm St", mode: "visit" },
        status: "approved",
        expiresAt: new Date("2026-09-25T13:00:00.000Z"),
        decidedByUserId: "user_emilio",
        decidedAt: at(20),
        failureReason: null,
        createdAt: at(6.001),
      },
    ],
  };
}

// ── 1. The story reads in order, with names ────────────────────────────────
test("the owner's example reads front desk → reply → hand-off → reply → proposal → take-over", () => {
  const s = story();
  const { steps } = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: FULL, now: at(30) });
  assert.deepEqual(
    steps.map((x) => x.kind),
    ["front_desk", "reply", "handed_off", "reply", "proposal", "human_took_over"],
  );
  const [desk, r1, hand, , prop, took] = steps;
  assert.equal(desk.key, "app.messages.handling.frontDesk");
  assert.equal(desk.params.intent, "price");
  assert.deepEqual(desk.params.to, { name: "Nora", role: "closer", missing: false });
  assert.deepEqual(r1.tools, [
    { name: "look_up_service_prices", state: "ok", count: 2 },
    { name: "send_instant_quote_link", state: "ok", count: 1 },
  ]);
  assert.equal(r1.key, "app.messages.handling.replySent");
  assert.equal(r1.costCents, 7);
  assert.equal(r1.confidence, "high");
  assert.equal(hand.note, "wants to book");
  assert.equal(hand.params.to.name, "Sam", "falls back to name when there is no displayName");
  assert.equal(prop.key, "app.messages.handling.proposalSlot");
  assert.equal(prop.params.slotAt, "2026-09-25T13:00:00.000Z");
  assert.equal(prop.outcome.key, "app.messages.handling.proposalApproved");
  assert.equal(prop.outcome.params.person, "Emilio");
  assert.equal(took.key, "app.messages.handling.tookOver");
  assert.equal(took.params.person, "Emilio");
  // No synthesised steps beside real ones.
  assert.ok(!steps.some((x) => x.id.startsWith("th:")));
  // The proposed tool is a chip, and the hand-off tools never are.
  assert.deepEqual(steps[3].tools.map((c) => c.state), ["ok", "proposed"]);
});

// ── 2. Out-of-order input ──────────────────────────────────────────────────
test("shuffled rows produce the same timeline", () => {
  const s = story();
  const a = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: FULL, now: at(30) });
  const b = buildHandlingTimeline({
    ...s,
    events: [...s.events].reverse(),
    replies: [...s.replies].reverse(),
    proposals: [...s.proposals].reverse(),
    employees: [...EMPLOYEES].reverse(),
    people: PEOPLE,
    viewer: FULL,
    now: at(30),
  });
  assert.deepEqual(a, b);
});

test("a row stamped before the one it answers is drawn in stamp order, and bad dates go last", () => {
  const { steps } = buildHandlingTimeline({
    events: [
      { id: "late", kind: "assigned", toEmployeeId: NORA.id, intent: "book", reason: "x", createdAt: at(10) },
      { id: "garbage", kind: "resumed", toEmployeeId: NORA.id, reason: null, createdAt: "not a date" },
      { id: "nul", kind: "burst_merged", reason: "burst", createdAt: null },
    ],
    replies: [{ id: "early", employeeId: NORA.id, sentAt: at(3), createdAt: at(3), toolsUsed: [] }],
    employees: EMPLOYEES,
    viewer: FULL,
  });
  assert.deepEqual(steps.map((x) => x.id), ["re:early", "ev:late", "ev:garbage", "ev:nul"]);
  assert.equal(steps[2].at, null);
  assert.equal(steps[3].at, null);
});

test("same-millisecond rows follow the order of a turn", () => {
  const { steps } = buildHandlingTimeline({
    events: [{ id: "h", kind: "handed_off", fromEmployeeId: NORA.id, toEmployeeId: SAM.id, reason: "r", createdAt: at(1) }],
    replies: [{ id: "r", employeeId: NORA.id, sentAt: at(1), createdAt: at(1) }],
    proposals: [{ id: "p", employeeId: NORA.id, tool: "book_callback", args: {}, status: "pending", createdAt: at(1) }],
    employees: EMPLOYEES,
    viewer: FULL,
    now: at(2),
  });
  assert.deepEqual(steps.map((x) => x.kind), ["handed_off", "reply", "proposal"]);
});

// ── 3. Missing and deleted employees ───────────────────────────────────────
test("an employee deleted since is 'missing', never undefined", () => {
  const s = story();
  const { steps } = buildHandlingTimeline({ ...s, employees: [SAM], people: {}, viewer: FULL, now: at(30) });
  const desk = steps.find((x) => x.kind === "front_desk");
  assert.deepEqual(desk.params.to, { name: null, role: null, missing: true });
  const hand = steps.find((x) => x.kind === "handed_off");
  assert.equal(hand.params.from.missing, true);
  assert.equal(hand.params.to.name, "Sam");
  // Nobody on the team resolves the person either.
  const took = steps.find((x) => x.kind === "human_took_over");
  assert.equal(took.key, "app.messages.handling.tookOverAnon");
  assert.equal(took.params.person, null);
  const prop = steps.find((x) => x.kind === "proposal");
  assert.equal(prop.outcome.key, "app.messages.handling.proposalApprovedAnon");
  assert.ok(!JSON.stringify(steps).includes("undefined"));
});

test("no employees at all, and respond.js's 'unknown' employee", () => {
  const { steps } = buildHandlingTimeline({
    replies: [{ id: "r", employeeId: "unknown", suppressedReason: "no_credit", handedOff: true, handoffReason: "no_credit", createdAt: at(1) }],
    events: [{ id: "e", kind: "handed_off", fromEmployeeId: null, toEmployeeId: null, reason: null, createdAt: at(0) }],
    employees: null,
    people: null,
    viewer: null,
  });
  assert.equal(steps.length, 2);
  assert.equal(steps[1].params.who, null, "'unknown' is nobody, not a former employee");
  assert.equal(steps[1].params.reason, "no_credit");
  assert.equal(steps[0].params.from, null);
  assert.equal(steps[0].note, null);
});

test("employees as a Map and as an id→row object behave like an array", () => {
  const s = story();
  const base = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: FULL, now: at(30) });
  const asMap = buildHandlingTimeline({ ...s, employees: new Map(EMPLOYEES.map((e) => [e.id, e])), people: new Map(Object.entries(PEOPLE)), viewer: FULL, now: at(30) });
  const asObj = buildHandlingTimeline({ ...s, employees: Object.fromEntries(EMPLOYEES.map((e) => [e.id, e])), people: PEOPLE, viewer: FULL, now: at(30) });
  assert.deepEqual(asMap, base);
  assert.deepEqual(asObj, base);
});

// ── 4. Ping-pong ───────────────────────────────────────────────────────────
test("ping-pong escalation reads as one refused hand-off, not a mystery", () => {
  const { steps } = buildHandlingTimeline({
    events: [
      { id: "a", kind: "assigned", toEmployeeId: SAM.id, intent: "book", reason: "wants a visit", createdAt: at(0) },
      { id: "h1", kind: "handed_off", fromEmployeeId: SAM.id, toEmployeeId: NORA.id, reason: "asks price", createdAt: at(1) },
      { id: "x", kind: "escalated", fromEmployeeId: NORA.id, toEmployeeId: null, reason: "ping_pong: wants to book after all", createdAt: at(3) },
    ],
    replies: [
      { id: "r1", employeeId: SAM.id, sentAt: at(1), createdAt: at(1), toolsUsed: [{ name: "hand_off_to_employee", ok: true }] },
      { id: "r2", employeeId: NORA.id, sentAt: at(3), createdAt: at(3), handedOff: true, handoffReason: "ping_pong", toolsUsed: [{ name: "hand_off_to_employee", ok: true }] },
    ],
    employees: EMPLOYEES,
    viewer: FULL,
  });
  assert.deepEqual(steps.map((x) => x.kind), ["front_desk", "handed_off", "reply", "escalated", "reply"]);
  const esc = steps[3];
  assert.equal(esc.key, "app.messages.handling.escalatedPingPong");
  assert.equal(esc.note, "wants to book after all");
  assert.equal(steps[4].key, "app.messages.handling.replyHandedOffSent");
  assert.equal(steps[4].note, null, "ping_pong is explained by the escalated step, not repeated");
  assert.deepEqual(steps[2].tools, [], "the hand-off tool is its own step, never a chip");
});

test("a thread bounced forty times still builds, one step per bounce", () => {
  const events = [];
  for (let i = 0; i < 40; i += 1) {
    events.push({ id: `h${i}`, kind: i % 5 === 4 ? "escalated" : "handed_off", fromEmployeeId: i % 2 ? SAM.id : NORA.id, toEmployeeId: i % 2 ? NORA.id : SAM.id, reason: i % 5 === 4 ? "ping_pong" : `bounce ${i}`, createdAt: at(i) });
  }
  const { steps } = buildHandlingTimeline({ events, employees: EMPLOYEES, viewer: FULL });
  assert.equal(steps.length, 40);
  assert.equal(steps.filter((x) => x.kind === "escalated").length, 8);
  assert.ok(steps.filter((x) => x.kind === "escalated").every((x) => x.note === null), "bare 'ping_pong' leaves no note");
});

// ── 5. What a viewer may see ───────────────────────────────────────────────
test("cost is absent — not zero — for a viewer without the cost rung", () => {
  const s = story();
  const { steps } = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: CREW, now: at(30) });
  for (const step of steps) assert.ok(!("costCents" in step), `${step.id} leaked a cost`);
  const full = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: FULL, now: at(30) });
  assert.deepEqual(full.steps.filter((x) => x.kind === "reply").map((x) => x.costCents), [7, 9]);
});

test("a viewer without client access never receives the proposal's contact details", () => {
  const s = story();
  s.events[1].reason = "call her on 604-555-0199 or sandra@example.com";
  const { steps } = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: CREW, now: at(30) });
  const wire = JSON.stringify(steps);
  for (const secret of ["555-0199", "5550199", "sandra@example.com", "Sandra Cole", "12 Elm St"]) {
    assert.ok(!wire.includes(secret), `leaked ${secret}`);
  }
  const prop = steps.find((x) => x.kind === "proposal");
  assert.deepEqual(prop.args, [{ field: "mode", value: "visit" }]);
  assert.equal(prop.argsHidden, true);
  assert.equal(prop.params.slotAt, "2026-09-25T13:00:00.000Z", "the slot is a time, not a contact detail");
  // …and the full viewer gets them.
  const full = buildHandlingTimeline({ ...s, employees: EMPLOYEES, people: PEOPLE, viewer: FULL, now: at(30) });
  const fullProp = full.steps.find((x) => x.kind === "proposal");
  assert.equal(fullProp.argsHidden, false);
  assert.ok(fullProp.args.some((a) => a.field === "phone" && a.value === "(604) 555-0199"));
  assert.ok(!fullProp.args.some((a) => a.field === "slot_id"), "slot_id is never shown raw");
  assert.ok(full.steps.find((x) => x.kind === "handed_off").note.includes("sandra@example.com"));
});

test("an unknown future argument is hidden from a restricted viewer by default", () => {
  const r = proposalArgs({ trade: "painting", licence_plate: "ABC 123", nested: { phone: "6045550199" } }, { canSeeClientDetails: false });
  assert.deepEqual(r.args, [{ field: "trade", value: "painting" }]);
  assert.equal(r.argsHidden, true);
  assert.deepEqual(proposalArgs("junk"), { args: [], argsHidden: false });
  assert.deepEqual(proposalArgs(["a"]), { args: [], argsHidden: false });
  assert.deepEqual(proposalArgs(null), { args: [], argsHidden: false });
});

test("scrubContact takes emails and phone numbers, and leaves dates and small numbers", () => {
  assert.equal(scrubContact("mail a.b+c@x.co.uk now"), "mail ••• now");
  assert.equal(scrubContact("call (604) 555-0199"), "call •••");
  assert.equal(scrubContact("call +1 604.555.0199 please"), "call ••• please");
  assert.equal(scrubContact("6045550199"), "•••");
  assert.equal(scrubContact("after 2026-09-30"), "after 2026-09-30");
  assert.equal(scrubContact("400 sq ft, 2 coats"), "400 sq ft, 2 coats");
  assert.equal(scrubContact("12 Elm St"), "12 Elm St");
  assert.equal(scrubContact(""), "");
  assert.equal(scrubContact(null), null);
  assert.equal(scrubContact(42), 42);
});

// ── 6. Hostile toolsUsed ───────────────────────────────────────────────────
test("toolsUsed that is not an array of calls is skipped, never trusted", () => {
  for (const junk of [null, undefined, "look_up_service_prices", 7, { name: "x" }, [null, 1, "a", { ok: true }, { name: "" }]]) {
    assert.deepEqual(toolChips(junk), []);
  }
  assert.deepEqual(toolChips([{ name: "create_instant_quote", ok: false, summary: "no_trade" }, { name: "create_instant_quote", ok: true }]), [
    { name: "create_instant_quote", state: "failed", count: 1 },
    { name: "create_instant_quote", state: "ok", count: 1 },
  ]);
  const { steps } = buildHandlingTimeline({ replies: [{ id: "r", employeeId: NORA.id, toolsUsed: "garbage", confidence: "certain", model: 12, costCents: "NaN", createdAt: at(0) }], employees: EMPLOYEES, viewer: FULL });
  assert.deepEqual(steps[0].tools, []);
  assert.equal(steps[0].confidence, null, "only high/medium/low");
  assert.equal(steps[0].model, null);
  assert.equal(steps[0].costCents, 0);
  assert.equal(steps[0].key, "app.messages.handling.replyDraft");
});

// ── 7. Duplicates, collapsing, junk rows ───────────────────────────────────
test("the same row twice is one step; junk rows are skipped", () => {
  const e = { id: "e", kind: "assigned", toEmployeeId: NORA.id, intent: "price", reason: null, createdAt: at(0) };
  const { steps } = buildHandlingTimeline({
    events: [e, { ...e }, null, 5, "x", { kind: "assigned" }, { id: "k", kind: "teleported", createdAt: at(1) }],
    replies: "not an array",
    proposals: { id: "p" },
    employees: EMPLOYEES,
    viewer: FULL,
  });
  assert.equal(steps.length, 1);
});

test("consecutive identical stops collapse; a stop that spent money never does", () => {
  const quiet = (id, min, extra = {}) => ({ id, employeeId: SAM.id, suppressedReason: "human_took_over", createdAt: at(min), ...extra });
  const { steps } = buildHandlingTimeline({
    replies: [quiet("q1", 1), quiet("q2", 2), quiet("q3", 3), quiet("q4", 5, { costCents: 3 }), quiet("q5", 6), { id: "s", employeeId: SAM.id, sentAt: at(7), createdAt: at(7) }, quiet("q6", 8)],
    employees: EMPLOYEES,
    viewer: CREW,
  });
  assert.deepEqual(steps.map((x) => [x.id, x.params.count || 1]), [["re:q1", 3], ["re:q4", 1], ["re:q5", 1], ["re:s", 1], ["re:q6", 1]]);
});

test("bursts collapse into one line with a count", () => {
  const { steps } = buildHandlingTimeline({
    events: [1, 2, 3].map((i) => ({ id: `b${i}`, kind: "burst_merged", reason: "burst", createdAt: at(i) })),
  });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].params.count, 3);
});

test("send_failed:<anything> and unknown reasons", () => {
  const { steps } = buildHandlingTimeline({
    replies: [
      { id: "a", employeeId: NORA.id, suppressedReason: "send_failed:meta_rejected", createdAt: at(0) },
      { id: "b", employeeId: NORA.id, suppressedReason: "martian_interference", createdAt: at(1) },
    ],
    employees: EMPLOYEES,
  });
  assert.equal(steps[0].params.reason, "send_failed");
  assert.equal(steps[1].params.reason, null);
  assert.equal(steps[1].params.code, "martian_interference");
});

// ── 8. The thread's own columns ────────────────────────────────────────────
test("routingIntent and humanTookOverAt stand in only when the log has nothing", () => {
  const { steps } = buildHandlingTimeline({
    thread: { routingIntent: "problem", routingReason: "leak, call 604 555 0199", routedAt: at(0), humanTookOverAt: at(4) },
    viewer: CREW,
  });
  assert.deepEqual(steps.map((x) => x.id), ["th:intent", "th:takeover"]);
  assert.equal(steps[0].key, "app.messages.handling.frontDeskIntentOnly");
  assert.equal(steps[0].note, "leak, call •••");
  const none = buildHandlingTimeline({ thread: { routingIntent: null, humanTookOverAt: null } });
  assert.deepEqual(none.steps, []);
});

test("front desk's machine reasons get sentences, not printed English", () => {
  const ev = (id, reason) => ({ id, kind: "assigned", toEmployeeId: NORA.id, intent: "other", reason, createdAt: at(0) });
  const { steps } = buildHandlingTimeline({
    events: [ev("a", "only one employee on the team"), ev("b", "previous assignee is no longer on the team"), ev("c", "triage unavailable (timeout)"), ev("d", "no AI credit for triage")],
    employees: EMPLOYEES,
  });
  assert.deepEqual(steps.map((x) => x.key), [
    "app.messages.handling.frontDeskOnly",
    "app.messages.handling.reassigned",
    "app.messages.handling.frontDeskUnread",
    "app.messages.handling.frontDeskUnread",
  ]);
  assert.ok(steps.every((x) => x.note === null));
});

// ── 9. Proposal outcomes ───────────────────────────────────────────────────
test("proposal outcomes, including a pending one whose moment has passed", () => {
  const p = (id, status, extra = {}) => ({ id, employeeId: SAM.id, tool: "book_callback", args: {}, status, createdAt: at(0), ...extra });
  const { steps } = buildHandlingTimeline({
    proposals: [
      p("pend", "pending", { expiresAt: at(60) }),
      p("exp", "pending", { expiresAt: at(5) }),
      p("dec", "declined", { decidedByUserId: "user_emilio" }),
      p("stale", "stale", { decidedByUserId: "user_gone" }),
      p("fail", "failed", { decidedByUserId: "user_emilio", failureReason: "slot taken; call 6045550199" }),
      p("weird", "teleported"),
      p("nul", null),
    ],
    employees: EMPLOYEES,
    people: PEOPLE,
    viewer: CREW,
    now: at(10),
  });
  const byId = Object.fromEntries(steps.map((x) => [x.id, x]));
  assert.equal(byId["pr:pend"].outcome.key, "app.messages.handling.proposalPending");
  assert.equal(byId["pr:exp"].outcome.key, "app.messages.handling.proposalExpired");
  assert.equal(byId["pr:dec"].outcome.key, "app.messages.handling.proposalDeclined");
  assert.equal(byId["pr:stale"].outcome.key, "app.messages.handling.proposalStaleAnon");
  assert.equal(byId["pr:fail"].outcome.key, "app.messages.handling.proposalFailed");
  assert.equal(byId["pr:fail"].note, "slot taken; call •••");
  assert.equal(byId["pr:weird"].outcome.key, "app.messages.handling.proposalUnknown");
  assert.equal(byId["pr:weird"].outcome.params.status, "teleported");
  assert.equal(byId["pr:nul"].outcome.params.status, null);
  assert.equal(byId["pr:pend"].key, "app.messages.handling.proposal", "no slot for a callback");
});

// ── 10. Coverage against the code that writes the rows ─────────────────────
const { ROUTING_EVENT_KINDS } = await import("../lib/aiEmployee/routing.js");
const { SKIP_REASONS } = await import("../lib/aiEmployee/decide.js");
const { ALL_TOOL_DEFINITIONS, AI_EMPLOYEE_TOOLS } = await import("../lib/aiEmployee/tools.js").then(async (m) => ({
  ...m,
  AI_EMPLOYEE_TOOLS: (await import("../lib/aiEmployee/roles.js")).AI_EMPLOYEE_TOOLS,
}));
const { MEDIA_CLAIM_REASON } = await import("../lib/aiEmployee/evidence.js");

test("every routing kind routing.js can write has a step", () => {
  assert.deepEqual([...HANDLED_ROUTING_KINDS].sort(), [...ROUTING_EVENT_KINDS].sort());
});

test("every stop reason decide.js and respond.js can write has a sentence", () => {
  for (const r of [...SKIP_REASONS, MEDIA_CLAIM_REASON, "provider_error", "no_text", "send_failed", "dismissed_by_user"]) {
    assert.ok(QUIET_REASONS.includes(r), `no sentence for stop reason ${r}`);
  }
});

test("every key, reason, argument label and step kind exists in all nine languages", () => {
  const argFields = new Set(SAFE_ARG_FIELDS);
  for (const def of ALL_TOOL_DEFINITIONS) for (const f of Object.keys(def.input_schema?.properties || {})) if (f !== "slot_id") argFields.add(f);
  const keys = [
    ...HANDLING_KEYS,
    ...QUIET_REASONS.map((r) => `app.messages.handling.why.${r}`),
    "app.messages.handling.why.other",
    ...[...argFields].map((f) => `app.messages.handling.arg.${f}`),
    ...["high", "medium", "low"].map((c) => `app.messages.handling.confidence.${c}`),
    ...["title", "hint", "loadError", "truncated", "team", "former", "toolsLabel", "toolFailed", "toolProposed", "confidenceLabel", "cost", "argsHidden"].map((k) => `app.messages.handling.${k}`),
    ...AI_EMPLOYEE_TOOLS.map((tool) => `app.aiEmployee.tool.${tool}`),
    ...["book", "price", "problem", "other"].map((i) => `app.aiEmployee.intent.${i}`),
  ];
  const langs = Object.keys(APP_MESSAGES);
  assert.equal(langs.length, 9);
  for (const lang of langs) {
    for (const key of keys) {
      const value = APP_MESSAGES[lang][key];
      assert.ok(typeof value === "string" && value.trim(), `${lang} is missing ${key}`);
      const want = (APP_MESSAGES.en[key].match(/\{\w+\}/g) || []).sort().join();
      const got = (value.match(/\{\w+\}/g) || []).sort().join();
      assert.equal(got, want, `${lang} ${key} placeholders`);
    }
  }
  assert.equal(new Set(HANDLING_STEP_KINDS).size, HANDLING_STEP_KINDS.length);
  assert.ok(PROPOSAL_OUTCOMES.includes("expired"));
});

test("the builder is pure: no imports", () => {
  const src = fs.readFileSync(new URL("../lib/aiEmployee/handlingTimeline.js", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "handlingTimeline.js must not import anything");
});

console.log(`✓ handling timeline: ${passed} checks passed`);
