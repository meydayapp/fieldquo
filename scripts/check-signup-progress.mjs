#!/usr/bin/env node
//
// scripts/check-signup-progress.mjs
//
//   npm run check:signup-progress
//
// The live signup stepper on the rep's lead panel — executed, not read.
//
// ══ What this holds ═══════════════════════════════════════════════════════
//
//   1. Every step writes its stamp, once, against the db stub: the row is
//      minted with a token and no "link sent"; the carrier's acceptance
//      stamps it; the browser's "opened" and "company" reports stamp by
//      token and a second report does not move the first; the plan step
//      stamps "plan" + companyId and fills the two browser steps if a beacon
//      never arrived; checkout completion stamps "card" and "signed up".
//      A browser cannot report a later step; an unknown token is a zero.
//   2. Scope: the rep who sent the link reads it; another rep — even with
//      the same lead id — reads null, which the route answers with 404.
//   3. The view: "stuck at <step> for N min" after three minutes without
//      movement, never once complete; the current step is the last reached.
//   4. The wiring: the texted link carries the token and only the texted
//      one; the SMS path mints the row before the body and marks "sent"
//      only after the carrier accepted; the public endpoint takes two step
//      names and answers 204; the companies route and the billing sync stamp
//      the server-side steps; the signup page reads ?link=, beacons the two
//      steps and sends the token with the company; the rep route scopes by
//      leadWhere and 404s; the component polls at the server's cadence,
//      clears its interval, prints the stuck sentence and the card talking
//      point; it is mounted on the lead panel and the console's card; the
//      keys exist in nine languages; the schema has the model; check:all
//      runs this.
//
// ══ Judged by exit code ═══════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BROWSER_REPORTABLE_STEPS,
  LINK_TOKEN_PARAM,
  PROGRESS_POLL_MS,
  SIGNUP_STEPS,
  SIGNUP_STEP_KEYS,
  STUCK_AFTER_MS,
  ensureSignupProgress,
  isLinkToken,
  markLinkSent,
  newLinkToken,
  openedUnfinishedForRep,
  signupProgressForRep,
  signupProgressView,
  signupStepData,
  stampSignupCompletedByCompany,
  stampSignupPlanByToken,
  stampSignupStepByToken,
} from "@/lib/sales/signupProgress";
import { signupLinkFor } from "@/lib/sales/repStats";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { db, resetDbStub, rows, writes } from "./fixtures/dbStub.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

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

const T0 = new Date("2026-09-13T15:00:00Z");
const plus = (ms) => new Date(T0.getTime() + ms);

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every step writes its stamp, once (db stub)");

resetDbStub();
const row = await ensureSignupProgress({ client: db, leadId: "lead_1", salesRepId: "rep_a", now: T0 });
ok("the row is minted with a token and nothing stamped", row && isLinkToken(row.token) && row.leadId === "lead_1" && row.salesRepId === "rep_a" && !row.linkSentAt && !row.openedAt, row);
ok("…the token is URL-safe and long enough", /^[A-Za-z0-9_-]{20,}$/.test(row.token) && isLinkToken(newLinkToken()) && !isLinkToken("short") && !isLinkToken("has space in it..........") && !isLinkToken(null));
const again = await ensureSignupProgress({ client: db, leadId: "lead_1", salesRepId: "rep_a", now: plus(1000) });
ok("a second text to the same lead reuses the open row — same token, same panel", again.id === row.id && rows.salesSignupProgress.length === 1);
const other = await ensureSignupProgress({ client: db, leadId: "lead_1", salesRepId: "rep_b", now: T0 });
ok("another rep texting the same lead gets their OWN row", other.id !== row.id && other.salesRepId === "rep_b" && rows.salesSignupProgress.length === 2);

ok("link_sent: stamped once when the carrier accepted", (await markLinkSent({ client: db, id: row.id, now: plus(2000) })) === 1 && rows.salesSignupProgress[0].linkSentAt?.getTime() === plus(2000).getTime());
ok("…a second mark does not move it", (await markLinkSent({ client: db, id: row.id, now: plus(9000) })) === 0 && rows.salesSignupProgress[0].linkSentAt?.getTime() === plus(2000).getTime());

ok("opened: the browser's report stamps by token", (await stampSignupStepByToken({ client: db, token: row.token, step: "opened", now: plus(60_000) })) === 1 && rows.salesSignupProgress[0].openedAt?.getTime() === plus(60_000).getTime());
ok("…reported twice, the first report stands", (await stampSignupStepByToken({ client: db, token: row.token, step: "opened", now: plus(90_000) })) === 0 && rows.salesSignupProgress[0].openedAt?.getTime() === plus(60_000).getTime());
ok("company: the business form submitted", (await stampSignupStepByToken({ client: db, token: row.token, step: "company", now: plus(120_000) })) === 1 && rows.salesSignupProgress[0].companyAt?.getTime() === plus(120_000).getTime());
ok("a browser cannot report plan, card or completed", (await stampSignupStepByToken({ client: db, token: row.token, step: "plan", now: T0 })) === 0 && (await stampSignupStepByToken({ client: db, token: row.token, step: "card", now: T0 })) === 0 && (await stampSignupStepByToken({ client: db, token: row.token, step: "completed", now: T0 })) === 0 && !rows.salesSignupProgress[0].planAt && !rows.salesSignupProgress[0].cardAt);
ok("…nor with an unknown token, a malformed one, or an unknown step", (await stampSignupStepByToken({ client: db, token: newLinkToken(), step: "opened", now: T0 })) === 0 && (await stampSignupStepByToken({ client: db, token: "x", step: "opened", now: T0 })) === 0 && (await stampSignupStepByToken({ client: db, token: row.token, step: "made_up", now: T0 })) === 0);
ok("BROWSER_REPORTABLE_STEPS is exactly opened and company", BROWSER_REPORTABLE_STEPS.join() === "opened,company");

ok("plan: the server stamps plan + companyId by token", (await stampSignupPlanByToken({ client: db, token: row.token, companyId: "co_1", now: plus(300_000) })) === 1 && rows.salesSignupProgress[0].planAt?.getTime() === plus(300_000).getTime() && rows.salesSignupProgress[0].companyId === "co_1");
ok("…once: a second company cannot take the row", (await stampSignupPlanByToken({ client: db, token: row.token, companyId: "co_2", now: plus(400_000) })) === 0 && rows.salesSignupProgress[0].companyId === "co_1");
ok("…and the browser steps it filled were NOT moved (they were already stamped)", rows.salesSignupProgress[0].openedAt?.getTime() === plus(60_000).getTime() && rows.salesSignupProgress[0].companyAt?.getTime() === plus(120_000).getTime());
// A blocked beacon: the plan step proves "opened" and "company" and fills them.
ok("a row whose beacons never arrived gets opened + company filled at the plan step", (await stampSignupPlanByToken({ client: db, token: other.token, companyId: "co_9", now: plus(500_000) })) === 1 && rows.salesSignupProgress[1].openedAt?.getTime() === plus(500_000).getTime() && rows.salesSignupProgress[1].companyAt?.getTime() === plus(500_000).getTime() && rows.salesSignupProgress[1].planAt?.getTime() === plus(500_000).getTime());

ok("completed: checkout done stamps card + signed up on the company's open row", (await stampSignupCompletedByCompany({ client: db, companyId: "co_1", now: plus(600_000) })) === 1 && rows.salesSignupProgress[0].cardAt?.getTime() === plus(600_000).getTime() && rows.salesSignupProgress[0].completedAt?.getTime() === plus(600_000).getTime());
ok("…once", (await stampSignupCompletedByCompany({ client: db, companyId: "co_1", now: plus(700_000) })) === 0 && rows.salesSignupProgress[0].completedAt?.getTime() === plus(600_000).getTime());
ok("…and an unknown company stamps nothing", (await stampSignupCompletedByCompany({ client: db, companyId: "co_none", now: T0 })) === 0);
ok("every write was an updateMany guarded on the column being null, or the plan's guarded on planAt/companyId", writes.filter((w) => w.model === "salesSignupProgress" && w.action === "updateMany").every((w) => Object.values(w.where).some((v) => v === null)));
ok("a completed row is not reused: the next text mints a fresh one", (await ensureSignupProgress({ client: db, leadId: "lead_1", salesRepId: "rep_a", now: plus(800_000) })).id !== row.id);
ok("signupStepData maps every step to its column", SIGNUP_STEP_KEYS.every((k) => Object.keys(signupStepData(k, T0))[0] === SIGNUP_STEPS.find((s) => s.key === k).column) && signupStepData("nope") === null);
ok("a client without the table: every store function is a quiet no-op", (await ensureSignupProgress({ client: {}, leadId: "l", salesRepId: "r" })) === null && (await markLinkSent({ client: {}, id: "x" })) === 0 && (await stampSignupStepByToken({ client: {}, token: row.token, step: "opened" })) === 0 && (await signupProgressForRep({ client: {}, leadId: "l", salesRepId: "r" })) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Scope: the rep who sent the link, and nobody else");

{
  const mine = await signupProgressForRep({ client: db, leadId: "lead_1", salesRepId: "rep_a", now: plus(900_000) });
  ok("rep A reads their own link's progress", mine && mine.steps.length === 6);
  const theirs = await signupProgressForRep({ client: db, leadId: "lead_1", salesRepId: "rep_c", now: plus(900_000) });
  ok("rep C — no link of their own to this lead — reads null (the route answers 404)", theirs === null);
  const b = await signupProgressForRep({ client: db, leadId: "lead_1", salesRepId: "rep_b", now: plus(900_000) });
  ok("rep B reads THEIR row, not rep A's", b && b.currentKey === "plan" && b.companyId === "co_9");
  ok("the newest row wins for a rep with two", mine.currentKey === null || mine.currentKey === "link_sent" || mine.completed === false);
  const opened = await openedUnfinishedForRep({ client: db, salesRepId: "rep_b" });
  ok("openedUnfinishedForRep: rep B's opened-not-completed link, for the check-in drafts", opened.length === 1 && opened[0].id === other.id);
  ok("…and none for rep A, whose only opened link completed", (await openedUnfinishedForRep({ client: db, salesRepId: "rep_a" })).every((r) => r.openedAt && !r.completedAt) && (await openedUnfinishedForRep({ client: db, salesRepId: "rep_a" })).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The view: current step, stuck after three minutes, never once complete");

{
  const r = { linkSentAt: T0, openedAt: plus(60_000), companyAt: null, planAt: null, cardAt: null, completedAt: null, companyId: null };
  const fresh = signupProgressView(r, plus(120_000));
  ok("the current step is the last reached (opened)", fresh.currentKey === "opened" && fresh.steps.find((s) => s.key === "opened").current && fresh.steps.filter((s) => s.done).length === 2);
  ok("one minute on: not stuck", fresh.stuck === false && fresh.stuckAtKey === null && fresh.stuckForMs === 0);
  const stuck = signupProgressView(r, plus(60_000 + STUCK_AFTER_MS));
  ok("three minutes on the same step: stuck at 'opened', for three minutes", stuck.stuck === true && stuck.stuckAtKey === "opened" && stuck.stuckForMs === STUCK_AFTER_MS);
  ok("STUCK_AFTER_MS is the owner's three minutes; the poll is ten seconds", STUCK_AFTER_MS === 3 * 60 * 1000 && PROGRESS_POLL_MS === 10 * 1000);
  const moved = signupProgressView({ ...r, companyAt: plus(200_000) }, plus(200_000 + 60_000));
  ok("a new stamp resets the clock: not stuck one minute after 'company'", moved.stuck === false && moved.currentKey === "company");
  const done = signupProgressView({ ...r, companyAt: plus(200_000), planAt: plus(300_000), cardAt: plus(400_000), completedAt: plus(400_000), companyId: "co_1" }, plus(400_000 + 24 * 3600 * 1000));
  ok("a completed signup is never stuck, a day later", done.completed === true && done.stuck === false && done.currentKey === "completed" && done.companyId === "co_1");
  ok("every step carries a labelKey and its English fallback", done.steps.every((s) => typeof s.labelKey === "string" && s.labelKey.startsWith("app.salesSignupProgress.step.") && typeof s.label === "string"));
  ok("no row: null", signupProgressView(null) === null);
  ok("a row with no stamps at all: nothing current, not stuck", signupProgressView({}, T0).currentKey === null && signupProgressView({}, T0).stuck === false);
  ok("hostile instants read as absent", signupProgressView({ openedAt: "yesterday?" }, T0).steps.find((s) => s.key === "opened").done === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The wiring");

{
  ok("signupLinkFor carries the token only when asked", signupLinkFor("https://fieldquo.com", "dan") === "https://fieldquo.com/signup?sales=dan" && signupLinkFor("https://fieldquo.com/", "dan", { linkToken: "abc_DEF-123456789012" }) === `https://fieldquo.com/signup?sales=dan&${LINK_TOKEN_PARAM}=abc_DEF-123456789012`);
  const sms = decomment(read("lib/sales/salesSms.js"));
  ok("deliverSignupLinkSms mints the row BEFORE the body is built and puts the token on the link", /const progress = await ensureSignupProgress\(/.test(sms) && /linkToken: progress\?\.token \|\| null/.test(sms) && sms.indexOf("ensureSignupProgress(") < sms.indexOf("salesSmsStatus({ rep, lead, origin, now, linkToken"));
  ok("…and marks 'link sent' only AFTER the carrier accepted (after the message row)", /markLinkSent\(\{ client: db, id: progress\.id/.test(sms) && sms.indexOf("markLinkSent(") > sms.indexOf("db.salesSmsMessage.create("));
  ok("…the preview shows the bare link", /signupLinkFor\(origin, rep\?\.code, \{ linkToken \}\)/.test(sms));
  const pub = decomment(read("app/api/signup/progress/route.js"));
  ok("the public endpoint takes a token and one of the browser steps, rate-limited, and answers 204 either way", /BROWSER_REPORTABLE_STEPS\.includes\(step\)/.test(pub) && /isLinkToken\(token\)/.test(pub) && /rateLimit\(request, "signup-progress"/.test(pub) && /status: 204/.test(pub) && !/findFirst|findMany/.test(pub));
  const companies = decomment(read("app/api/companies/route.js"));
  ok("the companies route stamps 'plan' with the token, best-effort, after the company exists", /stampSignupPlanByToken\(\{ client: db, token: signupLinkToken, companyId: company\.id/.test(companies) && companies.indexOf("stampSignupPlanByToken(") > companies.indexOf("captureSalesAttribution("));
  const billing = decomment(read("lib/platform/stripeBilling.js"));
  ok("the billing sync stamps completion where the Subscription row is written", /stampSignupCompletedByCompany\(\{ client: db, companyId/.test(billing) && billing.indexOf("stampSignupCompletedByCompany(") > billing.indexOf("db.subscription.upsert("));
  const page = decomment(read("app/signup/page.js"));
  ok("the signup page reads ?link=, keeps it in the draft, beacons opened and company, and sends the token with the company", /get\("link"\)/.test(page) && /salesCode,\s*signupLinkToken,/.test(page) && /reportSignupStep\(signupLinkToken, "opened"\)/.test(page) && /reportSignupStep\(signupLinkToken, "company"\)/.test(page) && /signupLinkToken: signupLinkToken \|\| undefined/.test(page));
  ok("…the beacon never awaits and never throws into the page", /keepalive: true/.test(page) && /\.catch\(\(\) => \{\}\)/.test(page.slice(page.indexOf("function reportSignupStep"), page.indexOf("function reportSignupStep") + 600)));
  const route = decomment(read("app/api/sales/leads/[id]/signup-progress/route.js"));
  ok("the rep route scopes the lead by leadWhere and the row by the rep, and 404s both ways", /leadWhere\(rep\.id, id\)/.test(route) && /signupProgressForRep\(\{ client: db, leadId: lead\.id, salesRepId: rep\.id/.test(route) && (route.match(/status: 404/g) || []).length === 2 && /requireOutreachRep\(request\)/.test(route));
  ok("…and hands the panel its cadence from the server", /pollMs: PROGRESS_POLL_MS/.test(route) && /stuckAfterMs: STUCK_AFTER_MS/.test(route));
  const comp = decomment(read("app/components/sales/SignupProgress.js"));
  ok("the component polls at the server's cadence and clears the interval on unmount", /setInterval\(/.test(comp) && /clearInterval\(timer\.current\)/.test(comp) && /pollMs/.test(comp));
  ok("…stops polling once complete", /if \(!leadId \|\| completed\) return undefined;/.test(comp));
  ok("…renders nothing on 404 (no link texted, or not this rep's)", /res\.status === 404/.test(comp) && /if \(missing \|\| !progress\) return null;/.test(comp));
  ok("…prints the stuck sentence with the step and the minutes from the server's clock", /app\.salesSignupProgress\.stuck/.test(comp) && /stuckForMs \/ 60000/.test(comp) && /data-testid="signup-progress-stuck"/.test(comp));
  ok("…and the card talking point inline once past 'opened'", /app\.salesSignupProgress\.cardPoint/.test(comp) && /reached >= 2/.test(comp));
  const lead = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the lead panel mounts it beside the signup-link text", /<SignupProgress leadId=\{id\} \/>/.test(lead));
  const next = decomment(read("app/components/sales/NextSteps.js"));
  ok("the console's current card (NextSteps) mounts it with the call's lead", /<SignupProgress leadId=\{leadId\} \/>/.test(next));
  for (const key of ["app.salesSignupProgress.heading", "app.salesSignupProgress.stuck", "app.salesSignupProgress.cardPoint", "app.salesSignupProgress.cardPointLabel", "app.salesSignupProgress.done", "app.salesSignupProgress.unreachable", ...SIGNUP_STEPS.map((s) => s.labelKey)]) {
    for (const lang of Object.keys(APP_MESSAGES)) {
      ok(`${key} exists in ${lang}`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 0);
    }
    ok(`${key} keeps its placeholders in every language`, (() => {
      const en = APP_MESSAGES.en[key].match(/\{[a-z]+\}/g) || [];
      return Object.keys(APP_MESSAGES).every((lang) => en.every((ph) => APP_MESSAGES[lang][key].includes(ph)));
    })());
  }
  ok("the English card point is the owner's sentence", /not charged for a month/.test(APP_MESSAGES.en["app.salesSignupProgress.cardPoint"]) && /Settings in one click/.test(APP_MESSAGES.en["app.salesSignupProgress.cardPoint"]));
  ok("nine languages", Object.keys(APP_MESSAGES).length === 9);
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SalesSignupProgress {"));
  for (const col of ["token", "leadId", "salesRepId", "linkSentAt", "openedAt", "companyAt", "planAt", "companyId", "cardAt", "completedAt"]) {
    ok(`SalesSignupProgress.${col} is in the schema`, new RegExp(`\\n  ${col}\\s+\\S+`).test(model));
  }
  ok("…the token is unique", /token String @unique/.test(model));
  const pkg = JSON.parse(read("package.json"));
  ok("package.json has check:signup-progress and check:all runs it", typeof pkg.scripts["check:signup-progress"] === "string" && /check:signup-progress/.test(pkg.scripts["check:all"]));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
