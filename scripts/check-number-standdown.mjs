// scripts/check-number-standdown.mjs
//
// What happens to the receptionist when its number goes away, and what happens
// to the number when the company goes away.
//
// ══ Two switches over a line that no longer exists ═════════════════════════
//
// Releasing the last number left "Answer my calls" and "Call clients back
// automatically" both ON. The screen then printed, directly under the still-on
// switch, "Set up a number above first — there's nothing for it to answer on."
//
// The outbound half is worse than cosmetic. `outboundCallsEnabled` is the
// contractor's own consent for FieldQuo to ring THEIR clients. Left set over a
// released number, the day they buy a new one the product resumes calling
// customers on a permission they last thought about months earlier.
//
// ══ And US$4 a month, silently, after they left ════════════════════════════
//
// Nothing noticed a cancelled subscription. The rent cron kept taking the
// rental out of a prepaid balance for a receptionist nobody could reach, on an
// account with nobody logging in to see it — and then released the number as a
// DELINQUENCY, with an email about an unpaid rental, which is not what
// happened.
//
// The rules asserted here are the ones that make that safe rather than merely
// cheaper: charging stops the day they cancel, the number survives the whole
// read-only window in case they come back, and a FAILED PAYMENT never releases
// anything.
import { rentDecision, RENT_GRACE_DAYS } from "@/lib/voice/spendGate";
import { CANCELLED_DAYS, accessFor } from "@/lib/billing/access";
import { readFileSync } from "node:fs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const DAY = 86400000;
const NOW = new Date("2026-08-30T12:00:00Z");
const ago = (days) => new Date(NOW.getTime() - days * DAY);
const NUMBER = {
  id: "n1",
  e164: "+13655176689",
  status: "active",
  monthlyCents: 400,
  rentPaidThroughAt: ago(1), // due
  rentGraceUntilAt: null,
  rentWarnedAt: null,
};
const decide = (access, over = {}) =>
  rentDecision({ number: { ...NUMBER, ...over }, balanceCents: 5000, now: NOW, access });

section("1. Cancelling stops the charge the same day");

const paying = accessFor({ status: "active" }, NOW);
ok(decide(paying).action === "charge", "a paying company is charged, exactly as before", decide(paying).action);
// The regression that matters: `access` defaults to null, so nothing that does
// not pass it may change behaviour.
ok(
  rentDecision({ number: NUMBER, balanceCents: 5000, now: NOW }).action === "charge",
  "a caller that does not ask about the subscription behaves exactly as before",
);

const justCancelled = accessFor({ status: "canceled", canceledAt: ago(1) }, NOW);
ok(justCancelled.level === "readonly", "one day after cancelling they are read-only", justCancelled.level);
ok(
  decide(justCancelled).action !== "charge",
  "…and the rental is NOT taken — they are not using it and would not know they were paying",
  decide(justCancelled).action,
);
ok(decide(justCancelled).action === "warn_cancelled", "…they are told instead", decide(justCancelled).action);
ok(
  decide(justCancelled).endsAt instanceof Date,
  "…and told WHEN the number goes, not merely that it will",
  decide(justCancelled).endsAt,
);
// Derived from their cancellation, not from now, or the email says a different
// day every time the cron runs.
ok(
  Math.round((decide(justCancelled).endsAt - ago(1)) / DAY) === CANCELLED_DAYS,
  `…${CANCELLED_DAYS} days from the day they cancelled, not from today`,
  decide(justCancelled).endsAt,
);
ok(
  decide(justCancelled, { rentWarnedAt: ago(0) }).action === "grace_wait",
  "…and it is not repeated daily",
);
ok(
  decide(justCancelled, { rentWarnedAt: ago(30) }).action === "warn_cancelled",
  "…but it IS repeated once the reminder gap has passed",
);

section("2. The number survives the whole window, then goes");

for (const d of [1, 15, 29]) {
  const a = accessFor({ status: "canceled", canceledAt: ago(d) }, NOW);
  ok(
    decide(a).action !== "release",
    `day ${d}: still theirs — the window is described as "not a punishment", and taking their business line away would make it one`,
    decide(a).action,
  );
}
const expired = accessFor({ status: "canceled", canceledAt: ago(CANCELLED_DAYS + 1) }, NOW);
ok(expired.level === "locked", "past the window they are locked out", expired.level);
ok(decide(expired).action === "release", "…and the number goes back rather than being rented for ever", decide(expired).action);
ok(
  decide(expired).reason === "subscription_ended",
  "…for a reason that is not 'you didn't pay', because they didn't fail to",
  decide(expired).reason,
);

section("3. A declined card does NOT destroy a number");

// A bank's fraud hold reaches `locked` in seven days. Releasing on that would
// take the number off somebody's van over a payment problem they may not know
// about, and it cannot be undone.
const pastDueLocked = accessFor({ status: "past_due", pastDueSince: ago(30) }, NOW);
ok(pastDueLocked.level === "locked", "a long-unpaid card is locked too", pastDueLocked.level);
ok(
  decide(pastDueLocked).action !== "release",
  "…and that must NEVER release the number — only a deliberate cancellation does",
  decide(pastDueLocked).action,
);
ok(
  decide(pastDueLocked).action === "charge",
  "…the rental goes on being taken, because they have not left",
  decide(pastDueLocked).action,
);
const pastDueSoon = accessFor({ status: "past_due", pastDueSince: ago(1) }, NOW);
ok(decide(pastDueSoon).action !== "release", "…nor inside the grace week");

section("4. Unpaid rent still has its own path, unchanged");

const broke = { number: { ...NUMBER, rentGraceUntilAt: ago(1) }, balanceCents: 0, now: NOW };
ok(rentDecision(broke).action === "release", `an empty balance past the ${RENT_GRACE_DAYS}-day grace still releases`);
ok(
  rentDecision(broke).reason !== "subscription_ended",
  "…and is NOT reported as a cancellation, so the email does not say the wrong thing",
  rentDecision(broke).reason,
);
ok(
  rentDecision({ ...broke, number: { ...broke.number, rentGraceUntilAt: null } }).action === "grace_start",
  "…and the first miss still starts a grace period rather than releasing",
);
// FieldQuo withdrawing the feature must still release nothing — it is our
// decision, so we carry the cost.
ok(
  rentDecision({ ...broke, available: false }).action === "skip",
  "a feature FieldQuo withdrew still releases nothing — we made that decision, we carry it",
);
ok(
  rentDecision({ ...broke, available: false, access: expired }).action === "skip",
  "…and that outranks the cancellation branch too",
);

section("5. Both release paths stand the receptionist down");

const helper = readFileSync("lib/voice/numberRelease.js", "utf8");
ok(/export async function standDownIfLastNumber/.test(helper), "there is one helper, not a copy per caller");
ok(/status: \{ in: HELD_STATUSES \}/.test(helper) && /if \(remaining > 0\) return unchanged;/.test(helper),
  "…and it only fires when that was the LAST number — a company can hold three");
ok(/enabled: false/.test(helper), "…switching the receptionist off");
ok(/outboundCallsEnabled: false/.test(helper), "…and withdrawing the standing consent to ring their clients");

const route = readFileSync("app/api/settings/voice/number/release/route.js", "utf8");
ok(/standDownIfLastNumber\(member\.companyId\)/.test(route), "the contractor's own button calls it");
const gate = readFileSync("lib/voice/spendGate.js", "utf8");
ok(/standDownIfLastNumber\(number\.companyId/.test(gate), "and so does the unattended release, which needs it more — nobody is watching");

section("6. The email says what actually happened");

ok(/release_cancelled/.test(gate), "a release after cancellation has its own copy");
ok(
  /decision\.reason === "subscription_ended" \? "release_cancelled" : decision\.action/.test(gate),
  "…chosen by REASON, because one action has two entirely different causes",
);
ok(
  /warn_cancelled: \{/.test(gate),
  "…and the stop-charging notice has its own copy too",
);
ok(
  /label: "Resubscribe"/.test(gate),
  "a company that left is not sent to a top-up screen — that reads as a bill on the way out",
);

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
