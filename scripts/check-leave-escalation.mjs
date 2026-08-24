// scripts/check-leave-escalation.mjs
//
// Executes the availability lookup and the routing it feeds, against
// constructed leave data. No database.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-leave-escalation.mjs
//
// Every expectation below is hand-checked against a fixed "today" of
// 2026-08-23 (a Sunday) so the run is deterministic — a check that depends on
// the real clock passes for a while and then starts failing on a Tuesday.
import assert from "node:assert/strict";
import {
  utcDay,
  dayBounds,
  coversDay,
  buildAwayLookup,
} from "@/lib/org/availability";
import { approverFor } from "@/lib/org/reportingLine";
import { describeRouting } from "@/lib/org/leaveRouting";

const TODAY = new Date("2026-08-23T11:30:00.000Z");

let pass = 0;
const fails = [];
function check(name, fn) {
  try {
    fn();
    pass += 1;
  } catch (err) {
    fails.push(`${name}: ${err.message}`);
  }
}

const leave = (over) => ({
  workerId: "w",
  status: "approved",
  startDate: new Date("2026-08-20T00:00:00.000Z"),
  endDate: new Date("2026-08-28T00:00:00.000Z"),
  ...over,
});

// ── 1. Who is away, and who only looks like it ─────────────────────────────

check("on leave today → away", () => {
  assert.equal(coversDay(leave(), TODAY), true);
});

check("leave ended yesterday → not away", () => {
  const l = leave({
    startDate: new Date("2026-08-14T00:00:00.000Z"),
    endDate: new Date("2026-08-22T00:00:00.000Z"),
  });
  assert.equal(coversDay(l, TODAY), false);
});

check("leave starts tomorrow → not away", () => {
  const l = leave({
    startDate: new Date("2026-08-24T00:00:00.000Z"),
    endDate: new Date("2026-08-30T00:00:00.000Z"),
  });
  assert.equal(coversDay(l, TODAY), false);
});

check("first day is inclusive", () => {
  const l = leave({ startDate: new Date("2026-08-23T00:00:00.000Z") });
  assert.equal(coversDay(l, TODAY), true);
});

check("last day is inclusive", () => {
  const l = leave({
    startDate: new Date("2026-08-10T00:00:00.000Z"),
    endDate: new Date("2026-08-23T00:00:00.000Z"),
  });
  assert.equal(coversDay(l, TODAY), true);
});

check("half day counts as away", () => {
  const l = leave({
    startDate: new Date("2026-08-23T00:00:00.000Z"),
    endDate: new Date("2026-08-23T00:00:00.000Z"),
    halfDay: true,
  });
  assert.equal(coversDay(l, TODAY), true);
});

check("a request spanning the day boundary covers every day it touches", () => {
  // Stored with a time component, which the midnight-UTC convention shouldn't
  // rely on being absent.
  const l = leave({
    startDate: new Date("2026-08-22T23:00:00.000Z"),
    endDate: new Date("2026-08-24T01:00:00.000Z"),
  });
  assert.equal(coversDay(l, new Date("2026-08-21T12:00:00.000Z")), false);
  assert.equal(coversDay(l, new Date("2026-08-22T12:00:00.000Z")), true);
  assert.equal(coversDay(l, TODAY), true);
  assert.equal(coversDay(l, new Date("2026-08-24T12:00:00.000Z")), true);
  assert.equal(coversDay(l, new Date("2026-08-25T12:00:00.000Z")), false);
});

for (const status of ["pending", "declined", "cancelled", "", null, undefined, "APPROVED"]) {
  check(`status ${JSON.stringify(status)} is not away`, () => {
    assert.equal(coversDay(leave({ status }), TODAY), false);
  });
}

check("ISO strings work as well as Dates", () => {
  const l = leave({ startDate: "2026-08-20", endDate: "2026-08-28" });
  assert.equal(coversDay(l, "2026-08-23"), true);
  assert.equal(coversDay(l, "2026-08-29"), false);
});

// ── 2. Hostile input ───────────────────────────────────────────────────────

const hostile = [
  ["null start", { startDate: null }],
  ["null end", { endDate: null }],
  ["undefined start", { startDate: undefined }],
  ["empty-string end", { endDate: "" }],
  ["NaN date", { startDate: new Date("banana") }],
  ["NaN number", { startDate: new Date(NaN), endDate: new Date(NaN) }],
  ["epoch (new Date(0)) is not 1 Jan 1970 leave", {
    startDate: new Date(0),
    endDate: new Date(0),
  }],
  ["inverted range", {
    startDate: new Date("2026-08-28T00:00:00.000Z"),
    endDate: new Date("2026-08-20T00:00:00.000Z"),
  }],
  ["garbage strings", { startDate: "not a date", endDate: "also not" }],
  ["numbers", { startDate: 0, endDate: 0 }],
];
for (const [name, over] of hostile) {
  check(`hostile: ${name} → not away`, () => {
    assert.equal(coversDay(leave(over), TODAY), false);
  });
}

check("hostile: non-object leave rows", () => {
  for (const v of [null, undefined, "x", 42, [], true]) {
    assert.equal(coversDay(v, TODAY), false);
  }
});

check("hostile: unreadable reference day → nobody is away", () => {
  for (const when of [null, undefined, "", new Date(NaN), "nope", new Date(0)]) {
    assert.equal(coversDay(leave(), when), false);
    assert.equal(buildAwayLookup([leave()], when).awayIds.size, 0);
  }
});

check("hostile: leaveRequests that isn't an array", () => {
  for (const v of [null, undefined, "rows", 7, {}]) {
    const { isAway, awayIds } = buildAwayLookup(v, TODAY);
    assert.equal(awayIds.size, 0);
    assert.equal(isAway("w"), false);
  }
});

check("hostile: rows without a workerId are skipped, not crashed on", () => {
  const { awayIds } = buildAwayLookup(
    [null, {}, { workerId: 5, status: "approved" }, leave({ workerId: "ok" })],
    TODAY,
  );
  assert.deepEqual([...awayIds], ["ok"]);
});

// ── 3. utcDay / dayBounds ──────────────────────────────────────────────────

check("utcDay normalises to midnight UTC", () => {
  assert.equal(
    utcDay("2026-08-23T23:59:59.999Z"),
    Date.UTC(2026, 7, 23),
  );
});
check("utcDay rejects pre-2000 and unparseable values", () => {
  assert.equal(utcDay(new Date(0)), null);
  assert.equal(utcDay(null), null);
  assert.equal(utcDay("1999-12-31"), null);
  assert.equal(utcDay(new Date("x")), null);
});
check("dayBounds spans exactly one UTC day", () => {
  const b = dayBounds(TODAY);
  assert.equal(b.start.toISOString(), "2026-08-23T00:00:00.000Z");
  assert.equal(b.end.toISOString(), "2026-08-23T23:59:59.999Z");
  assert.equal(dayBounds(new Date(NaN)), null);
});

check("the query's where-clause agrees with the pure check", () => {
  // The db filter is `startDate <= dayEnd AND endDate >= dayStart`. If it ever
  // disagreed with coversDay, rows would be dropped before the authority saw
  // them — so assert the two on the same fixtures.
  const b = dayBounds(TODAY);
  const rows = [
    leave(), // covers
    leave({ startDate: "2026-08-14", endDate: "2026-08-22" }), // ended yesterday
    leave({ startDate: "2026-08-24", endDate: "2026-08-30" }), // starts tomorrow
    leave({ startDate: "2026-08-23", endDate: "2026-08-23" }), // exactly today
  ];
  for (const r of rows) {
    const s = new Date(r.startDate);
    const e = new Date(r.endDate);
    const matchedByQuery = s <= b.end && e >= b.start;
    assert.equal(
      matchedByQuery,
      coversDay(r, TODAY),
      `query and coversDay disagree on ${r.startDate}→${r.endDate}`,
    );
  }
});

// ── 4. Routing: the escalation this whole change exists for ────────────────
//
// ana → bo → cy → (nobody). Every expectation is the chain walked by hand.
const ORG = new Map(
  [
    { id: "ana", name: "Ana", managerId: "bo" },
    { id: "bo", name: "Bo", managerId: "cy" },
    { id: "cy", name: "Cy", managerId: null },
  ].map((w) => [w.id, w]),
);

function routeWith(awayRows) {
  const { isAway } = buildAwayLookup(awayRows, TODAY);
  return describeRouting({ workerId: "ana", byId: ORG, isAway });
}

check("nobody away → waits on the direct manager", () => {
  const r = routeWith([]);
  assert.equal(r.approverId, "bo");
  assert.equal(r.reason, "direct_manager");
  assert.equal(r.label, "Waiting on Bo.");
  assert.deepEqual(r.escalatedPast, []);
});

check("manager away today → escalates past them, and says why", () => {
  const r = routeWith([leave({ workerId: "bo" })]);
  assert.equal(r.approverId, "cy");
  assert.equal(r.reason, "escalated");
  assert.equal(r.label, "Waiting on Cy — escalated because Bo is away.");
  assert.deepEqual(r.escalatedPast, [{ id: "bo", name: "Bo", why: "away" }]);
});

check("manager's leave ended yesterday → no escalation", () => {
  const r = routeWith([
    leave({ workerId: "bo", startDate: "2026-08-14", endDate: "2026-08-22" }),
  ]);
  assert.equal(r.approverId, "bo");
  assert.equal(r.reason, "direct_manager");
});

check("manager's request is only PENDING → no escalation", () => {
  const r = routeWith([leave({ workerId: "bo", status: "pending" })]);
  assert.equal(r.approverId, "bo");
});

check("whole chain away → nobody waited on, and the reason is specific", () => {
  const r = routeWith([leave({ workerId: "bo" }), leave({ workerId: "cy" })]);
  assert.equal(r.approverId, null);
  assert.equal(r.reason, "chain_unavailable");
  assert.match(r.label, /^Waiting on an owner or admin — everyone above Ana \(Bo and Cy\) is away\.$/);
});

check("no manager at all → the other empty case, worded differently", () => {
  const r = describeRouting({ workerId: "cy", byId: ORG });
  assert.equal(r.approverId, null);
  assert.equal(r.reason, "no_manager");
  assert.match(r.label, /no manager is set for Cy/);
});

check("a throwing isAway does not make a request unroutable", () => {
  const boom = () => {
    throw new Error("neon is asleep");
  };
  assert.equal(approverFor({ workerId: "ana", byId: ORG, isAway: boom }).approverId, "bo");
  const r = describeRouting({ workerId: "ana", byId: ORG, isAway: boom, degraded: true });
  assert.equal(r.approverId, "bo");
  assert.equal(r.canAct, false);
  // ...and it must not pretend it knows who is away.
  assert.match(r.note, /Couldn't check who's away/);
});

check("escalation does not widen who may act", () => {
  const away = buildAwayLookup([leave({ workerId: "bo" })], TODAY).isAway;
  // Bo is away and the request waits on Cy — Bo may still act. Escalation
  // decides waiting, not permission.
  const asBo = describeRouting({
    workerId: "ana",
    byId: ORG,
    isAway: away,
    actorWorkerId: "bo",
  });
  assert.equal(asBo.approverId, "cy");
  assert.equal(asBo.canAct, true);

  // A stranger with no manage permission and no place above Ana may not.
  const asStranger = describeRouting({
    workerId: "ana",
    byId: ORG,
    isAway: away,
    actorWorkerId: "zed",
  });
  assert.equal(asStranger.canAct, false);

  // Nobody approves their own, permission or not.
  const asSelf = describeRouting({
    workerId: "ana",
    byId: ORG,
    isAway: away,
    actorWorkerId: "ana",
    hasManagePermission: true,
  });
  assert.equal(asSelf.canAct, false);
});

check("a cycle terminates and is flagged rather than hidden", () => {
  const looped = new Map(
    [
      { id: "ana", name: "Ana", managerId: "bo" },
      { id: "bo", name: "Bo", managerId: "ana" },
    ].map((w) => [w.id, w]),
  );
  const r = describeRouting({ workerId: "ana", byId: looped });
  assert.equal(r.approverId, "bo");
  assert.match(r.note, /loops back on itself/);
});

check("an unknown worker id degrades to a sentence, not a crash", () => {
  const r = describeRouting({ workerId: "ghost", byId: ORG });
  assert.equal(r.approverId, null);
  assert.equal(r.reason, "no_manager");
});

// ── Report ─────────────────────────────────────────────────────────────────

if (fails.length) {
  console.error(`\n${fails.length} FAILED:`);
  for (const f of fails) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`✓ ${pass} availability + escalation checks passed`);
