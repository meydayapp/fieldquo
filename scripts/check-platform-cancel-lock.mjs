// scripts/check-platform-cancel-lock.mjs
//
//   npm run check:platform-cancel-lock
//   npm run check:platform-cancel-lock -- --baseline=/path/to/old/route.js
//
// The platform console's "Cancel the subscription" panel, for EVERY company.
//
// Until 2026-09-28 the panel offered three modes to every company and the
// route answered "No Stripe subscription on this company — there is nothing
// to cancel" for every company without one — which, since the card-free
// trial (2026-09-24), is every new company. The owner: "if i lock the account
// because of terms break locked immediately it should still block the trial".
//
// Executed, not read:
//
//   1. the decision matrix — subscribed / trial / expired trial (read-only
//      and locked) / no trial / demo × period_end / now / terms — through
//      lib/platform/cancelOptions.js, the function the panel renders from
//      and the route decides with;
//   2. the access gate for every state those writes produce, at the moment
//      of the press and 10 / 31 days on, through lib/billing/access.js;
//   3. the REAL route, replayed against a recording Stripe and database:
//      a trial is locked (200, Company columns + audit row in one
//      transaction), a demo is refused, and the Stripe path's calls, write
//      set and response are pinned — with --baseline, compared by md5
//      against the route as it was before this change;
//   4. every letter the trial gets (7/3/1 reminders, next steps, the two
//      signup-recovery nudges) refuses a company FieldQuo ended;
//   5. the console's buckets and status words: a locked trial is "locked",
//      an ended one "cancelled", never "trialing";
//   6. checkout and Resume refuse a company FieldQuo ended, before any
//      Stripe call.

import { register } from "node:module";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

register("./platform-cancel-stub-hooks.mjs", import.meta.url);

let fail = 0;
let count = 0;
const ok = (cond, msg) => {
  count++;
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) fail++;
};
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const stubs = await import("./fixtures/platformCancelStubs.mjs");
const {
  fieldquoEndAccessFor, trialAccessFor, accessForCompany, denyReason, fieldquoEndRefusal,
  FIELDQUO_END_SELECT, CANCELLED_DAYS,
} = await import("@/lib/billing/access");
const { cancelOptions, cancelKind, planFieldquoEnd } = await import("@/lib/platform/cancelOptions");
const { subscriberBucket, SUBSCRIBER_BOOK_SELECT } = await import("@/lib/platform/trialCounting");
const { companyStanding } = await import("@/lib/platform/companyStanding");
const { trialReminderDecision } = await import("@/lib/billing/trialReminder");
const { decideNextStepsEmail } = await import("@/lib/signup/nextSteps");
const { decideSignupNudge } = await import("@/lib/signup/abandoned");
const { earlyNudgePersonFromCompany, decideEarlyNudge, planEarlyNudges } = await import("@/lib/signup/earlyNudge");
const { rentDecision } = await import("@/lib/voice/spendGate");

const NOW = new Date("2026-09-28T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (d) => new Date(NOW.getTime() + d * DAY);

// ── The companies ─────────────────────────────────────────────────────────
const TYPES = {
  subscribed: { company: { isDemo: false, trialEndsAt: at(-40) }, subscription: { stripeSubscriptionId: "sub_1" } },
  trial: { company: { isDemo: false, trialEndsAt: at(14) }, subscription: null },
  trial_expired_readonly: { company: { isDemo: false, trialEndsAt: at(-3) }, subscription: null },
  trial_expired_locked: { company: { isDemo: false, trialEndsAt: at(-20) }, subscription: null },
  no_trial: { company: { isDemo: false, trialEndsAt: null }, subscription: null },
  demo: { company: { isDemo: true, trialEndsAt: null }, subscription: null },
};
const trialOnly = (c) => trialAccessFor({ trialEndsAt: c.trialEndsAt }, NOW);

// ══ 1. The decision matrix ══════════════════════════════════════════════
console.log("\n1. Which company takes which ending\n");
const expectKind = { subscribed: "stripe", trial: "trial", trial_expired_readonly: "trial_over", trial_expired_locked: "trial_over", no_trial: "no_trial", demo: "demo" };
for (const [name, t] of Object.entries(TYPES)) {
  ok(cancelKind({ ...t, now: NOW }) === expectKind[name], `${name} is kind "${expectKind[name]}"`);
}
let threw = false;
try { cancelKind({ company: {}, subscription: undefined }); } catch { threw = true; }
ok(threw, "an unloaded subscription (undefined) throws rather than reading as 'no subscription'");

// The Stripe path's words are the exact strings the panel printed before.
const OLD_STRIPE = [
  ["period_end", "At the end of the paid period", "They keep full access until the date they paid to, then thirty days read-only.", "Cancel at period end"],
  ["now", "Now — thirty days read-only, then locked", "Nothing more is charged. Read-only for thirty days from now, then locked.", "Cancel now"],
  ["terms", "Terms breach — locked immediately", "Locked immediately — no read-only window. The locked screen says FieldQuo ended it, with your reason.", "Cancel and lock now"],
];
const stripeOpts = cancelOptions({ ...TYPES.subscribed, now: NOW });
ok(
  JSON.stringify(stripeOpts.modes.map((m) => [m.value, m.label, m.consequence, m.button])) === JSON.stringify(OLD_STRIPE) &&
    stripeOpts.modes.every((m) => m.available) && stripeOpts.heading === "Cancel the subscription" &&
    stripeOpts.subtitle === "FieldQuo ends it — from here, not the Stripe dashboard",
  "subscribed: the three radios, their sentences and the button words are byte-identical to the old panel",
);

const matrix = [];
for (const [name, t] of Object.entries(TYPES)) {
  if (name === "subscribed") continue;
  for (const mode of ["period_end", "now", "terms"]) {
    const plan = planFieldquoEnd({ ...t, mode, reason: "Sent spam through FieldQuo", trialAccess: trialOnly(t.company), now: NOW });
    matrix.push({ name, mode, plan });
  }
}
const cell = (name, mode) => matrix.find((m) => m.name === name && m.mode === mode).plan;

ok(cell("trial", "terms").data?.platformEndMode === "terms" && +cell("trial", "terms").data.platformEndsAt === +NOW,
  "trial × terms → written: mode terms, ends now");
ok(cell("trial", "now").data?.platformEndMode === "now" && +cell("trial", "now").data.platformEndsAt === +NOW,
  "trial × now → written: the trial ends now");
ok(cell("trial", "period_end").data?.platformEndMode === "period_end" && +cell("trial", "period_end").data.platformEndsAt === +TYPES.trial.company.trialEndsAt,
  "trial × at the end of the free trial → written: access ends at trialEndsAt");
for (const n of ["trial_expired_readonly", "trial_expired_locked", "no_trial"]) {
  ok(cell(n, "period_end").status === 409 && /no (period|free trial)|already ended/i.test(cell(n, "period_end").error),
    `${n} × period_end → refused, with why ("${cell(n, "period_end").error.slice(0, 60)}…")`);
  ok(cell(n, "now").data?.platformEndMode === "now", `${n} × now → written`);
  ok(cell(n, "terms").data?.platformEndMode === "terms", `${n} × terms → written`);
}
for (const mode of ["period_end", "now", "terms"]) {
  ok(cell("demo", mode).status === 409 && /demo/i.test(cell("demo", mode).error), `demo × ${mode} → refused (FieldQuo's own fixture)`);
}
const demoOpts = cancelOptions({ ...TYPES.demo, now: NOW });
ok(Boolean(demoOpts.refusal) && demoOpts.modes.length === 0, "demo: the panel shows why, and no radios");

// Honest words per type.
const trialOpts = cancelOptions({ ...TYPES.trial, trialAccess: trialOnly(TYPES.trial.company), now: NOW });
const pe = trialOpts.modes.find((m) => m.value === "period_end");
ok(pe.label === "At the end of the free trial" && /Full access until Oct 12, 2026/.test(pe.consequence) && /cannot convert/.test(pe.consequence),
  `trial: "${pe.label} — ${pe.consequence}"`);
ok(trialOpts.modes.every((m) => !/nothing to cancel/i.test(`${m.label} ${m.consequence}`)) && !/nothing to cancel/i.test(JSON.stringify(trialOpts)),
  "trial: no 'nothing to cancel' anywhere on the panel");
const lockedOpts = cancelOptions({ ...TYPES.trial_expired_locked, trialAccess: trialOnly(TYPES.trial_expired_locked.company), now: NOW });
ok(/already locked/.test(lockedOpts.modes.find((m) => m.value === "now").consequence),
  "an already-locked trial's 'now' says it re-opens thirty days of read-only (the subscribed path's semantics), not silence");
ok(!/NextResponse\.json\(\{ error: "No Stripe subscription on this company — there is nothing to cancel\."/.test(read("app/api/platform/companies/[id]/cancel-subscription/route.js")),
  "the cancel route no longer answers 'there is nothing to cancel' (its header still quotes it, as history)");

// Only tighten.
const ended = (mode, endsAt) => ({ ...TYPES.trial.company, platformEndMode: mode, platformEndsAt: endsAt, platformEndReason: "x" });
ok(planFieldquoEnd({ company: ended("period_end", at(14)), subscription: null, mode: "period_end", reason: "again", now: NOW }).status === 409,
  "an ending already set cannot be pressed again");
ok(planFieldquoEnd({ company: ended("now", NOW), subscription: null, mode: "period_end", reason: "loosen", now: NOW }).status === 409,
  "now → period_end (looser) is refused");
ok(planFieldquoEnd({ company: ended("period_end", at(14)), subscription: null, mode: "terms", reason: "escalate", now: NOW }).data?.platformEndMode === "terms",
  "period_end → terms (stricter) is allowed, the way terms is allowed on a Stripe subscription already cancelled");
ok(Boolean(cancelOptions({ company: ended("terms", NOW), subscription: null, now: NOW }).refusal),
  "a terms lock already set: the panel says so and offers nothing (reversing it is Unlock company, its own act)");

// ══ 2. The access gate for the resulting states ═══════════════════════════
console.log("\n2. What the company can do afterwards\n");
const afterWrite = (name, mode) => ({ ...TYPES[name].company, ...cell(name, mode).data });
const lvl = (c, d) => {
  const a = trialAccessFor(c, at(d));
  return a ? `${a.level}/${a.reason}${a.daysLeft != null ? `/${a.daysLeft}` : ""}` : "null";
};
const table = [];
for (const name of ["trial", "trial_expired_readonly", "trial_expired_locked", "no_trial"]) {
  for (const mode of ["period_end", "now", "terms"]) {
    const plan = cell(name, mode);
    if (!plan.data) { table.push([name, mode, "refused", "", "", ""]); continue; }
    const c = afterWrite(name, mode);
    table.push([name, mode, lvl(c, 0), lvl(c, 10), lvl(c, 20), lvl(c, 45)]);
  }
}
console.log("   company × mode                   | at press            | +10d                | +20d                | +45d");
for (const r of table) console.log(`   ${`${r[0]} × ${r[1]}`.padEnd(32)} | ${r.slice(2).map((x) => String(x).padEnd(19)).join(" | ")}`);

const tTerms = afterWrite("trial", "terms");
ok(trialAccessFor(tTerms, NOW).level === "locked" && trialAccessFor(tTerms, NOW).reason === "terms",
  "trial × terms: locked at the press — reason 'terms', the same reason a subscribed terms lock has");
const tNow = afterWrite("trial", "now");
ok(trialAccessFor(tNow, NOW).level === "readonly" && trialAccessFor(tNow, NOW).daysLeft === CANCELLED_DAYS &&
   trialAccessFor(tNow, at(29.5)).level === "readonly" && trialAccessFor(tNow, at(30)).level === "locked",
  `trial × now: read-only ${CANCELLED_DAYS} days from the press, then locked`);
const tPe = afterWrite("trial", "period_end");
ok(trialAccessFor(tPe, NOW).level === "full" && trialAccessFor(tPe, at(14.5)).level === "readonly" &&
   trialAccessFor(tPe, at(14 + 30)).level === "locked",
  "trial × at the end of the free trial: full until trialEndsAt, then 30 days read-only, then locked");
ok(trialAccessFor(afterWrite("no_trial", "terms"), NOW)?.level === "locked",
  "a company with no trial date and no subscription can be locked (it used to have full access for ever)");

// The gate itself: denyReason on those states.
const deny = (c, method, path = "/api/quotes") => denyReason(trialAccessFor(c, NOW), { method, pathname: path });
ok(deny(tTerms, "GET")?.status === 402 && /terms of service/.test(deny(tTerms, "GET").error) && !/overdue|card/i.test(deny(tTerms, "GET").error),
  `terms lock: even reads are refused, and the 402 says terms, not "payment overdue" ("${deny(tTerms, "GET").error.slice(0, 50)}…")`);
ok(deny(tNow, "GET") === null && deny(tNow, "POST")?.status === 402 && /FieldQuo has ended/.test(deny(tNow, "POST").error) && !/Start the plan again/.test(deny(tNow, "POST").error),
  "ended now: reads allowed, writes 402 — and the sentence never says 'start the plan again'");
ok(deny(tNow, "POST", "/api/platform/billing/checkout") === null,
  "the billing path stays reachable to the GATE (the checkout route itself refuses — section 6)");
// A subscribed terms lock is unchanged in level and now carries its reason.
ok(denyReason({ level: "locked", reason: "terms" }, { method: "GET", pathname: "/api/jobs" }).error.includes("terms of service"),
  "the subscribed terms lock's 402 no longer says 'payment is overdue' either");

// accessForCompany, through the stub database.
stubs.resetStubs();
stubs.state.company = { ...tTerms, createdAt: at(-16) };
stubs.state.subscription = null;
const acTrial = await accessForCompany("co_trial", NOW);
ok(acTrial.level === "locked" && acTrial.reason === "terms" && acTrial.lockedReason === "Sent spam through FieldQuo" && acTrial.endedBy === "fieldquo",
  "accessForCompany: a terms-locked trial is locked, with FieldQuo's reason for the locked screen");
ok(Object.keys(FIELDQUO_END_SELECT).every((k) => stubs.reads.some((r) => r.model === "company" && r.args?.select?.[k])),
  "…and it SELECTS the ending columns (an unselected column reads as 'not ended')");
stubs.resetStubs();
stubs.state.company = { isDemo: false, trialEndsAt: null, createdAt: at(-400) };
stubs.state.subscription = { status: "canceled", canceledAt: at(-1), accessLockedAt: at(-1), accessLockedReason: "Abuse after warning" };
const acSub = await accessForCompany("co_sub", NOW);
ok(acSub.level === "locked" && acSub.reason === "terms" && acSub.lockedReason === "Abuse after warning",
  "accessForCompany: a SUBSCRIBED terms lock now reaches the locked screen with its reason (promised since e6283647, never delivered)");
stubs.resetStubs();
stubs.state.company = { isDemo: false, trialEndsAt: at(-40), createdAt: at(-400), platformEndsAt: at(-2), platformEndMode: "now", platformEndReason: "x" };
stubs.state.subscription = { status: "active", canceledAt: null, accessLockedAt: null };
ok((await accessForCompany("co_late", NOW)).reason === "fieldquo_ended",
  "a trial FieldQuo ended whose late checkout webhook then wrote an ACTIVE row is still ended");
stubs.resetStubs();
stubs.state.company = { isDemo: false, trialEndsAt: at(-40), createdAt: at(-400) };
stubs.state.subscription = { status: "active", canceledAt: null, accessLockedAt: null };
ok((await accessForCompany("co_paying", NOW)).level === "full", "an ordinary paying company is untouched");

// ══ 3. The real route, replayed ═════════════════════════════════════════
console.log("\n3. The cancel route, executed\n");
const route = await import("@/app/api/platform/companies/[id]/cancel-subscription/route.js");
const post = async (mod, id, body) => {
  const res = await mod.POST(new Request(`http://x/api/platform/companies/${id}/cancel-subscription`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
  return { status: res.status, json: await res.json() };
};

stubs.resetStubs();
stubs.state.company = { id: "co_t", name: "Trial Co", isDemo: false, trialEndsAt: at(14) };
stubs.state.subscription = null;
const r1 = await post(route, "co_t", { mode: "terms", reason: "Sent spam through FieldQuo" });
const tx1 = stubs.calls.find((c) => c.kind === "transaction");
const ops1 = tx1?.ops.map((o) => o.__op) || [];
ok(r1.status === 200 && r1.json.lockedAt && /locked now/.test(r1.json.access),
  `trial × terms: 200 — "${r1.json.access || r1.json.error}"`);
ok(JSON.stringify(ops1) === JSON.stringify(["voiceAutoTopup.updateMany", "company.update", "platformAuditLog.create"]),
  `…one transaction: top-up off, the Company columns, the audit row (${ops1.join(", ")})`);
const upd = tx1?.ops.find((o) => o.__op === "company.update")?.args;
ok(upd?.data?.platformEndMode === "terms" && upd?.data?.platformEndReason === "Sent spam through FieldQuo" && upd?.where?.id === "co_t",
  "…the Company write is the ending and the reason, scoped to that company");
const audit = tx1?.ops.find((o) => o.__op === "platformAuditLog.create")?.args?.data;
ok(audit?.platformAdminId === "adm_super" && audit?.action === "access_ended_by_platform" && audit?.details?.reason === "Sent spam through FieldQuo" && audit?.details?.mode === "terms",
  "…the audit row carries who, what and why");
ok(!stubs.calls.some((c) => c.kind === "stripe"), "…and Stripe is never called (there is nothing there)");
ok(/access_ended_by_platform:/.test(read("lib/platform/auditActions.js")), "the audit catalogue has words for the new action");

stubs.resetStubs();
stubs.state.company = { id: "co_d", name: "Demo", isDemo: true, trialEndsAt: null };
const r2 = await post(route, "co_d", { mode: "terms", reason: "testing" });
ok(r2.status === 409 && /demo/i.test(r2.json.error) && !stubs.calls.length, "demo × terms: 409, nothing written");

stubs.resetStubs();
stubs.state.company = { id: "co_t", name: "Trial Co", isDemo: false, trialEndsAt: at(14) };
stubs.state.admin = { id: "adm_support", role: "support" };
const r3 = await post(route, "co_t", { mode: "terms", reason: "Sent spam" });
ok(r3.status === 403 && !stubs.calls.length, "a support agent (not superadmin) is refused, nothing written");

// The Stripe path: same calls, same write set, same response.
const STRIPE_SUB = {
  id: "sub_live", status: "active", cancel_at_period_end: false, current_period_end: 1792000000, current_period_start: 1789400000,
  trial_end: null, canceled_at: null, cancel_at: null, items: { data: [{ price: { id: "price_1", recurring: { interval: "month" } }, quantity: 1 }] },
};
const realNow = Date.now();
const normalise = (v) =>
  JSON.parse(JSON.stringify(v), (_k, x) =>
    typeof x === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(x) && Math.abs(Date.parse(x) - realNow) < 10 * 60 * 1000 ? "<now>" : x);
async function replayStripePath(mod) {
  const out = {};
  for (const mode of ["period_end", "now", "terms"]) {
    stubs.resetStubs();
    stubs.state.company = { id: "co_s", name: "Paying Co", isDemo: false, trialEndsAt: at(-40) };
    stubs.state.subscription = { stripeSubscriptionId: "sub_live", status: "active", accessLockedAt: null, cancelAtPeriodEnd: false };
    stubs.state.stripeSub = { ...STRIPE_SUB };
    const r = await post(mod, "co_s", { mode, reason: "Asked to stop by email" });
    out[mode] = normalise({ status: r.status, response: r.json, calls: stubs.calls.map((c) => (c.kind === "transaction" ? { kind: c.kind, ops: c.ops } : c)) });
  }
  return out;
}
const now3 = await replayStripePath(route);
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");
console.log(`   Stripe path md5 (calls + write set + response, all three modes): ${md5(now3)}`);
// Pinned: what the route did before 2026-09-28, recorded from that version
// with --baseline. A change here changes what a paying customer's cancel
// does; it needs a reason, not a new hash.
const PINNED = "9a6a43644483a6017268841b22a553ec";
ok(md5(now3) === PINNED, "the Stripe path's recorded behaviour matches the pinned fingerprint (recorded from the pre-2026-09-28 route with --baseline)");
ok(now3.terms.calls.map((c) => c.method || (c.ops || []).map((o) => o.__op).join("+")).join(" → ") ===
   "subscriptions.retrieve → subscriptions.cancel → voiceAutoTopup.updateMany+subscription.update+platformAuditLog.create",
  "Stripe × terms: retrieve → cancel → one transaction (top-up off, Subscription lock, audit) — as before");
ok(now3.period_end.calls.some((c) => c.method === "subscriptions.update" && c.args[1].cancel_at_period_end === true),
  "Stripe × period_end: still Stripe's cancel_at_period_end");
ok(!JSON.stringify(now3).includes("platformEnd"), "Stripe path: never writes the new Company columns");

const baselineArg = process.argv.find((a) => a.startsWith("--baseline="));
if (baselineArg) {
  const path = baselineArg.slice("--baseline=".length);
  const old = await import(pathToFileURL(path).href);
  const before = await replayStripePath(old);
  console.log(`   baseline md5:                                                  ${md5(before)}`);
  ok(md5(before) === md5(now3), "Stripe path: byte-identical to the baseline route (calls, write set, response)");
  if (md5(before) !== md5(now3)) console.log(JSON.stringify({ before, now: now3 }, null, 1).slice(0, 3000));
}

// ══ 4. The letters ═══════════════════════════════════════════════════════
console.log("\n4. No trial letter to a company FieldQuo ended\n");
ok(trialReminderDecision({ trialEndsAt: at(3), endedByFieldQuo: true, now: NOW }).reason === "ended_by_fieldquo" &&
   trialReminderDecision({ trialEndsAt: at(3), now: NOW }).send === true,
  "7/3/1 reminder: refused when ended, still sent when not");
ok(/platformEndsAt: true/.test(read("app/api/cron/trial-reminders/route.js")) && /endedByFieldQuo: Boolean\(company\.platformEndsAt\)/.test(read("app/api/cron/trial-reminders/route.js")),
  "…and the cron selects the column and passes it");
const nsCompany = { isDemo: false, email: "o@x.co", createdAt: new Date(NOW.getTime() - 3 * 3600e3), trialEndsAt: at(20), platformEndsAt: at(20) };
const ns = decideNextStepsEmail({ subscription: null, company: nsCompany, onboarding: { complete: false, steps: [{ done: false }] }, settings: { enabled: true }, now: NOW });
ok(ns.send === false && ns.reason === "ended_by_fieldquo" && ns.skip === "ended_by_fieldquo", "next-steps letter: refused and recorded");
ok(/platformEndsAt: true/.test(read("app/api/cron/onboarding-next-steps/route.js")), "…the cron selects the column");
const incomplete = { id: "c1", isDemo: false, email: "a@b.co", createdAt: at(-2), subscription: null, trialEndsAt: null, memberCount: 1, platformEndsAt: NOW };
ok(decideSignupNudge({ company: incomplete, now: NOW }).reason === "ended_by_fieldquo" &&
   decideSignupNudge({ company: { ...incomplete, platformEndsAt: null }, now: NOW }).send === true,
  "24-hour recovery note: refused when ended, still sent when not");
const person = earlyNudgePersonFromCompany({ ...incomplete, name: "X", industries: [], createdAt: at(-1) });
ok(person.endedByFieldQuo === true && decideEarlyNudge({ person, now: NOW }).reason === "ended_by_fieldquo", "5-minute early nudge: refused");
const lead = { kind: "lead", email: "A@b.co", lastActivityAt: at(-1), completed: false, dismissed: false, isDemo: false };
const plan = planEarlyNudges({ people: [person, lead], now: NOW });
ok(plan.sends.length === 0, "…and a lead at the same address is not mailed either (the ending closes the address)");
const rec = read("app/api/cron/signup-recovery/route.js");
ok((rec.match(/platformEndsAt: true/g) || []).length >= 4, "signup-recovery: every company read, list and fresh, selects the column");

// ══ 5. The console's counts ═════════════════════════════════════════════
console.log("\n5. /platform buckets and words\n");
const book = (c) => ({ id: "c", name: "C", subscription: null, ...c });
ok(subscriberBucket(book(tTerms), NOW) === "locked" && companyStanding(book(tTerms), NOW).label.startsWith("Locked by FieldQuo"),
  `trial × terms → bucket "locked", "${companyStanding(book(tTerms), NOW).label}"`);
ok(subscriberBucket(book(tNow), NOW) === "cancelled" && /Ended by FieldQuo .* read-only 30 days more/.test(companyStanding(book(tNow), NOW).label),
  `trial × now → bucket "cancelled", "${companyStanding(book(tNow), NOW).label}"`);
ok(subscriberBucket(book(tPe), NOW) === "trial_no_plan" && /cannot convert/.test(companyStanding(book(tPe), NOW).label),
  `trial × period_end, before the date → still in its free month, and says so: "${companyStanding(book(tPe), NOW).label}"`);
ok(subscriberBucket(book(tPe), at(15)) === "cancelled", "…after the date → cancelled, never 'trialing'");
ok(subscriberBucket(book(TYPES.trial.company), NOW) === "trial_no_plan", "an ordinary trial is still trialing");
ok(Object.keys(FIELDQUO_END_SELECT).every((k) => SUBSCRIBER_BOOK_SELECT[k] === true), "the book's one select carries the ending columns");
const schema = read("prisma/schema.prisma");
ok(["platformEndsAt", "platformEndMode", "platformEndReason"].every((f) => new RegExp(`^\\s+${f}\\s`, "m").test(schema)), "the three columns are in the schema");

// Phone numbers: an ended company stops paying rent like a cancelled one.
const NUMBER = { id: "n1", companyId: "c", rentPaidThroughAt: at(-1), rentGraceUntilAt: null, rentWarnedAt: null, monthlyRentCents: 400, status: "active" };
const rd = (access) => rentDecision({ number: NUMBER, balanceCents: 5000, now: NOW, access });
ok(rd(trialAccessFor(tTerms, NOW)).action === "release", "phone number rent: a terms-locked trial's number is released, not charged");
ok(rd(trialAccessFor(tNow, NOW)).action !== "charge", "…an ended trial in its read-only window is not charged");
ok(rd(trialAccessFor(tNow, at(31))).action === "release", "…and released once the window closes");

// ══ 6. No card buys back an ending ══════════════════════════════════════
console.log("\n6. Checkout and Resume\n");
ok(Boolean(fieldquoEndRefusal(tTerms, null)) && Boolean(fieldquoEndRefusal(tPe, null)) && Boolean(fieldquoEndRefusal({}, { accessLockedAt: NOW })),
  "a trial FieldQuo ended (any mode) and a subscribed terms lock are refused");
ok(fieldquoEndRefusal({ trialEndsAt: at(3) }, null) === null && fieldquoEndRefusal({}, { accessLockedAt: null }) === null,
  "an ordinary trial and an ordinary subscription are not");
for (const [file, call] of [["app/api/platform/billing/checkout/route.js", "createBillingCheckoutSession({"], ["app/api/platform/billing/resume/route.js", "resumeSubscription(member.companyId"]]) {
  const src = read(file);
  const guard = src.indexOf("fieldquoEndRefusal(");
  ok(guard > 0 && guard < src.indexOf(call), `${file.split("/").slice(-2).join("/")}: refuses before it reaches Stripe`);
}
const extend = read("app/api/platform/companies/[id]/extend-trial/route.js");
ok(/company\.platformEndsAt/.test(extend) && extend.indexOf("company.platformEndsAt") < extend.indexOf("db.company.update"),
  "extend-trial: refuses an ended company before writing (a new trial date would change nothing it can do)");
const banner = read("app/components/layout/BillingBanner.js");
ok(banner.indexOf('"fieldquo_ending"') > 0 && banner.indexOf('"fieldquo_ending"') < banner.indexOf("trial_no_plan"),
  "the banner's ended branch comes before the 'Choose a plan' trial branch");
ok(/endedByFieldQuo/.test(read("app/app/settings/account-billing/page.js")) && /hidden=\{endedByFieldQuo\}/.test(read("app/app/settings/account-billing/page.js")),
  "Account & Billing hides the plan cards for an ended company");
const locked = read("app/components/layout/AccountLocked.js");
ok(/lockedReason/.test(locked) && /data-locked-reason/.test(locked) && /lockedReason=\{locked\.lockedReason/.test(read("app/app/layout.js")),
  "the locked screen prints FieldQuo's reason, and the layout passes it");
const panel = read("app/platform/companies/[id]/CompanyActions.js");
ok(/cancelOptions/.test(panel) && !/\["period_end", "At the end of the paid period"\]/.test(panel),
  "the panel renders from cancelOptions, not a hard-coded list of three");
ok(/cancelOptions: cancel/.test(read("app/api/platform/companies/[id]/route.js")), "the company route hands the panel its options");
// Impersonation is untouched: still read-only, still refused before billing.
ok(/function assertReadOnly/.test(read("lib/currentMember.js")) && /if \(member\.impersonation\) return member;/.test(read("lib/currentMember.js")),
  "impersonation: the read-only gate and its place before billing are unchanged");

console.log(`\n${count} checks, ${fail} failure(s).`);
process.exit(fail ? 1 : 0);
