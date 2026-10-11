// scripts/check-lifecycle-emails.mjs
//
//   npm run check:lifecycle-emails
//
// The trial sequence (lib/lifecycle/), the email preferences (lib/email/
// preferences*.js) and their copy (lib/i18n/lifecycleEmailCopy.js) — executed
// against a stub database that records every query and REFUSES any read of a
// company other than the one being processed, and a stub sender that records
// what would have gone out. No real email is sent by this check.
//
// What it proves:
//   1. The copy: nine languages, every key, the same {placeholders}, none a
//      silent copy of the English.
//   2. The plan, simulated hour by hour over a whole trial: never two
//      lifecycle emails on one local day (the next-steps letter and the 7/3/1
//      reminders included), only inside 09:00–18:00 local, the documented
//      calendar for a company that does nothing — printed, so
//      docs/ONBOARDING-EMAILS.md can be checked against it.
//   3. A done step suppresses its nudge (checked fresh, after the claim too).
//   4. The do-not-contact list suppresses; a failed read fails closed.
//   5. "Tips" switched off suppresses the tips letters, never the
//      transactional trial-ended one.
//   6. Idempotency: one row per (company, kind); a second run sends nothing.
//   7. A foreign company is never read.
//   8. The personal note never goes without a named sender; the help letter
//      links only real articles; stories are never invented.
//   9. The trial-ended letter states the lock date lib/billing/access.js uses.
//  10. The cron is wired: vercel.json, requireCronSecret, the reminder hour.
//  11. Mutation-tested.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-lifecycle-emails.mjs
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { LIFECYCLE_COPY, LIFECYCLE_COPY_KEYS, LIFECYCLE_LANGUAGES, lifecycleT, labelled } from "@/lib/i18n/lifecycleEmailCopy";
import {
  planLifecycle,
  localParts,
  daysBetween,
  nextTrialReminderRun,
  trialLockAt,
  LIFECYCLE_KINDS,
  TRIAL_REMINDER_RUN_UTC_HOUR,
  SCHEDULE,
  safeTimeZone,
} from "@/lib/lifecycle/plan";
import { runLifecycleForCompany, fromWithName, nextStepsPendingUntil } from "@/lib/lifecycle/run";
import { buildFeatureNudge, buildMilestoneEmail, buildPersonalEmail, buildHelpEmail, buildTrialEndedEmail, localDay, HERO_IMAGES } from "@/lib/lifecycle/emails";
import { pickHelpArticles, FEATURE_ARTICLES, TRADE_ARTICLES, GENERAL_ARTICLES } from "@/lib/lifecycle/helpArticles";
import { normalisePersonalSender, personalSenderReady, validatePersonalSender, normaliseStories, validateStories, storiesFor, STORY_TRADES } from "@/lib/lifecycle/settings";
import { resolvePreferences, categoryAllowed, validatePreferencePatch, oneClickCategory, maskEmail, plausibleToken, preferencesUrls } from "@/lib/email/preferences";
import { IMPORT_SAME_SECOND_MIN } from "@/lib/lifecycle/facts";
import { trialReminderDecision } from "@/lib/billing/trialReminder";
import { trialAccessFor, GRACE_DAYS } from "@/lib/billing/access";
import { articleMeta } from "@/lib/help/tree";

let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else fails.push(label);
};
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};
const HOUR = 3600e3;
const DAY = 24 * HOUR;
const ORIGIN = "https://www.fieldquo.com";
const ADDRESS = "FieldQuo, 123 Example St, Toronto ON M5V 1A1, Canada";
const FOOTER = { mailingAddress: ADDRESS, unsubscribeUrl: `${ORIGIN}/email-preferences/T?c=tips`, preferencesUrl: `${ORIGIN}/email-preferences/T`, oneClickUrl: `${ORIGIN}/api/email-preferences/T/unsubscribe?c=tips` };

// ═══ 1. The copy ═══════════════════════════════════════════════════════════
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
// Words that are legitimately the same as the English in that language.
const SAME_AS_ENGLISH = new Set(["*:layout.logoAlt", "tl:personal.greetingNamed", "tl:personal.greeting"]);
for (const lang of LIFECYCLE_LANGUAGES) {
  const dict = LIFECYCLE_COPY[lang];
  ok(Boolean(dict), `${lang}: a dictionary exists`);
  for (const key of LIFECYCLE_COPY_KEYS) {
    const v = dict?.[key];
    ok(typeof v === "string" && v.trim().length > 0, `${lang}: ${key} is written`);
    ok(placeholders(v) === placeholders(LIFECYCLE_COPY.en[key]), `${lang}: ${key} has the English placeholders`);
    if (lang !== "en" && !SAME_AS_ENGLISH.has(`*:${key}`) && !SAME_AS_ENGLISH.has(`${lang}:${key}`)) {
      ok(v !== LIFECYCLE_COPY.en[key], `${lang}: ${key} is not the English copied across`);
    }
  }
  ok(Object.keys(dict || {}).every((k) => LIFECYCLE_COPY_KEYS.includes(k)), `${lang}: no key the English lacks`);
}
ok(LIFECYCLE_LANGUAGES.join(",") === "en,fr,es,it,de,uk,pa,tl,zh", "the nine app languages");
ok(throws(() => lifecycleT("en")("no.such.key")), "an unknown key throws rather than printing the key in an email");
ok(lifecycleT("xx")("layout.help") === "Help", "an unknown language is English");
ok(labelled("fr", "A", "b") === "A : b" && labelled("zh", "A", "b") === "A： b" && labelled("en", "A", "b") === "A: b", "label: value in each typography");

// ═══ 2. The plan, hour by hour over a trial ════════════════════════════════
const created = new Date("2026-10-13T18:20:00Z"); // 14:20 Toronto, a Tuesday
const trialEndsAt = new Date(created.getTime() + 14 * DAY);
function simulate({ facts = {}, factsAt = () => ({}), personalReady = true, tz = "America/Toronto", hours = 17 * 24, createdAt = created, trialEnd = trialEndsAt, hasSubscription = false } = {}) {
  const rows = [];
  const company = { createdAt, timezone: tz, trialEndsAt: trialEnd, hasSubscription, nextStepsEmailSentAt: null, nextStepsEmailSkipped: null, trialReminder7At: null, trialReminder3At: null, trialReminder1At: null };
  const log = [];
  const pending = nextStepsPendingUntil(company, { enabled: true, delayHours: 2 });
  for (let h = 0; h <= hours; h++) {
    const now = new Date(Math.floor(createdAt.getTime() / HOUR) * HOUR + h * HOUR + 40 * 60e3);
    // the next-steps letter, 2 h after signup (cron every 15 min — modelled at the hour)
    if (!company.nextStepsEmailSentAt && now >= new Date(createdAt.getTime() + 2 * HOUR)) {
      company.nextStepsEmailSentAt = now;
      log.push({ at: now, kind: "next_steps_letter" });
    }
    // the 7/3/1 reminders at 09:00 UTC
    if (now.getUTCHours() === TRIAL_REMINDER_RUN_UTC_HOUR) {
      const runAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), TRIAL_REMINDER_RUN_UTC_HOUR));
      const d = trialReminderDecision({ trialEndsAt: company.trialEndsAt, hasSubscription, stamps: company, now: runAt });
      if (d.send) {
        company[d.field] = runAt;
        log.push({ at: runAt, kind: `trial_reminder_${d.days}` });
      }
    }
    const f = { ...facts, ...factsAt(now) };
    const plan = planLifecycle({ now, company, facts: f, rows, personalReady, nextStepsPendingUntil: pending, sequenceStartsAt: new Date("2026-10-01T00:00:00Z") });
    for (const o of plan.observe) rows.push({ kind: o.kind, observedAt: o.at });
    for (const r of plan.record) {
      const row = rows.find((x) => x.kind === r.kind);
      if (row) row.skipped = r.skipped;
      else rows.push({ kind: r.kind, skipped: r.skipped });
    }
    if (plan.send) {
      const row = rows.find((x) => x.kind === plan.send.kind);
      if (row) row.sentAt = now;
      else rows.push({ kind: plan.send.kind, sentAt: now });
      log.push({ at: now, kind: plan.send.kind, dayIndex: plan.dayIndex });
    }
  }
  log.sort((a, b) => a.at - b.at);
  return { log, rows, company };
}
function perDay(log, tz = "America/Toronto", createdAt = created) {
  const start = localParts(createdAt, tz).date;
  return log.map((e) => ({ ...e, day: daysBetween(start, localParts(e.at, tz).date), local: localParts(e.at, tz) }));
}
{
  const { log } = simulate();
  const days = perDay(log);
  const byDay = new Map();
  for (const e of days) byDay.set(e.day, [...(byDay.get(e.day) || []), e.kind]);
  ok([...byDay.values()].every((k) => k.length === 1), `never two lifecycle emails on one local day (${[...byDay.entries()].map(([d, k]) => `d${d}:${k.join("+")}`).join(" ")})`);
  const sequence = days.filter((e) => LIFECYCLE_KINDS.includes(e.kind));
  ok(sequence.every((e) => e.local.hour >= SCHEDULE.sendFromHour && e.local.hour < SCHEDULE.sendToHour), "every sequence email lands between 09:00 and 18:00 local");
  const want = [
    ["next_steps_letter", 0],
    ["feature_payments", 1],
    ["personal_checkin", 3],
    ["feature_booking", 4],
    ["help_articles", 5],
    ["feature_quote", 6],
    ["trial_reminder_7", 8],
    ["feature_import", 9],
    ["trial_reminder_3", 12],
    ["trial_reminder_1", 14],
    ["trial_ended", 15],
  ];
  const got = days.map((e) => [e.kind, e.day]);
  ok(JSON.stringify(got) === JSON.stringify(want), `the do-nothing calendar is the documented one — got ${got.map(([k, d]) => `d${d} ${k}`).join(", ")}`);
  if (process.argv.includes("--print-schedule")) for (const e of days) console.log(`  day ${e.day}  ${e.local.date} ${String(e.local.hour).padStart(2, "0")}:40 local  ${e.kind}`);
}
{
  // Vancouver: the 09:00 UTC reminder is 02:00 local; still one per local day.
  const { log } = simulate({ tz: "America/Vancouver" });
  const days = perDay(log, "America/Vancouver");
  const counts = {};
  for (const e of days) counts[e.day] = (counts[e.day] || 0) + 1;
  ok(Object.values(counts).every((n) => n === 1), "Vancouver: never two on one local day");
  // Berlin: the reminder is 11:00 local, INSIDE the window — the sequence must yield that day.
  const b = perDay(simulate({ tz: "Europe/Berlin" }).log, "Europe/Berlin");
  const bc = {};
  for (const e of b) bc[e.day] = (bc[e.day] || 0) + 1;
  ok(Object.values(bc).every((n) => n === 1), "Berlin (reminder inside the window): never two on one local day");
}
{
  // Everything done from the start: every nudge recorded already_done, none sent; milestones sent the next day.
  const { log, rows } = simulate({ facts: { paymentsDone: true, bookingLive: true, firstQuoteSentAt: new Date(created.getTime() + HOUR), clientsImported: true } });
  ok(!log.some((e) => e.kind.startsWith("feature_")), "all four features done → no feature nudge sent");
  ok(["feature_payments", "feature_booking", "feature_quote", "feature_import"].every((k) => rows.find((r) => r.kind === k)?.skipped === "already_done"), "…each recorded as already_done");
  const ms = perDay(log).filter((e) => e.kind.startsWith("milestone_"));
  ok(ms.length === 3 && ms.every((e) => e.day >= 1), `the three milestones go out, each on a later day than it happened (${ms.map((e) => `d${e.day} ${e.kind}`).join(", ")})`);
}
{
  // Stripe connected on day 2 at noon local: the payments nudge (day 1) went; the milestone follows the next day.
  const at = new Date(created.getTime() + 2 * DAY);
  const { log } = simulate({ factsAt: (now) => ({ paymentsDone: now >= at }) });
  const d = perDay(log);
  const ms = d.find((e) => e.kind === "milestone_payments");
  ok(ms && daysBetween(localParts(at, "America/Toronto").date, ms.local.date) >= 1, "Stripe connected → the milestone letter on a later local day");
  ok(d.filter((e) => e.kind === "feature_payments").length === 1, "the payments nudge went once, before it was done");
}
{
  // Payments done before day 1 → the FIRST nudge is booking, not payments.
  const { log } = simulate({ facts: { paymentsDone: true } });
  const first = log.find((e) => e.kind.startsWith("feature_"));
  ok(first?.kind === "feature_booking", "a done step is skipped and the order adapts (first nudge: booking)");
}
{
  const { log, rows } = simulate({ personalReady: false });
  ok(!log.some((e) => e.kind === "personal_checkin"), "no named sender → no personal note");
  ok(rows.find((r) => r.kind === "personal_checkin")?.skipped === "sender_not_configured", "…recorded as sender_not_configured once its window closes");
}
{
  const { log } = simulate({ hasSubscription: true });
  ok(!log.some((e) => e.kind === "trial_ended" || e.kind.startsWith("trial_reminder")), "a company that chose a plan gets no reminder and no trial-ended letter");
}
{
  // Created before the sequence started: only the trial-ended letter.
  const plan = planLifecycle({ now: new Date(created.getTime() + 2 * DAY + 3 * HOUR), company: { createdAt: created, timezone: "America/Toronto", trialEndsAt }, rows: [], sequenceStartsAt: new Date(created.getTime() + DAY) });
  ok(plan.send === null && plan.reason === "before_sequence_start", "a company older than the sequence gets no day-1 burst");
}
ok(planLifecycle({ company: { isDemo: true, createdAt: created } }).reason === "demo", "a demo is never planned for");
ok(planLifecycle({ company: { platformEndsAt: new Date(), createdAt: created } }).reason === "ended_by_fieldquo", "a company FieldQuo ended is never planned for");
ok(safeTimeZone("Not/AZone") === "America/Toronto" && safeTimeZone(null) === "America/Toronto", "an unreadable time zone is Toronto");
{
  const n = nextTrialReminderRun(new Date("2026-10-14T08:59:00Z"));
  const m = nextTrialReminderRun(new Date("2026-10-14T09:00:00Z"));
  ok(n.toISOString() === "2026-10-14T09:00:00.000Z" && m.toISOString() === "2026-10-15T09:00:00.000Z", "the reminder's next run is the next 09:00 UTC strictly after now");
}
{
  // A claim in flight blocks a second letter; a stale one is retried.
  const now = new Date(created.getTime() + DAY + 3 * HOUR);
  const company = { createdAt: created, timezone: "America/Toronto", trialEndsAt, nextStepsEmailSentAt: created };
  const fresh = planLifecycle({ now, company, rows: [{ kind: "feature_payments", claimedAt: new Date(now.getTime() - 60e3) }], sequenceStartsAt: new Date(0) });
  ok(fresh.send === null && fresh.reason === "claim_in_flight", "a claim in flight → nothing else");
  const stale = planLifecycle({ now, company, rows: [{ kind: "feature_payments", claimedAt: new Date(now.getTime() - 3 * HOUR) }], sequenceStartsAt: new Date(0) });
  ok(stale.send?.kind === "feature_payments", "a stale claim is retried");
  const backoff = planLifecycle({ now, company, rows: [{ kind: "feature_payments", failedAt: new Date(now.getTime() - HOUR) }], sequenceStartsAt: new Date(0) });
  ok(backoff.send?.kind === "feature_booking", "a refused send waits out its backoff while the next letter goes");
}

// ═══ 3–7. The run, against a stub database and a stub sender ═══════════════
function matches(row, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (k === "OR") {
      if (!v.some((w) => matches(row, w))) return false;
      continue;
    }
    const val = row[k];
    if (v === null) {
      if (val !== null && val !== undefined) return false;
    } else if (v instanceof Date) {
      if (!(val instanceof Date) || val.getTime() !== v.getTime()) return false;
    } else if (typeof v === "object") {
      if ("lt" in v && !(val && new Date(val) < v.lt)) return false;
      if ("not" in v && v.not === null && (val === null || val === undefined)) return false;
    } else if (val !== v) return false;
  }
  return true;
}
function makeWorld({ companyId = "c1", user = { id: "u1", email: "owner@acme.ca", name: "Maya Lee", language: null, marketingConsentAt: null }, company = {}, quotes = [], bookable = 0, sameSecond = false, prefRow = null } = {}) {
  const reads = [];
  const target = companyId;
  const guard = (where, what) => {
    const id = where?.companyId ?? where?.id;
    reads.push({ what, id });
    if (id !== undefined && id !== target) throw new Error(`FOREIGN READ of ${id} in ${what}`);
  };
  const state = {
    company: {
      id: companyId, name: "Acme Painting", email: "office@acme.ca", isDemo: false, createdAt: created, timezone: "America/Toronto", defaultLanguage: "en",
      industries: ["painting"], country: "CA", slug: "acme", bookingSlug: null, trialEndsAt, platformEndsAt: null, offerFinancing: false, stripeChargesEnabled: false,
      nextStepsEmailSentAt: created, nextStepsEmailSkipped: null, trialReminder7At: null, trialReminder3At: null, trialReminder1At: null, subscription: null,
      signupLead: { firstName: "Maya", trades: ["painting"] }, ...company,
    },
    lifecycle: [],
    prefs: prefRow ? [{ id: "p1", userId: user.id, token: "T".repeat(43), ...prefRow }] : [],
  };
  const client = {
    company: { findUnique: async ({ where }) => (guard(where, "company.findUnique"), state.company.id === where.id ? { ...state.company } : null) },
    lifecycleEmail: {
      findMany: async ({ where }) => (guard(where, "lifecycleEmail.findMany"), state.lifecycle.filter((r) => matches(r, where)).map((r) => ({ ...r }))),
      create: async ({ data }) => {
        guard(data, "lifecycleEmail.create");
        if (state.lifecycle.some((r) => r.companyId === data.companyId && r.kind === data.kind)) {
          const e = new Error("unique");
          e.code = "P2002";
          throw e;
        }
        state.lifecycle.push({ observedAt: null, claimedAt: null, sentAt: null, skipped: null, failedAt: null, ...data });
        return data;
      },
      updateMany: async ({ where, data }) => {
        guard(where, "lifecycleEmail.updateMany");
        let count = 0;
        for (const r of state.lifecycle) if (matches(r, where)) (Object.assign(r, data), count++);
        return { count };
      },
    },
    availabilitySchedule: { count: async ({ where }) => (guard({ companyId: where.user.memberships.some.companyId }, "availabilitySchedule.count"), bookable) },
    quote: { findFirst: async ({ where }) => (guard(where, "quote.findFirst"), quotes.length ? { sentAt: quotes[0] } : null) },
    $queryRaw: async (strings, ...values) => (guard({ companyId: values[0] }, "$queryRaw"), sameSecond ? [{ hit: 1 }] : []),
    member: { findFirst: async ({ where }) => (guard(where, "member.findFirst"), user ? { user: { ...user } } : null) },
    emailPreference: {
      findUnique: async ({ where }) => state.prefs.find((p) => (where.userId ? p.userId === where.userId : p.token === where.token)) || null,
      create: async ({ data }) => {
        const row = { id: `p${state.prefs.length + 1}`, tips: null, updates: null, offers: null, ...data };
        state.prefs.push(row);
        return row;
      },
      update: async ({ where, data }) => Object.assign(state.prefs.find((p) => p.id === where.id), data),
    },
    user: { findUnique: async ({ where }) => (user && where.id === user.id ? { ...user } : null) },
  };
  const sent = [];
  const deps = {
    client,
    sendEmail: async (msg) => (sent.push(msg), { id: `re_${sent.length}` }),
    checkSuppression: async () => ({ suppressed: false }),
    mailingAddress: ADDRESS,
    platformFrom: "FieldQuo <hello@send.fieldquo.com>",
    origin: ORIGIN,
    now: new Date(created.getTime() + DAY + 0.2 * HOUR), // day 1, 14:32 Toronto
    settings: { personalSender: normalisePersonalSender({ name: "Emilio Boves", title: "Founder", replyTo: "emilio@fieldquo.com" }), stories: [] },
    nextStepsSettings: { enabled: true, delayHours: 2 },
    graceDays: GRACE_DAYS,
    sequenceStartsAt: new Date("2026-10-01T00:00:00Z"),
    helpArticleText: async (lang, slug) => ({ title: `Title of ${slug}`, summary: "One line.", english: !["en", "fr", "es"].includes(lang) }),
  };
  return { client, deps, sent, state, reads };
}
{
  const w = makeWorld();
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.outcome === "sent" && r.kind === "feature_payments", `day 1: the payments nudge is sent (${r.outcome} ${r.kind || r.reason})`);
  const m = w.sent[0];
  ok(m && m.to === "owner@acme.ca" && m.headers["List-Unsubscribe"]?.includes("/api/email-preferences/") && m.html && m.text, "…to the owner, with RFC 8058 headers, an HTML and a text part");
  ok(w.state.prefs.length === 1 && m.text.includes(`/email-preferences/${w.state.prefs[0].token}`), "…with a working preferences link (the row was created with its token)");
  const row = w.state.lifecycle.find((x) => x.kind === "feature_payments");
  ok(row.sentAt && row.toAddress === "owner@acme.ca" && row.language === "en" && row.providerId === "re_1", "…and stamped sentAt with what went");
  const again = await runLifecycleForCompany("c1", w.deps);
  ok(again.outcome === "nothing" && w.sent.length === 1, `idempotent: a second run the same day sends nothing (${again.reason})`);
  ok(w.reads.every((x) => x.id === undefined || x.id === "c1"), "no read named another company");
}
{
  // Stripe connected between the plan and the send — caught by the read after the claim.
  const w = makeWorld();
  let n = 0;
  const realFind = w.client.company.findUnique;
  w.client.company.findUnique = async (args) => {
    const c = await realFind(args);
    n++;
    return n >= 2 ? { ...c, stripeChargesEnabled: true } : c;
  };
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.outcome === "skipped" && r.reason === "already_done" && w.sent.length === 0, "a step finished after the plan is caught by the fresh read after the claim");
  ok(w.state.lifecycle.find((x) => x.kind === "feature_payments")?.skipped === "already_done", "…and recorded, never revisited");
}
{
  const w = makeWorld();
  w.deps.checkSuppression = async () => ({ suppressed: true });
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.reason === "do_not_contact" && w.sent.length === 0, "the do-not-contact list suppresses");
  const w2 = makeWorld();
  w2.deps.checkSuppression = async () => {
    throw new Error("db down");
  };
  const r2 = await runLifecycleForCompany("c1", w2.deps);
  ok(r2.outcome === "suppression_read_failed" && w2.sent.length === 0 && !w2.state.lifecycle[0].skipped && !w2.state.lifecycle[0].claimedAt, "a failed do-not-contact read fails CLOSED and releases the claim (asked again later)");
}
{
  const w = makeWorld({ prefRow: { tips: false } });
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.reason === "opted_out" && w.sent.length === 0, "tips switched off → no tips letter");
  const w2 = makeWorld({ prefRow: { tips: false }, company: { createdAt: new Date(created.getTime() - 20 * DAY), trialEndsAt: new Date(created.getTime() + DAY) } });
  w2.deps.now = new Date(created.getTime() + DAY + 2 * HOUR); // the trial ended an hour ago, 15:20 Toronto
  const r2 = await runLifecycleForCompany("c1", w2.deps);
  ok(r2.outcome === "sent" && r2.kind === "trial_ended", `…but the transactional trial-ended letter still goes (${r2.outcome} ${r2.kind || r2.reason})`);
  ok(w2.sent[0] && Object.keys(w2.sent[0].headers || {}).length === 0 && !/Unsubscribe/.test(w2.sent[0].html), "…with no unsubscribe and no List-Unsubscribe header");
}
{
  const w = makeWorld({ user: { id: "u1", email: "owner@example.com", name: "T", language: null } });
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.reason === "test_address" && w.sent.length === 0, "a reserved test domain is never written to");
  const w2 = makeWorld({ user: null });
  const r2 = await runLifecycleForCompany("c1", w2.deps);
  ok(r2.reason === "no_recipient", "no active owner → no letter, recorded");
}
{
  const w = makeWorld({ company: { isDemo: true } });
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.outcome === "nothing" && r.reason === "demo" && w.sent.length === 0, "a demo is never written to");
  const w2 = makeWorld({ company: { platformEndsAt: new Date() } });
  ok((await runLifecycleForCompany("c1", w2.deps)).reason === "ended_by_fieldquo" && w2.sent.length === 0, "ended by FieldQuo → nothing");
}
{
  const w = makeWorld();
  w.deps.sendEmail = async () => ({ error: "Resend says no" });
  const r = await runLifecycleForCompany("c1", w.deps);
  const row = w.state.lifecycle.find((x) => x.kind === "feature_payments");
  ok(r.outcome === "resend_rejected" && !row.sentAt && !row.claimedAt && row.failedAt && /Resend says no/.test(row.error), "a refused send releases the claim with failedAt (never stamped as sent)");
}
{
  const w = makeWorld();
  w.deps.mailingAddress = "";
  const r = await runLifecycleForCompany("c1", w.deps);
  ok(r.outcome === "build_failed" && /mailing address/i.test(r.reason) && w.sent.length === 0, "no SALES_MAILING_ADDRESS → the tips letter refuses to build, nothing sent");
}
{
  // Day 3: the personal note — plain text, From the person, Reply-To them.
  const w = makeWorld({ company: { stripeChargesEnabled: true } });
  w.state.lifecycle.push({ companyId: "c1", kind: "feature_payments", skipped: "already_done" }, { companyId: "c1", kind: "feature_booking", sentAt: new Date(created.getTime() + 2 * DAY) });
  w.deps.now = new Date(created.getTime() + 3 * DAY);
  const r = await runLifecycleForCompany("c1", w.deps);
  const m = w.sent[0];
  ok(r.kind === "personal_checkin" && m && !m.html && m.from === "Emilio Boves <hello@send.fieldquo.com>" && m.replyTo === "emilio@fieldquo.com", `day 3: the personal note, plain text, From the person, Reply-To them (${r.kind || r.reason})`);
  ok(m && /^Hi Maya,/.test(m.text) && !/<img|<a /.test(m.text) && m.text.includes(ADDRESS) && m.headers["List-Unsubscribe"], "…greets by name, no images, the footer and the headers still there");
  const w2 = makeWorld();
  w2.deps.settings = { personalSender: normalisePersonalSender({ name: "", replyTo: "x@y.com" }), stories: [] };
  w2.state.lifecycle.push({ companyId: "c1", kind: "feature_payments", sentAt: new Date(created.getTime() + DAY) });
  w2.deps.now = new Date(created.getTime() + 3 * DAY);
  const r2 = await runLifecycleForCompany("c1", w2.deps);
  ok(r2.kind !== "personal_checkin" && !w2.sent.some((s) => s.replyTo), "no name → the personal note is not sent");
}
{
  // Day 5: help articles, real ones, stories only when listed.
  const w = makeWorld({ user: { id: "u1", email: "owner@acme.ca", name: "Maya", language: "de" } });
  w.state.lifecycle.push(
    { companyId: "c1", kind: "feature_payments", sentAt: new Date(created.getTime() + DAY) },
    { companyId: "c1", kind: "personal_checkin", sentAt: new Date(created.getTime() + 3 * DAY) },
    { companyId: "c1", kind: "feature_booking", sentAt: new Date(created.getTime() + 4 * DAY) },
  );
  w.deps.now = new Date(created.getTime() + 5 * DAY);
  const r = await runLifecycleForCompany("c1", w.deps);
  const m = w.sent[0];
  ok(r.kind === "help_articles" && m, `day 5: the help-articles letter (${r.kind || r.reason})`);
  ok(m && m.html.includes("/help/de/quotes-and-estimates/") === false && m.html.includes(`${ORIGIN}/help/de/`) && m.html.includes("(auf Englisch)"), "…linked in the reader's language, English bodies marked as such");
  ok(m && !m.html.includes("Wie andere Handwerksbetriebe FieldQuo nutzen"), "…no stories listed → no stories block");
}

// ═══ 8. Builders and settings against hostile input ════════════════════════
for (const lang of LIFECYCLE_LANGUAGES) {
  const all = [
    ...["payments", "booking", "quote", "import"].map((f) => buildFeatureNudge({ feature: f, language: lang, origin: ORIGIN, bookingUrl: `${ORIGIN}/book/acme`, footer: FOOTER })),
    ...["booking", "payments", "quote"].map((m) => buildMilestoneEmail({ milestone: m, language: lang, origin: ORIGIN, bookingUrl: `${ORIGIN}/book/acme`, guideUrl: `${ORIGIN}/help/${lang}/invoices-and-payments/pay-over-time-financing`, footer: FOOTER })),
    buildPersonalEmail({ language: lang, firstName: "Maya", companyName: "Acme", sender: { name: "Emilio", title: "Founder", replyTo: "e@fieldquo.com", phone: "+1 416 555 0100", bookingUrl: "https://cal.com/e" }, footer: FOOTER }),
    buildHelpEmail({ language: lang, origin: ORIGIN, articles: [{ title: "A", summary: "s", url: `${ORIGIN}/help/en/a/b` }, { title: "B", url: `${ORIGIN}/help/en/c/d`, english: true }], stories: [{ title: "Story", url: "https://youtu.be/x", trade: "" }], footer: FOOTER }),
    buildTrialEndedEmail({ language: lang, companyName: "Acme", trialEndsAt, lockAt: trialLockAt(trialEndsAt, GRACE_DAYS), timeZone: "America/Toronto", origin: ORIGIN }),
  ];
  ok(all.every((e) => !/\{[a-z]+\}|undefined/i.test(e.subject + e.text + (e.html || ""))), `${lang}: every letter fills every placeholder`);
  ok(all.slice(0, -1).every((e) => e.headers["List-Unsubscribe"] && e.text.includes(ADDRESS)), `${lang}: every tips letter has the address and the one-click header`);
}
ok(throws(() => buildFeatureNudge({ feature: "payments", origin: ORIGIN, footer: { ...FOOTER, mailingAddress: "" } })), "a nudge without the mailing address refuses to build");
ok(throws(() => buildPersonalEmail({ sender: { name: "", replyTo: "x@y.com" }, footer: FOOTER })), "the personal note refuses a nameless sender");
ok(throws(() => buildHelpEmail({ origin: ORIGIN, articles: [{ title: "only one", url: "https://x" }], footer: FOOTER })), "the help letter refuses to go with fewer than two articles");
ok(throws(() => buildMilestoneEmail({ milestone: "booking", origin: ORIGIN, footer: FOOTER })), "the booking milestone refuses without a booking link");
{
  const e = buildFeatureNudge({ feature: "booking", language: "en", origin: ORIGIN, bookingUrl: null, footer: FOOTER });
  ok(!e.text.includes("will be at"), "no booking URL → the sentence that would print one is left out");
  const de = buildFeatureNudge({ feature: "quote", language: "de", origin: ORIGIN, footer: FOOTER });
  ok(!de.html.includes("hero-quote"), "no German screenshot → no hero, rather than an English screen");
  const fr = buildFeatureNudge({ feature: "quote", language: "fr", origin: ORIGIN, footer: FOOTER });
  ok(fr.html.includes(`${ORIGIN}/email/hero-quote.fr.jpg`), "French reader → the French screenshot");
  ok(!buildFeatureNudge({ feature: "import", language: "en", origin: ORIGIN, footer: FOOTER }).html.includes("fq-hero"), "import has no real screenshot → no hero");
  ok(Object.keys(HERO_IMAGES).every((k) => ["payments", "booking", "quote"].includes(k)), "heroes only where a real product screen exists");
}
{
  const lockAt = trialLockAt(trialEndsAt, GRACE_DAYS);
  ok(trialAccessFor({ trialEndsAt }, new Date(lockAt.getTime() - 1)).level === "readonly" && trialAccessFor({ trialEndsAt }, lockAt).level === "locked", "the lock date printed is the one lib/billing/access.js locks on");
  const e = buildTrialEndedEmail({ language: "en", companyName: "Acme", trialEndsAt, lockAt, timeZone: "America/Toronto", origin: ORIGIN });
  ok(e.text.includes(`ended on ${localDay(trialEndsAt, "America/Toronto", "en")}`) && e.text.includes(`On ${localDay(lockAt, "America/Toronto", "en")} the account locks`), `trial ended: the real dates (${e.endDate} → ${e.lockDate})`);
  ok(/Nothing is deleted/.test(e.text) && e.html.includes("/app/settings/account-billing"), "…nothing deleted, choose a plan");
  ok(localDay(new Date("2026-10-22T05:30:00Z"), "America/Vancouver", "en") === "Oct 21, 2026", "a date is the company's local calendar day, not UTC's");
}
// Help articles: real slugs only.
for (const slug of [...Object.values(FEATURE_ARTICLES), ...Object.values(TRADE_ARTICLES), ...GENERAL_ARTICLES, "pay-over-time-financing"]) {
  ok(Boolean(articleMeta(slug)), `help article exists: ${slug}`);
}
{
  const p = pickHelpArticles({ tradeKey: "painting", open: ["payments", "import"] });
  ok(p.map((a) => a.slug).join(",") === "painting-by-production-rate,connect-stripe-and-get-verified,import-clients-from-a-csv", "trade first, then open features, three at most");
  ok(pickHelpArticles({ tradeKey: "handyman", open: [] }).length >= 2, "no trade article and nothing open → still two real general guides");
  ok(pickHelpArticles({ tradeKey: "<script>", open: ["nope"] }).every((a) => articleMeta(a.slug)), "hostile input → only real articles");
}
// Settings.
ok(!personalSenderReady({ name: "Emilio" }) && !personalSenderReady({ replyTo: "a@b.com" }) && personalSenderReady({ name: "E", replyTo: "a@b.com" }), "the personal note needs a name AND a reply-to");
ok(normalisePersonalSender({ name: "E", replyTo: "a@b.com, c@d.com" }).replyTo === "", "two addresses in reply-to is no reply-to");
ok(normalisePersonalSender({ name: "E\r\nBcc: x@y.com", replyTo: "a@b.com" }).name.includes("\n") === false, "a header-injection name is flattened");
ok(validatePersonalSender({ name: "E", replyTo: "not an email" }).ok === false, "a bad reply-to is refused with a sentence");
ok(validatePersonalSender({ name: "E", replyTo: "a@b.com", bookingUrl: "http://cal.com/e" }).ok === false, "an http booking link is refused");
ok(validatePersonalSender({ name: "E", replyTo: "a@b.com", phone: "call me maybe" }).ok === false, "a phone with letters is refused");
ok(validatePersonalSender({ name: "Emilio", replyTo: "e@fieldquo.com", phone: "+1 (416) 555-0100" }).ok === true, "a real sender is accepted");
ok(validateStories({ stories: [{ title: "T", url: "https://youtu.be/x", imageUrl: "https://i.ytimg.com/x.jpg" }] }).ok === false, "a hotlinked story image is refused");
ok(validateStories({ stories: [{ title: "T", url: "javascript:alert(1)" }] }).ok === false, "a javascript: story link is refused");
ok(validateStories({ stories: [{ title: "T", url: "https://youtu.be/x", trade: "astronaut" }] }).ok === false, "an unknown trade is refused");
ok(validateStories({ stories: [{ title: "T", url: "https://youtu.be/x", trade: "painting", imageUrl: `${ORIGIN}/email/hero-quote.en.jpg` }] }).ok === true, "a real story with our own image is accepted");
ok(normaliseStories([{ title: "", url: "https://x" }, null, { title: "Ok", url: "https://x" }]).length === 1, "stored junk is dropped, not repaired");
ok(storiesFor([{ title: "P", url: "u", trade: "painting" }, { title: "R", url: "u", trade: "roofing" }, { title: "A", url: "u", trade: "" }], "painting").map((s) => s.title).join() === "P,A", "a letter shows its trade's stories then the any-trade ones — never another trade's");
ok(storiesFor([], "painting").length === 0, "no stories → none (never invented)");
ok(STORY_TRADES.includes("painting") && STORY_TRADES.includes("roofing"), "story trades are the discovery trades");
// Preferences.
ok(JSON.stringify(resolvePreferences(null, {})) === '{"tips":true,"updates":false,"offers":false}', "no row, no signup consent → tips on, news and offers OFF");
ok(JSON.stringify(resolvePreferences(null, { marketingConsentAt: new Date() })) === '{"tips":true,"updates":true,"offers":true}', "ticked 'product news and offers' at signup → on");
ok(resolvePreferences({ updates: false }, { marketingConsentAt: new Date() }).updates === false, "a stored false wins over signup consent");
ok(categoryAllowed("transactional", { tips: false }, {}) === true && categoryAllowed("tips", { tips: false }, {}) === false, "transactional always; tips off is off");
ok(categoryAllowed("weekly-digest", null, {}) === false, "an unknown category is refused");
ok(validatePreferencePatch({ tips: "false" }).ok === false && validatePreferencePatch({}).ok === false && validatePreferencePatch([]).ok === false, "junk patches are refused");
ok(JSON.stringify(validatePreferencePatch({ tips: false, billing: false }).data) === '{"tips":false}', "only the three categories are ever written (billing cannot be switched off)");
ok(oneClickCategory("tips") === "tips" && oneClickCategory("billing") === null && oneClickCategory("<x>") === null, "the one-click ?c= accepts only a category");
ok(maskEmail("owner@acme.ca") === "o***@acme.ca" && maskEmail("nope") === "", "the page shows a masked address");
ok(plausibleToken("A".repeat(43)) && !plausibleToken("short") && !plausibleToken("../../etc/passwd" + "a".repeat(30)), "token shape is checked before any read");
{
  const u = preferencesUrls(ORIGIN, "TOK", "tips");
  ok(u.oneClick === `${ORIGIN}/api/email-preferences/TOK/unsubscribe?c=tips` && u.unsubscribe === `${ORIGIN}/email-preferences/TOK?c=tips`, "the one-click URL is the POST endpoint; the visible link is the page");
}
ok(fromWithName("FieldQuo <hello@send.fieldquo.com>", 'Evil" <x@y.com>\r\n') === "Evil x@y.com <hello@send.fieldquo.com>", "the personal From keeps OUR address whatever the name holds");
ok(IMPORT_SAME_SECOND_MIN === 2 && /HAVING count\(\*\) >= 2 LIMIT 1/.test(readFileSync(new URL("../lib/lifecycle/facts.js", import.meta.url), "utf8")), "the import fingerprint's SQL matches its constant");

// ═══ 10. Wiring ════════════════════════════════════════════════════════════
{
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  ok(vercel.crons.some((c) => c.path === "/api/cron/lifecycle-emails" && c.schedule === "40 * * * *"), "the cron is scheduled hourly at :40");
  ok(vercel.crons.find((c) => c.path === "/api/cron/trial-reminders")?.schedule === `0 ${TRIAL_REMINDER_RUN_UTC_HOUR} * * *`, "the reminder hour the plan predicts is the trial-reminders schedule");
  ok(vercel.crons.length <= 100, `cron count within Vercel's 100 per project (${vercel.crons.length})`);
  const route = readFileSync(new URL("../app/api/cron/lifecycle-emails/route.js", import.meta.url), "utf8");
  ok(/const denied = requireCronSecret\(request\);\s*if \(denied\) return denied;/.test(route), "the cron checks CRON_SECRET first");
  const platformCompany = readFileSync(new URL("../app/api/platform/companies/[id]/lifecycle-emails/route.js", import.meta.url), "utf8");
  ok(/export async function GET/.test(platformCompany) && !/export async function (POST|PUT|PATCH|DELETE)/.test(platformCompany), "the console's per-company view is read-only (GET only)");
  const appRoute = readFileSync(new URL("../app/api/settings/email-preferences/route.js", import.meta.url), "utf8");
  ok(/member\.impersonation/.test(appRoute), "a support session cannot change a person's preferences");
  const oneClick = readFileSync(new URL("../app/api/email-preferences/[token]/unsubscribe/route.js", import.meta.url), "utf8");
  ok(/export async function GET[\s\S]*NextResponse\.redirect/.test(oneClick) && !/export async function GET[\s\S]*savePreferences/.test(oneClick.split("export async function GET")[1] || ""), "GET on the one-click URL never mutates (redirects to the page)");
  const notif = readFileSync(new URL("../app/app/settings/notifications/page.js", import.meta.url), "utf8");
  ok(notif.includes('endpoint="/api/settings/email-preferences"'), "Settings › Notifications carries the preferences card");
}

// ═══ 11. Mutations ═════════════════════════════════════════════════════════
const MUTATIONS = [
  // The day gate moved into sendDayGate (shared with win-back / product
  // updates, lib/lifecycle/marketing.js); the anchors follow it.
  { file: "lib/lifecycle/plan.js", label: "two lifecycle emails may share a day", from: "  if (sentToday) return \"already_emailed_today\";", to: "  if (false) return \"already_emailed_today\";" },
  { file: "lib/lifecycle/plan.js", label: "the sequence stops yielding to the trial reminder", from: "    if (reminder.send) return \"trial_reminder_due_today\";", to: "    if (false) return \"trial_reminder_due_today\";" },
  // Two guards in the plan keep a done feature from being chosen (recorded
  // as already_done, and refused by the pick); both are broken together.
  {
    file: "lib/lifecycle/plan.js",
    label: "a done feature is nudged anyway",
    edits: [
      { from: "    const next = FEATURES.find((f) => open(`feature_${f}`) && !featureDone(f, facts));", to: "    const next = FEATURES.find((f) => open(`feature_${f}`));" },
      { from: "      else if (dayIndex >= SCHEDULE.featureFirstDay && featureDone(f, facts)) record(kind, \"already_done\");", to: "" },
    ],
  },
  { file: "lib/lifecycle/plan.js", label: "emails at any hour", from: "  if (today.hour < SCHEDULE.sendFromHour || today.hour >= SCHEDULE.sendToHour) return", to: "  if (false) return" },
  { file: "lib/lifecycle/run.js", label: "the do-not-contact list is ignored", from: "  if (suppressed) return skip(\"do_not_contact\");", to: "  if (false) return skip(\"do_not_contact\");" },
  { file: "lib/lifecycle/run.js", label: "preferences are ignored", from: "  if (category !== \"transactional\" && !(await userAllowsCategory(user.id, category, { client }))) return skip(\"opted_out\");", to: "" },
  { file: "lib/lifecycle/run.js", label: "no fresh re-read after the claim", from: "  if (kind.startsWith(\"feature_\") && featureDone(kind.slice(\"feature_\".length), freshFacts)) return skip(\"already_done\");", to: "" },
  { file: "lib/lifecycle/run.js", label: "a refused send is stamped as sent", from: "  if (result?.error || result?.skipped) {", to: "  if (false) {" },
  { file: "lib/email/preferences.js", label: "absent consent reads as yes for offers", from: "    offers: pick(row?.offers, consented),", to: "    offers: pick(row?.offers, true)," },
  { file: "lib/lifecycle/settings.js", label: "a nameless personal sender is accepted", from: "  return Boolean(s.name && s.replyTo);", to: "  return Boolean(s.replyTo);" },
  { file: "lib/i18n/lifecycleEmailCopy.js", label: "a German sentence goes missing", from: '  "ended.cta": "Tarif wählen",', to: "" },
];
if (!process.argv.includes("--no-mutate")) {
  const dir = mkdtempSync(join(tmpdir(), "fq-lifecycle-mut-"));
  for (const [i, m] of MUTATIONS.entries()) {
    const path = new URL(`../${m.file}`, import.meta.url);
    const src = readFileSync(path, "utf8");
    const edits = m.edits || [{ from: m.from, to: m.to }];
    if (!edits.every((e) => src.includes(e.from))) {
      ok(false, `mutation anchor still exists — ${m.label}`);
      continue;
    }
    const backup = join(dir, `${i}.bak`);
    copyFileSync(path, backup);
    try {
      writeFileSync(path, edits.reduce((acc, e) => acc.replace(e.from, e.to), src));
      const run = spawnSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "scripts/check-lifecycle-emails.mjs", "--no-mutate"], { encoding: "utf8" });
      ok(run.status !== 0, `caught: ${m.label}`);
    } finally {
      copyFileSync(backup, path);
    }
  }
}

for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
