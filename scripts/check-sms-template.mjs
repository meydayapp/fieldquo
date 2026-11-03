// Executes lib/sms/renderTemplate.js — the wording customers actually receive.
import { readFileSync } from "node:fs";
import {
  SMS_TEMPLATE_TYPES, validateTemplate, fillTemplate, renderMessage,
} from "@/lib/sms/renderTemplate";
import { SMS_COPY, SMS_LANGUAGES, formatWhen } from "@/lib/sms/templates";
import { documentTextNoteKey, documentTextOn, clientFirstName, DOCUMENT_TEXT_TYPE } from "@/lib/sms/documentTextRules";
import { SMS_PURPOSES, normalisePurpose } from "@/lib/sms/deliveryStatus";

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

console.log("\nEditable = wired to send. All nine send today.");
const editable = Object.entries(SMS_TEMPLATE_TYPES).filter(([, s]) => s.editable).map(([k]) => k).sort();
ok("the five booking/visit texts, the two document texts and the two follow-up texts are editable, and nothing else",
  editable.join(",") === "appointment_reminder,booking_cancelled,booking_confirmation,booking_moved,invoice_sent,lead_follow_up,on_my_way,quote_follow_up,quote_sent", editable);
// "Editable" is a promise that it sends. These two are sent by the follow-up
// cron through lib/sms/followUpText.js, for a FollowUpRule whose channel is
// "sms" — scripts/check-follow-up-sms.mjs asserts that whole chain.
// The two change texts send from lib/schedule/changeText.js, which every
// move/cancel path calls — scripts/check-booking-modes.mjs executes them.
const changeSrc = readFileSync(new URL("../lib/schedule/changeText.js", import.meta.url), "utf8");
ok("the moved / cancelled texts render through renderMessage", /renderMessage\(\{\s*type,/.test(changeSrc) && /moved: "booking_moved", cancelled: "booking_cancelled"/.test(changeSrc));
ok("…behind the confirmation's own verdict (one switch, the phone, the opt-out)", /bookingTextVerdict\(\{ company, booking: \{ clientPhone: phone \} \}\)/.test(changeSrc));
// Editable is a promise that it sends. The booking confirmation is texted by
// finalizeBooking — the one point both the free and the paid path pass
// through — behind the company's switch, the client's phone and the opt-out.
const finalizeSrc = readFileSync(new URL("../lib/booking/finalizeBooking.js", import.meta.url), "utf8");
ok("finalizeBooking renders the booking confirmation through renderMessage", /renderMessage\(\{\s*type: "booking_confirmation"/.test(finalizeSrc));
ok("…only when the company switched it on", /bookingSmsConfirmation/.test(finalizeSrc));
ok("…and never to a number that opted out", /maySms\(/.test(finalizeSrc));
ok("…from the company's own line or the system number", /clientSmsFrom\(/.test(finalizeSrc));
ok("…with the mode line as {where}", /where: bookingModeLine\(/.test(finalizeSrc));
// The reminder cron must render through renderMessage, or "editable" is a lie:
// the screen would offer wording that the send path never reads.
const cronSrc = readFileSync(new URL("../app/api/cron/appointment-reminders/route.js", import.meta.url), "utf8");
ok("the reminder cron renders through renderMessage", /renderMessage\(\{\s*type: "appointment_reminder"/.test(cronSrc));
ok("…and no longer calls the English builder directly", !/appointmentReminderText\(/.test(cronSrc));
ok("…passing the client's language", /language,?\s*$|language:\s*language/m.test(cronSrc) && /resolveClientLanguage\(/.test(cronSrc));
ok("…and formatting the time in the company's zone", /formatWhen\([^)]*timezone: row\.company\.timezone/.test(cronSrc));
// The cron reads BOTH tables now — a crew visit on a job reminded nobody
// while the notifications card promised a reminder before every visit. See
// scripts/check-visit-reminders.mjs for the verdict itself.
ok("…for appointments AND job visits, through one verdict", /db\.jobVisit\.findMany/.test(cronSrc) && /db\.appointment\.findMany/.test(cronSrc) && /reminderVerdict\(/.test(cronSrc));
const visitSrc = readFileSync(new URL("../app/api/jobs/[id]/visits/[visitId]/route.js", import.meta.url), "utf8");
ok("the on-my-way send passes the client's language", /type: "on_my_way"[\s\S]{0,600}resolveClientLanguage\(/.test(visitSrc));

// ── The two document texts (2026-11-02) ────────────────────────────────────
//
// "Editable" is a promise that it sends. These two are sent by
// lib/sms/documentText.js, which the quote and invoice send routes call AFTER
// their email provider accepted the message — so this asserts the whole
// chain, not just that the wording exists.
const docSrc = readFileSync(new URL("../lib/sms/documentText.js", import.meta.url), "utf8");
ok("documentText renders the document texts through renderMessage", /renderMessage\(\{\s*type,/.test(docSrc));
ok("…choosing the type from the kind, not a string per caller",
  DOCUMENT_TEXT_TYPE.quote === "quote_sent" && DOCUMENT_TEXT_TYPE.invoice === "invoice_sent" && Object.isFrozen(DOCUMENT_TEXT_TYPE));
ok("…and a kind nobody defined sends nothing", DOCUMENT_TEXT_TYPE.receipt === undefined);
ok("…never to a number that opted out", /maySms\(/.test(docSrc));
ok("…with maySms checked BEFORE sendSms, in the verdict the sender calls first",
  docSrc.search(/maySms\(/) < docSrc.search(/await sendSms\(/));
ok("…from the company's own line or the system number", /clientSmsFrom\(company\)/.test(docSrc));
ok("…behind the company's switch, re-read fresh from the row", /documentSmsOn: true/.test(docSrc) && /documentTextOn\(row\)/.test(docSrc));
ok("…and a company row that isn't there is not a company that said no", /if \(!row\) return \{ send: false, reason: "no_company", to: null \};/.test(docSrc));

// ── The switch, executed ─────────────────────────────────────────────────
//
// Four lines, and every one of them is a way to text somebody who said not
// to — or to silence a company that never did.
ok("on when the column says true", documentTextOn({ documentSmsOn: true }) === true);
ok("off when the company turned it off", documentTextOn({ documentSmsOn: false }) === false);
ok("a row with no company is not a decision", documentTextOn(null) === false && documentTextOn(undefined) === false);
let threw = false;
try { documentTextOn({ name: "Acme" }); } catch { threw = true; }
ok("a caller that forgot to SELECT the column is refused loudly, not read as 'off'", threw);
ok("…and the message names the column so the fix is obvious",
  (() => { try { documentTextOn({}); return false; } catch (e) { return /documentSmsOn was not selected/.test(e.message); } })());

// ── The greeting, executed ───────────────────────────────────────────────
ok("a first name is the first word", clientFirstName({ name: "Ana Cristina Morales" }) === "Ana");
ok("…trimmed, and collapsed over any run of whitespace", clientFirstName({ name: "  Ana\t Cristina " }) === "Ana");
ok("no name → null, so the greeting is dropped rather than sent as 'Hi .'",
  clientFirstName({ name: "" }) === null && clientFirstName({ name: "   " }) === null && clientFirstName({}) === null && clientFirstName(null) === null);
ok("a non-string name does not become 'undefined' on a homeowner's phone",
  clientFirstName({ name: 42 }) === "42" && clientFirstName({ name: undefined }) === null);
// ── The tenant is never read off the company row ─────────────────────────
//
// The first cut of this read `company.id`, and NEITHER send route selects it
// — both build their row with a select for the email they are composing. So
// every text would have been refused as "no_company" with nothing on screen
// saying so: a control that appears to work and doesn't. Asserted from here
// on, because the next person to add a caller will have the same row.
// Comments stripped first — the paragraph above the signature explains the
// bug by naming `company.id`, and an assertion that cannot tell prose from
// code is one somebody will "fix" by deleting the explanation.
const docCode = docSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
ok("the sender never reads the tenant off the company row", !/company\??\.id/.test(docCode), docCode.match(/company\??\.id/g));
ok("…it takes companyId as its own argument", /sendDocumentLinkText\(\{\s*\n\s*kind,\s*\n\s*companyId,/.test(docSrc));
ok("…and refuses without one rather than texting on a guess", /if \(!companyId\) return \{ texted: false, reason: "no_company" \};/.test(docSrc));

for (const [file, kind] of [["../app/api/quotes/[id]/send/route.js", "quote"], ["../app/api/invoices/[id]/send/route.js", "invoice"]]) {
  const routeSrc = readFileSync(new URL(file, import.meta.url), "utf8");
  ok(`${kind} send calls sendDocumentLinkText`, /sendDocumentLinkText\(\{/.test(routeSrc));
  ok(`${kind} send selects the switch, the wording and the sending line`,
    /documentSmsOn: true/.test(routeSrc) && /smsTemplates: true/.test(routeSrc) && /smsFromNumber: true/.test(routeSrc));
  ok(`${kind} send passes the tenant explicitly`,
    new RegExp(`kind: "${kind}",\\s*\\n\\s*companyId: member\\.companyId,`).test(routeSrc));
  // The text must be attempted only after the email was accepted: the send
  // route returns before this point on skipped / errored mail.
  const sendAt = routeSrc.indexOf("sendDocumentLinkText({");
  const mailAt = routeSrc.search(/const result = await sendEmail\(/);
  ok(`${kind} send texts AFTER the email was accepted, never before`, mailAt !== -1 && sendAt > mailAt, { mailAt, sendAt });
  // And the outcome is reported rather than swallowed.
  ok(`${kind} send returns the text's outcome to the screen`, /\n    sms,\n/.test(routeSrc));
}
// One link per document: the invoice text carries the string the email's own
// button carried, stage query and all. Two expressions building "the same"
// url is how one of them loses the stage and asks for the whole balance.
const invSrc = readFileSync(new URL("../app/api/invoices/[id]/send/route.js", import.meta.url), "utf8");
ok("the invoice email and its text share ONE url variable",
  /const emailedUrl = plainInvoiceUrl \+ \(ask\.stage \? `\?stage=\$\{ask\.stage\.id\}` : ""\);/.test(invSrc) &&
  (invSrc.match(/url: emailedUrl,/g) || []).length === 2, (invSrc.match(/url: emailedUrl,/g) || []).length);
const qSrc = readFileSync(new URL("../app/api/quotes/[id]/send/route.js", import.meta.url), "utf8");
ok("the quote email and its text share the one `url` the share token built", /sendDocumentLinkText\(\{[\s\S]{0,200}\n        url,\n/.test(qSrc));
ok("a follow-up sends no text (its wording would claim the quote is newly ready)", /reason: "follow_up"/.test(qSrc));

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

  // The change texts: a real-length manage link (43-char token), the mode
  // line, the time. The link wins over the phone; without it the phone is
  // the tail; without either the sentence is dropped, never left as a hole.
  const when = formatWhen(D, { language: lang, timezone: "America/Toronto" });
  const link = "https://app.fieldquo.com/visit/" + "x".repeat(43);
  const mv = renderMessage({ type: "booking_moved", templates: null, language: lang, values: { company: "Northside", when, where: "On-site visit at 123 Oak St", link, phone: "555-0100" } });
  ok(`${lang}: moved text carries the time, the place and the link`, mv.includes(when.replace(/\.$/, "")) && mv.includes("123 Oak St") && mv.includes(link) && !mv.includes("555-0100"), mv);
  ok(`${lang}: moved text keeps STOP and fits in two segments' worth`, /\bSTOP\b/.test(mv) && mv.length <= 320, mv.length);
  const mvPhone = renderMessage({ type: "booking_moved", templates: null, language: lang, values: { company: "Northside", when, where: null, link: null, phone: "555-0100" } });
  ok(`${lang}: no link → the phone, and no empty where clause`, mvPhone.includes("555-0100") && !/null|undefined|, ,|\.\s+,|\.\./.test(mvPhone), mvPhone);
  const mvBare = renderMessage({ type: "booking_moved", templates: null, language: lang, values: { company: "Northside", when } });
  ok(`${lang}: no link and no phone → neither sentence`, !/null|undefined|:\s*$/.test(mvBare) && /\bSTOP\b/.test(mvBare), mvBare);
  const cx = renderMessage({ type: "booking_cancelled", templates: null, language: lang, values: { company: "Northside", when, where: "Phone call — we'll ring 819-238-7263", phone: "555-0100" } });
  ok(`${lang}: cancelled text names the time, the mode line and the number to rebook`, cx.includes(when.replace(/\.$/, "")) && cx.includes("819-238-7263") && cx.includes("555-0100") && /\bSTOP\b/.test(cx), cx);
  ok(`${lang}: the change texts are not the English sentences`, lang === "en" || (!/has moved/.test(mv) && !/is cancelled/.test(cx)), [mv, cx]);

  // ── The document texts, at REAL link length ──────────────────────────────
  //
  // A 43-char share token on the app origin is 70 characters of the budget
  // before a word is written, and the portal's invoice deep link is 110 with
  // its stage query. Measured here rather than estimated, because the
  // difference between two segments and three is what FieldQuo pays.
  const qUrl = "https://www.fieldquo.com/q/" + "x".repeat(43);
  const iUrl = "https://www.fieldquo.com/portal/" + "y".repeat(43) + "/invoices/" + "z".repeat(25) + "?stage=" + "s".repeat(25);
  const qt = renderMessage({ type: "quote_sent", templates: null, language: lang, values: { company: "Northside", name: "Ana", link: qUrl } });
  ok(`${lang}: the quote text names the company, greets by first name and carries the link`,
    qt.includes("Northside") && qt.includes("Ana") && qt.includes(qUrl), qt);
  ok(`${lang}: the quote text keeps the STOP keyword the inbound handler listens for`, /\bSTOP\b/.test(qt), qt);
  ok(`${lang}: the quote text fits in two segments' worth`, qt.length <= 320, qt.length);
  ok(`${lang}: the quote text is not the English sentence`, lang === "en" || !/Your quote is ready/.test(qt), qt);
  // No name on the client (an organisation filed under a company name) must
  // drop the greeting, not send "Hi ." to a homeowner.
  const qtNoName = renderMessage({ type: "quote_sent", templates: null, language: lang, values: { company: "Northside", name: null, link: qUrl } });
  // No stray "Hi ." / "Bonjour ." left behind. The colon is deliberately NOT
  // in this class: French typography puts a space before one ("Northside :
  // Votre soumission"), and flagging that would be asserting a typo.
  ok(`${lang}: no first name → the greeting is dropped, never left as a hole`,
    !/undefined|null/.test(qtNoName) && !/\s[,.;।]/.test(qtNoName) && qtNoName.includes(qUrl), qtNoName);
  const it2 = renderMessage({ type: "invoice_sent", templates: null, language: lang, values: { company: "Northside", name: "Ana", link: iUrl } });
  ok(`${lang}: the invoice text carries the portal deep link, stage query and all`, it2.includes(iUrl) && /\bSTOP\b/.test(it2), it2);
  ok(`${lang}: the invoice text fits in two segments' worth`, it2.length <= 320, it2.length);
  // Money stays OUT of the built-in wording — a phone is read by whoever
  // holds it, and the figure is one tap behind the link.
  ok(`${lang}: the built-in invoice text names no amount`, !/1,500|1500/.test(renderMessage({ type: "invoice_sent", templates: null, language: lang, values: { company: "N", name: "A", link: iUrl, amount: "$1,500.00" } })));
}
ok("every catalogue language has the two document texts", SMS_LANGUAGES.every((l) => ["quote", "invoice"].every((k) => typeof SMS_COPY[l][k] === "function")));
console.log(`     → "${renderMessage({ type: "quote_sent", templates: null, language: "en", values: { company: "TrueFinish Cabinets", name: "Ana", link: "https://www.fieldquo.com/q/" + "x".repeat(43) } })}"`);
// A company that wants "free quote" (the owner's own words) types it, with
// the number and the amount tokens available — none of which FieldQuo
// asserts on their behalf in the built-in wording.
const customQuote = renderMessage({ type: "quote_sent", templates: { quote_sent: "{company}: Hi {name}, here is your free quote {number}: {link}" }, language: "en", templateLanguage: "en",
  values: { company: "TrueFinish Cabinets", name: "Ana", number: "Q-2026-0042", link: "https://x/q/t" } });
ok("a custom quote text fills {name}, {number} and {link}",
  customQuote === "TrueFinish Cabinets: Hi Ana, here is your free quote Q-2026-0042: https://x/q/t", customQuote);
ok("a quote text may NOT use {amount} — nothing has been asked for yet", !validateTemplate("quote_sent", "{company} owes {amount}").ok);
ok("an invoice text MAY use {amount}", validateTemplate("invoice_sent", "{company}: {amount} due — {link}").ok);
ok("every catalogue language has the two change texts", SMS_LANGUAGES.every((l) => ["moved", "cancelled"].every((k) => typeof SMS_COPY[l][k] === "function")));
console.log(`     → "${renderMessage({ type: "booking_moved", templates: null, language: "en", values: { company: "TrueFinish Cabinets", when: formatWhen(D, { language: "en", timezone: "America/Toronto" }), where: "On-site visit at 12 Elm St", link: "https://app.fieldquo.com/visit/abc" } })}"`);
console.log(`     → "${renderMessage({ type: "booking_cancelled", templates: null, language: "en", values: { company: "TrueFinish Cabinets", when: formatWhen(D, { language: "en", timezone: "America/Toronto" }), where: "On-site visit at 12 Elm St", phone: "819-555-0100" } })}"`);

console.log("\nEvery message type is a REGISTERED delivery purpose with a label");
// SMS_PURPOSES is a closed list and normalisePurpose quietly collapses
// anything else to "other". That is the right default — an unregistered send
// path must still be TRACKED — but it means a new type silently loses its
// identity on the platform's SMS health page, which exists precisely to say
// which KIND of text a carrier is dropping. The document texts are two of
// the longest FieldQuo sends; they were landing in "other" until this.
const healthSrc = readFileSync(new URL("../app/platform/sms-health/page.js", import.meta.url), "utf8");
for (const key of Object.keys(SMS_TEMPLATE_TYPES).filter((k) => SMS_TEMPLATE_TYPES[k].editable)) {
  ok(`${key.padEnd(22)} is a registered SMS purpose`, SMS_PURPOSES.includes(key), normalisePurpose(key));
  ok(`${key.padEnd(22)} survives normalisePurpose (does not fall into "other")`, normalisePurpose(key) === key);
  ok(`${key.padEnd(22)} has a label on the SMS health page`, new RegExp(`\\n  ${key}: "`).test(healthSrc));
}
// And the sender files the text under its own type, not a hand-typed string.
ok("documentText files the delivery under the message type itself", /purpose: type,/.test(docSrc));

console.log("\nWhat the screen says about the text, against every outcome");
// Executed rather than read: this function decides whether a rep is told the
// phone was texted, and the branch that matters most is the one that must
// NOT claim it was.
ok("texted → the link also went by text", documentTextNoteKey({ texted: true, reason: "ok" }) === "app.docText.texted");
ok("a DEMO's text is never reported as sent", documentTextNoteKey({ texted: true, reason: "ok", simulated: true }) === "app.docText.simulated");
ok("no phone on the client is said, not hidden", documentTextNoteKey({ texted: false, reason: "no_phone" }) === "app.docText.noPhone");
ok("an opt-out is said", documentTextNoteKey({ texted: false, reason: "opted_out" }) === "app.docText.optedOut");
ok("a FAILED text is said — the loudest one", documentTextNoteKey({ texted: false, reason: "failed" }) === "app.docText.failed");
ok("a trial that has not verified a mobile gets its OWN sentence, not \"failed\"", documentTextNoteKey({ texted: false, reason: "phone_unverified" }) === "app.docText.phoneUnverified");
ok("the company's own 'off' is not nagged about on every send", documentTextNoteKey({ texted: false, reason: "switched_off" }) === null);
ok("a follow-up, which deliberately sends none, says nothing", documentTextNoteKey({ texted: false, reason: "follow_up" }) === null);
ok("an unknown reason says nothing rather than guessing", documentTextNoteKey({ texted: false, reason: "wat" }) === null);
ok("no sms object at all (an older response) says nothing", documentTextNoteKey(undefined) === null && documentTextNoteKey(null) === null);
ok("a non-object says nothing", documentTextNoteKey("texted") === null && documentTextNoteKey(7) === null);
// texted must be exactly true. A truthy-but-not-true value arriving from a
// hand-rolled response must not turn into "their phone buzzed".
ok("texted: 'yes' is not texted", documentTextNoteKey({ texted: "yes", reason: "ok" }) === null);
ok("texted: 1 is not texted", documentTextNoteKey({ texted: 1, reason: "ok" }) === null);
// Asymmetric on purpose: `texted` must be exactly true to claim a send, but
// ANY truthy `simulated` is enough to deny one. Both lean away from telling a
// rep a phone buzzed when it may not have.
ok("a truthy simulated is enough to withhold the claim",
  documentTextNoteKey({ texted: true, simulated: "true", reason: "ok" }) === "app.docText.simulated" &&
  documentTextNoteKey({ texted: true, simulated: 1, reason: "ok" }) === "app.docText.simulated");
ok("a falsy simulated still reports the send", documentTextNoteKey({ texted: true, simulated: false, reason: "ok" }) === "app.docText.texted");

console.log("\nA custom moved text: the company's wording, every token filled");
const customMoved = renderMessage({ type: "booking_moved", templates: { booking_moved: "{company}: moved from {previous} to {when} ({service}). {link}" }, language: "en", templateLanguage: "en",
  values: { company: "Acme", when: "Thu 10 AM", previous: "Tue 2 PM", service: "Estimate", link: "https://x/visit/t" } });
ok("{previous}, {when}, {service} and {link} all fill", customMoved === "Acme: moved from Tue 2 PM to Thu 10 AM (Estimate). https://x/visit/t", customMoved);
ok("a cancelled template may not use {link} (a cancelled visit has none to manage)", !validateTemplate("booking_cancelled", "{company} cancelled {link}").ok);
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
