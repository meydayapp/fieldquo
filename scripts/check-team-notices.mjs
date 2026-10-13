// scripts/check-team-notices.mjs
//
//   npm run check:team-notices
//
// Every email FieldQuo sends to a company's OWN team as a notification,
// rendered — the owner, 2026-10-13: "right now these type of emails is a
// simple text email can we add better formatting to the emails that the
// company gets as forms of notifications?"
//
// The notices (each builder is the shipped one; the senders are executed
// against stubs where they can be, and read where they cannot):
//
//   large quote created     app/api/cron/large-quote-check/route.js
//   payment received        lib/notifications/invoicePaymentNotice.js
//   quote approved/declined app/api/public/quotes/[token]/route.js
//   client ticket           lib/clientTickets/service.js (emailOffice)
//   kitchen design request  app/api/self-quote/kitchen/route.js
//   client design saved     app/api/kitchen-design/[token]/route.js
//   photo @mention          lib/photoComments/notify.js (the email fallback)
//   visit cancelled / moved app/admin/lib/email/templates.js (office copy)
//
// For each, in all nine app languages, it proves: the FieldQuo layout as a
// transactional letter, a hidden preheader, a heading, a facts card, exactly
// ONE button and that it opens the exact record, a plain-text part carrying
// the same facts and link; no amount at all for a reader whose grid hides
// money; the English wording is the old wording; the client's half of a
// two-sided event is byte-for-byte what it was (md5 against
// scripts/fixtures/teamNoticeVisitBaseline.json); every pair the card draws
// clears 4.5:1. Then it mutates the code and requires each mutation be caught.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  largeQuoteNotice,
  invoicePaidNotice,
  quoteDecisionNotice,
  clientTicketNotice,
  kitchenRequestNotice,
  kitchenDesignSavedNotice,
  photoMentionNotice,
} from "@/lib/notifications/teamEmails";
import { TEAM_NOTICE_PAIRS, teamNoticeFrom, groupReaders, COMPANY_INBOX, readerSeesMoney } from "@/lib/email/teamNotice";
import { TEAM_NOTICE_LANGUAGES, teamNoticeCopy } from "@/lib/i18n/teamNoticeCopy";
import { memberReaders } from "@/lib/notifications/teamReaders";
import { formatAppMoney } from "@/lib/format/money";
import { buildVisitCancelledEmails, buildVisitRescheduledEmails } from "@/app/admin/lib/email/templates";
import { emailCopy, SUPPORTED_EMAIL_LANGUAGES } from "@/lib/i18n/emailCopy";
import { notifyInvoicePayment } from "@/lib/notifications/invoicePaymentNotice";
import { emailOffice } from "@/lib/clientTickets/service";
import { notifyMentions } from "@/lib/photoComments/notify";
import { appSentence } from "@/lib/notify/push";
import { VISIT_CASES } from "./fixtures/teamNoticeVisitCases.mjs";

let pass = 0;
const fails = [];
const ok = (cond, label, got) => {
  if (cond) pass++;
  else fails.push(`${label}${got !== undefined ? `  got: ${JSON.stringify(got).slice(0, 300)}` : ""}`);
};
const md5 = (s) => createHash("md5").update(String(s)).digest("hex");
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const attr = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const html = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const ORIGIN = "https://app.fieldquo.test";
const OWNER = { role: "owner", permissions: null };
const ADMIN = { role: "admin", permissions: { showPricing: false } }; // admins see money whatever the grid says
const NO_MONEY = { role: "employee", permissions: { showPricing: false, quotes: "view_only" } };
const WITH_MONEY = { role: "employee", permissions: { showPricing: true } };
// A hostile company: a quote mark and angle brackets in the name (the From
// header), an ampersand, a currency that is not dollars.
const COMPANY = { name: 'Northline "Best" <Painting> & Sons', currency: "GBP", timezone: "Europe/London", defaultLanguage: "en" };
const AT = new Date("2026-10-13T14:05:00Z");

// Amounts whose digits appear nowhere else in a letter, so "no amount" can be
// asserted on the digits as well as on the formatted string.
const A = { total: 7777.77, threshold: 6666.66, paid: 5555.55, due: 8888.88, extras: 9393.93, approved: 7979.79, plan: 4848.48 };
// Matched with every grouping and decimal mark taken out ("£7,777.77",
// "7 777,77 £" and "7.777,77" all become 777777), so no locale's
// punctuation can hide one.
const AMOUNT_DIGITS = /777777|666666|555555|888888|939393|797979|484848/;
const digits = (s) => String(s).replace(/[\s,.\u00a0\u202f'\u2019]/g, "");

const CLIENT = "Marie <b>Tremblay</b>";

// ── The notices, as one table ──────────────────────────────────────────────
//
// `build(lang, reader)` is the shipped builder; `url` the record it must open;
// `money` whether the notice is ABOUT an amount (null for a reader without
// money sight); `oldEn` the English it sent before 2026-10-13, word for word
// (with the amount now in the company's currency — the only wording change).
const money = (n, lang = "en") => formatAppMoney(n, COMPANY.currency, lang);
const CASES = [
  {
    name: "large quote created",
    cta: "quote",
    money: true,
    url: `${ORIGIN}/app/quotes/q_1`,
    build: (language, reader) =>
      largeQuoteNotice({
        language,
        company: COMPANY,
        quote: { id: "q_1", quoteNumber: "Q-2026-0042", total: A.total, createdAt: AT, client: { name: CLIENT } },
        threshold: A.threshold,
        writtenBy: "Sam Ortiz",
        reader,
        origin: ORIGIN,
      }),
    oldEn: () => ({
      subject: `Large quote created: ${money(A.total)}`,
      sentences: [`A quote for ${CLIENT} was just created for ${money(A.total)}, above your ${money(A.threshold)} threshold.`],
    }),
    facts: ["client", "quote", "quoteTotal", "threshold", "writtenBy", "created"],
  },
  {
    name: "payment received (part paid)",
    cta: "invoice",
    money: true,
    url: `${ORIGIN}/app/invoices/inv_1`,
    build: (language, reader) =>
      invoicePaidNotice({
        language,
        company: COMPANY,
        invoice: { id: "inv_1", invoiceNumber: "INV-0007", amountDue: A.due, client: { name: CLIENT } },
        amount: A.paid,
        methodLabel: "Klarna",
        paidAt: AT,
        reader,
        origin: ORIGIN,
      }),
    oldEn: () => ({
      subject: "Payment received — Invoice INV-0007",
      sentences: [`${money(A.paid)} was just paid on Invoice INV-0007 for ${CLIENT}.`, `${money(A.due)} still owing.`],
    }),
    facts: ["client", "invoice", "amountPaid", "method", "stillOwing", "paidAt"],
  },
  {
    name: "payment received (paid in full)",
    cta: "invoice",
    money: true,
    url: `${ORIGIN}/app/invoices/inv_2`,
    build: (language, reader) =>
      invoicePaidNotice({
        language,
        company: COMPANY,
        invoice: { id: "inv_2", invoiceNumber: "INV-0008", amountDue: 0, client: null },
        amount: A.paid,
        paidAt: AT,
        reader,
        origin: ORIGIN,
      }),
    oldEn: () => ({
      subject: "Payment received — Invoice INV-0008",
      sentences: [`${money(A.paid)} was just paid on Invoice INV-0008 for a client.`, "Invoice is now paid in full."],
    }),
    facts: ["invoice", "amountPaid", "status", "paidAt"],
  },
  {
    name: "quote approved with extras and a plan",
    cta: "quote",
    money: false,
    url: `${ORIGIN}/app/quotes/q_2`,
    build: (language, reader) =>
      quoteDecisionNotice({
        language,
        company: COMPANY,
        quote: { id: "q_2", quoteNumber: "Q-2026-0043" },
        clientName: CLIENT,
        decision: "accepted",
        priced: { total: A.approved, extras: A.extras, chosen: [{ description: "Crown <moulding>", amount: A.extras }] },
        plansTaken: [{ name: "Annual touch-up", pricePerVisit: A.plan, discountPct: 10 }],
        signedBy: "Marie T.",
        decidedAt: AT,
        reader,
        origin: ORIGIN,
      }),
    oldEn: () => ({
      subject: `${CLIENT} approved Q-2026-0043 — plus ${money(A.extras)} in extras`,
      sentences: [
        `${CLIENT} approved quote Q-2026-0043.`,
        "They also added:",
        "Maintenance plan they signed up for (billed per visit, not in the total):",
        `${money(A.plan)} per visit, 10% off every visit`,
      ],
    }),
    // What a reader without money sight still sees, in English.
    noMoneyEn: { subject: `${CLIENT} approved Q-2026-0043`, keeps: ["Crown <moulding>", "Annual touch-up"] },
    facts: ["client", "quote", "approvedTotal", "signedBy", "decidedAt"],
  },
  {
    name: "quote declined",
    cta: "quote",
    money: false,
    url: `${ORIGIN}/app/quotes/q_3`,
    build: (language, reader) =>
      quoteDecisionNotice({ language, company: COMPANY, quote: { id: "q_3", quoteNumber: "Q-2026-0044" }, clientName: null, decision: "declined", decidedAt: AT, reader, origin: ORIGIN }),
    oldEn: () => ({ subject: "A client declined Q-2026-0044", sentences: ["A client declined quote Q-2026-0044."] }),
    facts: ["quote", "decidedAt"],
  },
  {
    name: "kitchen design request",
    cta: "request",
    money: false,
    url: `${ORIGIN}/app/leads?lead=lead_1`,
    build: (language, reader) =>
      kitchenRequestNotice({ language, company: COMPANY, lead: { id: "lead_1" }, name: CLIENT, cabinets: 14, finish: "Shaker, white", receivedAt: AT, reader, origin: ORIGIN }),
    oldEn: () => ({
      subject: `Kitchen design request — ${CLIENT}`,
      sentences: [`${CLIENT} designed a kitchen on your website and asked for a price.`, "Open the lead to see their drawing, price it, and send them a quote."],
    }),
    facts: ["client", "cabinets", "finish", "received"],
  },
  {
    name: "client design saved",
    cta: "designer",
    money: false,
    url: `${ORIGIN}/app/quotes/q_4/kitchen`,
    build: (language, reader) =>
      kitchenDesignSavedNotice({ language, company: COMPANY, quote: { id: "q_4", quoteNumber: "Q-2026-0045" }, clientName: CLIENT, savedAt: AT, reader, origin: ORIGIN }),
    oldEn: (mail) => ({
      subject: "Client design saved — Q-2026-0045",
      sentences: [
        // The old sentence ended ", <when>." — the time is now the company's
        // zone, so it is read back from the card rather than recomputed here.
        `${CLIENT} saved their own version of the kitchen layout on Q-2026-0045, ${mail.facts.find((f) => f.label === "Saved")?.value}.`,
        "Their changes are kept separate from your drawing — open the designer to compare and decide whether to take them.",
      ],
    }),
    facts: ["client", "quote", "saved"],
  },
  {
    name: "photo mention",
    cta: "job",
    money: false,
    url: `${ORIGIN}/app/jobs/job_1`,
    build: (language, reader) =>
      photoMentionNotice({ language, company: COMPANY, job: { id: "job_1", title: "Kitchen repaint", client: { name: CLIENT } }, authorName: "Sam <i>Ortiz</i>", reader, origin: ORIGIN }),
    oldEn: () => ({
      subject: "Sam <i>Ortiz</i> mentioned you on a job photo",
      sentences: [`Sam <i>Ortiz</i> mentioned you in a comment on a photo for ${CLIENT}.`],
    }),
    facts: ["job", "client", "mentionedBy"],
  },
  {
    name: "client ticket",
    money: false,
    url: `${ORIGIN}/app/tickets/t_1`,
    build: (language, reader) =>
      clientTicketNotice({
        language,
        company: COMPANY,
        ticket: { id: "t_1", subject: "Paint <peeling>" },
        clientName: CLIENT,
        heading: `HEADING-${language}`,
        ctaLabel: `OPEN-${language}`,
        message: "The paint is peeling\nnear the <window>.",
        receivedAt: AT,
        reader,
        origin: ORIGIN,
      }),
    oldEn: () => ({ subject: "HEADING-en", sentences: ["The paint is peeling\nnear the <window>."] }),
    facts: ["client", "subject", "received"],
  },
];

/** The pill button(s) the layout drew. */
const buttons = (h) => [...h.matchAll(/<a href="([^"]*)" style="display:inline-block;padding:14px 32px;/g)].map((m) => m[1]);

function shapeOf(mail, { language, url, label }) {
  ok(mail && typeof mail.subject === "string" && mail.subject.trim(), `${label}: has a subject`);
  ok(/<html lang="/.test(mail.html) && mail.html.includes(`<html lang="${language}"`), `${label}: the layout, in ${language}`, mail.html.slice(0, 80));
  ok(mail.html.includes("A service email about your FieldQuo account") || language !== "en", `${label}: transactional footer`);
  ok(!/Unsubscribe|Manage email preferences/.test(mail.html), `${label}: no unsubscribe on transactional mail`);
  ok(/<div style="display:none;font-size:1px;[^>]*>[^<]+/.test(mail.html) && mail.preheader && mail.html.includes(html(mail.preheader).slice(0, 40)), `${label}: a hidden preheader carrying the first sentence`);
  ok(/<h1 [^>]*>[^<]+<\/h1>/.test(mail.html), `${label}: a heading`);
  ok((mail.html.match(/class="fq-facts"/g) || []).length === 1, `${label}: exactly one facts card`);
  ok(mail.facts.length >= 2, `${label}: the card has at least two facts`, mail.facts.length);
  const b = buttons(mail.html);
  ok(b.length === 1, `${label}: exactly ONE button`, b);
  ok(b[0] === attr(url), `${label}: the button opens the exact record`, b[0]);
  ok(typeof mail.text === "string" && mail.text.length > 40, `${label}: a plain-text part`);
  ok(mail.text.includes(url), `${label}: the text part carries the link`);
  for (const f of mail.facts) {
    if (!f.labelOnly) ok(mail.text.includes(`${f.label}`) && mail.text.includes(String(f.value)), `${label}: the text part carries "${f.label}"`);
    ok(mail.html.includes(html(f.label)), `${label}: the card prints "${f.label}"`);
  }
  for (const part of [mail.subject, mail.text, mail.html]) {
    ok(!/\bundefined\b|\bNaN\b|\[object |Invalid Date/.test(part), `${label}: nothing undefined/NaN printed`, part.match(/.{0,30}(undefined|NaN|\[object |Invalid Date).{0,30}/)?.[0]);
  }
  ok(!/<script|<b>|<i>|<moulding>|<window>|<peeling>/.test(mail.html), `${label}: typed text is escaped in the HTML`);
}

// ── 1. Every notice, every language, an owner ──────────────────────────────
console.log("\n1. Shape, in all nine languages");
ok(TEAM_NOTICE_LANGUAGES.join(",") === "en,fr,es,uk,pa,tl,de,zh,it", "the copy carries the nine app languages", TEAM_NOTICE_LANGUAGES);
const textSnapshot = {};
for (const c of CASES) {
  for (const language of TEAM_NOTICE_LANGUAGES) {
    const mail = c.build(language, OWNER);
    const label = `${c.name} [${language}]`;
    shapeOf(mail, { language, url: c.url, label });
    const t = teamNoticeCopy(language);
    // Its labels are this language's — no English fallback leaking through.
    for (const key of c.facts) ok(mail.facts.some((f) => f.label === t.labels[key]), `${label}: fact "${key}" in ${language}`, mail.facts.map((f) => f.label));
    if (c.cta) ok(mail.cta?.label === t.cta[c.cta] && mail.html.includes(html(t.cta[c.cta])), `${label}: the button's words are ${language}`, mail.cta?.label);
    if (language === "en") textSnapshot[c.name] = md5(mail.text);
  }
}

// ── 2. The English is the old English ──────────────────────────────────────
console.log("2. Wording");
for (const c of CASES) {
  const mail = c.build("en", OWNER);
  const old = c.oldEn(mail);
  ok(mail.subject === old.subject, `${c.name}: subject unchanged`, { now: mail.subject, was: old.subject });
  for (const s of old.sentences) {
    ok(mail.text.includes(s), `${c.name}: text keeps "${s.slice(0, 50)}…"`);
    ok(mail.html.includes(html(s).replace(/\n/g, "<br>")), `${c.name}: HTML keeps "${s.slice(0, 50)}…"`);
  }
}

// ── 3. Money, by role ──────────────────────────────────────────────────────
console.log("3. Money");
ok(readerSeesMoney(OWNER) && readerSeesMoney(ADMIN) && readerSeesMoney(WITH_MONEY) && readerSeesMoney(COMPANY_INBOX), "owner, admin, an employee with showPricing and the company inbox see money");
ok(!readerSeesMoney(NO_MONEY) && !readerSeesMoney(null), "an employee without showPricing — and nobody — does not");
for (const c of CASES) {
  for (const language of TEAM_NOTICE_LANGUAGES) {
    const label = `${c.name} [${language}] for a reader without money sight`;
    const mail = c.build(language, NO_MONEY);
    if (c.money) {
      ok(mail === null, `${label}: not written at all — the notice is about an amount`);
      continue;
    }
    shapeOf(mail, { language, url: c.url, label });
    for (const part of [mail.subject, mail.text, mail.html.replace(/#[0-9a-f]{6}/gi, "")]) {
      ok(!AMOUNT_DIGITS.test(digits(part)), `${label}: no amount anywhere`, digits(part).match(new RegExp(`.{0,40}(${AMOUNT_DIGITS.source}).{0,20}`))?.[0]);
    }
    for (const n of Object.values(A)) ok(!mail.html.includes(html(money(n, language))), `${label}: ${money(n, language)} is not printed`);
  }
  // …and the readers who may see money do see it.
  if (c.money || c.name.startsWith("quote approved")) {
    for (const reader of [OWNER, ADMIN, WITH_MONEY]) {
      const mail = c.build("en", reader);
      ok(mail && AMOUNT_DIGITS.test(digits(mail.text)), `${c.name}: ${reader.role}${reader.permissions?.showPricing ? " with showPricing" : ""} reads the amount`);
    }
  }
  if (c.noMoneyEn) {
    const mail = c.build("en", NO_MONEY);
    ok(mail.subject === c.noMoneyEn.subject, `${c.name}: without money sight the subject drops the extras figure`, mail.subject);
    for (const k of c.noMoneyEn.keeps) ok(mail.text.includes(k), `${c.name}: …and still names "${k}"`);
  }
}

// ── 4. The office copy of a visit a client changed; the client's untouched ─
console.log("4. Visit letters");
const baseline = JSON.parse(read("scripts/fixtures/teamNoticeVisitBaseline.json")).cases;
for (const v of VISIT_CASES) {
  const r = (v.kind === "cancelled" ? buildVisitCancelledEmails : buildVisitRescheduledEmails)({ ...v.args, appointmentId: "ap_1", origin: ORIGIN });
  ok(md5(JSON.stringify({ to: r.client.to, subject: r.client.subject, html: r.client.html })) === baseline[v.name], `${v.name}: the CLIENT's letter is byte-for-byte what it was`);
  if (v.args.initiatedBy === "office") {
    ok(r.company.to === null && r.company.html === null, `${v.name}: an office-made change writes the office nothing`);
    continue;
  }
  const officeLang = v.args.company.defaultLanguage;
  const oc = emailCopy(officeLang).visit;
  const label = `${v.name} office copy`;
  ok(r.company.to === v.args.company.email, `${label}: to the company inbox`);
  ok(buttons(r.company.html).length === 1 && buttons(r.company.html)[0] === attr(`${ORIGIN}/app/appointments?appointment=ap_1`), `${label}: one button, to the appointment`, buttons(r.company.html));
  ok((r.company.html.match(/class="fq-facts"/g) || []).length === 1 && /display:none;font-size:1px;/.test(r.company.html), `${label}: facts card and preheader`);
  ok(r.company.html.includes(`<html lang="${officeLang}"`), `${label}: in the office's language`);
  ok(typeof r.company.text === "string" && r.company.text.includes(`${ORIGIN}/app/appointments?appointment=ap_1`), `${label}: a text part with the link`);
  const headline = v.kind === "cancelled" ? oc.officeCancelledHeadline : oc.officeMovedHeadline;
  const foot = v.kind === "cancelled" ? oc.officeCancelledFootnote : oc.officeMovedFootnote;
  ok(r.company.html.includes(html(headline)) && r.company.text.includes(foot), `${label}: the same headline and footnote`);
  ok(r.company.html.includes("dana@example.test") && r.company.text.includes(oc.client), `${label}: the client's address and the old rows`);
  if (v.args.refund?.amountCents) ok(r.company.text.includes(v.args.refund.refunded ? "49" : "120"), `${label}: the fee line keeps its amount (company inbox)`);
}
{
  // The direct-call default the existing checks rely on, and the sender's own resolution.
  const m = buildVisitCancelledEmails({ ...VISIT_CASES[0].args, company: { ...VISIT_CASES[0].args.company, defaultLanguage: "fr" }, initiatedBy: "client" });
  ok(m.company.html.includes('<html lang="fr"'), "a direct call writes the office copy in the company's language");
  const m2 = buildVisitCancelledEmails({ ...VISIT_CASES[0].args, initiatedBy: "client", officeLanguage: "de" });
  ok(m2.company.html.includes('<html lang="de"') && m2.company.html.includes(html(emailCopy("de").visit.officeCancelledHeadline)), "the resolved office language wins");
  const m3 = buildVisitCancelledEmails({ ...VISIT_CASES[0].args, initiatedBy: "client", appointmentId: null, origin: ORIGIN });
  ok(buttons(m3.company.html)[0] === `${ORIGIN}/app/appointments`, "no appointment row → the calendar, never a dead link");
  const tpl = read("app/admin/lib/email/templates.js");
  ok(/officeLanguageFor\(params\)[\s\S]{0,200}buildVisitCancelledEmails\(\{ \.\.\.params, officeLanguage \}\)/.test(tpl), "sendVisitCancelledEmails resolves the office's language first");
  ok(/officeLanguageFor\(params\)[\s\S]{0,200}buildVisitRescheduledEmails\(\{ \.\.\.params, officeLanguage \}\)/.test(tpl), "…and so does sendVisitRescheduledEmails");
  ok(/inboxLanguage\(params\.company\.id, \(code\) => SUPPORTED_EMAIL_LANGUAGES\.includes\(code\)\)/.test(tpl), "…held to the languages the visit letters exist in");
  ok(/sendEmail\(\{ companyId: sendingCompanyId, \.\.\.letters\.company, \.\.\.sender \}\)/.test(tpl), "the office send spreads the letter, so its text part goes too");
  for (const f of ["app/api/visit/[token]/route.js", "app/api/visit/[token]/reschedule/route.js"]) {
    ok(/appointmentId: booking\.appointmentId \|\| null,/.test(read(f)), `${f} passes the appointment for the button`);
  }
}
ok(SUPPORTED_EMAIL_LANGUAGES.length === 8, "the visit letters' eight languages (zh office readers fall back to the company's)");

// ── 5. The senders, executed against stubs ─────────────────────────────────
console.log("5. Senders");
{
  // Payment received: per-reader language, From header cleaned, the gate.
  const sent = [];
  const db = {
    invoice: {
      findUnique: async () => ({
        id: "inv_9",
        invoiceNumber: "INV-0099",
        total: 20000,
        amountDue: 0,
        companyId: "co_1",
        company: COMPANY,
        client: { name: CLIENT },
      }),
    },
    notificationRule: { findFirst: async () => null },
    member: {
      findMany: async () => [
        { role: "owner", permissions: null, user: { email: "owner@x.test", language: "fr" } },
        { role: "admin", permissions: null, user: { email: "admin@x.test", language: null } },
        // Not who the query asks for — here to prove the builder's gate holds
        // if a wider query ever hands one over.
        { role: "employee", permissions: { showPricing: false }, user: { email: "crew@x.test", language: "en" } },
        { role: "admin", permissions: null, user: { email: "OWNER@x.test", language: "de" } },
      ],
    },
  };
  const r = await notifyInvoicePayment({ invoiceId: "inv_9", amount: A.paid, payment: { method: "stripe", feeRateLabel: "klarna" }, paidAt: AT }, { db, sendEmail: async (m) => (sent.push(m), { id: "re_1" }), origin: ORIGIN });
  ok(r.sent === 2 && sent.length === 2, "payment notice: one email per reader who may see money", sent.map((m) => m.to));
  ok(!sent.some((m) => m.to === "crew@x.test"), "…never the employee without money sight");
  ok(sent.every((m) => m.from === "Northline Best Painting & Sons <notifications@fieldquo.com>"), "…From cleaned of the characters that broke the header", sent[0]?.from);
  const fr = sent.find((m) => m.to === "owner@x.test");
  ok(fr && fr.html.includes('<html lang="fr"') && fr.subject === "Paiement reçu — Facture INV-0099", "…the French owner reads French", fr?.subject);
  ok(fr && fr.text.includes("Klarna") && fr.text.includes(`${ORIGIN}/app/invoices/inv_9`) && fr.text.includes(teamNoticeCopy("fr").invoicePaid.paidInFullStatus), "…with the method, the link and the paid-in-full status", fr?.text);
  const en = sent.find((m) => m.to === "admin@x.test");
  ok(en && en.subject === "Payment received — Invoice INV-0099" && en.text.includes("£"), "…an admin with no language reads the company's, in pounds");
  const muted = await notifyInvoicePayment({ invoiceId: "inv_9", amount: 1 }, { db: { ...db, notificationRule: { findFirst: async () => ({ active: false }) } }, sendEmail: async () => ({}) });
  ok(muted.reason === "muted", "…and a muted rule still mutes");
  const rsp = read("lib/invoices/recordStripePayment.js");
  ok(/invoiceId: inv\.id,\s*\n\s*amount: \(Number\(amountCents\) \|\| 0\) \/ 100,\s*\n\s*payment: \{ method, feeRateLabel: selectedPaymentMethod \|\| fee\?\.feeRateLabel \|\| null \},/.test(rsp), "recordStripePayment hands the notice the CURRENT invoice and the method");
}
{
  // Client ticket: the assignee's language, else the owner's.
  const sent = [];
  const mk = (holder) => ({
    company: { findUnique: async () => ({ name: COMPANY.name, defaultLanguage: "es", timezone: "America/Toronto" }) },
    member: {
      findFirst: async ({ where }) => (where.userId ? holder : { role: "owner", permissions: null, user: { email: "owner@x.test", language: null } }),
    },
  });
  const ticket = { id: "t_9", companyId: "co_1", subject: "Leak <kitchen>", assignedToId: "u_2" };
  await emailOffice({ ticket, client: { name: CLIENT }, kind: "opened", text: "Water\nunder the sink", db: mk({ role: "employee", permissions: { showPricing: false }, user: { email: "tech@x.test", language: "de" } }), send: async (m) => (sent.push(m), { id: "re" }), now: AT });
  const de = sent[0];
  const deHeading = await appSentence("de", "app.clientTickets.email.openedHeading", { clientName: CLIENT, subject: ticket.subject });
  ok(de && de.to === "tech@x.test" && de.subject === deHeading, "ticket: to the assignee, in THEIR language", de?.subject);
  ok(de && buttons(de.html)[0]?.endsWith("/app/tickets/t_9") && de.html.includes('class="fq-facts"') && de.text.includes("Water\nunder the sink"), "…facts card, the ticket's button, the client's words in the text part");
  await emailOffice({ ticket: { ...ticket, assignedToId: null }, client: { name: CLIENT }, kind: "replied", text: "Thanks", db: mk(null), send: async (m) => (sent.push(m), { id: "re" }), now: AT });
  const es = sent[1];
  ok(es && es.to === "owner@x.test" && es.html.includes('<html lang="es"'), "…unassigned: the owner, in the company's language when they chose none", es?.to);
}
{
  // Photo mention: the email fallback.
  const sent = [];
  const updates = [];
  const db = {
    jobPhoto: { findFirst: async () => ({ id: "p1" }) },
    company: { findUnique: async () => ({ name: COMPANY.name, defaultLanguage: "en", timezone: null }) },
    job: { findUnique: async () => ({ title: "Kitchen repaint", client: { name: CLIENT } }) },
    member: {
      findUnique: async () => ({ user: { name: "Sam" } }),
      findMany: async () => [{ id: "mem-1", role: "employee", permissions: null, user: { email: "a@x.test", language: "it", workerProfile: null } }],
    },
    crewInboxNumber: { findUnique: async () => null },
    jobPhotoMention: { updateMany: async (a) => (updates.push(a), { count: 1 }) },
  };
  await notifyMentions({ commentId: "c1", photoId: "p1", jobId: "job_7", companyId: "co_1", authorMemberId: "a1", mentionMemberIds: ["mem-1"] }, { db, sendEmail: async (m) => (sent.push(m), { id: "re" }), origin: ORIGIN });
  const m = sent[0];
  ok(m && m.subject === teamNoticeCopy("it").mention.subject("Sam") && m.html.includes('<html lang="it"'), "mention: in the mentioned person's language", m?.subject);
  ok(m && buttons(m.html)[0] === `${ORIGIN}/app/jobs/job_7` && m.text.includes(`${ORIGIN}/app/jobs/job_7`), "…one button and a text link to the job");
  ok(updates[0]?.data?.notifiedVia === "email", "…and the delivery is recorded as email");
}
{
  // Grouping: one send per (language, money), addresses de-duplicated.
  const readers = memberReaders(
    [
      { role: "owner", permissions: null, user: { email: "a@x.test", language: "en" } },
      { role: "admin", permissions: null, user: { email: "b@x.test", language: "en-CA" } },
      { role: "admin", permissions: null, user: { email: "c@x.test", language: "pa" } },
      { role: "admin", permissions: null, user: { email: "A@x.test", language: "fr" } },
      { role: "admin", permissions: null, user: { email: "", language: "fr" } },
      { role: "employee", permissions: { showPricing: false }, user: { email: "d@x.test", language: "en" } },
    ],
    { defaultLanguage: "xx" },
  );
  const g = groupReaders(readers);
  ok(readers.length === 4, "readers: no address and a repeated address are dropped", readers.map((r) => r.email));
  ok(readers[1].language === "en" && readers[2].language === "pa", "readers: a region is not a different letter; Punjabi is carried");
  ok(g.length === 3 && g[0].to.join() === "a@x.test,b@x.test", "groups: the two English owners share one letter, money and no-money apart", g.map((x) => `${x.language}/${x.seesMoney}:${x.to}`));
}

// ── 6. The senders that cannot run offline, read ───────────────────────────
console.log("6. Wiring");
{
  const lq = read("app/api/cron/large-quote-check/route.js");
  ok(/largeQuoteNotice\(\{/.test(lq) && /text: mail\.text,/.test(lq) && /from: teamNoticeFrom\(rule\.company\.name\)/.test(lq), "large-quote cron: the builder, its text part, the cleaned From");
  ok(!/\$\$\{Number\(quote\.total\)/.test(lq), "large-quote cron: no hardcoded dollar sign");
  ok(/historicalImportedAt: null/.test(lq), "large-quote cron: still skips imported history");
  const pub = read("app/api/public/quotes/[token]/route.js");
  ok(/quoteDecisionNotice\(\{[\s\S]{0,600}reader: group\.reader,[\s\S]{0,400}text: mail\.text,/.test(pub), "quote decision: the builder per reader group, with a text part");
  ok(/attachments,\s*\n\s*html: mail\.html,/.test(pub), "quote decision: the signed PDF still rides with the team's copy");
  ok(/signedPdf = await dispatchDecisionEmails/.test(pub), "quote decision: the PDF is still returned for the job's documents");
  const kq = read("app/api/self-quote/kitchen/route.js");
  ok(/kitchenRequestNotice\(\{/.test(kq) && /text: mail\.text,/.test(kq), "kitchen request: the builder and its text part");
  const kd = read("app/api/kitchen-design/[token]/route.js");
  ok(/kitchenDesignSavedNotice\(\{/.test(kd) && /text: mail\.text,/.test(kd), "design saved: the builder and its text part");
  ok(/OR: \[\{ userId: quote\.createdById \}, \{ role: \{ in: \["owner", "admin"\] \} \}\]/.test(kd), "design saved: still the creator plus owners and admins");
  // No team notice is assembled by hand any more.
  for (const f of ["app/api/cron/large-quote-check/route.js", "lib/notifications/invoicePaymentNotice.js", "lib/photoComments/notify.js", "app/api/kitchen-design/[token]/route.js", "app/api/self-quote/kitchen/route.js"]) {
    ok(!/html: `</.test(read(f)), `${f}: no hand-written HTML notice left`);
  }
}

// ── 7. Hostile input and the From header ───────────────────────────────────
console.log("7. Hostile input");
ok(teamNoticeFrom('A "B" <c@d>') === "A B c@d <notifications@fieldquo.com>", "From: quotes and brackets stripped", teamNoticeFrom('A "B" <c@d>'));
ok(teamNoticeFrom("") === "FieldQuo <notifications@fieldquo.com>" && teamNoticeFrom(null) === "FieldQuo <notifications@fieldquo.com>", "From: no name → FieldQuo");
{
  const m = largeQuoteNotice({ language: "en", company: { ...COMPANY, timezone: "Not/AZone" }, quote: { id: "q", quoteNumber: "Q", total: 1, createdAt: AT, client: { name: "X" } }, threshold: 1, reader: OWNER, origin: ORIGIN });
  ok(m.facts.find((f) => f.label === "Created")?.value.endsWith("UTC"), "a timezone Intl does not know prints UTC and says so", m.facts.find((f) => f.label === "Created"));
  const n = largeQuoteNotice({ language: "en", company: COMPANY, quote: { id: "q", quoteNumber: "", total: 1, createdAt: null, client: null }, threshold: 1, reader: OWNER, origin: ORIGIN });
  ok(!n.facts.some((f) => ["Quote", "Created", "Written by", "Client"].includes(f.label)), "absent facts are absent rows, never blanks or dashes", n.facts.map((f) => f.label));
  const x = largeQuoteNotice({ language: "xx", company: COMPANY, quote: { id: "q", quoteNumber: "Q", total: 1, createdAt: AT }, threshold: 1, reader: OWNER, origin: ORIGIN });
  ok(x.subject.startsWith("Large quote created"), "an unknown language falls back to English, never to a key");
}

// ── 8. Contrast ────────────────────────────────────────────────────────────
console.log("8. Contrast");
const lum = (hex) => {
  const n = hex.replace("#", "");
  const v = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
for (const p of TEAM_NOTICE_PAIRS) ok(ratio(p.fg, p.bg) >= 4.5, `${p.name}: ${ratio(p.fg, p.bg).toFixed(2)}:1`, ratio(p.fg, p.bg));

// ── 9. The English text parts, pinned ──────────────────────────────────────
//
// md5 of every English text part, recorded when this landed. A change to the
// wording, the facts or the order fails here and has to be re-recorded on
// purpose (--record), so a later edit cannot drift a notice silently.
console.log("9. Text parts pinned");
const SNAP = "scripts/fixtures/teamNoticeTextBaseline.json";
if (process.argv.includes("--record")) {
  writeFileSync(new URL(`../${SNAP}`, import.meta.url), JSON.stringify(textSnapshot, null, 2) + "\n");
  console.log(`  recorded ${Object.keys(textSnapshot).length} text parts`);
} else {
  const pinned = JSON.parse(read(SNAP));
  for (const [name, hash] of Object.entries(textSnapshot)) ok(pinned[name] === hash, `${name}: English text part md5 unchanged`, { now: hash, pinned: pinned[name] });
  ok(Object.keys(pinned).length === Object.keys(textSnapshot).length, "every notice is pinned");
}

// ── 10. Mutations ──────────────────────────────────────────────────────────
const MUTATIONS = [
  { file: "lib/email/teamNotice.js", label: "money facts shown to everyone", from: "    if (r.money && !seesMoney) return false;", to: "" },
  { file: "lib/email/teamNotice.js", label: "readers grouped across money sight", from: "    const key = `${r.language || \"en\"}|${seesMoney ? 1 : 0}`;", to: "    const key = `${r.language || \"en\"}`;" },
  { file: "lib/email/teamNotice.js", label: "the facts card dropped", from: '      groups.length ? cardHtml(groups) : "",', to: '      "",' },
  { file: "lib/email/teamNotice.js", label: "no preheader", from: "    preheader: pre,\n    heading,", to: "    preheader: null,\n    heading," },
  { file: "lib/email/teamNotice.js", label: "the text part loses the facts", from: '    ...(factLines.length ? ["", ...factLines] : []),', to: "" },
  { file: "lib/email/teamNotice.js", label: "the From header keeps quotes", from: '.replace(/[<>"]/g, "")', to: "" },
  { file: "lib/email/teamNotice.js", label: "the card's label grey drops below 4.5:1", from: 'const MUTED = "#4b5563";', to: 'const MUTED = "#9ca3af";' },
  { file: "lib/notifications/teamEmails.js", label: "the large-quote alert written for a reader without money sight", from: "export function largeQuoteNotice({ language, company = {}, quote = {}, threshold, writtenBy = null, reader, origin }) {\n  if (!readerSeesMoney(reader)) return null;", to: "export function largeQuoteNotice({ language, company = {}, quote = {}, threshold, writtenBy = null, reader, origin }) {" },
  { file: "lib/notifications/teamEmails.js", label: "the extras figure in the subject whatever the reader", from: "  const subject = tookExtras && seesMoney", to: "  const subject = tookExtras" },
  { file: "lib/notifications/teamEmails.js", label: "the kitchen request opens the bare list", from: "/app/leads?lead=${encodeURIComponent(lead.id || \"\")}", to: "/app/leads" },
  { file: "lib/notifications/teamEmails.js", label: "a hardcoded dollar sign", from: "  const amount = money(quote.total);", to: "  const amount = `$${Number(quote.total).toLocaleString()}`;" },
  { file: "lib/i18n/teamNoticeCopy.js", label: "the English wording drifts", from: "was just paid on Invoice ${number} for ${client}.", to: "was paid on Invoice ${number} for ${client}." },
  { file: "app/admin/lib/email/templates.js", label: "the office copy back on the client's stationery", from: "    : officeNotice({\n        language: officeLang,\n        companyName,\n        subject: officeCopy.officeCancelledSubject", to: "    : null && officeNotice({\n        language: officeLang,\n        companyName,\n        subject: officeCopy.officeCancelledSubject" },
  { file: "app/admin/lib/email/templates.js", label: "the client's letter changes", from: "    headline: esc(copy.cancelledHeadline),", to: "    headline: esc(copy.cancelledHeadline) + \" \"," },
  { file: "lib/notifications/teamReaders.js", label: "every reader in the company's language", from: "      language: letterLanguage(m.user, company, has),", to: "      language: letterLanguage(null, company, has)," },
];
if (!process.argv.includes("--no-mutate") && !process.argv.includes("--record")) {
  console.log("10. Mutations");
  const dir = mkdtempSync(join(tmpdir(), "fq-team-notice-mut-"));
  for (const [i, m] of MUTATIONS.entries()) {
    const path = new URL(`../${m.file}`, import.meta.url);
    const src = readFileSync(path, "utf8");
    if (!src.includes(m.from)) {
      ok(false, `mutation anchor still exists — ${m.label}`);
      continue;
    }
    // Backed up by copy and restored by copy — never by git, which restores the
    // commit rather than the working file.
    const backup = join(dir, `${i}.bak`);
    copyFileSync(path, backup);
    try {
      writeFileSync(path, src.replace(m.from, m.to));
      const run = spawnSync(process.execPath, ["--import", "./scripts/alias-loader.mjs", "--import", "./scripts/db-stub-loader.mjs", "scripts/check-team-notices.mjs", "--no-mutate"], { encoding: "utf8" });
      ok(run.status !== 0, `caught: ${m.label}`);
    } finally {
      copyFileSync(backup, path);
    }
  }
}

for (const f of fails) console.log(`  FAIL ${f}`);
console.log(`${pass} passed, ${fails.length} failed`);
if (fails.length) process.exit(1);
