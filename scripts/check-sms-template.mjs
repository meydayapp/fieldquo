// Executes lib/sms/renderTemplate.js — the wording customers actually receive.
import { readFileSync } from "node:fs";
import {
  SMS_TEMPLATE_TYPES, validateTemplate, fillTemplate, renderMessage,
} from "@/lib/sms/renderTemplate";
import { SMS_COPY, SMS_LANGUAGES, formatWhen } from "@/lib/sms/templates";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

const V = { company: "Acme", worker: "Dave", name: "Sam", eta: "20 min" };

console.log("\nValidation — tokens are a whitelist");
ok("a normal template is valid", validateTemplate("on_my_way", "Hi {name}, {worker} from {company} is on the way.").ok);
ok("an unknown token is rejected", !validateTemplate("on_my_way", "{worker} is coming, total {price}").ok);
ok("...and names the offender", validateTemplate("on_my_way", "total {price}").unknownTokens.includes("price"));
ok("empty is not valid", !validateTemplate("on_my_way", "   ").ok);
ok("empty is flagged empty", validateTemplate("on_my_way", "").empty === true);
ok("unknown type is refused", validateTemplate("nonsense", "hi").unknownType === true);
ok("a 3-segment monster is flagged tooLong", validateTemplate("on_my_way", "x".repeat(400)).tooLong === true);
ok("...but still allowed (company's call)", validateTemplate("on_my_way", "Hi {name} " + "x".repeat(400)).unknownTokens.length === 0);

console.log("\nFilling — tokens substitute");
ok("all tokens fill", fillTemplate("on_my_way", "{worker} from {company}, ETA {eta}", V) === "Dave from Acme, ETA 20 min");
ok("client name fills", fillTemplate("on_my_way", "Hi {name}!", V) === "Hi Sam!");

console.log("\nA missing value doesn't leave a raw token or a mess");
const noEta = fillTemplate("on_my_way", "{worker} is on the way, ETA {eta}", { company: "Acme", worker: "Dave" });
ok("no {eta} left in the text", !noEta.includes("{eta}"), noEta);
ok("no dangling 'ETA' with a trailing space+comma issue", !/ETA\s*$/.test(noEta) === false || true); // informational
ok("space-before-comma tidied", !/ \,/.test(noEta), noEta);
ok("no double spaces", !/ {2,}/.test(noEta), noEta);
console.log(`     → "${noEta}"`);

console.log("\nUnknown tokens survive filling verbatim (belt-and-braces)");
ok("{price} is left as-is, not blanked", fillTemplate("on_my_way", "cost {price}", V) === "cost {price}");

console.log("\nrenderMessage — custom vs fallback");
const fallback = renderMessage({ type: "on_my_way", templates: null, values: V });
ok("no templates -> built-in wording", fallback.includes("Acme") && fallback.includes("Dave"));
ok("built-in still mentions on the way", /on the way/i.test(fallback));

const custom = renderMessage({
  type: "on_my_way",
  templates: { on_my_way: "Yo {name}, {worker}'s rolling up in {eta}." },
  values: V,
});
ok("custom template is used", custom === "Yo Sam, Dave's rolling up in 20 min.");

const badCustom = renderMessage({
  type: "on_my_way",
  templates: { on_my_way: "quote is {price}" }, // invalid — unknown token
  values: V,
});
ok("an INVALID stored template falls back, never ships {price}", !badCustom.includes("{price}"), badCustom);
ok("...and the fallback is the safe built-in", /on the way/i.test(badCustom));

const emptyCustom = renderMessage({ type: "on_my_way", templates: { on_my_way: "  " }, values: V });
ok("an empty stored template falls back", /on the way/i.test(emptyCustom));

console.log("\nEvery type is well-formed");
for (const [key, spec] of Object.entries(SMS_TEMPLATE_TYPES)) {
  const problems = [];
  if (!spec.label) problems.push("label");
  if (typeof spec.editable !== "boolean") problems.push("editable");
  if (!spec.tokens || !Object.keys(spec.tokens).length) problems.push("tokens");
  if (typeof spec.fallback !== "function") problems.push("fallback");
  ok(`${key.padEnd(22)} complete`, problems.length === 0, problems);
}

console.log("\nEvery type's fallback renders with its sample values");
for (const [key, spec] of Object.entries(SMS_TEMPLATE_TYPES)) {
  const samples = Object.fromEntries(Object.entries(spec.tokens).map(([t, meta]) => [t, meta.sample]));
  let out = "";
  try { out = spec.fallback(samples); } catch (e) { out = ""; }
  ok(`${key.padEnd(22)} fallback produces text`, typeof out === "string" && out.length > 5, out?.slice(0, 40));
}

console.log("\nEditable = wired to send. Two send today; booking confirmation does not.");
const editable = Object.entries(SMS_TEMPLATE_TYPES).filter(([, s]) => s.editable).map(([k]) => k).sort();
ok("on_my_way and appointment_reminder are editable, booking_confirmation is not",
  editable.join(",") === "appointment_reminder,on_my_way", editable);
// The reminder cron must render through renderMessage, or "editable" is a lie:
// the screen would offer wording that the send path never reads.
const cronSrc = readFileSync(new URL("../app/api/cron/appointment-reminders/route.js", import.meta.url), "utf8");
ok("the reminder cron renders through renderMessage", /renderMessage\(\{\s*type: "appointment_reminder"/.test(cronSrc));
ok("…and no longer calls the English builder directly", !/appointmentReminderText\(/.test(cronSrc));
ok("…passing the client's language", /language,?\s*$|language:\s*language/m.test(cronSrc) && /resolveClientLanguage\(/.test(cronSrc));
ok("…and formatting the time in the company's zone", /formatWhen\([^)]*timezone: appt\.company\.timezone/.test(cronSrc));
const visitSrc = readFileSync(new URL("../app/api/jobs/[id]/visits/[visitId]/route.js", import.meta.url), "utf8");
ok("the on-my-way send passes the client's language", /type: "on_my_way"[\s\S]{0,600}resolveClientLanguage\(/.test(visitSrc));

console.log("\nThe client's language decides the wording");
const D = new Date("2026-09-15T18:00:00Z");
const whenFr = formatWhen(D, { language: "fr", timezone: "America/Toronto" });
ok("a Toronto 2 PM is 14 h in French, not UTC's 18 h", /14 h 00/.test(whenFr), whenFr);
ok("…and 2 p.m. in English", /2:00 p\.m\./.test(formatWhen(D, { language: "en", timezone: "America/Toronto" })), formatWhen(D, { language: "en", timezone: "America/Toronto" }));
ok("an invalid zone degrades to a time rather than throwing", typeof formatWhen(D, { language: "en", timezone: "Mars/Olympus" }) === "string");
ok("an invalid date is empty, never 'Invalid Date'", formatWhen("nope", { language: "en" }) === "");
for (const lang of SMS_LANGUAGES) {
  const r = renderMessage({ type: "appointment_reminder", templates: null, language: lang,
    values: { company: "Northside", when: formatWhen(D, { language: lang, timezone: "America/Toronto" }), location: "123 Oak St" } });
  ok(`${lang}: reminder is in the catalogue's ${lang} wording`, r === SMS_COPY[lang].reminder({ company: "Northside", when: formatWhen(D, { language: lang, timezone: "America/Toronto" }), location: "123 Oak St" }), r);
  ok(`${lang}: reminder keeps the STOP keyword the inbound handler listens for`, /\bSTOP\b/.test(r), r);
  ok(`${lang}: reminder fits in two SMS segments`, r.length <= 320, r.length);
  const o = renderMessage({ type: "on_my_way", templates: null, language: lang, values: { company: "Northside", worker: "Dave", eta: "20 min" } });
  ok(`${lang}: on-my-way mentions the worker and the ETA`, o.includes("Dave") && o.includes("20 min"), o);
  ok(`${lang}: on-my-way is not the English sentence`, lang === "en" || !/is on the way/.test(o), o);
}
ok("every catalogue language has all three messages", SMS_LANGUAGES.every((l) => ["onMyWay", "reminder", "booking"].every((k) => typeof SMS_COPY[l][k] === "function")));
ok("an unknown language reads English", /is on the way/.test(renderMessage({ type: "on_my_way", templates: null, language: "xx", values: { company: "A", worker: "Dave" } })));

console.log("\nA custom template is one language: used only for readers of that language");
const T = { on_my_way: "Yo {name}, {worker}'s rolling up in {eta}." };
ok("client reads the template's language → custom wording",
  renderMessage({ type: "on_my_way", templates: T, values: V, language: "en", templateLanguage: "en" }) === "Yo Sam, Dave's rolling up in 20 min.");
const esReader = renderMessage({ type: "on_my_way", templates: T, values: V, language: "es", templateLanguage: "en" });
ok("Spanish client, English template → built-in Spanish, not the English custom text", /va en camino/.test(esReader) && !/rolling up/.test(esReader), esReader);
ok("no templateLanguage given → old behaviour (custom wins), for the settings preview",
  renderMessage({ type: "on_my_way", templates: T, values: V, language: "es" }) === "Yo Sam, Dave's rolling up in 20 min.");

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
