// scripts/check-sales-checkin.mjs
//
//   npm run check:sales-checkin
//
// A rep signs up thirty contractors. Sixty days later, how many are still
// there — and which one should they text this morning?
//
// ══ Why this check carries its own fixtures ═══════════════════════════════
//
// Zero companies are attributed to anybody today. There is no data to look at,
// so every branch below is driven by hand against `checkInSignals` — the day
// they signed up, day 59, day 61, checked in yesterday, no setup snapshot at
// all, a cancelled subscription, a demo company, a null signup date. The point
// of a pure decision function is that this is possible months before the first
// real row exists.
//
// ══ The three things it is really guarding ════════════════════════════════
//
//   1. THE CADENCE GUARD. "Never nag" is a claim about a subtraction, and a
//      subtraction is exactly the kind of thing that quietly stops being true.
//   2. THE DEMO EXCLUSION. lib/demo/seedDemo.js companies have no owner. A
//      check-in text to one is a message to nobody, sent by a real number.
//   3. THE FALLBACK. The rep must always get a usable draft. The model is
//      forced to fail here five different ways — absent, unmetered, over
//      budget, erroring, and answering with a plausible invented fact — and
//      every one of them has to produce a sendable message.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// The cadence guard, the demo exclusion, the retentionDays read and the AI
// fallback were each broken on disk in turn, confirmed to fail here, and
// restored from a `cp` backup — never `git checkout`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The no-model half must run with no key whatever the developer's environment
// says. Set before any module is imported; `isAiConfigured()` reads
// process.env at CALL time, so section 7 can put one back.
delete process.env.OPENAI_API_KEY;

import {
  checkInSignals,
  setupFacts,
  minGapDays,
  rankCheckIns,
  compareCheckIns,
  CHECKIN_REASONS,
  REASON_CODES,
  SUPPRESSIONS,
  FIRST_CHECKIN_DAY,
  RETENTION_NEAR_DAYS,
  PROBLEM_URGENCY,
  MIN_GAP_FLOOR_DAYS,
  MIN_GAP_CEILING_DAYS,
  scheduledCheckinDue,
  SCHEDULED_CHECKIN_DAYS,} from "@/lib/sales/checkin/signals";

import {
  draftCheckIn,
  ruleDraft,
  judgeDraft,
  smsCost,
  isGsm7,
  MAX_SMS_CHARS,
  MAX_SEGMENTS,
  CHECKIN_AI_AREA,
  DRAFT_REASONS,
} from "@/lib/sales/checkin/draft";

// The REAL producer of the setup signal, not a hand-made array. The lesson
// from check-inbound-distribution.mjs: a check that builds the shape it wants
// passes while the shipped code reads a shape that never arrives.
import { stepsFor, SETUP_STEP_KEYS } from "@/lib/setupSteps";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * The file with its comments removed.
 *
 * Every source assertion below is about what the code DOES, and both of these
 * files carry long headers that talk about what they deliberately do not do
 * ("no cron, no queue"). Grepping the whole file would fail on the sentence
 * promising the absence of the thing being grepped for.
 */
const codeOnly = (p) =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

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

const NOW = new Date("2026-09-10T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const dayAgo = (n) => new Date(NOW.getTime() - n * DAY);

// The plan's window. Read from the schema default rather than typed here, so
// this file cannot be the place 60 gets hardcoded either.
const PLAN_RETENTION_DAYS = (() => {
  const m = read("prisma/schema.prisma").match(/retentionDays\s+Int @default\((\d+)\)/);
  return m ? Number(m[1]) : null;
})();

/** A healthy, fully-measured company thirty days in. Overridden per case. */
const company = (over = {}) => ({
  id: "c1",
  name: "Northside Painting",
  signedUpAt: dayAgo(30),
  isDemo: false,
  chargesEnabled: true,
  onboardingCompletedAt: dayAgo(29),
  subscriptionStatus: "active",
  attributedAt: dayAgo(30),
  attributionSource: "link",
  ...over,
});

/** Real steps, with `n` of the ten still open. Dismissal is a real code path. */
const stepsWithOpen = (n) => stepsFor({ dismissed: SETUP_STEP_KEYS.slice(0, SETUP_STEP_KEYS.length - n) });
const ALL_STEPS_DONE = stepsWithOpen(0);
const THREE_OPEN = stepsWithOpen(3);

const decide = (over = {}, extra = {}) =>
  checkInSignals({
    company: company(over),
    setup: ALL_STEPS_DONE,
    retentionDays: PLAN_RETENTION_DAYS,
    now: NOW,
    ...extra,
  });

const codes = (d) => d.reasons.map((r) => r.code);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The plan's window is READ, never assumed");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the schema still carries a retentionDays default", Number.isFinite(PLAN_RETENTION_DAYS), PLAN_RETENTION_DAYS);

  // The one number that must not appear in the code: a hardcoded window would
  // make every milestone date on the screen wrong the day the owner changes
  // the plan, and nothing would say so. The DAY_MS constant's own 60s are the
  // only ones allowed, and they are seconds and minutes, not days.
  const decisionCode = codeOnly("lib/sales/checkin/signals.js").replace(/24 \* 60 \* 60 \* 1000/g, "DAY");
  const dayLines = decisionCode.split("\n").filter((l) => /\b60\b/.test(l) && /day|retention|window/i.test(l));
  ok("signals.js hardcodes no 60-day window", dayLines.length === 0, dayLines);
  ok("…and retentionDays has no default to fall back to", /retentionDays = null/.test(decisionCode));

  // The window is the caller's, proven by changing it and watching the answer
  // move. Day 61 is past a 60-day milestone and well inside a 90-day one.
  const d60 = decide({ signedUpAt: dayAgo(61) }, { retentionDays: 60 });
  const d90 = decide({ signedUpAt: dayAgo(61) }, { retentionDays: 90 });
  ok("at day 61 on a 60-day plan the window has passed", d60.daysToRetention === -1, d60.daysToRetention);
  ok("…the same company on a 90-day plan has 29 days left", d90.daysToRetention === 29, d90.daysToRetention);
  ok("…and the retentionDate moves with it", d90.retentionDate.getTime() - d60.retentionDate.getTime() === 30 * DAY);
  ok("the window is reported back", d60.retentionDays === 60 && d90.retentionDays === 90);
  ok("an absent window yields no milestone arithmetic rather than a guessed one",
    decide({}, { retentionDays: null }).daysToRetention === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The cadence guard — never nag");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a quarter of the window, so the count of contacts holds at any window", minGapDays(60) === 15, minGapDays(60));
  ok("…40 days gives 10", minGapDays(40) === 10, minGapDays(40));
  ok(`…and it never drops below ${MIN_GAP_FLOOR_DAYS} days`, minGapDays(8) === MIN_GAP_FLOOR_DAYS, minGapDays(8));
  ok(`…nor above ${MIN_GAP_CEILING_DAYS}`, minGapDays(3650) === MIN_GAP_CEILING_DAYS, minGapDays(3650));
  ok("an unreadable window is the most conservative gap, not the least",
    minGapDays(null) === MIN_GAP_CEILING_DAYS && minGapDays("soon") === MIN_GAP_CEILING_DAYS);

  const gap = minGapDays(PLAN_RETENTION_DAYS);
  const yesterday = decide({}, { lastCheckInAt: dayAgo(1) });
  ok("checked in yesterday is NOT due", yesterday.due === false, yesterday.due);
  ok("…and says which rule stopped it", yesterday.suppressed?.code === "recently_checked_in", yesterday.suppressed);
  ok("…in words a rep can read", yesterday.suppressed?.text === SUPPRESSIONS.recently_checked_in);
  ok("…and says when it lifts", yesterday.nextEligibleAt?.getTime() === dayAgo(1).getTime() + gap * DAY, yesterday.nextEligibleAt);
  ok("…while still showing WHY it wanted to", yesterday.reasons.length > 0, codes(yesterday));

  ok(`the day before the gap closes is still too soon`, decide({}, { lastCheckInAt: dayAgo(gap - 1) }).due === false);
  ok("…the day it closes is due", decide({}, { lastCheckInAt: dayAgo(gap) }).due === true);

  // Absolute. A second reason appearing is not permission to text twice in a
  // week — the contractor cannot see our reasoning, only the two texts.
  const urgentButRecent = decide(
    { subscriptionStatus: "past_due", chargesEnabled: false },
    { lastCheckInAt: dayAgo(1) },
  );
  ok("even a failing payment does not override the guard", urgentButRecent.due === false, urgentButRecent.suppressed);
  ok("…and the urgency is still reported for the screen", urgentButRecent.urgency >= PROBLEM_URGENCY, urgentButRecent.urgency);
  ok("never checked in is not a blocked check-in", decide().due === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The clock: today, day 59, day 61");
// ═══════════════════════════════════════════════════════════════════════════
{
  const today = decide({ signedUpAt: NOW, onboardingCompletedAt: null });
  ok("signed up today is not due", today.due === false, today.due);
  ok("…because there is nothing to check in on yet", today.suppressed?.code === "too_soon", today.suppressed);
  ok("…and it says when that changes", today.nextEligibleAt?.getTime() === NOW.getTime() + FIRST_CHECKIN_DAY * DAY);
  ok("day 0 is day 0, not day 1", today.dayInLife === 0, today.dayInLife);

  ok(`day ${FIRST_CHECKIN_DAY - 1} is still too soon`, decide({ signedUpAt: dayAgo(FIRST_CHECKIN_DAY - 1) }).due === false);
  ok(`day ${FIRST_CHECKIN_DAY} is the first day a check-in is due`, decide({ signedUpAt: dayAgo(FIRST_CHECKIN_DAY) }).due === true);

  const d59 = decide({ signedUpAt: dayAgo(59) });
  ok("day 59 is due", d59.due === true, d59.suppressed);
  ok("…with one day to the milestone", d59.daysToRetention === 1, d59.daysToRetention);
  ok("…and the near-milestone reason raised", codes(d59).includes("retention_milestone_near"), codes(d59));
  ok(`…which only appears inside ${RETENTION_NEAR_DAYS} days`,
    !codes(decide({ signedUpAt: dayAgo(30) })).includes("retention_milestone_near"));

  const d61 = decide({ signedUpAt: dayAgo(61) });
  ok("day 61 with nothing wrong is not due", d61.due === false, d61.reasons);
  ok("…because the window has passed", d61.suppressed?.code === "milestone_passed", d61.suppressed);

  // A problem still gets through after the milestone. The commission is
  // settled; the contractor's failing card is not.
  const d61Broken = decide({ signedUpAt: dayAgo(61), subscriptionStatus: "past_due" });
  ok("day 61 with a failing payment IS due", d61Broken.due === true, d61Broken.suppressed);
  ok("…on the payment, not on a courtesy", d61Broken.primary?.code === "payment_failing", d61Broken.primary);

  const d61Minor = decide({ signedUpAt: dayAgo(61) }, { setup: THREE_OPEN });
  ok("day 61 with only open setup steps stays quiet", d61Minor.due === false, d61Minor.suppressed);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Two companies that must never be texted");
// ═══════════════════════════════════════════════════════════════════════════
{
  const demo = decide({ isDemo: true, subscriptionStatus: "past_due", chargesEnabled: false });
  ok("a demo company is not due", demo.due === false, demo.due);
  ok("…and is marked uncontactable, not merely not-due", demo.contactable === false, demo.contactable);
  ok("…named as a demo", demo.suppressed?.code === "demo_company", demo.suppressed);
  ok("…with no reasons at all, so no screen can offer to draft one", demo.reasons.length === 0, demo.reasons);
  ok("…and the demo test runs before any reason is computed", demo.urgency === 0, demo.urgency);
  ok("a demo company that looks perfect is also excluded", decide({ isDemo: true }).contactable === false);

  const noDate = decide({ signedUpAt: null });
  ok("a null signup date is not due", noDate.due === false, noDate.due);
  ok("…and says so rather than assuming today", noDate.suppressed?.code === "signup_date_unknown", noDate.suppressed);
  ok("…with no invented day count", noDate.dayInLife === null && noDate.daysToRetention === null, noDate.dayInLife);
  ok("…but it is still a real company, so it stays contactable", noDate.contactable === true);
  ok("an unparseable signup date is treated the same", decide({ signedUpAt: "whenever" }).suppressed?.code === "signup_date_unknown");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Absence of a statement is not a statement");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("no snapshot means not measured", setupFacts(null).measured === false);
  ok("…with no invented count", setupFacts(null).remainingCount === null, setupFacts(null));
  ok("an empty list IS measured", setupFacts([]).measured === true);
  ok("the real producer measures ten steps", setupFacts(stepsFor({})).total === SETUP_STEP_KEYS.length, setupFacts(stepsFor({})).total);
  ok("…all open when nothing is done", setupFacts(stepsFor({})).remainingCount === SETUP_STEP_KEYS.length);
  ok("…none open when every one is dismissed", setupFacts(ALL_STEPS_DONE).remainingCount === 0);
  ok("…and three when three are left", setupFacts(THREE_OPEN).remainingCount === 3, setupFacts(THREE_OPEN).remainingCount);
  ok("at most two titles reach a text message", setupFacts(stepsFor({})).remainingTitles.length === 2);

  const blind = decide({}, { setup: null });
  ok("an unmeasured company is never reported healthy", !codes(blind).includes("all_good"), codes(blind));
  ok("…it is reported unknown", codes(blind).includes("unknown_state"), codes(blind));
  ok("…and it is still worth a text", blind.due === true);
  ok("a company we could not read the subscription of is unknown too",
    codes(decide({ subscriptionStatus: null })).includes("unknown_state"));
  ok("…and one whose charges column was not selected",
    codes(decide({ chargesEnabled: undefined })).includes("unknown_state"));
  ok("…and one whose onboarding column was not selected",
    codes(decide({ onboardingCompletedAt: undefined })).includes("unknown_state"));
  ok("unknown outranks fine, because not knowing is worse",
    CHECKIN_REASONS.unknown_state.urgency > CHECKIN_REASONS.all_good.urgency);
  ok("all_good and unknown_state can never both be raised",
    REASON_CODES.every(() => true) && !codes(blind).includes("all_good") && !codes(decide()).includes("unknown_state"));

  const fine = decide();
  ok("a fully-measured healthy company IS reported healthy", codes(fine).includes("all_good"), codes(fine));
  ok("…and it is a legitimate reason to text, not a problem", fine.due === true && fine.primary.code === "all_good");
  ok("…phrased as what it is", /just checking in/i.test(fine.primary.angle), fine.primary.angle);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The reasons, and the order a rep works them in");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the reason set is closed", REASON_CODES.length === 8, REASON_CODES);
  ok("every reason carries an urgency, a headline and an angle",
    REASON_CODES.every((c) => Number.isFinite(CHECKIN_REASONS[c].urgency) && CHECKIN_REASONS[c].headline && CHECKIN_REASONS[c].angle));
  ok("every urgency is distinct, so the ordering is total",
    new Set(REASON_CODES.map((c) => CHECKIN_REASONS[c].urgency)).size === REASON_CODES.length);

  ok("a failing card is the top reason", decide({ subscriptionStatus: "past_due" }).primary.code === "payment_failing");
  ok("…as is an unpaid one", decide({ subscriptionStatus: "unpaid" }).primary.code === "payment_failing");
  ok("…and an incomplete one", decide({ subscriptionStatus: "incomplete" }).primary.code === "payment_failing");
  ok("a cancelled subscription is not a check-in at all", decide({ subscriptionStatus: "canceled" }).due === false);
  ok("…it says the subscription ended", decide({ subscriptionStatus: "canceled" }).suppressed?.code === "subscription_ended");
  ok("…and drafts nothing", decide({ subscriptionStatus: "canceled" }).reasons.length === 0);
  ok("an expired incomplete signup is treated the same", decide({ subscriptionStatus: "incomplete_expired" }).suppressed?.code === "subscription_ended");

  ok("no payouts connected is its own reason", codes(decide({ chargesEnabled: false })).includes("payments_not_connected"));
  ok("…and it counts as a problem past the milestone",
    CHECKIN_REASONS.payments_not_connected.urgency >= PROBLEM_URGENCY);
  ok("unfinished onboarding is its own reason", codes(decide({ onboardingCompletedAt: null })).includes("onboarding_unfinished"));
  ok("open setup steps are their own reason", codes(decide({}, { setup: THREE_OPEN })).includes("setup_steps_outstanding"));
  ok("…and are not raised when there are none", !codes(decide()).includes("setup_steps_outstanding"));

  const trial = decide({ subscriptionStatus: "trialing", signedUpAt: dayAgo(30) }, { trialEndsAt: new Date(NOW.getTime() + 5 * DAY) });
  ok("a free period ending before the milestone is a reason", codes(trial).includes("trial_ends_before_retention"), codes(trial));
  const trialLate = decide({ subscriptionStatus: "trialing", signedUpAt: dayAgo(30) }, { trialEndsAt: new Date(NOW.getTime() + 45 * DAY) });
  ok("…one ending after it is not", !codes(trialLate).includes("trial_ends_before_retention"), codes(trialLate));
  ok("…and with no trial date read, nothing is guessed from the status",
    !codes(decide({ subscriptionStatus: "trialing" })).includes("trial_ends_before_retention"));
  // Day 1 of a free month on a 60-day plan: the trial ends before the
  // milestone, and it is not "soon". Found when the backlog made day-1 drafts
  // reachable and every one of them opened with the free period ending.
  // The first real company: "Easy Roofers Inc." ended the greeting with a
  // double full stop until the name's own punctuation was dropped.
  {
    const inc = ruleDraft({ primary: { code: "all_good" }, facts: { companyName: "Easy Roofers Inc." } }, { repName: "Daniel" });
    ok("a company name ending in a full stop does not double it", /about Easy Roofers Inc\. How/.test(inc) && !/\.\./.test(inc), inc);
  }
  const trialFar = decide({ subscriptionStatus: "trialing", signedUpAt: dayAgo(1) }, { trialEndsAt: new Date(NOW.getTime() + 29 * DAY) });
  ok("…a free period ending in a month is not raised as ending soon", !codes(trialFar).includes("trial_ends_before_retention"), codes(trialFar));
  const trialNear = decide({ subscriptionStatus: "trialing", signedUpAt: dayAgo(20) }, { trialEndsAt: new Date(NOW.getTime() + RETENTION_NEAR_DAYS * DAY) });
  ok("…one ending within the near window is", codes(trialNear).includes("trial_ends_before_retention"), codes(trialNear));

  const many = decide({ subscriptionStatus: "past_due", chargesEnabled: false, onboardingCompletedAt: null }, { setup: THREE_OPEN });
  ok("several problems all appear", many.reasons.length === 4, codes(many));
  ok("…hardest first", codes(many)[0] === "payment_failing" && codes(many).at(-1) === "setup_steps_outstanding", codes(many));
  ok("…and urgency is the worst of them", many.urgency === CHECKIN_REASONS.payment_failing.urgency);

  const queue = rankCheckIns([
    decide({ id: "quiet" }),
    decide({ id: "broken", subscriptionStatus: "past_due" }),
    decide({ id: "demo", isDemo: true }),
    decide({ id: "steps" }, { setup: THREE_OPEN }),
  ]);
  ok("the rep's queue puts the failing card first", queue[0].companyId === "broken", queue.map((q) => q.companyId));
  ok("…the open steps next", queue[1].companyId === "steps", queue.map((q) => q.companyId));
  ok("…the healthy one after that", queue[2].companyId === "quiet");
  ok("…and the demo last, present but never due", queue[3].companyId === "demo" && queue[3].due === false);
  ok("nothing is dropped from the queue", queue.length === 4);
  ok("the comparator is a total order", compareCheckIns(queue[0], queue[0]) === 0);
  ok("a company with no window sorts after one that has one",
    compareCheckIns(decide({ id: "a" }), decide({ id: "b" }, { retentionDays: null })) < 0);
  ok("rankCheckIns survives rubbish", rankCheckIns(null).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The draft, with no model at all");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("the key really is unset for this section", !process.env.OPENAI_API_KEY);

  // Every reason produces a sendable message, inside the SMS budget, in
  // characters that do not silently triple the cost of the send.
  for (const code of REASON_CODES) {
    const d = { ...decide(), primary: { code, ...CHECKIN_REASONS[code] } };
    const text = ruleDraft(d, { repName: "Daniel" });
    const cost = smsCost(text);
    ok(`${code}: a draft exists`, typeof text === "string" && text.length > 40);
    ok(`${code}: it fits ${MAX_SEGMENTS} segments`, cost.segments <= MAX_SEGMENTS && cost.chars <= MAX_SMS_CHARS, cost);
    ok(`${code}: GSM-7, so one emoji has not tripled the send`, cost.gsm7 === true);
    ok(`${code}: it passes the same gate the model's answer has to`, judgeDraft(text, d).ok, judgeDraft(text, d));
    ok(`${code}: it asks how it is going`, /how is it going/i.test(text), text);
  }

  const steps = decide({}, { setup: THREE_OPEN });
  ok("the setup draft names the count it measured", ruleDraft(steps, { repName: "Daniel" }).includes("3 setup steps"), ruleDraft(steps, { repName: "Daniel" }));
  const one = decide({}, { setup: stepsWithOpen(1) });
  ok("…and says it in the singular when there is one", /still 1 setup step open/.test(ruleDraft(one, { repName: "Daniel" })));

  ok("the rep's name is used", ruleDraft(decide(), { repName: "Daniel" }).includes("Daniel"));
  ok("…and a missing one does not leave a hole", !/undefined|null|\s{2}/.test(ruleDraft(decide(), {})));
  ok("an emoji in a rep's name is stripped rather than sent",
    isGsm7(ruleDraft(decide(), { repName: "Daniel 🎨" })) && !ruleDraft(decide(), { repName: "Daniel 🎨" }).includes("🎨"));

  // Contractors name their businesses whatever they like. A 400-character one
  // must shorten the message, not break the send.
  const huge = decide({ name: "The Very Long Company Name ".repeat(20) });
  const hugeText = ruleDraft(huge, { repName: "Daniel" });
  ok("a 540-character company name still yields a sendable text", smsCost(hugeText).segments <= MAX_SEGMENTS, smsCost(hugeText));
  ok("…and it is not cut off mid-word", /[.?]$/.test(hugeText), hugeText.slice(-40));
  ok("…and still asks the question", /how is it going/i.test(hugeText));
  ok("a company with no name at all still gets a draft", ruleDraft(decide({ name: null }), { repName: "Daniel" }).length > 40);

  // The gate, exercised directly on the things a model actually does.
  const d = decide({}, { setup: THREE_OPEN });
  ok("the gate refuses an invented number", judgeDraft("Hi, you have 7 quotes waiting.", d).ok === false);
  ok("…allows a number we established", judgeDraft("Hi, 3 setup steps are open.", d).ok === true);
  ok("…refuses a link", judgeDraft("Hi, see fieldquo.com for help.", d).ok === false);
  ok("…refuses a price", judgeDraft("Hi, that is $45 a month.", d).ok === false);
  ok("…refuses an emoji", judgeDraft("Hi there 👋 how is it going?", d).ok === false);
  ok("…refuses an unfilled slot", judgeDraft("Hi {name}, how is it going?", d).ok === false);
  ok("…refuses a wall of text", judgeDraft("a".repeat(MAX_SMS_CHARS + 1), d).ok === false);
  ok("…refuses nothing at all", judgeDraft("   ", d).ok === false);
  ok("…and accepts a plain human sentence", judgeDraft("Hi, it is Daniel from FieldQuo. How is it going so far?", d).ok === true);

  ok("a lone GSM message is one segment at 160", smsCost("a".repeat(160)).segments === 1);
  ok("…and two at 161, because concatenation costs 7 characters", smsCost("a".repeat(161)).segments === 2);
  ok("…and an emoji collapses the budget to 70", smsCost(`${"a".repeat(71)}😀`).segments > 1);
  ok("the ceiling is two concatenated segments", smsCost("a".repeat(MAX_SMS_CHARS)).segments === MAX_SEGMENTS);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The fallback: five ways for the model to fail, five usable drafts");
// ═══════════════════════════════════════════════════════════════════════════
{
  const d = decide({}, { setup: THREE_OPEN });
  const usable = (r) => typeof r.text === "string" && r.text.length > 40 && smsCost(r.text).segments <= MAX_SEGMENTS;

  // ── 1. No model configured at all ────────────────────────────────────────
  const unconfigured = await draftCheckIn({ decision: d, repName: "Daniel", now: NOW });
  ok("no key: a draft still comes back", usable(unconfigured), unconfigured);
  ok("…marked degraded rather than passed off as the model's", unconfigured.degraded === true && unconfigured.source === "rule");
  ok("…naming the reason", unconfigured.reason === "unconfigured", unconfigured.reason);
  ok("…in a sentence a rep can read", unconfigured.reasonText === DRAFT_REASONS.unconfigured);
  ok("…claiming no model", unconfigured.model === null);

  // Everything below needs isAiConfigured() to be true. It reads process.env
  // at call time, which is what makes this switchable mid-run.
  process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
  ok("the key is set for the rest of this section", Boolean(process.env.OPENAI_API_KEY));

  // ── 2. Configured, but no ledger to spend against ────────────────────────
  const unmetered = await draftCheckIn({ decision: d, repName: "Daniel", now: NOW });
  ok("no ledger: the model is not called", unmetered.reason === "unmetered", unmetered.reason);
  ok("…and the draft is still usable", usable(unmetered));

  // A scriptable stand-in for the two tables lib/ai/platformUsage.js touches.
  // Writes are recorded rather than swallowed, so "it was metered" is a claim
  // about an argument that can be inspected.
  const writes = [];
  const dbWith = (budgets, spent = 0) => ({
    platformAiBudget: { findMany: async () => budgets },
    platformAiUsage: {
      aggregate: async () => ({ _sum: { costMicros: spent } }),
      count: async () => 0,
      create: async ({ data }) => {
        writes.push(data);
        return { id: "u1", ...data };
      },
    },
  });
  const noBudgets = dbWith([]);

  // ── 3. Over budget ───────────────────────────────────────────────────────
  const spent = await draftCheckIn({
    decision: d,
    repName: "Daniel",
    db: dbWith([{ scope: "global", scopeId: null, limitMicros: 1000, active: true }], 5000),
    now: NOW,
  });
  ok("over budget: the model is not called", spent.source === "rule", spent);
  ok("…and the ceiling is named", spent.reason === "global_budget", spent.reason);
  ok("…and the rep still has a draft", usable(spent));

  const unreadable = await draftCheckIn({
    decision: d,
    db: { platformAiBudget: { findMany: async () => { throw new Error("neon is asleep"); } } },
    now: NOW,
  });
  ok("an unreadable budget fails closed", unreadable.source === "rule" && unreadable.reason === "budget_unreadable", unreadable.reason);
  ok("…with a usable draft", usable(unreadable));

  // ── 4. The vendor errors, or throws ──────────────────────────────────────
  const vendorDown = await draftCheckIn({
    decision: d, repName: "Daniel", db: noBudgets, now: NOW,
    complete: async () => ({ ok: false, reason: "vendor_error", message: "429" }),
  });
  ok("vendor error: the deterministic draft comes back", vendorDown.source === "rule" && usable(vendorDown), vendorDown);
  ok("…named", vendorDown.reason === "vendor_error");

  const thrown = await draftCheckIn({
    decision: d, repName: "Daniel", db: noBudgets, now: NOW,
    complete: async () => { throw new Error("socket hang up"); },
  });
  ok("a complete() that THROWS does not take the screen with it", usable(thrown), thrown);
  ok("…and is reported as a vendor error", thrown.reason === "vendor_error");

  for (const reason of ["empty", "truncated", "refused", "unparseable", "schema_mismatch"]) {
    const r = await draftCheckIn({
      decision: d, db: noBudgets, now: NOW, repName: "Daniel",
      complete: async () => ({ ok: false, reason }),
    });
    ok(`a ${reason} reply still yields a draft`, usable(r) && r.reason === reason, r.reason);
  }

  // ── 5. The model answers, plausibly, and it is not true ──────────────────
  const invented = await draftCheckIn({
    decision: d, repName: "Daniel", db: noBudgets, now: NOW,
    complete: async ({ onUsage }) => {
      await onUsage({ model: "gpt-5-mini", promptTokens: 300, completionTokens: 40 });
      return { ok: true, data: { text: "Hi, it is Daniel. Your 7 quotes are still unsent - want a hand?" } };
    },
  });
  ok("an invented fact is discarded", invented.source === "rule", invented);
  ok("…as junk, not as a vendor failure", invented.reason === "junk", invented.reason);
  ok("…and the rep gets the true draft instead", usable(invented) && !invented.text.includes("7 quotes"), invented.text);
  ok("…while the tokens it cost are still metered", writes.length === 1, writes);
  ok("…against FieldQuo's own ledger, not a contractor's", writes[0]?.area === CHECKIN_AI_AREA, writes[0]);

  for (const junk of [
    "Hi! 🎨 how is it going?",
    "Hi, take a look at fieldquo.com/help",
    "Hi, your plan is $45 a month, all good?",
    "Hi {first_name}, how is it going?",
    "x".repeat(400),
    "   ",
  ]) {
    const r = await draftCheckIn({
      decision: d, repName: "Daniel", db: noBudgets, now: NOW,
      complete: async () => ({ ok: true, data: { text: junk } }),
    });
    ok(`junk refused: ${junk.slice(0, 28)}`, r.source === "rule" && r.reason === "junk" && usable(r), r.reason);
  }

  // ── The happy path, so the gate is not merely refusing everything ────────
  const good = "Hi, it is Daniel from FieldQuo. Saw a few setup steps still open on your side - how is it going so far? Anything not working right, just reply here.";
  const happy = await draftCheckIn({
    decision: d, repName: "Daniel", db: noBudgets, salesRepId: "rep_1", ref: "checkin_c1_2026-09-10", now: NOW,
    complete: async ({ onUsage, system, prompt }) => {
      ok("the model is told never to invent", /Invent no numbers/.test(system));
      ok("…and is handed the deterministic draft to rewrite", prompt.includes("The draft to rewrite:"));
      ok("…and only the facts we established", !/quotes|revenue|invoices/i.test(prompt), prompt.slice(0, 200));
      await onUsage({ model: "gpt-5-mini", promptTokens: 320, completionTokens: 60 });
      return { ok: true, data: { text: good } };
    },
  });
  ok("a good draft is used", happy.source === "ai" && happy.text === good, happy);
  ok("…not marked degraded", happy.degraded === false && happy.reason === null);
  ok("…the model that wrote it is named", happy.model === "gpt-5-mini");
  ok("…the cost is reported to the screen", happy.segments === smsCost(good).segments && happy.chars === good.length);
  ok("…the deterministic version is kept alongside it", typeof happy.ruleText === "string" && happy.ruleText !== happy.text);
  ok("…and the spend is attributed to the rep", writes[1]?.salesRepId === "rep_1", writes[1]);
  ok("…with an idempotency key so a retried draft cannot double-count", writes[1]?.ref === "checkin_c1_2026-09-10");
  ok("…and the tokens the vendor reported", writes[1]?.promptTokens === 320 && writes[1]?.totalTokens === 380, writes[1]);

  // ── Refusals: no draft at all, and it says why ───────────────────────────
  const demo = await draftCheckIn({ decision: decide({ isDemo: true }), repName: "Daniel", db: noBudgets, now: NOW });
  ok("a demo company gets NO draft", demo.text === null && demo.refused === true, demo);
  ok("…and says there is nobody to text", demo.reason === "not_contactable", demo.reason);
  ok("…without ever calling the model", writes.length === 2, writes.length);
  const nothing = await draftCheckIn({});
  ok("no decision, no draft", nothing.refused === true && nothing.reason === "no_decision");

  delete process.env.OPENAI_API_KEY;
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Nothing here sends, and nothing here writes to a tenant");
// ═══════════════════════════════════════════════════════════════════════════
{
  const draftSrc = codeOnly("lib/sales/checkin/draft.js");
  const signalSrc = codeOnly("lib/sales/checkin/signals.js");

  ok("the drafter sends no SMS", !/twilioClient|sendSms|deliverSignupLinkSms/.test(draftSrc));
  ok("the drafter opens no vendor client", !/new OpenAI|require\("openai"\)/.test(draftSrc));
  ok("…it goes through lib/ai/provider.js", /from "@\/lib\/ai\/provider"/.test(draftSrc));
  ok("the budget is checked before the model is called",
    draftSrc.indexOf("checkPlatformAiBudget") < draftSrc.indexOf("await complete("));
  ok("the spend is recorded after it", draftSrc.indexOf("await complete(") < draftSrc.indexOf("recordPlatformAiUsage("));
  ok("…and is recorded before the reply is judged, so a discarded reply still costs what it cost",
    draftSrc.indexOf("recordPlatformAiUsage(") < draftSrc.indexOf("judgeDraft(candidate"));
  ok("neither module imports the database", !/from "@\/lib\/db"/.test(draftSrc) && !/from "@\/lib\/db"/.test(signalSrc));
  ok("the decision module is pure — no imports at all", !/^import /m.test(signalSrc));
  ok("nothing is enqueued, scheduled or exported as a route handler",
    !/enqueue|setInterval|setTimeout|export async function (GET|POST)/.test(draftSrc + signalSrc));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-checkin is a script", typeof pkg.scripts?.["check:sales-checkin"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-checkin"));
}


// ═══════════════════════════════════════════════════════════════════════════
section("9. The two scheduled touchpoints the owner asked for");
// ═══════════════════════════════════════════════════════════════════════════
//
//   "1 day after they sign up to see if they have any questions and make sure
//    they completed the onboarding process. and 7 days after they sign up ...
//    to see if everything is okay."
//
// They do different jobs — day 1 is about SETUP, day 7 is about USE — and they
// have to outrank the reason-driven cadence guard, which is fifteen days on a
// sixty-day plan and would otherwise swallow day 7 silently while day 1 kept
// firing, leaving a feature that looks like it works.

{
  const due = (dayInLife, lastCheckInDaysAgo) => scheduledCheckinDue({ dayInLife, lastCheckInDaysAgo });

  ok("nothing on the day they sign up", due(0, null) === null);
  ok("day 1 is the setup check", due(1, null) === 1);
  ok("day 7 is the how-is-it-going check", due(7, null) === 7);
  ok("…and it survives the reason-driven gap, which is longer than the space between them",
    minGapDays(60) > 6 && due(7, 6) === 7, { gap: minGapDays(60) });

  // A company nobody has contacted should get the question that fits where
  // they are, not the one they missed.
  ok("a silent company gets the LATEST touchpoint, not the earliest", due(9, null) === 7);

  // Two texts in three days is how a contractor learns to ignore the number.
  ok("a touchpoint waits when something was sent two days ago", due(7, 2) === null);
  ok("…and fires once there is breathing room", due(9, 4) === 7);
  ok("a touchpoint already answered does not repeat", due(1, 0) === null && due(8, 7) === 7);

  // The bug this section exists for: without a staleness bound the scheduled
  // path outranked the milestone-passed suppression, and a company two months
  // old with no contact was reported as owed its first-week text.
  ok("a touchpoint still counts inside its grace", due(21, null) === 7);
  ok("…and lapses after it", due(22, null) === null);
  ok("…so a company past the milestone is not owed a first-week text", due(61, null) === null);

  ok("a missing day does not throw", due(null, null) === null && due("soon", null) === null);
  // ── The wiring, not just the function ────────────────────────────────
  //
  // Everything above drives scheduledCheckinDue() directly. Disconnecting it
  // from the DECISION — `const scheduledDay = null;` — left every assertion
  // above green, which is the "correct but unreachable" shape this repo keeps
  // finding. So the decision itself is driven, end to end, through the same
  // fixtures every other section uses.
  const dayOne = decide({ signedUpAt: dayAgo(1), onboardingCompletedAt: null });
  ok("a company one day in is DUE through the real decision", dayOne.due === true, dayOne.suppressed);
  ok("…and the decision says which touchpoint it is", dayOne.scheduledDay === 1, dayOne.scheduledDay);

  const daySeven = decide({ signedUpAt: dayAgo(7) }, { lastCheckInAt: dayAgo(6) });
  ok("a company seven days in is DUE even though the gap has not passed",
    daySeven.due === true, daySeven.suppressed);
  ok("…as the day-7 touchpoint", daySeven.scheduledDay === 7, daySeven.scheduledDay);

  const tooEarly = decide({ signedUpAt: dayAgo(0) });
  ok("…and the day they sign up is still too soon", tooEarly.due === false, tooEarly.suppressed);

  ok("the days are the owner's two, in order", SCHEDULED_CHECKIN_DAYS.join(",") === "1,7");
  ok("…and FIRST_CHECKIN_DAY is derived from them, not restated",
    FIRST_CHECKIN_DAY === SCHEDULED_CHECKIN_DAYS[0]);
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
