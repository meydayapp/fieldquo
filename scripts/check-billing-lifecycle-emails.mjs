// scripts/check-billing-lifecycle-emails.mjs
//
//   npm run check:billing-lifecycle-emails
//
// FieldQuo → contractor lifecycle letters, part B (2026-10-11): what each one
// does is EXECUTED here against a FakePrisma that evaluates `where`, a Stripe
// that records and a sendEmail that records — nothing is mailed, nothing
// reaches Stripe or Postgres (scripts/billing-lifecycle-stub-hooks.mjs).
//
//   1. the monthly summary's audience — card-free trials now in, ended and
//      locked companies out, an empty trial month skipped (the real cron)
//   2. the subscription letters in every app language; English byte-for-byte
//      what it was (an md5 per kind, taken before the change)
//   3. one "cancelled" letter per cancellation — the real cancel route AND the
//      real customer.subscription.deleted webhook, together
//   4. the referral month letters, once per reward (the real grant path)
//   5. AI credit running low, once per crossing (the real ledger writers)
//   6. the client's approval email: the contractor's stationery, no FieldQuo,
//      contrast measured on hostile brand colours, every client language
//   7. win-back and product-updates: content and selection only (pure)
//
// Run: node --import ./scripts/alias-loader.mjs \
//           --import ./scripts/billing-lifecycle-stub-loader.mjs scripts/check-billing-lifecycle-emails.mjs

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { harness, resetHarness } from "./fixtures/billingLifecycleStubs.mjs";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)?.slice(0, 400)}` : ""}`);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const DAY = 86400000;
const APP_LANGS = Object.keys(APP_MESSAGES);
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

// FakePrisma relations every scenario shares.
const RELATIONS = {
  subscription: {
    plan: [(r, d) => d.t.plan.find((p) => p.id === r.planId) || null, "plan"],
    company: [(r, d) => d.t.company.find((c) => c.id === r.companyId) || null, "company"],
  },
  company: {
    subscription: [(r, d) => d.t.subscription.find((s) => s.companyId === r.id) || null, "subscription"],
  },
  member: {
    user: [(r, d) => d.t.user.find((u) => u.id === r.userId) || null, "user"],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 1. Monthly summary audience ─────────────────────────────────");
{
  const { digestAudience, monthHasActivity, digestAudienceWhere } = await import("@/lib/ai/digestAudience");
  const NOW = new Date("2026-11-01T08:00:00Z");
  const periodEnd = new Date("2026-10-31T23:59:59Z");
  const base = { isDemo: false, onboardingStatus: null, createdAt: new Date("2026-09-01"), platformEndsAt: null, platformEndMode: null, platformEndReason: null };
  const cases = [
    ["card-free trial still running → in, as a trial", { ...base, trialEndsAt: new Date(NOW.getTime() + 5 * DAY), subscription: null }, true, true],
    ["card-free trial ended (read-only week) → out", { ...base, trialEndsAt: new Date(NOW.getTime() - 2 * DAY), subscription: null }, false],
    ["card-free trial ended and locked → out", { ...base, trialEndsAt: new Date(NOW.getTime() - 20 * DAY), subscription: null }, false],
    ["Stripe trialing (plan chosen, free month) → in, as a trial", { ...base, subscription: { status: "trialing" } }, true, true],
    ["active plan → in, not a trial", { ...base, onboardingStatus: "active", subscription: { status: "active" } }, true, false],
    ["active plan booked to end → still in", { ...base, subscription: { status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(NOW.getTime() + 9 * DAY) } }, true, false],
    ["past_due inside grace → in", { ...base, subscription: { status: "past_due", pastDueSince: new Date(NOW.getTime() - 2 * DAY) } }, true, false],
    ["past_due, grace expired (locked) → out", { ...base, subscription: { status: "past_due", pastDueSince: new Date(NOW.getTime() - 9 * DAY) } }, false],
    ["cancelled plan → out", { ...base, subscription: { status: "canceled", canceledAt: new Date(NOW.getTime() - 3 * DAY) } }, false],
    ["locked by FieldQuo (terms) → out", { ...base, subscription: { status: "active", accessLockedAt: new Date(NOW.getTime() - DAY) } }, false],
    ["FieldQuo ended a trial (platformEndsAt, even if still running) → out", { ...base, trialEndsAt: new Date(NOW.getTime() + 5 * DAY), platformEndsAt: new Date(NOW.getTime() + 5 * DAY), platformEndMode: "period_end", subscription: null }, false],
    ["FieldQuo ended it, then a late checkout webhook wrote an active row → still out", { ...base, platformEndsAt: new Date(NOW.getTime() - DAY), platformEndMode: "now", subscription: { status: "active" } }, false],
    ["demo → out", { ...base, isDemo: true, subscription: { status: "active" } }, false],
    ["hand-made company with onboardingStatus active and no trial → in (the old rule kept)", { ...base, onboardingStatus: "active", trialEndsAt: null, subscription: null }, true, false],
    ["no plan, no trial, not active → out", { ...base, trialEndsAt: null, subscription: null }, false],
    ["signed up after the month closed → out", { ...base, createdAt: new Date("2026-11-01T01:00:00Z"), subscription: { status: "trialing" } }, false],
  ];
  for (const [label, company, send, trial] of cases) {
    const v = digestAudience(company, { periodEnd, now: NOW });
    ok(label, v.send === send && (send ? v.trial === trial : true), v);
  }

  // An EMPTY month, built by the real summary builder from no rows at all.
  const { buildMonthlySummary } = await import("@/lib/analytics/monthlySummary");
  const { summaryMonths } = await import("@/lib/analytics/monthlySummaryData");
  const { period, prior } = summaryMonths(new Date("2026-10-15T12:00:00Z"));
  const empty = buildMonthlySummary({ period, prior, asOf: NOW, hadFullPriorMonth: true });
  ok("an empty month (no rows at all) has no activity — its headline is 'quiet'", !monthHasActivity(empty) && empty.headline.key === "quiet", empty.headline);
  const oneLead = buildMonthlySummary({ period, prior, asOf: NOW, hadFullPriorMonth: true, leads: [{ id: "l1", source: "website", status: "new", createdAt: new Date("2026-10-03") }] });
  ok("one lead in the month is activity", monthHasActivity(oneLead));
  const onePayment = buildMonthlySummary({
    period, prior, asOf: NOW, hadFullPriorMonth: true,
    invoices: [{ id: "i1", companyId: "x", parentInvoiceId: null, version: 1, status: "paid", total: 100, sentAt: new Date("2026-10-02"), createdAt: new Date("2026-10-02"), dueDate: new Date("2026-10-20") }],
    payments: [{ invoiceId: "i1", amount: 100, date: new Date("2026-10-05") }],
  });
  ok("an invoice paid in the month is activity", monthHasActivity(onePayment));

  // The real cron, its audience executed against a FakePrisma that evaluates
  // digestAudienceWhere. generateMonthlyDigest is the recorder for this
  // importer only (billing-lifecycle-stub-hooks.mjs).
  process.env.CRON_SECRET = "cron-test";
  const { GET } = await import("../app/api/cron/monthly-digest/route.js");
  const realNow = Date.now;
  const tables = {
    company: [
      { ...base, id: "trial_live", name: "Trial Live", trialEndsAt: new Date(Date.now() + 5 * DAY) },
      { ...base, id: "trial_over", name: "Trial Over", trialEndsAt: new Date(Date.now() - 3 * DAY) },
      { ...base, id: "paid", name: "Paid", onboardingStatus: "active" },
      { ...base, id: "stripe_trial", name: "Stripe Trial", onboardingStatus: "active" },
      { ...base, id: "cancelled", name: "Cancelled", onboardingStatus: "churned" },
      { ...base, id: "terms", name: "Terms", onboardingStatus: "active" },
      { ...base, id: "ended_trial", name: "Ended", trialEndsAt: new Date(Date.now() + 5 * DAY), platformEndsAt: new Date(Date.now() + 5 * DAY), platformEndMode: "period_end" },
      { ...base, id: "demo", name: "Demo", isDemo: true, onboardingStatus: "active" },
    ],
    subscription: [
      { id: "s_paid", companyId: "paid", status: "active" },
      { id: "s_st", companyId: "stripe_trial", status: "trialing" },
      { id: "s_c", companyId: "cancelled", status: "canceled", canceledAt: new Date(Date.now() - 4 * DAY) },
      { id: "s_t", companyId: "terms", status: "active", accessLockedAt: new Date(Date.now() - DAY) },
      { id: "s_d", companyId: "demo", status: "active" },
    ],
  };
  resetHarness({ tables, relations: RELATIONS });
  harness.digestAnswer = (args) => (args.companyId === "stripe_trial" ? { skipped: "no_activity" } : null);
  const res = await GET(new Request("https://www.fieldquo.com/api/cron/monthly-digest", { headers: { authorization: "Bearer cron-test" } }));
  const body = await res.json();
  const asked = harness.digestCalls.map((c) => c.companyId).sort();
  ok("cron: card-free trial, paid plan and Stripe trial are asked for; nobody else", JSON.stringify(asked) === JSON.stringify(["paid", "stripe_trial", "trial_live"]), asked);
  ok("cron: trials are asked with skipWhenEmpty, the paying company without", harness.digestCalls.every((c) => c.skipWhenEmpty === (c.companyId !== "paid")), harness.digestCalls.map((c) => [c.companyId, c.skipWhenEmpty]));
  ok("cron: an empty trial month is reported as skipped, not processed", body.skipped?.no_activity === 1 && body.processed === 2, body);
  ok("cron: the old onboardingStatus filter is gone from the query", !harness.db.calls.some((c) => c.model === "company" && JSON.stringify(c.where).includes('"onboardingStatus":"active"') && !JSON.stringify(c.where).includes("OR")));
  const bad = await GET(new Request("https://www.fieldquo.com/api/cron/monthly-digest"));
  ok("cron: refuses without the secret", bad.status === 401);
  Date.now = realNow;

  const digestSrc = stripComments(read("lib/ai/monthlyDigest.js"));
  const skipAt = digestSrc.indexOf("if (skipWhenEmpty && !monthHasActivity(summary))");
  ok("an empty trial month returns before the model, the row and the send", skipAt > 0 && skipAt < digestSrc.indexOf("const ai = await buildDigestInsights({") && skipAt < digestSrc.indexOf("db.aiDigest.create") && skipAt < digestSrc.indexOf("await sendEmail("));
  ok("the digest skips a reserved test address", /isReservedTestAddress\(owner\.user\.email\)/.test(digestSrc));
  const where = digestAudienceWhere(NOW);
  ok("the query is narrowed to non-demo, not-ended companies", where.isDemo === false && where.platformEndsAt === null);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 2. Subscription letters in every app language ───────────────");
{
  const { buildBillingEmail, buildPlatformNotice, formatBillingDate } = await import("@/lib/email/billingEmail");
  const { BILLING_EMAIL_COPY, BILLING_EMAIL_KEYS } = await import("@/lib/i18n/billingEmailCopy");

  // English, byte-for-byte: the md5s taken from the shipped builder BEFORE
  // the letters were translated (3c5cab740), over the same inputs.
  const url = "https://www.fieldquo.com/app/settings/account-billing";
  const facts = [["Plan", "Solo"], ["Users included", "3"], ["Status", "Free trial"], ["Trial ends", "Oct 21, 2026"]];
  const cases = {
    started: [{ kind: "started", companyName: "Alpha & <Sons>", planName: "Solo", facts, billingUrl: url }, "1bab38d41640c3c9cd65c6f446c9832e"],
    startedNoUrl: [{ kind: "started", companyName: "Alpha", planName: "Solo", facts: [] }, "d66765f33114d7300cbb939e838590dd"],
    changed: [{ kind: "changed", companyName: "Alpha", planName: "Team", previousPlanName: "Solo", facts, billingUrl: url }, "20d6ce676ff15e039c5091f6ec42e6d5"],
    changedNoPrev: [{ kind: "changed", companyName: "Alpha", planName: "Team", previousPlanName: null, facts, billingUrl: url }, "94673ca996aa67b141771d7d0ac9f2a4"],
    renewal: [{ kind: "renewal", companyName: "Alpha", planName: "Solo", periodEnd: "Nov 1, 2026", renewalAmount: "$49.00", last4: "4242", billingUrl: url }, "44d059ae26cf46c03ac5eb845cb7644d"],
    renewalNoCard: [{ kind: "renewal", companyName: "Alpha", planName: "Solo", periodEnd: "Nov 1, 2026", renewalAmount: "$49.00", last4: null, billingUrl: url }, "2ee9752833805fc63ebb6b6150953408"],
    graceStart: [{ kind: "grace", companyName: "Alpha", daysLeft: 7, lockDate: "Oct 18, 2026", reminder: false, billingUrl: url }, "07a5019ca5f6870a085d3a5dde745ef2"],
    graceOne: [{ kind: "grace", companyName: "Alpha", daysLeft: 1, lockDate: "Oct 18, 2026", reminder: true, billingUrl: url }, "510f23536e8660611c3d487c6f5b49ab"],
    graceRemind: [{ kind: "grace", companyName: "Alpha", daysLeft: 2, lockDate: "Oct 18, 2026", reminder: true, billingUrl: url }, "33712f7bb42babdc350224aad8858895"],
    cancelledNow: [{ kind: "cancelled", companyName: "Alpha", planName: "Solo", billingUrl: url }, "26282484a8aaaacf1c29fe8dfaf69c7d"],
    cancelledNoPlan: [{ kind: "cancelled", companyName: "Alpha", planName: null, billingUrl: url }, "089b7bf2b3033979708ea6aa28edf79f"],
    cancelledEnding: [{ kind: "cancelled", companyName: "Alpha", planName: "Solo", periodEnd: "Nov 1, 2026", atPeriodEnd: true, billingUrl: url }, "72a3804648fe2d7500325feac25dd4b0"],
  };
  for (const [name, [input, hash]] of Object.entries(cases)) {
    ok(`English ${name}: byte-identical to before (md5 ${hash.slice(0, 8)}…)`, md5(buildBillingEmail(input)) === hash);
    ok(`English ${name}: language "en" passed explicitly is the same letter`, md5(buildBillingEmail({ ...input, language: "en" })) === hash);
  }
  ok("the platform notice (voice rent, tickets, trial reminder) is byte-identical in English", md5(buildPlatformNotice({ subject: "S", heading: "H", sub: "Alpha", paragraphs: ["<strong>x</strong>"], facts: [["a", "b"]], cta: { url, label: "Go" } })) === "4ef249f34aa4b75b5e5cffb0a2af45ba");

  // Every app language, every key, the same placeholders.
  ok(`the letters exist in every app catalogue language (${APP_LANGS.join(" ")})`, APP_LANGS.every((l) => BILLING_EMAIL_COPY[l]), APP_LANGS.filter((l) => !BILLING_EMAIL_COPY[l]));
  for (const lang of APP_LANGS) {
    const dict = BILLING_EMAIL_COPY[lang] || {};
    const required = BILLING_EMAIL_KEYS.filter((k) => !k.startsWith("grace.days."));
    const missing = required.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
    ok(`${lang}: every sentence translated`, missing.length === 0, missing);
    const wrong = required.filter((k) => dict[k] && placeholders(dict[k]) !== placeholders(BILLING_EMAIL_COPY.en[k]));
    ok(`${lang}: every sentence carries the English placeholders, no more, no fewer`, wrong.length === 0, wrong);
    ok(`${lang}: a day count has its "other" form`, typeof dict["grace.days.other"] === "string" && dict["grace.days.other"].includes("{n}"));
    if (lang !== "en") {
      const same = required.filter((k) => dict[k] === BILLING_EMAIL_COPY.en[k] && !/^(Plan|Status|read-only)$/.test(dict[k]));
      ok(`${lang}: nothing is English left untranslated`, same.length === 0, same);
    }
  }

  // Render every kind in every language: nothing unfilled, the right words.
  for (const lang of APP_LANGS) {
    const all = Object.values(cases).map(([input]) => buildBillingEmail({ ...input, language: lang }));
    // \bnull\b: Italian "annullato" contains the letters.
    const leftovers = all.filter((m) => /\{\w+\}|undefined|\bnull\b/.test(m.subject + m.html));
    ok(`${lang}: all 12 letters render with no {placeholder}, "undefined" or "null"`, leftovers.length === 0, leftovers.map((m) => m.subject));
    const footer = BILLING_EMAIL_COPY[lang].footer;
    ok(`${lang}: the footer is in the letter's language`, all.every((m) => m.html.includes(footer.replace(/&/g, "&amp;").replace(/</g, "&lt;"))));
    if (lang !== "en") {
      ok(`${lang}: no English sentence leaks into the letters`, all.every((m) => !/We weren't able|Thanks for subscribing|nothing is charged until|you manage this company's billing/.test(m.html)));
    }
  }
  const fr = buildBillingEmail({ kind: "grace", companyName: "Peinture Roy", daysLeft: 7, lockDate: formatBillingDate(new Date("2026-10-18T12:00:00Z"), "fr"), reminder: true, billingUrl: url, language: "fr" });
  ok("French grace reminder: French subject, French date, French button", /verrouillé le 18 oct/.test(fr.subject) && fr.html.includes("Mettre à jour votre carte"), fr.subject);
  const ukDays = (n) => buildBillingEmail({ kind: "grace", companyName: "Co", daysLeft: n, lockDate: "x", reminder: false, language: "uk" }).html;
  ok("Ukrainian counts days by its three forms: 1 день, 3 дні, 5 днів, 21 день", ukDays(1).includes("1 день") && ukDays(3).includes("3 дні") && ukDays(5).includes("5 днів") && ukDays(21).includes("21 день"));
  ok("French counts zero as singular: 0 jour", buildBillingEmail({ kind: "grace", companyName: "Co", daysLeft: 0, lockDate: "x", reminder: false, language: "fr" }).html.includes("0 jour<"));
  const hostile = buildBillingEmail({ kind: "started", companyName: '<img src=x onerror="1">', planName: "<b>Solo</b>", facts: [], language: "de" });
  ok("a hostile company or plan name is escaped in every language", !hostile.html.includes("<img src=x") && hostile.html.includes("&lt;img src=x"));
  ok("an unknown language falls back to English, never a blank", buildBillingEmail({ kind: "cancelled", companyName: "Co", planName: "Solo", language: "xx" }).subject === "Your FieldQuo plan has been cancelled");
  ok("English dates are formatDateOnly exactly (Oct 18, 2026)", formatBillingDate(new Date("2026-10-18T12:00:00Z"), "en") === "Oct 18, 2026");

  // The reader's language, through the real notify path.
  const { notifySubscriptionState } = await import("@/lib/billing/notify");
  const run = async ({ userLang, companyLang }) => {
    resetHarness({
      tables: {
        company: [{ id: "c1", name: "Roy", email: "roy@roy.ca", defaultLanguage: companyLang }],
        subscription: [{ id: "s1", companyId: "c1", status: "trialing", planId: "p1", currentPeriodEnd: new Date("2026-10-21T12:00:00Z"), welcomeEmailSentAt: null, notifiedPlanId: null }],
        plan: [{ id: "p1", name: "Solo", maxUsers: 3 }],
        member: [{ id: "m1", companyId: "c1", userId: "u1", role: "owner", createdAt: new Date("2026-01-01") }],
        user: [{ id: "u1", email: "roy@roy.ca", language: userLang }],
      },
      relations: RELATIONS,
    });
    await notifySubscriptionState("c1");
    return harness.sent[0];
  };
  const a = await run({ userLang: "fr", companyLang: "en" });
  ok("the owner's own language wins: French letter for a French owner of an English company", a?.subject === "Vous êtes abonné à FieldQuo — Solo" && a.html.includes("Utilisateurs inclus") && a.html.includes("21 oct"), a?.subject);
  const b = await run({ userLang: null, companyLang: "es" });
  ok("no language of the owner's own → the company's (Spanish)", b?.subject === "Está suscrito a FieldQuo — Solo" && b.html.includes("Fin de la prueba"), b?.subject);
  const c = await run({ userLang: null, companyLang: "en" });
  ok("neither → English, with the English facts table", c?.subject === "You're subscribed to FieldQuo — Solo" && c.html.includes("Users included") && c.html.includes("Oct 21, 2026"), c?.subject);
  const d = await run({ userLang: "zh", companyLang: "en" });
  ok("an owner who chose Chinese reads Chinese (the letter has it even though the picker does not)", d?.subject === "你已订阅 FieldQuo — Solo", d?.subject);
  const e = await run({ userLang: "klingon", companyLang: "it" });
  ok("an unknown owner language falls to the company's (Italian)", e?.subject === "Ha sottoscritto FieldQuo — Solo", e?.subject);

  for (const f of ["app/api/cron/grace-warning/route.js", "app/api/cron/renewal-reminders/route.js"]) {
    const src = stripComments(read(f));
    ok(`${f.split("/")[3]}: asks the reader's language and passes it, with the date in it`, /ownerLetterLanguage\(sub\.companyId, hasBillingEmailLanguage\)/.test(src) && /language,?\s/.test(src) && /formatBillingDate\(/.test(src) && !/"Your company"/.test(src));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 3. One cancellation, one letter ─────────────────────────────");
{
  const { POST } = await import("../app/api/platform/billing/cancel/route.js");
  const { syncSubscriptionFromStripeEvent } = await import("@/lib/platform/stripeBilling");
  const { notifyCancellation } = await import("@/lib/billing/notify");
  const now = Math.floor(Date.now() / 1000);
  const liveFor = (id, status = "trialing") => ({ id, status, customer: "cus_A", current_period_end: now + 10 * 86400, items: { data: [] } });
  const setup = ({ subId = "sub_1", status = "trialing", extra = {}, company = {} } = {}) => {
    resetHarness({
      tables: {
        company: [
          { id: "A", name: "Alpha", email: "a@alpha.ca", defaultLanguage: "en", onboardingStatus: "active", ...company },
          { id: "B", name: "Beta", email: "b@beta.ca", defaultLanguage: "en", onboardingStatus: "active" },
        ],
        subscription: [
          { id: "sA", companyId: "A", stripeSubscriptionId: subId, stripeCustomerId: "cus_A", status, planId: "p1", currentPeriodEnd: new Date((now + 10 * 86400) * 1000), canceledAt: null, cancellationNotifiedFor: null, ...extra },
          { id: "sB", companyId: "B", stripeSubscriptionId: "sub_B", stripeCustomerId: "cus_B", status: "canceled", planId: "p1", cancellationNotifiedFor: null },
        ],
        plan: [{ id: "p1", name: "Solo" }],
        member: [],
        user: [],
      },
      relations: RELATIONS,
      stripe: {
        subscriptions: {
          retrieve: async (id) => (harness.stripeCalls.push(["retrieve", id]), liveFor(id, status)),
          cancel: async (id) => (harness.stripeCalls.push(["cancel", id]), { ...liveFor(id), status: "canceled", canceled_at: now }),
          update: async (id, p) => (harness.stripeCalls.push(["update", id, p]), { ...liveFor(id, status), ...p, cancel_at: p.cancel_at_period_end ? now + 10 * 86400 : null }),
        },
      },
      member: { companyId: "A", role: "owner", userId: "u1" },
    });
  };
  const cancel = () => POST(new Request("https://www.fieldquo.com/api/platform/billing/cancel", { method: "POST", body: "{}" }));
  const deleted = (id) => syncSubscriptionFromStripeEvent({ id: `evt_${id}`, type: "customer.subscription.deleted", data: { object: { ...liveFor(id), status: "canceled", canceled_at: now } } });
  const cancelledLetters = () => harness.sent.filter((m) => /cancelled|ends on/.test(m.subject));

  setup();
  await cancel();
  await deleted("sub_1");
  ok("a trial cancelled on the spot: the route AND the webhook ran, ONE letter went", cancelledLetters().length === 1, harness.sent.map((m) => m.subject));
  ok("…and it is the 'has been cancelled' letter", harness.sent[0]?.subject === "Your FieldQuo plan has been cancelled");
  ok("…the guard holds the ended Stripe subscription's id", harness.db.t.subscription.find((s) => s.id === "sA").cancellationNotifiedFor === "sub_1");
  await deleted("sub_1");
  ok("a replayed webhook sends nothing more", cancelledLetters().length === 1);
  ok("…and never touched the other company's guard", harness.db.t.subscription.find((s) => s.id === "sB").cancellationNotifiedFor === null);
  const guardWrites = harness.db.calls.filter((c) => c.model === "subscription" && c.op === "updateMany" && JSON.stringify(c.where).includes("cancellationNotifiedFor"));
  ok("every claim on the guard is fenced to the company", guardWrites.length > 0 && guardWrites.every((c) => c.where.companyId === "A"), guardWrites.map((c) => c.where));

  // Cancel → resubscribe (a NEW Stripe subscription) → cancel: two letters.
  const row = harness.db.t.subscription.find((s) => s.id === "sA");
  Object.assign(row, { stripeSubscriptionId: "sub_2", status: "trialing", canceledAt: null });
  await cancel();
  await deleted("sub_2");
  ok("cancel → resubscribe → cancel: the second cancellation gets its own letter (two in all)", cancelledLetters().length === 2, harness.sent.map((m) => m.subject));

  // The webhook arriving FIRST (the route's call then sends nothing).
  setup({ subId: "sub_3" });
  await deleted("sub_3");
  await notifyCancellation("A", null, { atPeriodEnd: false });
  ok("webhook first, route second: still one letter", cancelledLetters().length === 1);

  // A send that fails releases the claim, so the next caller sends.
  setup({ subId: "sub_4" });
  harness.failFor.add("a@alpha.ca");
  const failed = await notifyCancellation("A", null, { atPeriodEnd: false });
  ok("Resend refused: nothing sent, and the guard is put back", !failed.sent && harness.db.t.subscription.find((s) => s.id === "sA").cancellationNotifiedFor === null, failed);
  harness.failFor.clear();
  await deleted("sub_4");
  ok("…so the webhook's attempt then sends it", cancelledLetters().length === 1);

  // A paid plan: booked end now, the ended letter on the date — two different
  // letters for two different events, and a second press books nothing new.
  setup({ subId: "sub_5", status: "active" });
  const booked = await cancel();
  ok("paid plan: the route books the end (atPeriodEnd)", (await booked.json()).atPeriodEnd === true);
  ok("…and sends 'ends on {date}'", harness.sent.length === 1 && /ends on/.test(harness.sent[0].subject), harness.sent.map((m) => m.subject));
  Object.assign(harness.db.t.subscription.find((s) => s.id === "sA"), { status: "canceled" });
  await deleted("sub_5");
  ok("…and on the date, the webhook's 'has been cancelled' (a different event) goes once", harness.sent.length === 2 && harness.sent[1].subject === "Your FieldQuo plan has been cancelled");

  // FieldQuo ended it: the letter would offer Resume, which is refused.
  setup({ subId: "sub_6", extra: { accessLockedAt: new Date() } });
  await deleted("sub_6");
  ok("locked by FieldQuo for a terms breach: no 'press Resume' letter", harness.sent.length === 0);
  setup({ subId: "sub_7", company: { platformEndsAt: new Date(), platformEndMode: "now" } });
  const r7 = await notifyCancellation("A", null, { atPeriodEnd: false });
  ok("ended by FieldQuo from the console: none either", harness.sent.length === 0 && r7.reason === "ended_by_fieldquo", r7);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 4. The referral month, told once ────────────────────────────");
{
  const { notifyReferralReward, buildReferralRewardEmail } = await import("@/lib/referrals/rewardEmail");
  const { grantRefereeBonus } = await import("@/lib/referrals");
  const { ACCOUNT_NOTICE_COPY, ACCOUNT_NOTICE_KEYS } = await import("@/lib/i18n/accountNoticeCopy");

  ok(`account notices exist in every app catalogue language`, APP_LANGS.every((l) => ACCOUNT_NOTICE_COPY[l]));
  for (const lang of APP_LANGS) {
    const dict = ACCOUNT_NOTICE_COPY[lang] || {};
    const missing = ACCOUNT_NOTICE_KEYS.filter((k) => typeof dict[k] !== "string" || !dict[k].trim());
    const wrong = ACCOUNT_NOTICE_KEYS.filter((k) => dict[k] && placeholders(dict[k]) !== placeholders(ACCOUNT_NOTICE_COPY.en[k]));
    ok(`${lang}: every account-notice sentence, with the English placeholders`, missing.length === 0 && wrong.length === 0, { missing, wrong });
  }

  const until = new Date("2026-12-14T12:00:00Z");
  const seed = (credit, company = {}) =>
    resetHarness({
      tables: {
        company: [
          { id: "R", name: "Roy Painting", email: "office@roy.ca", defaultLanguage: "en", ...company },
          { id: "N", name: "New Floors", email: "hi@newfloors.ca", defaultLanguage: "en" },
        ],
        referralCredit: [{ id: "rc1", companyId: "R", counterpartyCompanyId: "N", role: "referrer", months: 1, appliedTrialEndsAt: until, notifiedAt: null, ...credit }],
        member: [{ id: "m1", companyId: "R", userId: "u1", role: "owner", createdAt: new Date("2026-01-01") }],
        user: [{ id: "u1", email: "owner@roy.ca", language: null }],
      },
      relations: RELATIONS,
    });

  seed({});
  const first = await notifyReferralReward({ creditId: "rc1", via: "subscription", origin: "https://www.fieldquo.com" });
  ok("referrer: the letter goes when the month landed", first.sent && harness.sent.length === 1 && harness.sent[0].subject === "You earned a free month of FieldQuo", first);
  ok("…to the company, naming the business that paid and the new charge date", harness.sent[0].to === "office@roy.ca" && harness.sent[0].html.includes("New Floors") && harness.sent[0].html.includes("Dec 14, 2026"));
  ok("…with a button to Refer & Earn", harness.sent[0].html.includes("https://www.fieldquo.com/app/settings/refer"));
  ok("…and stamped once", harness.db.t.referralCredit[0].notifiedAt instanceof Date);
  const again = await notifyReferralReward({ creditId: "rc1", via: "subscription" });
  ok("a second call for the same reward sends nothing", !again.sent && harness.sent.length === 1, again);

  seed({ appliedTrialEndsAt: null });
  const notApplied = await notifyReferralReward({ creditId: "rc1" });
  ok("a month that did NOT land is never announced", !notApplied.sent && notApplied.reason === "not_applied" && harness.sent.length === 0);

  seed({});
  harness.failFor.add("office@roy.ca");
  const rejected = await notifyReferralReward({ creditId: "rc1" });
  ok("Resend refused: not stamped, so it is told on the next try", !rejected.sent && harness.db.t.referralCredit[0].notifiedAt === null);
  harness.failFor.clear();
  ok("…and the next try sends", (await notifyReferralReward({ creditId: "rc1" })).sent && harness.sent.length === 1);

  seed({}, { email: "owner@example.com" });
  ok("a reserved test address is skipped", (await notifyReferralReward({ creditId: "rc1" })).reason === "test_address" && harness.sent.length === 0);
  seed({}, { platformEndsAt: new Date() });
  ok("a company FieldQuo ended is not told about a month it cannot use", (await notifyReferralReward({ creditId: "rc1" })).reason === "ended_by_fieldquo");

  const referee = buildReferralRewardEmail({ role: "referred", companyName: "New Floors", counterpartyName: "Roy Painting", until, via: "subscription", language: "fr", origin: "https://x.test" });
  ok("newcomer (French): its own letter — the referrer's link, the moved first charge, a link to the plan", referee.subject === "Votre mois gratuit de FieldQuo est appliqué" && referee.html.includes("Roy Painting") && referee.html.includes("premier prélèvement") && referee.html.includes("https://x.test/app/settings/account-billing"), referee.subject);
  const trialVia = buildReferralRewardEmail({ role: "referrer", companyName: "Roy", counterpartyName: "N", until, via: "trial", language: "en" });
  ok("a grandfathered trial extension says the trial now runs to the date", trialVia.html.includes("your free trial now runs to"));
  for (const lang of APP_LANGS) {
    const m = buildReferralRewardEmail({ role: "referrer", companyName: "Roy", counterpartyName: "N", until, language: lang });
    ok(`${lang}: the referrer letter renders complete`, !/\{\w+\}|undefined/.test(m.subject + m.html));
  }

  // The real grant path: the newcomer chooses a plan, the month lands on its
  // Stripe trial_end, and the letter goes from inside claimAndExtend.
  const periodEnd = Math.floor(new Date("2026-11-20T00:00:00Z").getTime() / 1000);
  resetHarness({
    tables: {
      company: [
        { id: "NEW", name: "New Floors", email: "hi@newfloors.ca", defaultLanguage: "es", referredByCode: "roypainting", referralTerms: "plan_required_month_promised", trialEndsAt: null },
        { id: "REF", name: "Roy Painting", email: "office@roy.ca", referralCode: "roypainting", defaultLanguage: "en" },
      ],
      subscription: [{ id: "sN", companyId: "NEW", stripeSubscriptionId: "sub_new", status: "trialing", currentPeriodEnd: new Date(periodEnd * 1000) }],
      referralCredit: [],
      member: [],
      user: [],
    },
    relations: RELATIONS,
    stripe: {
      subscriptions: {
        retrieve: async (id) => ({ id, status: "trialing", current_period_end: periodEnd, items: { data: [{ current_period_end: periodEnd }] } }),
        update: async (id, p) => (harness.stripeCalls.push(["update", id, p]), { id, status: "trialing", current_period_end: p.trial_end, trial_end: p.trial_end, items: { data: [] } }),
      },
    },
  });
  // The table's @@unique([companyId, role, counterpartyCompanyId]) is what
  // makes a grant happen once (claimAndExtend's claim). FakePrisma does not
  // model uniques, so the constraint is modelled here, the way Postgres
  // answers it: P2002.
  const createCredit = harness.db.referralCredit.create;
  harness.db.referralCredit.create = async (args) => {
    const d = args.data;
    if (harness.db.t.referralCredit.some((r) => r.companyId === d.companyId && r.role === d.role && r.counterpartyCompanyId === d.counterpartyCompanyId)) {
      throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    }
    return createCredit(args);
  };
  const granted = await grantRefereeBonus("NEW");
  ok("grantRefereeBonus (real): the month landed on Stripe", granted && harness.stripeCalls.some((c) => c[0] === "update" && c[1] === "sub_new"), granted);
  ok("…and the newcomer was told, once, in its language (Spanish)", harness.sent.length === 1 && harness.sent[0].to === "hi@newfloors.ca" && harness.sent[0].subject === "Su mes gratis de FieldQuo está aplicado", harness.sent.map((m) => m.subject));
  await grantRefereeBonus("NEW").catch(() => null);
  ok("a replay of the grant sends nothing more", harness.sent.length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 5. AI credit running low, once per crossing ─────────────────");
{
  const { debitCredit, addCredit, AI_CREDIT_LOW_CENTS, isAiCreditLow } = await import("@/lib/voice/credits");
  const { aiCreditLowDecision, buildAiCreditLowEmail } = await import("@/lib/ai/creditLow");
  ok("the threshold is $5 (500 US cents) and below it is low", AI_CREDIT_LOW_CENTS === 500 && isAiCreditLow(499) && !isAiCreditLow(500));

  const decisions = [
    [{ event: "debit", kind: "ai_employee_reply", balanceCents: 450, notifiedAt: null }, "send"],
    [{ event: "debit", kind: "image_generation", balanceCents: -20, notifiedAt: null }, "send"],
    [{ event: "debit", kind: "ai_employee_reply", balanceCents: 450, notifiedAt: new Date() }, "none"],
    [{ event: "debit", kind: "ai_employee_reply", balanceCents: 500, notifiedAt: null }, "none"],
    [{ event: "debit", kind: "ai_plan_expiry", balanceCents: 100, notifiedAt: null }, "none"],
    [{ event: "credit", kind: "ai_topup", balanceCents: 2500, notifiedAt: new Date() }, "rearm"],
    [{ event: "credit", kind: "ai_topup", balanceCents: 300, notifiedAt: new Date() }, "none"],
    [{ event: "credit", kind: "ai_bundle", balanceCents: 5000, notifiedAt: null }, "none"],
  ];
  for (const [input, action] of decisions) ok(`decision: ${input.event} ${input.kind} → ${input.balanceCents}¢, stamped ${Boolean(input.notifiedAt)} → ${action}`, aiCreditLowDecision(input).action === action, aiCreditLowDecision(input));

  const seed = () =>
    resetHarness({
      tables: {
        company: [
          { id: "C", name: "Roy Painting", defaultLanguage: "en", aiCreditLowNotifiedAt: null, platformEndsAt: null },
          { id: "OTHER", name: "Other", defaultLanguage: "en", aiCreditLowNotifiedAt: null },
        ],
        voiceCreditEntry: [
          { id: "e1", companyId: "C", cents: 600, kind: "ai_topup", pool: "ai" },
          { id: "e2", companyId: "C", cents: 9000, kind: "topup", pool: "voice" },
          { id: "e3", companyId: "OTHER", cents: 100, kind: "ai_topup", pool: "ai" },
        ],
        member: [
          { id: "m1", companyId: "C", userId: "u1", role: "owner", active: true },
          { id: "m2", companyId: "C", userId: "u2", role: "admin", active: true },
          { id: "m3", companyId: "C", userId: "u3", role: "employee", active: true },
          { id: "m4", companyId: "C", userId: "u4", role: "admin", active: false },
          { id: "m5", companyId: "OTHER", userId: "u5", role: "owner", active: true },
        ],
        user: [
          { id: "u1", email: "owner@roy.ca", language: null },
          { id: "u2", email: "admin@roy.ca", language: "fr" },
          { id: "u3", email: "crew@roy.ca", language: null },
          { id: "u4", email: "gone@roy.ca", language: null },
          { id: "u5", email: "owner@other.ca", language: null },
        ],
      },
      relations: RELATIONS,
    });

  seed();
  await debitCredit({ companyId: "C", cents: 50, kind: "ai_employee_reply", ref: "r1" });
  ok("$6.00 → $5.50: still above $5, nothing sent", harness.sent.length === 0);
  await debitCredit({ companyId: "C", cents: 80, kind: "ai_employee_reply", ref: "r2" });
  ok("$5.50 → $4.70: crossed — the owner AND the admin are told; not the crew, not an inactive admin", harness.sent.map((m) => m.to).sort().join() === "admin@roy.ca,owner@roy.ca", harness.sent.map((m) => m.to));
  const toAdmin = harness.sent.find((m) => m.to === "admin@roy.ca");
  ok("…each in their own language (the admin chose French)", toAdmin?.subject === "Votre crédit IA FieldQuo est presque épuisé" && harness.sent.find((m) => m.to === "owner@roy.ca")?.subject === "Your FieldQuo AI credit is running low");
  ok("…with the balance and a link to top up", harness.sent.find((m) => m.to === "owner@roy.ca").html.includes("US$4.70") && harness.sent[0].html.includes("/app/settings/ai-credit"), harness.sent.find((m) => m.to === "owner@roy.ca").html.match(/has <strong>[^<]+/)?.[0]);
  ok("…and nobody at the other company", !harness.sent.some((m) => /other\.ca/.test(m.to)));
  await debitCredit({ companyId: "C", cents: 100, kind: "image_generation", ref: "r3" });
  await debitCredit({ companyId: "C", cents: 100, kind: "material_list", ref: "r4" });
  ok("further charges below $5 send nothing more", harness.sent.length === 2);
  await addCredit({ companyId: "C", cents: 200, kind: "ai_topup", stripeRef: "pi_small" });
  await debitCredit({ companyId: "C", cents: 10, kind: "ai_employee_reply", ref: "r5" });
  ok("a top-up that leaves it under $5 does not re-arm", harness.sent.length === 2);
  await addCredit({ companyId: "C", cents: 3000, kind: "ai_topup", stripeRef: "pi_big" });
  ok("a top-up back over $5 re-arms the letter", harness.db.t.company.find((c) => c.id === "C").aiCreditLowNotifiedAt === null);
  await debitCredit({ companyId: "C", cents: 3200, kind: "ai_employee_reply", ref: "r6" });
  ok("…and the next crossing sends it again (four letters in all: two people, twice)", harness.sent.length === 4, harness.sent.length);
  ok("the ledger reads were all fenced to the company", harness.db.calls.filter((c) => c.model === "voiceCreditEntry" && c.op === "aggregate").every((c) => c.where.companyId === "C" && c.where.pool === "ai"));

  seed();
  await debitCredit({ companyId: "C", cents: 200, kind: "ai_plan_expiry", ref: "x1" });
  ok("a plan's month-end expiry taking it under $5 sends nothing (not spending)", harness.sent.length === 0);
  await debitCredit({ companyId: "C", cents: 5, kind: "ai_employee_reply", ref: "x2" });
  ok("…the next real charge, still under $5, does", harness.sent.length === 2);

  seed();
  await debitCredit({ companyId: "C", cents: 9000, kind: "call", ref: "v1" });
  ok("a PHONE charge never reads the AI wallet or sends", harness.sent.length === 0 && !harness.db.calls.some((c) => c.op === "aggregate"));

  seed();
  harness.failFor.add("owner@roy.ca");
  harness.failFor.add("admin@roy.ca");
  await debitCredit({ companyId: "C", cents: 200, kind: "ai_employee_reply", ref: "f1" });
  ok("every send refused: the stamp is put back, so the next charge tries again", harness.db.t.company.find((c) => c.id === "C").aiCreditLowNotifiedAt === null);
  harness.failFor.clear();
  await debitCredit({ companyId: "C", cents: 1, kind: "ai_employee_reply", ref: "f2" });
  ok("…and it does", harness.sent.length === 2);

  for (const lang of APP_LANGS) {
    const m = buildAiCreditLowEmail({ companyName: "Roy", balanceCents: 312, language: lang, origin: "https://x.test" });
    ok(`${lang}: the AI credit letter renders complete, with its top-up link`, !/\{\w+\}|undefined/.test(m.subject + m.html) && m.html.includes("https://x.test/app/settings/ai-credit"));
  }
  ok("an overdrawn wallet prints nothing left, never a negative", buildAiCreditLowEmail({ companyName: "Roy", balanceCents: -40 }).html.includes("US$0.00"));
  const jen = stripComments(read("lib/ai/jennifer/tools.js"));
  ok("the assistant's 'low' and the email's are the same rule (isAiCreditLow)", /isAiCreditLow\(cents\)/.test(jen) && !/<\s*500\b|= 500;/.test(jen));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 6. The client's approval email ──────────────────────────────");
{
  const { buildQuoteApprovedEmail } = await import("@/lib/email/quoteApprovedEmail");
  const { documentTheme, fillPair } = await import("@/lib/documents/theme");
  const { contrastRatio } = await import("@/lib/brand/colour");
  const { CLIENT_DOC_COPY } = await import("@/lib/i18n/clientDocCopy");
  const { LANGUAGE_CODES } = await import("@/app/i18n/languages");

  const company = { name: "Roy Painting", logoUrl: "https://res.cloudinary.com/roy/logo.png", brandColor: "#f7e017", email: "office@roy.ca", phone: "613-555-0100", website: "roypainting.ca", currency: "CAD", taxIdName: "GST", taxIdNumber: "123" };
  const args = { quote: { quoteNumber: "Q-1042" }, company, client: { name: "Maureen Clark" }, language: "en", quoteUrl: "https://app.roy.test/q/tok123", portalUrl: "https://app.roy.test/portal/ptok", total: 4520.5 };
  const m = buildQuoteApprovedEmail(args);
  ok("subject unchanged in shape: 'Approved — thank you — Q-1042'", m.subject === "Approved — thank you — Q-1042", m.subject);
  ok("the contractor's logo is in the band", m.html.includes('src="https://res.cloudinary.com/roy/logo.png"'));
  ok("the brand colour fills the band (measured fill)", m.html.includes(fillPair(documentTheme(company)).bg));
  ok("a button back to the quote they approved", /href="https:\/\/app\.roy\.test\/q\/tok123"[^>]*>View your approved quote</.test(m.html));
  ok("the client's own portal line", m.html.includes('href="https://app.roy.test/portal/ptok"') && m.html.includes("Your account with Roy Painting"));
  ok("what happens next: they'll be in touch about scheduling", m.html.includes("Roy Painting will be in touch about scheduling the work."));
  ok("the approved total, in the company's currency", m.html.includes("4,520.50"), m.html.match(/\$[\d,.]+/)?.[0]);
  ok("the signed-copy sentence is still there (the PDF rides along)", m.html.includes("A copy is attached for your records."));
  ok("the text part carries the same: quote link, portal link, scheduling", m.text.includes("https://app.roy.test/q/tok123") && m.text.includes("https://app.roy.test/portal/ptok") && m.text.includes("scheduling"));
  ok("white-label: no FieldQuo anywhere in the HTML or the text", !/fieldquo/i.test(m.html + m.text + m.subject));
  const noPortal = buildQuoteApprovedEmail({ ...args, portalUrl: null, total: null });
  ok("no portal → no account line; no total → no amount block (nothing invented)", !noPortal.html.includes("/portal/") && !noPortal.html.includes("4,520"));
  const noLogo = buildQuoteApprovedEmail({ ...args, company: { ...company, logoUrl: null } });
  ok("no logo → the company's name in the band, not an empty image", !noLogo.html.includes("<img") && noLogo.html.includes(">Roy Painting<"));
  const hostileName = buildQuoteApprovedEmail({ ...args, client: { name: '<script>x</script>' }, company: { ...company, name: 'Roy & "Sons" <b>' } });
  ok("hostile client and company names are escaped", !hostileName.html.includes("<script>") && !hostileName.html.includes("<b>") && hostileName.html.includes("&lt;script&gt;"));
  ok("a javascript: link is never drawn as the button", !buildQuoteApprovedEmail({ ...args, quoteUrl: "javascript:alert(1)", portalUrl: "javascript:x" }).html.includes("javascript:"));

  // Every client document language: the new sentences exist and render.
  for (const lang of LANGUAGE_CODES) {
    const copy = CLIENT_DOC_COPY[lang];
    ok(`${lang}: approvedScheduling and approvedViewQuote exist`, typeof copy?.approvedScheduling === "function" && typeof copy?.approvedViewQuote === "string" && copy.approvedViewQuote.trim().length > 0);
    const out = buildQuoteApprovedEmail({ ...args, language: lang });
    ok(`${lang}: renders in that language with no FieldQuo, nothing unfilled`, out.html.includes(copy.approvedViewQuote) && out.html.includes(copy.approvedScheduling("Roy Painting")) && !/fieldquo|undefined|\$\{/i.test(out.html + out.text));
    if (lang !== "en") ok(`${lang}: the scheduling line is translated`, copy.approvedScheduling("X") !== CLIENT_DOC_COPY.en.approvedScheduling("X"));
  }
  ok("no company name: the scheduling line stands in the contractor's own voice", !CLIENT_DOC_COPY.en.approvedScheduling("").includes("undefined") && CLIENT_DOC_COPY.en.approvedScheduling("").startsWith("We"));

  // Contrast, measured, on the brand colours contractors actually pick.
  const HOSTILE = ["#ffffff", "#f7e017", "#808080", "#ff69b4", "#ff6a13", "#0b0b0b", "#06356b", "#7fff00", "#00ffff"];
  const shortfalls = [];
  for (const brand of HOSTILE) {
    const t = documentTheme({ brandColor: brand });
    const fill = fillPair(t);
    const pairs = [
      ["band text / button label on the brand fill", fill.fg, fill.bg],
      ["body ink on white", t.ink, "#ffffff"],
      ["intro + account line (inkMuted) on white", t.inkMuted, "#ffffff"],
      ["footer note on the wash", t.inkMutedOnWash, t.accentWash],
      ["footer name on the wash", t.inkOnWash, t.accentWash],
    ];
    for (const [what, fg, bg] of pairs) {
      const r = contrastRatio(fg, bg);
      if (!(r >= 4.5)) shortfalls.push(`${brand} ${what}: ${r.toFixed(2)}`);
    }
  }
  ok(`every text/background pair in the approval email is ≥ 4.5:1 on ${HOSTILE.length} hostile brands`, shortfalls.length === 0, shortfalls);
  // …and the email uses ONLY those measured inks: every `color:` in the
  // rendered HTML must be one of them (plus the amount figure, measured
  // against the wash by amountBlock itself). A hand-picked grey fails here.
  const { ensureContrast } = await import("@/lib/brand/colour");
  const strays = [];
  for (const brand of HOSTILE) {
    const t = documentTheme({ brandColor: brand });
    const fill = fillPair(t);
    const figure = ensureContrast(t.accentText, t.accentWash, 4.5);
    if (contrastRatio(figure, t.accentWash) < 4.5) strays.push(`${brand} figure ${contrastRatio(figure, t.accentWash).toFixed(2)}`);
    const allowed = new Set([fill.fg, t.ink, t.inkMuted, t.inkMutedOnWash, t.inkOnWash, figure].map((c) => c.toLowerCase()));
    const html = buildQuoteApprovedEmail({ ...args, company: { ...company, brandColor: brand } }).html;
    for (const [, c] of html.matchAll(/(?:^|[;"\s])color:\s*(#[0-9a-fA-F]{6})/g)) if (!allowed.has(c.toLowerCase())) strays.push(`${brand}: ${c}`);
  }
  ok("every ink in the approval email is one of the measured ones", strays.length === 0, [...new Set(strays)]);

  const route = stripComments(read("app/api/public/quotes/[token]/route.js"));
  ok("the route builds the client's copy with buildQuoteApprovedEmail", /buildQuoteApprovedEmail\(\{/.test(route));
  ok("…still attaches the signed PDF", /subject: signedSubject,\s*html,\s*text,\s*attachments,/.test(route));
  ok("…in the quote's language (resolveClientLanguage, passed as `language`)", /resolveClientLanguage\(\{\s*document: quote/.test(route) && /buildQuoteApprovedEmail\(\{[\s\S]*?language,/.test(route));
  ok("…mints the portal token scoped to the quote's own company", /ensurePortalToken\(db, quote\.clientId, updated\.companyId\)/.test(route));
  ok("…the old four-paragraph body is gone", !/approvedCopyIntro\(companyName\)\)\}<\/p>/.test(route));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n── 7. Win-back and product updates (content + selection only) ──");
{
  const { winBackDecision, winBackContent, updatesSince, WIN_BACK_AFTER_DAYS } = await import("@/lib/lifecycle/winBack");
  const { newsletterIssue, newsletterDecision, newsletterContent } = await import("@/lib/lifecycle/productNewsletter");
  const canceledAt = new Date("2026-09-10T12:00:00Z");
  const sub = { status: "canceled", canceledAt, stripeSubscriptionId: "sub_x", accessLockedAt: null };
  const co = { isDemo: false, platformEndsAt: null };
  const at = (days) => new Date(canceledAt.getTime() + days * DAY);
  const wb = (o = {}) => winBackDecision({ company: co, subscription: sub, to: "office@roy.ca", now: at(15), ...o });
  ok(`win-back: due ${WIN_BACK_AFTER_DAYS} days after the cancellation took effect`, wb().send && !wb({ now: at(13.9) }).send && wb({ now: at(13.9) }).reason === "not_yet");
  ok("win-back: not once the read-only month is over (its date sentence would be false)", wb({ now: at(30) }).reason === "window_passed" && wb({ now: at(29.9) }).send);
  ok("win-back: the read-only-until date is cancellation + 30 days", wb().readOnlyUntil?.toISOString() === at(30).toISOString());
  ok("win-back: once per cancellation (keyed on the ended subscription)", wb({ lastSentFor: "sub_x" }).reason === "already_sent" && wb({ lastSentFor: "sub_old" }).send);
  ok("win-back: never a company that came back", wb({ subscription: { ...sub, status: "active" } }).reason === "not_cancelled");
  ok("win-back: never demo / FieldQuo-ended / locked", wb({ company: { ...co, isDemo: true } }).reason === "demo" && wb({ company: { ...co, platformEndsAt: new Date() } }).reason === "ended_by_fieldquo" && wb({ subscription: { ...sub, accessLockedAt: new Date() } }).reason === "ended_by_fieldquo");
  ok("win-back: never do-not-contact, unsubscribed or a test address", wb({ suppressed: true }).reason === "do_not_contact" && wb({ unsubscribed: true }).reason === "unsubscribed" && wb({ to: "x@example.com" }).reason === "test_address");
  ok("win-back: a trial that ran out is not a cancellation", winBackDecision({ company: co, subscription: null, to: "a@b.ca", now: at(15) }).reason === "not_cancelled");
  const since = updatesSince(new Date("2026-09-01T00:00:00Z"), { now: new Date("2026-10-01T00:00:00Z") });
  ok("updates since a date are the real changelog entries after it (one: 2026-09-24)", since.length === 1 && since[0].date === "2026-09-24");
  for (const lang of APP_LANGS) {
    const content = winBackContent({ companyName: "Roy", readOnlyUntil: at(30), canceledAt: new Date("2026-09-01"), language: lang, origin: "https://x.test", now: new Date("2026-10-01") });
    const flat = JSON.stringify(content);
    ok(`${lang}: win-back content complete — no placeholder, a plan button, the changelog entry`, !/\{\w+\}|undefined/.test(flat) && content.cta.url === "https://x.test/app/settings/account-billing" && content.updates.length === 1);
  }
  ok("win-back with nothing shipped since: no 'new since you left' section at all", winBackContent({ companyName: "R", readOnlyUntil: at(30), canceledAt: new Date("2026-09-30"), now: new Date("2026-10-10") }).updatesTitle === null);

  const sep = newsletterIssue(new Date("2026-09-15T00:00:00Z"));
  ok("newsletter: September 2026's issue is the one entry shipped that month", sep?.key === "2026-09" && sep.entries.length === 1);
  ok("newsletter: a month with nothing shipped has NO issue (no filler)", newsletterIssue(new Date("2026-08-10T00:00:00Z")) === null);
  ok("newsletter: July 2026 has its two entries, newest first", newsletterIssue(new Date("2026-07-02"))?.entries.map((e) => e.date).join() === "2026-07-21,2026-07-18");
  const NOW = new Date("2026-10-01T09:00:00Z");
  const nd = (o = {}) => newsletterDecision({ company: { isDemo: false, platformEndsAt: null, subscription: { status: "active" } }, issueKey: "2026-09", to: "office@roy.ca", now: NOW, ...o });
  ok("newsletter: a paying customer gets it", nd().send);
  ok("newsletter: a running card-free trial gets it", nd({ company: { isDemo: false, trialEndsAt: new Date("2026-10-09"), subscription: null } }).send);
  ok("newsletter: once per issue", nd({ lastIssueKey: "2026-09" }).reason === "already_sent" && nd({ lastIssueKey: "2026-08" }).send);
  ok("newsletter: not cancelled, expired-trial, demo, ended, unsubscribed or do-not-contact", nd({ company: { subscription: { status: "canceled", canceledAt: new Date("2026-09-20") } } }).reason === "not_a_customer" && nd({ company: { trialEndsAt: new Date("2026-09-20"), subscription: null } }).reason === "not_a_customer" && nd({ company: { isDemo: true, subscription: { status: "active" } } }).reason === "demo" && nd({ company: { platformEndsAt: new Date("2026-09-01"), subscription: null } }).reason === "ended_by_fieldquo" && nd({ unsubscribed: true }).reason === "unsubscribed" && nd({ suppressed: true }).reason === "do_not_contact");
  for (const lang of APP_LANGS) {
    const c = newsletterContent({ issue: sep, language: lang, origin: "https://x.test" });
    ok(`${lang}: newsletter content complete, linking the full post`, !/\{\w+\}|undefined/.test(JSON.stringify(c)) && c.items[0].url === "https://x.test/app/settings/product-updates/services-checklists-client-portal");
  }
  ok("newsletter (fr): the entry in French when its translation is complete", newsletterContent({ issue: sep, language: "fr" }).items[0].title.startsWith("Services et modèles"));
  const july = newsletterIssue(new Date("2026-07-02"));
  ok("newsletter (fr, an entry with no translation): the English entry whole, never half", newsletterContent({ issue: july, language: "fr" }).items.every((i, n) => i.title === july.entries[n].title && i.body === july.entries[n].body));

  // Not wired: nothing sends either letter, and no control renders for them.
  const { execSync } = await import("node:child_process");
  // git grep exits 1 on "no match", which is the answer wanted here.
  let users = "";
  try {
    users = execSync("git grep -l -e '@/lib/lifecycle/winBack' -e '@/lib/lifecycle/productNewsletter' -- app lib", { encoding: "utf8" }).trim();
  } catch (err) {
    users = err.status === 1 ? "" : `git grep failed: ${err.message}`;
  }
  ok("nothing in app/ or lib/ imports the win-back or newsletter yet (they wait on preferences)", users === "", users);
  ok("ROADMAP says they wait on the preferences system", /win-back[\s\S]{0,400}preferences/i.test(read("docs/ROADMAP.md")));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
