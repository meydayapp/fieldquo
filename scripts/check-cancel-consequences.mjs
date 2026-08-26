// scripts/check-cancel-consequences.mjs
//
//   npm run check:cancel-warnings
//
// The two irreversible buttons in this product, and whether the screens in
// front of them tell the truth.
//
// ══ What this refuses to test ══════════════════════════════════════════════
//
// The wording. Asserting that a sentence still reads "your number is gone for
// good" proves only that nobody edited the sentence, which is the one property
// that does not matter — the sentence can be word-perfect and false. So every
// consequence the cancel flow states is checked against the MODULE that
// performs it: the cron that keeps charging, the gate that goes read-only, the
// route that deletes nothing. If the code stops doing the thing, this fails,
// and the screen has to stop saying it.
//
// The one exception is the release confirmation, where the assertion IS about
// wording — because what is being checked there is that we do NOT claim two
// specific things Retell does not document (that a released number can be
// bought back, and when their billing stops). An absent claim can only be
// checked as an absence in the text.
//
// ══ The three cases the brief named ════════════════════════════════════════
//
//   * a company with no phone number is not warned about one
//   * a company with unpaid invoices IS warned
//   * the release confirmation claims nothing about reclaiming a number, and
//     nothing about when the provider stops billing
//
// All three are executed below rather than read.
import { readFileSync, existsSync } from "node:fs";

import {
  ALWAYS_TRUE,
  consequenceItems,
  evidencePaths,
  SAMPLE,
} from "@/lib/billing/cancelConsequences";
import { accessFor, denyReason, isPaidSubscription, CANCELLED_DAYS } from "@/lib/billing/access";
import { planRelease } from "@/lib/voice/numberRelease";
import { rentDecision, RENT_GRACE_DAYS } from "@/lib/voice/spendGate";
import { planBlockedReason } from "@/lib/servicePlans/schedule";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let fail = 0;
const ok = (c, m) => {
  console.log((c ? "✓ " : "✗ ") + m);
  if (!c) fail++;
};
const src = (p) => readFileSync(p, "utf8");
const DAY = 864e5;

const FLOW = "app/app/settings/account-billing/CancelFlow.js";
const ROUTE = "app/api/settings/subscription/consequences/route.js";
const CANCEL = "app/api/platform/billing/cancel/route.js";
const VOICE_PAGE = "app/app/settings/voice/page.js";

console.log("\n── Which company is told what ─────────────────────────────\n");

// ── A company with nothing is warned about nothing ────────────────────────
//
// The whole point. A one-van painter told his business line is about to die
// learns that our warnings are decoration, and skips the next one.
const bare = consequenceItems({
  immediate: true,
  readOnlyDays: 30,
  rentGraceDays: 7,
  phoneNumbers: [],
  voiceCreditCents: 0,
  autoTopup: { enabled: false, armed: false, amountCents: null },
  servicePlans: { active: 0, chargeable: 0 },
  unpaidInvoices: { count: 0, amountDue: 0 },
  heldBookings: 0,
  site: { live: false, subdomain: null },
});
ok(bare.length === 0,
   `a company with nothing outstanding is warned about nothing (${bare.length} items)`);

const keysOf = (items) => items.map((i) => i.key);

// ── No phone number, no phone-number warning ──────────────────────────────
const noNumber = consequenceItems({ ...SAMPLE, phoneNumbers: [], voiceCreditCents: 0 });
ok(!keysOf(noNumber).includes("numberKept"),
   "a company with no phone number is NOT warned about a phone number");
ok(!keysOf(noNumber).includes("creditNoRefund"),
   "and not told about phone credit it hasn't got");

// ── Unpaid invoices ARE warned about ──────────────────────────────────────
const owed = consequenceItems({
  ...SAMPLE,
  phoneNumbers: [],
  voiceCreditCents: 0,
  autoTopup: { enabled: false },
  servicePlans: { active: 0, chargeable: 0 },
  heldBookings: 0,
  site: { live: false },
  unpaidInvoices: { count: 4, amountDue: 8150 },
});
ok(keysOf(owed).includes("unpaidInvoices"),
   "a company with unpaid invoices IS warned about them");
const owedItem = owed.find((i) => i.key === "unpaidInvoices");
ok(owedItem.count === 4 && owedItem.amountDue === 8150,
   `and the warning carries the real numbers (${owedItem.count} invoices, ${owedItem.amountDue})`);
ok(consequenceItems({ ...SAMPLE, unpaidInvoices: { count: 0, amountDue: 0 } })
     .every((i) => i.key !== "unpaidInvoices"),
   "a company with none is not told there are none — silence, not a zero");

// ── One line per number, not one line about "your numbers" ────────────────
const three = consequenceItems({
  ...SAMPLE,
  phoneNumbers: [
    { e164: "+15875550001", monthlyCents: 400 },
    { e164: "+15875550002", monthlyCents: 400 },
    { e164: "+15875550003", monthlyCents: 900 },
  ],
});
ok(three.filter((i) => i.key === "numberKept").length === 3,
   "a company holding three numbers gets three lines — each is printed on something different");

// ── An unarmed auto-top-up must not claim a card will be charged ──────────
const unarmed = consequenceItems({
  ...SAMPLE,
  autoTopup: { enabled: true, armed: false, amountCents: null },
});
ok(keysOf(unarmed).includes("autoTopupOn") && !keysOf(unarmed).includes("autoTopupArmed"),
   "auto-top-up enabled with no saved card does NOT claim a card is about to be charged");

// ── A service plan with no live mandate is not a card warning ─────────────
const noMandate = consequenceItems({ ...SAMPLE, servicePlans: { active: 3, chargeable: 0 } });
ok(!keysOf(noMandate).includes("servicePlansRun"),
   "service plans with no live mandate raise invoices, not charges — and are not reported as charges");

// ── The failed-fetch path claims nothing ──────────────────────────────────
ok(consequenceItems(null).length === 0 && consequenceItems(undefined).length === 0,
   "a failed consequences fetch produces no per-company claims at all");

console.log("\n── Every stated consequence is performed by real code ──────\n");

// ── Each item's evidence file exists ──────────────────────────────────────
for (const p of evidencePaths()) {
  ok(existsSync(p), `evidence for a stated consequence exists on disk: ${p}`);
}

// Every key the pure module can emit must have wording in the component, and
// every key the component knows must be emittable. A sentence with no branch is
// dead copy; a branch with no sentence renders an empty bullet.
const flowSrc = src(FLOW);
const emittable = new Set([
  ...ALWAYS_TRUE.map((i) => i.key),
  ...consequenceItems(SAMPLE).map((i) => i.key),
  // Only one of the auto-top-up pair can be emitted by SAMPLE.
  "autoTopupOn",
]);
for (const key of emittable) {
  ok(flowSrc.includes(`"app.cancelFlow.${key}"`),
     `the flow has wording for "${key}"`);
  for (const lang of ["en", "fr"]) {
    ok(`app.cancelFlow.${key}` in APP_MESSAGES[lang],
       `  and ${lang} carries app.cancelFlow.${key}`);
  }
}

// ── It ends NOW, and the screen no longer says otherwise ──────────────────
//
// cancelSubscription() is stripe.subscriptions.cancel() with no
// cancel_at_period_end, so there is no period to keep working through. The
// screen used to promise one.
const billingSrc = src("lib/platform/stripeBilling.js");
ok(/subscriptions\.cancel\(/.test(billingSrc),
   "cancelSubscription() calls stripe.subscriptions.cancel()");
ok(!/cancel_at_period_end/.test(billingSrc),
   "…with no cancel_at_period_end anywhere in the billing module — so it is immediate");
ok(!/keep working normally until then/i.test(flowSrc),
   "the flow no longer promises the rest of the month it does not get");
ok(flowSrc.includes('"app.cancelFlow.endsNow"'),
   "and says plainly that the plan ends on the button press");

// ── Read-only immediately, locked after CANCELLED_DAYS ────────────────────
const cancelledNow = { status: "canceled", canceledAt: new Date("2026-01-01T00:00:00Z") };
const dayZero = accessFor(cancelledNow, new Date("2026-01-01T00:05:00Z"));
ok(dayZero.level === "readonly",
   `a cancelled company is read-only from the moment it cancels (${dayZero.level})`);
ok(denyReason(dayZero, { method: "POST", pathname: "/api/quotes" })?.status === 402,
   "…and a write is refused, which is what 'you won't be able to afterwards' means");
ok(denyReason(dayZero, { method: "POST", pathname: "/api/settings/voice/number/release" })?.status === 402,
   "including releasing a phone number — hence 'sort these out FIRST'");
const later = accessFor(cancelledNow, new Date(Date.parse("2026-01-01") + (CANCELLED_DAYS + 1) * DAY));
ok(later.level === "locked",
   `and locked after ${CANCELLED_DAYS} days, which is the number the screen quotes`);
ok(flowSrc.includes('"app.cancelFlow.youReadOnly"') && src(ROUTE).includes("CANCELLED_DAYS"),
   "the screen takes that number from lib/billing/access.js rather than restating it");

// ── Nothing is deleted ────────────────────────────────────────────────────
//
// The most reassuring sentence on the screen, so it gets the strictest check:
// the module that cancels must not delete anything, and the access gate must
// have no state that means "gone".
const cancelSrc = src(CANCEL);
ok(!/\.delete\(|\.deleteMany\(/.test(cancelSrc),
   "the cancel route deletes nothing");
ok(!/\.delete\(|\.deleteMany\(/.test(src("app/api/cron/voice-rent/route.js")),
   "and neither does the rent cron, the one cron that acts on a churned company");
ok(["full", "readonly", "locked"].includes(accessFor(cancelledNow, new Date()).level),
   "the access gate has no state meaning 'deleted' — the worst outcome is locked");
ok(accessFor({ status: "active" }, new Date()).level === "full",
   "and re-subscribing returns full access, so 'come back and it's all here' is true");

// ── The client's links keep working ───────────────────────────────────────
//
// The gate is attached in getCurrentMember and nowhere else. Every client-facing
// page and public API must therefore be free of it — checked directly, because
// this is the sentence a homeowner's experience depends on.
const PUBLIC_SURFACES = [
  "app/q/[token]/page.js",
  "app/portal/[token]/page.js",
  "app/book/[companySlug]/page.js",
  "app/quote/[companySlug]/page.js",
];
for (const p of PUBLIC_SURFACES) {
  const s = src(p);
  const gated = /accessFor|billingAccess|denyReason|onboardingStatus/.test(s);
  ok(!gated, `${p} is not gated on the subscription — a client's link keeps opening`);
}
ok(/accessForCompany|denyReason/.test(src("lib/currentMember.js")),
   "…because the billing gate lives in getCurrentMember, which public paths never call");

// ── The website keeps serving, and our credit comes back ──────────────────
const siteSrc = src("app/site/[subdomain]/page.js");
ok(/isPaidSubscription/.test(siteSrc),
   "the public site reads isPaidSubscription only to decide the FieldQuo credit");
const paidPlan = { plan: { priceMonthly: 45 } };
ok(isPaidSubscription({ ...paidPlan, ...cancelledNow }, new Date("2026-01-02T00:00:00Z")) === true,
   "during the read-only window the site is still credit-free");
ok(isPaidSubscription({ ...paidPlan, ...cancelledNow },
      new Date(Date.parse("2026-01-01") + (CANCELLED_DAYS + 1) * DAY)) === false,
   `and the "Site by FieldQuo" line comes back after ${CANCELLED_DAYS} days, exactly as the screen says`);

// ── The phone number is NOT released, and the rent keeps coming ───────────
const now = new Date("2026-03-01T00:00:00Z");
const activeNumber = {
  id: "n1",
  status: "active",
  monthlyCents: 400,
  rentPaidThroughAt: new Date("2026-02-25T00:00:00Z"),
};
const stillCharging = rentDecision({ number: activeNumber, balanceCents: 5000, now });
ok(stillCharging.action === "charge",
   "the rent cron charges a live number with no reference to the subscription at all");
ok(!/subscription|onboardingStatus/i.test(src("app/api/cron/voice-rent/route.js")),
   "…confirmed at the cron: it never looks the company's plan up");
ok(!/voicePhoneNumber|releaseHeldNumber/i.test(cancelSrc),
   "and cancelling touches no phone number row — so 'it is not handed back' is literally true");

const broke = rentDecision({ number: activeNumber, balanceCents: 0, now });
ok(broke.action === "grace_start" && broke.graceUntil,
   "once the credit can't cover it, a grace period starts rather than an instant cut-off");
const expired = rentDecision({
  number: { ...activeNumber, rentGraceUntilAt: new Date("2026-02-20T00:00:00Z") },
  balanceCents: 0,
  now,
});
ok(expired.action === "release",
   `and past the ${RENT_GRACE_DAYS}-day grace the number IS released — the ending the screen warns about`);
ok(src(ROUTE).includes("RENT_GRACE_DAYS"),
   "the screen imports that grace period rather than hard-coding a second copy of it");

// ── Auto top-up keeps charging the card ───────────────────────────────────
const topupCron = src("app/api/cron/voice-auto-topup/route.js");
ok(/enabled:\s*true/.test(topupCron) && !/subscription|onboardingStatus/i.test(topupCron),
   "the auto-top-up cron selects on `enabled` alone — cancelling does not switch it off");

// ── Service plans keep charging the CLIENT's card ─────────────────────────
const planCron = src("app/api/cron/service-plans/route.js");
ok(/status:\s*"active"/.test(planCron) && !/subscription|onboardingStatus/i.test(planCron),
   "the service-plan cron selects on ServicePlan.status alone");
ok(planBlockedReason(
     { status: "active", frequency: "monthly", endMode: "count", startDate: new Date("2026-01-01") },
     { now },
   ) === null,
   "…and planBlockedReason asks nothing about the company, so an active plan keeps billing");

// ── Held booking fees settle themselves ───────────────────────────────────
const bookingSrc = src("lib/booking/reconcileBookingFee.js");
ok(/status:\s*"pending_payment"/.test(bookingSrc),
   "held bookings are reconciled on Booking.status alone, so they settle or expire without anyone");

console.log("\n── Releasing a number: what we must not claim ──────────────\n");

// ── The forbidden claims ──────────────────────────────────────────────────
//
// Retell documents exactly one lever, DELETE /delete-phone-number. They do NOT
// document whether the number can be repurchased, whether billing stops at once
// or at period end, or whether anything is prorated. So the screen may say the
// number is gone; it may not say anything about getting it back or about the
// provider's billing clock. "Assume it is gone for good" is honest;
// "you can buy it back" is not, and neither is "their billing stops today".
const RELEASE_KEYS = Object.keys(APP_MESSAGES.en).filter((k) =>
  k.startsWith("app.setVoice.release."),
);
ok(RELEASE_KEYS.length > 0, `${RELEASE_KEYS.length} strings make up the release confirmation`);

const FORBIDDEN = [
  [/\b(buy|get|have|take|claim|purchase)\s+(it|that number|the number)\s+back\b/i,
   "claims the number can be got back"],
  [/\breclaim/i, "claims the number can be reclaimed"],
  [/\bre-?purchase\b/i, "claims the number can be repurchased"],
  [/\brecoverable\b/i, "claims the number is recoverable"],
  [/\bpro-?rat/i, "claims the rental is prorated"],
  [/\bpartial refund\b/i, "promises a partial refund"],
  [/\bwe (will|'ll) refund\b/i, "promises a refund"],
  [/billing stops (immediately|right away|straight away|today)/i,
   "claims when the provider stops billing"],
  [/(stops|ends) billing (immediately|right away|straight away|today)/i,
   "claims when the provider stops billing"],
];

for (const lang of ["en", "fr"]) {
  for (const key of RELEASE_KEYS) {
    const text = APP_MESSAGES[lang][key];
    if (typeof text !== "string") continue;
    for (const [re, what] of FORBIDDEN) {
      if (re.test(text)) {
        ok(false, `${lang} ${key} ${what}: "${text.slice(0, 70)}…"`);
      }
    }
  }
}
ok(true, "no release string claims a number can be got back, or when the provider's billing stops");

// ── The claims that MUST be there ─────────────────────────────────────────
//
// The owner named these three. They are checked as presence rather than as
// exact wording — a rewrite is fine, a removal is not.
const warning = APP_MESSAGES.en["app.setVoice.release.warning"] || "";
ok(/deleted at the phone company|deleted at the provider/i.test(warning),
   "the release warning says the number is deleted at the phone company");
ok(/cannot be recovered|can't be recovered/i.test(warning) && /not by us and not by you/i.test(warning),
   "…that neither we nor they can get it back");
ok(/van|sign|business card|google/i.test(warning),
   "…and that anything it is printed on stops working");
const moneyLine = APP_MESSAGES.en["app.setVoice.release.money"] || "";
ok(/not refunded/i.test(moneyLine),
   "the unused part of the month is stated as NOT refunded rather than left to be discovered");

// ── The confirmation is still two gates, not one ──────────────────────────
//
// planRelease is what stops a misclick destroying a business line, and it is
// what the copy above is warning about. If it stopped refusing, the screen
// would be describing a guard that no longer exists.
const target = { id: "n1", e164: "+15875550123", status: "active" };
ok(planRelease({ target, siblings: [], confirm: "+15875550123" }).reason === "sole_number",
   "a company's last working line still needs a second, explicit acknowledgement");
ok(planRelease({ target, siblings: [], confirm: "5875550123" }).reason === "confirm_mismatch",
   "…and the number has to be named exactly, so a stale screen destroys nothing");
ok(planRelease({ target, siblings: [], confirm: "+15875550123", acknowledgeSoleNumber: true }).allowed,
   "both gates cleared, it proceeds — the exit is real, not theatre");
ok(src(VOICE_PAGE).includes('"app.setVoice.release.warning"'),
   "and the warning is actually rendered on the settings page, not merely defined");

console.log("\n── The flow is not a dark pattern ──────────────────────────\n");

// Informed consent, not friction. The consequences sit ON the confirm screen —
// if they ever became a step of their own, leaving would cost an extra click.
ok(!/step === "consequences"|setStep\("consequences"\)/.test(flowSrc),
   "the consequences did not become a fourth screen — leaving still costs the same clicks");
ok(/setStep\("confirm"\)/.test(flowSrc),
   "and both earlier screens still jump straight to confirm");
// Comments stripped first: this file's own header ARGUES against a
// "type CANCEL to confirm" gate, and a scan that cannot tell the argument from
// the gate would fail on the sentence explaining why the gate is absent.
const flowCode = flowSrc
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");
ok(!/["']CANCEL["']/.test(flowCode) && !/toUpperCase\(\)/.test(flowCode),
   "no type-the-word-CANCEL gate was added");

console.log(fail ? `\n${fail} problem(s)\n` : "\nAll good.\n");
process.exit(fail ? 1 : 0);
