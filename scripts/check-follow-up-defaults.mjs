// scripts/check-follow-up-defaults.mjs
//
// FieldQuo's built-in follow-ups — three quote chases at 1, 7 and 14 days
// (ON) and three enquiry chases at 1, 3 and 7 days (OFF) — and everything
// that makes each set safe to seed for every company.
//
// The quote chases are on because they write to somebody who asked this
// company for a price and is holding it. The enquiry chases are off because
// they write to somebody who filled in a form, from the contractor's own
// address, and that is not a default FieldQuo gets to set. Several assertions
// below exist for nothing but that distinction.
//
//   npm run check:follow-up-defaults
//
// ── What is EXECUTED rather than read ──────────────────────────────────────
//
//   * ensureDefaultFollowUps against a fake db: three rows the first time,
//     none the second, none for a company whose default is tombstoned.
//   * quoteChaseBlocker for every stop reason, and for the day-1 case that
//     must NOT be blocked.
//   * builtInWording in each language, with the generic fallback for a
//     language the day-specific copy is not written in.
//   * buildBuiltInFollowUpEmail: the link is in the HTML and the text, the
//     subject is the client's language, nothing says "FieldQuo".
//   * resetBuiltInRule: a deleted, re-timed, re-pointed default comes back.
//
// ── What is read ───────────────────────────────────────────────────────────
//
//   The cron route: the stop decision runs BEFORE the FollowUpLog claim, the
//   built-in wording is rendered in the client's language, the plan and tax
//   gates are asked, tombstones are skipped. The two signup routes seed. The
//   DELETE route tombstones. The page shows a switch, a delay, a template
//   picker, reset and restore, and the stop explainer.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILT_IN_FOLLOW_UPS,
  BUILT_IN_KEYS,
  BUILT_IN_TRIGGER,
  BUILT_IN_LANGUAGES,
  LEAD_FOLLOW_UPS,
  LEAD_KEYS,
  LEAD_TRIGGER,
  ALL_BUILT_IN_FOLLOW_UPS,
  ALL_BUILT_IN_KEYS,
  builtInEntityType,
  builtInTrigger,
  builtInWording,
  buildBuiltInFollowUpEmail,
  buildBuiltInLeadEmail,
  ensureDefaultFollowUps,
  resetBuiltInRule,
} from "../lib/followUps/defaults.js";
import { quoteChaseBlocker, QUOTE_STOP_REASONS } from "../lib/followUps/stopConditions.js";
import { SUPPORTED_TRIGGERS } from "../lib/followUps/triggers.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { SUPPORTED_EMAIL_LANGUAGES } from "../lib/i18n/emailCopy.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── A fake db: just enough Prisma for the two functions that take one ──────
function fakeDb(rows = []) {
  const store = rows.map((r) => ({ ...r }));
  return {
    rows: store,
    followUpRule: {
      async findMany({ where }) {
        return store.filter(
          (r) => r.companyId === where.companyId && where.builtInKey.in.includes(r.builtInKey),
        );
      },
      async create({ data }) {
        const row = { id: `r${store.length + 1}`, createdAt: new Date(), ...data };
        store.push(row);
        return row;
      },
      async update({ where, data }) {
        const row = store.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
}

console.log("\nThe three defaults\n");

ok("exactly three quote chases", BUILT_IN_FOLLOW_UPS.length === 3 && BUILT_IN_KEYS.length === 3);
ok(
  "at 1, 7 and 14 days",
  BUILT_IN_FOLLOW_UPS.map((r) => `${r.delayValue}${r.delayUnit}`).join(",") === "1days,7days,14days",
);
ok("on the quote trigger the cron supports", SUPPORTED_TRIGGERS.includes(BUILT_IN_TRIGGER) && BUILT_IN_TRIGGER === "quote_no_response");
ok("all three arrive ON — they write to somebody holding a price", BUILT_IN_FOLLOW_UPS.every((r) => r.active !== false));

// ── The three enquiry chases (2026-11-02) ──────────────────────────────────
//
// FollowUpRule held 114 rows across 38 companies and not one was on
// lead_no_response, a trigger that had existed for weeks — so an enquiry that
// never became a quote was chased by nothing at all. These are the rules that
// make that trigger real, and every assertion below is about the one thing
// that makes them safe to seed for every company: they are OFF.
console.log("\nThe three enquiry chases\n");

ok("exactly three enquiry chases", LEAD_FOLLOW_UPS.length === 3 && LEAD_KEYS.length === 3);
ok(
  "at 1, 3 and 7 days — tighter than the quote chase, because the person is comparing contractors now",
  LEAD_FOLLOW_UPS.map((r) => `${r.delayValue}${r.delayUnit}`).join(",") === "1days,3days,7days",
);
ok("on the enquiry trigger the cron supports", SUPPORTED_TRIGGERS.includes(LEAD_TRIGGER) && LEAD_TRIGGER === "lead_no_response");
ok(
  "every one of them is seeded OFF — three emails nobody chose, to a stranger, under the contractor's name is not a default FieldQuo sets",
  LEAD_FOLLOW_UPS.every((r) => r.active === false),
);
ok(
  "…and on the EMAIL channel, because the follow-up-text switch is off until a company chooses it",
  LEAD_FOLLOW_UPS.every((r) => r.channel === "email"),
);
ok("six built-ins in all, quote chases first", ALL_BUILT_IN_FOLLOW_UPS.length === 6 && ALL_BUILT_IN_KEYS.length === 6
  && ALL_BUILT_IN_KEYS.slice(0, 3).join(",") === BUILT_IN_KEYS.join(","));
ok("each key knows which trigger it rides", LEAD_KEYS.every((k) => builtInTrigger(k) === LEAD_TRIGGER)
  && BUILT_IN_KEYS.every((k) => builtInTrigger(k) === BUILT_IN_TRIGGER));
// The cron asks this before rendering. It used to be a bare
// `finder.entityType !== "quote"`, which would have refused every enquiry
// default the day they were seeded.
ok("each key knows which entity its wording is written for",
  LEAD_KEYS.every((k) => builtInEntityType(k) === "lead") && BUILT_IN_KEYS.every((k) => builtInEntityType(k) === "quote"));
ok("a key nobody defined has no entity to guess at", builtInEntityType("made_up") === null);

console.log("\nSeeding\n");

{
  const db = fakeDb();
  const first = await ensureDefaultFollowUps(db, "c1");
  const second = await ensureDefaultFollowUps(db, "c1");
  ok("first run creates six", first === 6 && db.rows.length === 6, `created ${first}`);
  ok("second run creates none (idempotent)", second === 0 && db.rows.length === 6, `created ${second}`);
  ok("none of them points at a template (built-in wording)", db.rows.every((r) => r.templateId === null));
  ok("the three quote chases arrive on",
    db.rows.filter((r) => BUILT_IN_KEYS.includes(r.builtInKey)).every((r) => r.active === true));
  // The one assertion this whole block exists for. A seeding bug that made
  // these active would start three emails a week at every enquiry in 38
  // companies' pipelines, from the contractor's own address, the first time
  // anybody opened the Follow-ups page.
  ok("the three enquiry chases arrive OFF",
    db.rows.filter((r) => LEAD_KEYS.includes(r.builtInKey)).every((r) => r.active === false));
  ok("each is seeded on its OWN trigger, not all on the quote one",
    db.rows.every((r) => r.triggerEvent === builtInTrigger(r.builtInKey))
      && db.rows.filter((r) => r.triggerEvent === LEAD_TRIGGER).length === 3);
  ok("each is seeded on the email channel", db.rows.every((r) => r.channel === "email"));
  ok("dry run counts without writing", (await ensureDefaultFollowUps(fakeDb(), "c9", { dryRun: true })) === 6);
}
{
  // A company that deleted the day-7 default keeps it deleted.
  const db = fakeDb([
    { id: "a", companyId: "c2", builtInKey: "quote_sent_d1", active: true, templateId: null, deletedAt: null },
    { id: "b", companyId: "c2", builtInKey: "quote_sent_d7", active: false, templateId: null, deletedAt: new Date() },
  ]);
  const created = await ensureDefaultFollowUps(db, "c2");
  ok("a deleted default is not re-created; only the genuinely missing ones are", created === 4 && db.rows.length === 6);
  ok("the tombstone is untouched", db.rows.find((r) => r.id === "b").deletedAt instanceof Date);
}

console.log("\nReset and restore\n");

{
  const db = fakeDb([
    { id: "x", companyId: "c3", builtInKey: "quote_sent_d14", name: "Renamed", delayValue: 30, delayUnit: "hours", templateId: "tpl", active: false, deletedAt: new Date() },
  ]);
  const back = await resetBuiltInRule(db, db.rows[0]);
  ok(
    "reset restores delay, wording, switch and un-deletes",
    back.delayValue === 14 && back.delayUnit === "days" && back.templateId === null && back.active === true && back.deletedAt === null,
  );
  ok("reset refuses a hand-made rule", (await resetBuiltInRule(db, { id: "y", builtInKey: null })) === null);
}
{
  // "Reset to default" on an ENQUIRY chase the company switched on must put
  // it back OFF. Resetting it to active would make Reset the one control on
  // that page that starts sending — and it would do it under the word
  // "default", which is the opposite of what the button promises.
  const db = fakeDb([
    { id: "l", companyId: "c4", builtInKey: "lead_new_d3", name: "Mine", delayValue: 30, delayUnit: "hours", templateId: "tpl", channel: "sms", active: true, deletedAt: null },
  ]);
  const back = await resetBuiltInRule(db, db.rows[0]);
  ok("reset puts an enquiry chase back to OFF, not to on",
    back.active === false && back.delayValue === 3 && back.delayUnit === "days" && back.templateId === null);
  ok("…on its own trigger and back on the email channel",
    back.triggerEvent === "lead_no_response" && back.channel === "email");
}

console.log("\nThe enquiry chase's email\n");

{
  const company = { name: "TrueFinish Cabinets", phone: "819-555-0100", brandColor: "#ffd400" };
  const client = { name: "Maureen Clarke" };
  for (const [lang, marker] of [["en", "your enquiry"], ["fr", "votre demande"], ["es", "su solicitud"]]) {
    const email = buildBuiltInLeadEmail({ key: "lead_new_d1", client, company, service: "cabinet refinishing", language: lang });
    ok(`${lang}: subject in the language the homeowner filled the form in`, email.subject.includes(marker) || !email.generic, email.subject);
    ok(`${lang}: it names the service they asked about`, email.html.includes("cabinet refinishing") && email.text.includes("cabinet refinishing"));
    ok(`${lang}: nothing says FieldQuo`, !/fieldquo/i.test(email.html) && !/fieldquo/i.test(email.text));
    ok(`${lang}: the company's name is on it`, email.html.includes("TrueFinish Cabinets"));
    // Nobody has looked at the job yet, so there is no figure to quote and a
    // number here would be a guess sent under the contractor's name.
    ok(`${lang}: no price, no figure, no currency`, !/\$|CAD|USD|€/.test(email.text));
  }
  // The service is the one token that can legitimately be absent, and the
  // sentence has to read without it rather than being padded with an invented
  // "your project" that the homeowner never said.
  const noService = buildBuiltInLeadEmail({ key: "lead_new_d1", client, company, service: null, language: "en" });
  ok("a lead that named no service still reads as a sentence",
    !/undefined|null|\s{2,}|\s[,.]/.test(noService.text), noService.text.slice(0, 160));
  // The video: a button when there is one, nothing at all when there is not.
  const withVideo = buildBuiltInLeadEmail({ key: "lead_new_d1", client, company, service: "cabinets", videoUrl: "https://youtu.be/abc123", language: "en" });
  ok("the pre-quote video is a button and a pasteable link when set",
    withVideo.html.includes("https://youtu.be/abc123") && withVideo.text.includes("https://youtu.be/abc123"));
  ok("…and the email mentions no video at all when there isn't one — no placeholder",
    !/video|vidéo/i.test(noService.html) && !/href=""/.test(noService.html) && !/<a [^>]*href="?[\s>]/.test(noService.html));
  // The day-7 one says it is the last. A chase with no stated end is the kind
  // a homeowner reports as spam.
  const d7 = buildBuiltInLeadEmail({ key: "lead_new_d7", client, company, service: "cabinets", language: "en" });
  ok("day 7 says it is the last one", /last/i.test(d7.text));
  // A language the enquiry copy is not written in gets the generic ENQUIRY
  // line in that language — never the generic QUOTE line, which names a quote
  // number this person does not have.
  for (const lang of SUPPORTED_EMAIL_LANGUAGES.filter((l) => !BUILT_IN_LANGUAGES.includes(l))) {
    const w = builtInWording("lead_new_d1", lang, { companyName: "Acme" });
    const en = builtInWording("lead_new_d1", "en", { companyName: "Acme" });
    ok(`${lang}: falls back to the generic ENQUIRY line in ${lang}`, w.generic && w.subject !== en.subject);
    ok(`${lang}: …and that line never mentions a quote number`, !/Q-|\{number\}/.test(w.subject + w.paragraphs.join(" ")));
  }
}

console.log("\nStop conditions (executed)\n");

const now = new Date("2026-09-19T12:00:00Z");
const day = 86400000;
const rule = { builtInKey: "quote_sent_d1", createdAt: new Date(now.getTime() - 10 * day) };
const sentQuote = (over = {}) => ({ status: "sent", sentAt: new Date(now.getTime() - 2 * day), validUntil: null, ...over });

ok("day-1: a sent quote, nothing else, IS chased", quoteChaseBlocker({ quote: sentQuote(), rule, now }) === null);
ok("accepted → answered", quoteChaseBlocker({ quote: sentQuote({ status: "accepted" }), rule, now }) === "answered");
ok("declined → answered", quoteChaseBlocker({ quote: sentQuote({ status: "declined" }), rule, now }) === "answered");
ok("expired → expired", quoteChaseBlocker({ quote: sentQuote({ validUntil: new Date(now.getTime() - day) }), rule, now }) === "expired");
ok("still valid is not expired", quoteChaseBlocker({ quote: sentQuote({ validUntil: new Date(now.getTime() + day) }), rule, now }) === null);
ok(
  "client replied after the send → replied",
  quoteChaseBlocker({ quote: sentQuote(), rule, facts: { clientRepliedAt: new Date(now.getTime() - day) }, now }) === "replied",
);
ok(
  "a message from BEFORE the send is not a reply",
  quoteChaseBlocker({ quote: sentQuote(), rule, facts: { clientRepliedAt: new Date(now.getTime() - 5 * day) }, now }) === null,
);
ok("a newer quote to the client → superseded", quoteChaseBlocker({ quote: sentQuote(), rule, facts: { laterQuoteExists: true }, now }) === "superseded");
ok(
  "a built-in never chases a quote sent before the rule existed",
  quoteChaseBlocker({ quote: sentQuote({ sentAt: new Date(now.getTime() - 20 * day) }), rule, now }) === "before_rule",
);
ok(
  "a hand-made rule keeps catching up on older quotes",
  quoteChaseBlocker({ quote: sentQuote({ sentAt: new Date(now.getTime() - 20 * day) }), rule: { builtInKey: null, createdAt: rule.createdAt }, now }) === null,
);
ok("no quote → answered (never chased)", quoteChaseBlocker({ quote: null, rule, now }) === "answered");
ok(
  "every stop reason the function can return is declared",
  ["answered", "expired", "replied", "superseded", "before_rule"].every((r) => QUOTE_STOP_REASONS.includes(r)),
);

console.log("\nThe client's language\n");

for (const lang of BUILT_IN_LANGUAGES) {
  const w = builtInWording("quote_sent_d7", lang, { companyName: "Acme", quoteNumber: "Q-7" });
  ok(`${lang}: day-specific wording, subject names the quote`, !w.generic && w.subject.includes("Q-7") && w.paragraphs.length >= 1);
}
ok("EN, FR and ES are all written", ["en", "fr", "es"].every((l) => BUILT_IN_LANGUAGES.includes(l)));
for (const lang of SUPPORTED_EMAIL_LANGUAGES.filter((l) => !BUILT_IN_LANGUAGES.includes(l))) {
  const w = builtInWording("quote_sent_d1", lang, { companyName: "Acme", quoteNumber: "Q-1" });
  const en = builtInWording("quote_sent_d1", "en", { companyName: "Acme", quoteNumber: "Q-1" });
  ok(`${lang}: falls back to the generic line in ${lang}, not to English`, w.generic && w.subject !== en.subject && w.paragraphs[0] !== en.paragraphs[0]);
}
{
  const company = { name: "Acme Painting", phone: "555-0100", brandColor: "#ffd400" };
  for (const [lang, marker] of [["en", "Did quote Q-1"], ["fr", "soumission Q-1"], ["es", "presupuesto Q-1"]]) {
    const email = buildBuiltInFollowUpEmail({ key: "quote_sent_d1", quote: { quoteNumber: "Q-1" }, client: { name: "Jane Doe" }, company, url: "https://x.test/q/tok", language: lang });
    ok(`${lang}: subject in the client's language`, email.subject.includes(marker), email.subject);
    ok(`${lang}: the quote link is in the HTML and the text`, email.html.includes("https://x.test/q/tok") && email.text.includes("https://x.test/q/tok"));
    ok(`${lang}: nothing says FieldQuo`, !/fieldquo/i.test(email.html) && !/fieldquo/i.test(email.text));
    ok(`${lang}: the company's name is on it`, email.html.includes("Acme Painting"));
  }
  const d14 = buildBuiltInFollowUpEmail({ key: "quote_sent_d14", quote: { quoteNumber: "Q-1" }, client: { name: "Jane" }, company, url: "https://x/q", language: "en" });
  ok("day 14 offers a way to say no", /stop writing/i.test(d14.text));
  ok("no built-in restates the price", !/\$|CAD|USD/.test(builtInWording("quote_sent_d7", "en").paragraphs.join(" ")));
}

console.log("\nThe cron (read)\n");

const cron = code(read("app/api/cron/follow-ups/route.js"));
ok("cron skips tombstoned rules", /where: \{ active: true, deletedAt: null \}/.test(cron));
ok("cron renders built-in wording when a default has no template", /buildBuiltInFollowUpEmail\(/.test(cron) && /const builtIn = Boolean\(rule\.builtInKey\) && !rule\.template/.test(cron));
// The language is resolved once per email (lib/followUps/mergeData.js's
// followUpLanguage — resolveClientLanguage, document first) and shared by the
// built-in wording, the template's tokens and the blocks' own words. Executed
// here: a French quote for an English-speaking client is written in French.
{
  const { followUpLanguage } = await import("../lib/followUps/mergeData.js");
  ok("cron resolves the CLIENT's language for the built-in",
    /const language = followUpLanguage\(finder\.entityType, entity\);/.test(cron)
      && cron.indexOf("const language = followUpLanguage(") < cron.indexOf("buildBuiltInFollowUpEmail(")
      && /buildBuiltInFollowUpEmail\(\{[\s\S]{0,300}?\blanguage,/.test(cron)
      && followUpLanguage("quote", { language: "fr", client: { language: "en" }, company: { defaultLanguage: "es" } }) === "fr"
      && followUpLanguage("quote", { language: null, client: { language: "uk" }, company: { defaultLanguage: "es" } }) === "uk");
}
{
  const blockerAt = cron.indexOf("quoteChaseBlocker(");
  const claimAt = cron.indexOf("followUpLog.create");
  ok("stop conditions are decided BEFORE the FollowUpLog claim", blockerAt > -1 && claimAt > -1 && blockerAt < claimAt);
  const planAt = cron.indexOf("companyMaySend(");
  const taxAt = cron.indexOf("quoteTaxReady(");
  ok("plan gate and tax gate are asked before the claim", planAt > -1 && taxAt > -1 && planAt < claimAt && taxAt < claimAt);
}
ok("cron still claims before sending (once per rule per quote)", cron.indexOf("followUpLog.create") < cron.indexOf("sendEmail({"));
ok("cron reports why quotes were left alone", /stopped\[reason\]/.test(cron) && /stopped,/.test(cron));

console.log("\nSeeding hooks (read)\n");

// Since 2026-09-25 signup seeds through the stages in lib/signup/setupStages.js
// — inline from /api/companies (runSetupInline) or streamed from
// /api/signup/setup (runSetupStage) — and the templates stage is where the
// rules are ensured, with the client each route passes.
ok(
  "self-serve signup seeds the defaults",
  /runSetupInline\(\{[\s\S]*?client: db,/.test(code(read("app/api/companies/route.js"))) &&
    /runSetupStage\(stage, \{ companyId, client: db \}\)/.test(code(read("app/api/signup/setup/route.js"))) &&
    /stage\?\.kind === "templates"[\s\S]*?ensureDefaultFollowUps, client, companyId/.test(code(read("lib/signup/setupStages.js"))),
);
ok("platform-created companies get them too", /ensureDefaultFollowUps\(db, company\.id\)/.test(code(read("app/api/platform/companies/route.js"))));
ok("the rules page self-heals a company that missed them", /ensureDefaultFollowUps\(db, member\.companyId\)/.test(code(read("app/api/settings/follow-up-rules/route.js"))));
ok("a backfill script exists and dry-runs first", /--dry-run/.test(read("scripts/backfill-follow-up-defaults.mjs")));

console.log("\nThe routes (read)\n");

const item = code(read("app/api/settings/follow-up-rules/[id]/route.js"));
ok("DELETE tombstones a built-in instead of removing it", /if \(existing\.builtInKey\) \{[\s\S]*?deletedAt: new Date\(\)/.test(item));
ok("hand-made rules still hard-delete", /followUpRule\.delete\(\{ where: \{ id \} \}\)/.test(item));
ok("PATCH { reset: true } restores a built-in", /reset === true/.test(item) && /resetBuiltInRule\(db, existing\)/.test(item));
ok("PATCH lets a built-in go back to built-in wording (templateId null)", /templateId === null && !existing\.builtInKey/.test(item));
ok("PATCH refuses a delay under 1", /Number\(delayValue\) >= 1/.test(item));
const list = code(read("app/api/settings/follow-up-rules/route.js"));
ok("GET hides tombstones from the live list and reports them for restore", /deletedBuiltIns/.test(list) && /!r\.deletedAt/.test(list));

console.log("\nThe page (read)\n");

const page = code(read("app/app/settings/follow-ups/page.js"));
ok("each rule has a switch", /role="switch"/.test(page));
ok("each rule's delay is editable in place", /commitDelay\(rule\)/.test(page) && /delayUnit: e\.target\.value/.test(page));
ok("each rule's template is a picker; a built-in offers FieldQuo's wording", /app\.setFollowUps\.builtInWording/.test(page));
ok("built-ins have Reset to default", /reset: true/.test(page) && /app\.setFollowUps\.resetToDefault/.test(page));
ok("deleted built-ins are listed with Restore", /deletedBuiltIns\.map/.test(page) && /app\.setFollowUps\.restore/.test(page));
ok("the stop conditions are explained in one line", /app\.setFollowUps\.stopExplainer/.test(page));
// Reads the SAME table the cron renders from, picked by key rather than
// guessed: the two tables take different arguments (the quote chase's subject
// wants a quote number, the enquiry chase's wants only the company), so a
// component that guessed would print "Q-1042" where a service name belongs.
ok("a built-in shows what it says, from the table its key belongs to",
  /builtInCopyTable\(ruleKey\)/.test(page) && /table\[lang\]\?\.\[ruleKey\]/.test(page));
ok("…and an enquiry default's wording is called with the service, not a quote number",
  /w\.body\(company, t\("app\.setFollowUps\.sampleService"\)\)/.test(page));
ok("a TEXT rule shows no email wording panel — its words are a message type",
  /channel !== "sms" && \(\n?\s*<BuiltInWording/.test(page) || /!rule\.templateId && channel !== "sms"/.test(page));
ok("the quote's trail prints automated chases from FollowUpLog", /automatedFollowUps/.test(read("app/app/quotes/[id]/page.js")) && /followUpLog\.findMany/.test(read("app/api/quotes/[id]/route.js")));

console.log("\nNine languages\n");

for (const key of [
  "app.setFollowUps.stopExplainer",
  "app.setFollowUps.fieldquoDefault",
  "app.setFollowUps.resetToDefault",
  "app.setFollowUps.restore",
  "app.setFollowUps.builtInWording",
  "app.quoteDetail.autoFollowUp",
]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in every language`, missing.length === 0, missing.join(","));
}
ok(
  "the stop explainer names every reason the cron can give",
  /accept|decline/i.test(APP_MESSAGES.en["app.setFollowUps.stopExplainer"]) &&
    /expire/i.test(APP_MESSAGES.en["app.setFollowUps.stopExplainer"]) &&
    /newer quote/i.test(APP_MESSAGES.en["app.setFollowUps.stopExplainer"]) &&
    /repl/i.test(APP_MESSAGES.en["app.setFollowUps.stopExplainer"]),
);

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
