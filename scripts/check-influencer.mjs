#!/usr/bin/env node
// scripts/check-influencer.mjs
//
// The influencer programme, executed rather than read.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-influencer.mjs
//
// The claims that matter here are all about WHICH rows get written and which
// do not: an influencer code enrols the company and mints a ledger; a signup
// on their link writes a SalesAttribution and NOT a referrer month; the
// referee still gets their own month; the ledger row can never sign into
// /sales. Every one of those is a property of a function that talks to the
// database, so the shipped functions run here against the scripted client in
// scripts/fixtures/dbStub.mjs — the same discipline check-sales-attribution
// and check-referral-reward use.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { rows, writes, reads, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  INFLUENCER_KIND,
  INFLUENCER_SOURCE,
  REP_KINDS,
  decideEnrolment,
  enrolInfluencer,
  unenrolInfluencer,
  influencerRepCode,
  isInfluencer,
  isInfluencerRep,
} from "@/lib/influencers";
import {
  REFEREE_BONUS_MONTHS,
  applySignupReferral,
  grantReferrerCredit,
  ensureReferralCode,
} from "@/lib/referrals";
import { redeemPromoCode, generatePromoCode } from "@/lib/platform/promoCodes";
import { ATTRIBUTION_SOURCES, decideAttribution } from "@/lib/sales/attribution";
import { canAuthenticate } from "@/lib/sales/invite";
import {
  METHODS_BY_KIND,
  PAYOUT_METHODS,
  isPayoutMethodFor,
  payoutMethodsFor,
  payoutReadiness,
} from "@/lib/sales/payoutDetails";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

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

const NOW = new Date("2026-09-15T15:00:00Z");
const PLAN = { id: "plan_a", name: "Standard", active: true, activationCents: 2000, firstPaymentCents: 4000, retentionCents: 6500, retentionDays: 60 };
const RETIRED = { id: "plan_z", name: "Old", active: false, activationCents: 1, firstPaymentCents: 1, retentionCents: 1, retentionDays: 60 };

/** A company row the way the fixture needs it — members inline, owner first. */
function company(id, name, email, extra = {}) {
  return {
    id,
    name,
    email,
    createdAt: NOW,
    onboardingStatus: "active",
    stripeChargesEnabled: true,
    trialEndsAt: new Date(NOW.getTime() + 30 * 86_400_000),
    referralCode: null,
    referredByCode: null,
    referredAt: null,
    influencerAt: null,
    influencerRepId: null,
    members: [{ role: "owner", createdAt: NOW, user: { email, name: `${name} owner` } }],
    ...extra,
  };
}

function fresh() {
  resetDbStub();
  rows.salesCommissionPlan.push({ ...PLAN }, { ...RETIRED });
}

// ── 1. Vocabulary ──────────────────────────────────────────────────────────
section("Vocabulary");
ok("REP_KINDS is rep + influencer", REP_KINDS.join() === "rep,influencer");
ok("the attribution source is registered beside the others", ATTRIBUTION_SOURCES.includes(INFLUENCER_SOURCE));
ok("isInfluencer needs BOTH columns", !isInfluencer({ influencerAt: NOW }) && !isInfluencer({ influencerRepId: "x" }) && isInfluencer({ influencerAt: NOW, influencerRepId: "x" }));
ok("the ledger code is prefixed so it cannot collide with a staff rep's", influencerRepCode("Dan").startsWith("inf-") && /^[a-z0-9][a-z0-9-]{1,30}$/.test(influencerRepCode("Dan", 1)));

// ── 2. Enrolment decision, pure ────────────────────────────────────────────
section("Enrolment decision");
{
  const c = company("c1", "Reno Dan", "dan@example.com");
  ok("refuses without a plan", decideEnrolment({ company: c, ownerEmail: "dan@example.com", plan: null }).reason === "no_plan");
  ok("refuses a retired plan", decideEnrolment({ company: c, ownerEmail: "dan@example.com", plan: RETIRED }).reason === "inactive_plan");
  ok("refuses when the owner's email is already a SalesRep", decideEnrolment({ company: c, ownerEmail: "dan@example.com", plan: PLAN, emailTakenBy: { id: "rep_x" } }).reason === "email_taken");
  ok("refuses a company that already is one", decideEnrolment({ company: { ...c, influencerAt: NOW, influencerRepId: "r" }, ownerEmail: "dan@example.com", plan: PLAN }).reason === "already_influencer");
  ok("accepts the ordinary case", decideEnrolment({ company: c, ownerEmail: "dan@example.com", plan: PLAN }).ok === true);
}

// ── 3. An influencer code enrols the company ───────────────────────────────
section("Influencer promo code → enrolled company");
{
  fresh();
  const promo = await generatePromoCode({ adminId: "adm", label: "@dan", kind: "influencer", rewardMonths: 0, commissionPlanId: PLAN.id });
  ok("an influencer code carries the plan", promo.commissionPlanId === PLAN.id, promo);
  ok("…and 0 reward months is legal (the ordinary trial)", promo.rewardMonths === 0, promo.rewardMonths);
  const tester = await generatePromoCode({ adminId: "adm", label: "qa", kind: "tester", rewardMonths: 0, commissionPlanId: PLAN.id });
  ok("a tester code never carries a plan, and keeps at least one month", tester.commissionPlanId === null && tester.rewardMonths === 1, tester);

  const dan = company("c_dan", "Reno Dan", "dan@example.com");
  rows.company.push(dan);
  const before = dan.trialEndsAt.getTime();
  const redeemed = await redeemPromoCode({ company: dan, code: promo.code });
  ok("redemption reports the kind and the plan to the signup route", redeemed.ok && redeemed.kind === "influencer" && redeemed.commissionPlanId === PLAN.id, redeemed);
  ok("0 months leaves the trial exactly where it was", rows.company[0].trialEndsAt.getTime() === before);

  const out = await enrolInfluencer({ companyId: dan.id, commissionPlanId: redeemed.commissionPlanId, via: "check" });
  ok("enrolment succeeds", out.ok === true, out.reason);
  const rep = rows.salesRep[0];
  ok("a SalesRep row of kind influencer exists", rep && isInfluencerRep(rep) && rep.kind === INFLUENCER_KIND, rep);
  ok("…on the code's plan", rep?.commissionPlanId === PLAN.id);
  ok("…with the owner's email, lower-cased", rep?.email === "dan@example.com");
  ok("…active, with no password and no accepted invite", rep?.active === true && !rep?.passwordHash && !rep?.acceptedAt);
  ok("…engaged as a freelancer, stated not defaulted", rep?.engagement === "freelancer" && rep?.accruesPaidLeave === false);
  ok("the company is flagged and points at the ledger", isInfluencer(rows.company[0]) && rows.company[0].influencerRepId === rep?.id, rows.company[0]);
  ok("their referral code is minted at enrolment, not on first visit to Refer", typeof rows.company[0].referralCode === "string" && rows.company[0].referralCode.length > 0, rows.company[0].referralCode);
  ok("the ledger row can never sign into /sales, even with a password", canAuthenticate({ ...rep, passwordHash: "x", acceptedAt: NOW }) === false);
  ok("…and a staff rep with the same shape still can", canAuthenticate({ ...rep, kind: "rep", passwordHash: "x", acceptedAt: NOW }) === true);
  ok("the payout run would not hold this ledger for an undecided engagement", !payoutReadiness(rep).problems.some((p) => p.code === "no_engagement"));

  // Idempotent: a second enrolment (a retried signup, a superadmin clicking
  // twice) is refused and logged, never a second ledger.
  const again = await enrolInfluencer({ companyId: dan.id, commissionPlanId: PLAN.id, via: "check" });
  ok("a second enrolment is refused as already_influencer", again.ok === false && again.reason === "already_influencer", again);
  ok("…with one ledger row, still", rows.salesRep.length === 1);
  ok("…and the refusal is on the platform error log", rows.platformErrorLog.some((e) => e.area === "influencer" && e.code === "already_influencer"));
}

// ── 4. Email already a rep: refuse and log, never crash ────────────────────
section("Owner's email is already a SalesRep");
{
  fresh();
  rows.salesRep.push({ id: "rep_staff", kind: "rep", email: "rachel@example.com", name: "Rachel", code: "rachel", active: true });
  const c = company("c_r", "Rachel Paints", "Rachel@Example.com");
  rows.company.push(c);
  const out = await enrolInfluencer({ companyId: c.id, commissionPlanId: PLAN.id, via: "check" });
  ok("refused as email_taken", out.ok === false && out.reason === "email_taken", out);
  ok("the company is NOT flagged", !isInfluencer(rows.company[0]));
  ok("the staff rep's row is untouched", rows.salesRep.length === 1 && rows.salesRep[0].kind === "rep");
  ok("the refusal is on the platform error log with the company", rows.platformErrorLog.some((e) => e.area === "influencer" && e.code === "email_taken" && e.companyId === c.id));
}

// ── 5. A signup on the influencer's link ───────────────────────────────────
section("Referral through an influencer's link");
{
  fresh();
  const dan = company("c_dan", "Reno Dan", "dan@example.com");
  rows.company.push(dan);
  await enrolInfluencer({ companyId: dan.id, commissionPlanId: PLAN.id, via: "check" });
  const ledger = rows.salesRep[0];
  const code = rows.company[0].referralCode;

  const newco = company("c_new", "Fresh Floors", "fresh@example.com");
  rows.company.push(newco);
  const trialBefore = newco.trialEndsAt.getTime();
  writes.length = 0;

  const result = await applySignupReferral({ company: newco, code });
  ok("the referral applies", result && result.referrer?.id === dan.id, result);
  const stored = rows.company.find((c) => c.id === "c_new");
  ok("the NEW company still gets its referee month", stored.trialEndsAt.getTime() > trialBefore && stored.referredByCode === code);
  ok("…recorded as a referred credit row", rows.referralCredit.some((r) => r.companyId === "c_new" && r.role === "referred" && r.months === REFEREE_BONUS_MONTHS));
  const attribution = rows.salesAttribution.find((a) => a.companyId === "c_new");
  ok("a SalesAttribution is written on the influencer's ledger", attribution && attribution.salesRepId === ledger.id, attribution);
  ok("…with source influencer_link", attribution?.source === INFLUENCER_SOURCE);
  ok("…and the verdict comes back so the signup route can log a miss", result.attribution?.outcome === "attribute");
  const order = writes.map((w) => `${w.model}.${w.action}`);
  ok("the attribution is written in the same transaction as the referee grant", order.indexOf("company.update") < order.indexOf("salesAttribution.create"), order);

  // Now the referred company pays. An ordinary referrer would be granted a
  // month here; an influencer must not be — their reward is the ledger.
  reads.length = 0;
  writes.length = 0;
  const credit = await grantReferrerCredit({ paidCompanyId: "c_new", paidAmountCents: 12900, currency: "usd" });
  ok("grantReferrerCredit returns null for an influencer referrer", credit === null, credit);
  ok("…writes no referrer credit row", !rows.referralCredit.some((r) => r.role === "referrer"));
  ok("…and never reaches the access extension", !writes.some((w) => w.model === "company" && w.action === "update"));

  // Same code, same company again: a reload. Nothing new.
  writes.length = 0;
  const second = await applySignupReferral({ company: stored, code });
  ok("a repeated signup on the same code does not write a second attribution", rows.salesAttribution.filter((a) => a.companyId === "c_new").length === 1 && second?.attribution?.outcome === "already_attributed", second?.attribution?.outcome);
}

// ── 5b. Stop influencer status, and start it again ─────────────────────────
section("Unenrol: back to a regular company; re-enrol: the same ledger comes back");
{
  fresh();
  const dan = company("c_dan", "Reno Dan", "dan@example.com");
  rows.company.push(dan);
  await enrolInfluencer({ companyId: dan.id, commissionPlanId: PLAN.id, via: "check" });
  const ledger = rows.salesRep[0];
  const code = rows.company[0].referralCode;
  // One referral earned while enrolled — it must survive the stop.
  const first = company("c_first", "First Floors", "first@example.com");
  rows.company.push(first);
  await applySignupReferral({ company: first, code });
  ok("setup: one attribution on the ledger", rows.salesAttribution.filter((a) => a.salesRepId === ledger.id).length === 1);

  const stopped = await unenrolInfluencer({ companyId: dan.id, via: "check" });
  ok("unenrol succeeds and names the ledger", stopped.ok === true && stopped.ledgerId === ledger.id, stopped);
  const c = rows.company.find((x) => x.id === "c_dan");
  ok("the company's influencer columns are cleared", !isInfluencer(c) && c.influencerAt === null && c.influencerRepId === null, c);
  ok("…its referral code is kept, so the link a follower has still works", c.referralCode === code);
  ok("the ledger row is deactivated, never deleted", rows.salesRep.length === 1 && rows.salesRep[0].active === false, rows.salesRep[0]);
  ok("…and the attribution already earned stays written", rows.salesAttribution.filter((a) => a.salesRepId === ledger.id).length === 1);
  ok("unenrolling twice is refused as not_influencer, and logged", (await unenrolInfluencer({ companyId: dan.id, via: "check" })).reason === "not_influencer" && rows.platformErrorLog.some((e) => e.code === "not_influencer"));

  // A referral AFTER the stop earns the ordinary referrer month again.
  const later = company("c_later", "Later Landscaping", "later@example.com");
  rows.company.push(later);
  const result = await applySignupReferral({ company: later, code });
  ok("a referral after unenrol still applies for the referee", result && result.referrer?.id === dan.id, result);
  ok("…writes NO attribution — the ledger is closed", !rows.salesAttribution.some((a) => a.companyId === "c_later"));
  const credit = await grantReferrerCredit({ paidCompanyId: "c_later", paidAmountCents: 12900, currency: "usd" });
  ok("…and the referrer month is granted again once they pay", credit !== null && rows.referralCredit.some((r) => r.role === "referrer" && r.companyId === "c_dan"), credit);

  // Re-enrol under another plan: the SAME row comes back, active, on the new plan.
  const OTHER = { ...PLAN, id: "plan_other", name: "Other plan" };
  rows.salesCommissionPlan.push(OTHER);
  const again = await enrolInfluencer({ companyId: dan.id, commissionPlanId: OTHER.id, via: "check" });
  ok("re-enrolment succeeds by reactivation, not a second ledger", again.ok === true && again.reactivated === true && rows.salesRep.length === 1, again);
  ok("…the row is active again on the newly chosen plan", rows.salesRep[0].active === true && rows.salesRep[0].commissionPlanId === OTHER.id);
  ok("…and the company points at it again", isInfluencer(rows.company.find((x) => x.id === "c_dan")) && rows.company.find((x) => x.id === "c_dan").influencerRepId === ledger.id);
  ok("a rep's login on the owner's email is still a refusal", decideEnrolment({ company: company("c_x", "X", "x@example.com"), ownerEmail: "x@example.com", plan: PLAN, emailTakenBy: { id: "rep_x", kind: "rep" } }).reason === "email_taken");
}

section("The reps page cannot flip an influencer ledger alone");
{
  const route = readFileSync(join(ROOT, "app/api/platform/sales/reps/[id]/route.js"), "utf8");
  ok("PATCH { active } on a kind influencer row answers 409 and points at the company page", /existing\.kind === INFLUENCER_KIND && typeof active === "boolean"/.test(route) && /status: 409/.test(route));
  const panel = readFileSync(join(ROOT, "app/platform/companies/[id]/CompanyInfluencer.js"), "utf8");
  ok("the company page has Stop influencer status behind a confirm that says what happens", /data-influencer-stop\b/.test(panel) && /data-influencer-stop-confirm/.test(panel) && /earns them the\s+free month again/.test(panel) && /never deleted/.test(panel));
  const api = readFileSync(join(ROOT, "app/api/platform/companies/[id]/influencer/route.js"), "utf8");
  ok("DELETE on the platform influencer route unenrols, superadmin only, audited", /export async function DELETE/.test(api) && /unenrolInfluencer\(/.test(api) && /influencer_unenrolled/.test(api));
}

// ── 6. The influencer cannot refer themselves ──────────────────────────────
section("Self-dealing is refused by the same rule as a rep");
{
  fresh();
  const dan = company("c_dan", "Reno Dan", "dan@example.com");
  rows.company.push(dan);
  await enrolInfluencer({ companyId: dan.id, commissionPlanId: PLAN.id, via: "check" });
  const code = rows.company[0].referralCode;
  // A second company registered with the influencer's own email.
  const mine = company("c_mine", "Dan's Other Shop", "dan@example.com");
  rows.company.push(mine);
  const result = await applySignupReferral({ company: mine, code });
  ok("the referee month is still granted (the link's promise)", rows.referralCredit.some((r) => r.companyId === "c_mine" && r.role === "referred"));
  ok("but the attribution is refused as self_dealing", result?.attribution?.outcome === "self_dealing", result?.attribution);
  ok("…and no attribution row exists", !rows.salesAttribution.some((a) => a.companyId === "c_mine"));
  ok("…nor a touch (a disqualified claim is not evidence)", rows.salesAttributionTouch.length === 0);

  // The pure decision agrees, with a ledger row instead of a staff rep.
  const v = decideAttribution({ source: INFLUENCER_SOURCE, rep: { id: "r", email: "dan@example.com", active: true }, company: { id: "c", email: "dan@example.com" } });
  ok("decideAttribution treats influencer_link like every other source", v.outcome === "self_dealing");
}

// ── 7. An ordinary referrer is untouched ───────────────────────────────────
section("An ordinary company's link still pays a month");
{
  fresh();
  const ref = company("c_ref", "Old Hand", "old@example.com", { referralCode: "oldhand" });
  rows.company.push(ref);
  const newco = company("c_new2", "Newbie", "new@example.com");
  rows.company.push(newco);
  const result = await applySignupReferral({ company: newco, code: "oldhand" });
  ok("the referral applies", result?.referrer?.id === "c_ref");
  ok("no attribution is written for a non-influencer referrer", rows.salesAttribution.length === 0 && result.attribution === null);
}

// ── 8. Payout methods per kind ─────────────────────────────────────────────
section("Payout methods");
{
  const inf = payoutMethodsFor("influencer").map((m) => m.key);
  const rep = payoutMethodsFor("rep").map((m) => m.key);
  ok("influencers: PayPal, Interac, Wise, bank transfer — no Upwork", inf.join() === "paypal,interac,wise,bank_transfer", inf);
  ok("reps keep Upwork", rep.includes("upwork"));
  ok("bank_transfer is a real method with a handle label", PAYOUT_METHODS.find((m) => m.key === "bank_transfer")?.handleLabel?.length > 0);
  ok("the write path can refuse Upwork for an influencer", isPayoutMethodFor("influencer", "upwork") === false && isPayoutMethodFor("influencer", "wise") === true && isPayoutMethodFor("rep", "upwork") === true);
  ok("every kind in METHODS_BY_KIND is a known rep kind", Object.keys(METHODS_BY_KIND).every((k) => REP_KINDS.includes(k)));
}

// ── 9. The routes read what was written ────────────────────────────────────
section("Wiring");
{
  const signup = read("app/api/companies/route.js");
  ok("signup enrols on an influencer promo", /enrolInfluencer\(\{/.test(signup) && /promo\.kind === "influencer" && promo\.commissionPlanId/.test(signup));
  ok("…and logs an influencer attribution miss", /Influencer referral did not attribute/.test(signup));
  for (const f of ["app/api/sales/auth/login/route.js", "lib/sales/gate.js", "lib/sales/outreachGate.js", "lib/sales/demoGate.js", "lib/sales/smsGate.js", "lib/sales/queueGate.js", "lib/sales/calls/gate.js", "lib/sales/calendar/gate.js"]) {
    ok(`${f} selects kind for canAuthenticate`, /kind: true/.test(read(f)));
  }
  ok("canAuthenticate refuses the kind before anything else", /rep\.kind === "influencer"\) return false/.test(read("lib/sales/invite.js")));
  const promoRoute = read("app/api/platform/promo-codes/route.js");
  ok("the console requires a plan on an influencer code", /Pick the commission plan/.test(promoRoute) && /resolvePlanAssignment/.test(promoRoute));
  const promoPage = read("app/platform/promo-codes/page.js");
  ok("the console defaults an influencer code to 0 months and says why", /rewardMonths: 0/.test(promoPage) && /ordinary trial/.test(promoPage));
  ok("the referrals module refuses the month for an influencer", /referrerIsInfluencer\(referrer\)\) return null/.test(read("lib/referrals/index.js")));
  ok("ensureReferralCode is the one minter", /ensureReferralCode\(company\)/.test(read("app/api/settings/referral/route.js")) && !/function getOrCreateReferralCode/.test(read("app/api/settings/referral/route.js")));
  ok("the schema carries the three columns", /influencerAt\s+DateTime\?/.test(read("prisma/schema.prisma")) && /influencerRepId\s+String\?/.test(read("prisma/schema.prisma")) && /kind\s+String\s+@default\("rep"\)/.test(read("prisma/schema.prisma")) && /commissionPlanId String\?\n  commissionPlan   SalesCommissionPlan\?/.test(read("prisma/schema.prisma")));
  // Part B — the /app screen, its routes and the nav row.
  const hasPage = (() => { try { read("app/app/influencer/page.js"); return true; } catch { return false; } })();
  if (hasPage) {
    const earnings = read("app/api/influencer/earnings/route.js");
    const payout = read("app/api/influencer/payout/route.js");
    const gate = read("lib/influencers/gate.js");
    ok("the company gate resolves the ledger from Company.influencerRepId, never from the request", /influencerRepId/.test(gate) && /where: \{ id: company\.influencerRepId \}/.test(gate) && /kind !== "influencer"/.test(gate));
    ok("/api/influencer/earnings goes through that gate and scopes every read to the ledger", /influencerOrRefusal\(request\)/.test(earnings) && (earnings.match(/where: \{ salesRepId: ledgerId \}/g) || []).length === 2);
    ok("/api/influencer/payout refuses methods outside the influencer list", /isPayoutMethodFor\(INFLUENCER_KIND/.test(payout) || /isPayoutMethodFor\("influencer"/.test(payout));
    ok("…and writes through the same savePayoutDestination the rep uses", /savePayoutDestination\(/.test(payout));
    ok("the nav row exists and is owner/admin", /app\.nav\.influencer/.test(read("app/components/layout/AdminSidebar.js")) && /"app\.nav\.influencer": \{ role: \["owner", "admin"\] \}/.test(read("lib/permissions/nav.js")));
    ok("the rep components take an endpoint", /endpoint = "\/api\/sales\/earnings"/.test(read("app/components/sales/EarningsPanel.js")) && /endpoint = "\/api\/sales\/payout"/.test(read("app/components/sales/PayoutDestinationForm.js")));
  } else {
    console.log("  skip /app/influencer not built yet");
  }
}

// ── 10. Nine languages ─────────────────────────────────────────────────────
section("Languages");
{
  const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.influencer.") || k === "app.nav.influencer");
  ok("the influencer keys exist in English", keys.length > 0, keys.length);
  // APP_MESSAGES, not app/i18n/languages.js: zh is translated but not
  // offered in the picker, and a key missing there is still a key missing.
  const langs = Object.keys(APP_MESSAGES);
  ok("nine languages", langs.length === 9, langs);
  for (const lang of langs) {
    const missing = keys.filter((k) => !APP_MESSAGES[lang]?.[k]);
    ok(`${lang} carries every influencer key`, missing.length === 0, missing.slice(0, 5));
  }
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass}/${pass + failures.length} assertions`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
