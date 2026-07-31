// Throwaway. Executes lib/reviews/request.js against the cases that cost money.
import { shouldRequestReview, validReviewUrl, clampDelay, MAX_DELAY_HOURS } from "@/lib/reviews/request.js";

let pass = 0, fail = 0;
const ok = (name, cond, got) => {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const HOUR = 3600e3;
const now = new Date("2026-07-30T12:00:00Z");
const co = { reviewUrl: "https://g.page/r/abc/review", reviewDelayHours: 24, reviewRequestsEnabled: true };
const client = { email: "sam@example.com" };
const done = (hoursAgo) => ({ status: "completed", completedAt: new Date(now - hoursAgo * HOUR), reviewRequestedAt: null });
const run = (over = {}) => shouldRequestReview({ job: done(48), company: co, client, now, ...over });

console.log("\nURL validation");
ok("google review link ok", validReviewUrl("https://g.page/r/x/review"));
ok("http ok", validReviewUrl("http://example.com/r"));
ok("javascript: refused", !validReviewUrl("javascript:alert(1)"));
ok("data: refused", !validReviewUrl("data:text/html,<script>x</script>"));
ok("empty refused", !validReviewUrl(""));
ok("null refused", !validReviewUrl(null));
ok("not-a-url refused", !validReviewUrl("just some words"));

console.log("\nDelay clamping");
ok("0 -> 1 (never same-second)", clampDelay(0) === 1, clampDelay(0));
ok("-5 -> 1", clampDelay(-5) === 1, clampDelay(-5));
ok("24 stays 24", clampDelay(24) === 24);
ok("99999 -> 30d cap", clampDelay(99999) === MAX_DELAY_HOURS, clampDelay(99999));
ok("garbage -> 24 default", clampDelay("abc") === 24, clampDelay("abc"));
ok("null -> 24 default", clampDelay(null) === 24, clampDelay(null));
ok("undefined -> 24 default", clampDelay(undefined) === 24, clampDelay(undefined));

console.log("\nThe happy path");
ok("48h after a finished job, sends", run().send === true, run());

console.log("\nThe gates that cost money if they leak");
ok("already asked -> never again", run({ job: { ...done(48), reviewRequestedAt: new Date() } }).send === false);
ok("...even if everything else is perfect and it's a year later",
  shouldRequestReview({ job: { status: "completed", completedAt: new Date(now - 8760 * HOUR), reviewRequestedAt: new Date() }, company: co, client, now }).send === false);
ok("switched off -> no", run({ company: { ...co, reviewRequestsEnabled: false } }).send === false);
ok("no review url -> no", run({ company: { ...co, reviewUrl: null } }).send === false);
ok("bad review url -> no", run({ company: { ...co, reviewUrl: "javascript:x" } }).send === false);
ok("unsubscribed -> no", run({ subscribed: false }).send === false);
ok("no email -> no", run({ client: {} }).send === false);
ok("null client -> no, not a crash", run({ client: null }).send === false);

console.log("\nJob state");
ok("scheduled -> no", run({ job: { ...done(48), status: "scheduled" } }).send === false);
ok("cancelled -> no", run({ job: { ...done(48), status: "cancelled" } }).send === false);
ok("in_progress -> no", run({ job: { ...done(48), status: "in_progress" } }).send === false);
ok("completed but no completedAt (legacy row) -> no",
  run({ job: { status: "completed", completedAt: null, reviewRequestedAt: null } }).send === false);

console.log("\nTiming");
ok("1h after finish, 24h delay -> too soon", run({ job: done(1) }).send === false);
ok("23h -> still too soon", run({ job: done(23) }).send === false);
ok("exactly 24h -> sends", run({ job: done(24) }).send === true, run({ job: done(24) }));
ok("25h -> sends", run({ job: done(25) }).send === true);
ok("31 days -> too old, left alone", run({ job: done(24 * 31) }).send === false);
ok("29 days -> still asks", run({ job: done(24 * 29) }).send === true);

console.log("\nHostile input");
ok("no job -> no crash", run({ job: null }).send === false);
ok("no company -> no crash", run({ company: null }).send === false);
ok("empty job object -> no crash", run({ job: {} }).send === false);
ok("garbage delay still resolves", run({ company: { ...co, reviewDelayHours: "banana" } }).send === true);
ok("negative delay can't fire instantly", (() => {
  const r = shouldRequestReview({ job: done(0.2), company: { ...co, reviewDelayHours: -100 }, client, now });
  return r.send === false; // 0.2h elapsed, clamped floor is 1h
})());

console.log("\nReasons are human-readable");
ok("every refusal carries a sentence", [
  run({ job: { ...done(48), reviewRequestedAt: new Date() } }),
  run({ company: { ...co, reviewUrl: null } }),
  run({ subscribed: false }),
  run({ job: done(1) }),
].every((r) => typeof r.reason === "string" && r.reason.length > 5 && r.reason.endsWith(".")));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 1 && 0 : 1);
