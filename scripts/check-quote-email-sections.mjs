// scripts/check-quote-email-sections.mjs
//
// The quote email's two optional sections, and the rule that an empty one is
// never sent.
//
//   npm run check:quote-email-sections
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// "A section that is switched on and empty must never reach a homeowner" is a
// promise made in four places at once: a resolver, a send route, an email
// builder and a dialog. Three of them could keep it while the fourth quietly
// stopped, and the visible symptom would be an email with a heading over a
// blank space — which nobody reports, because the person who sent it never
// sees what arrived.
//
// So nothing below is a description. The pure functions are EXECUTED against
// the rows a UI would rather not hand them, buildQuoteEmail is rendered for a
// real quote shape, and the send route is read as text and checked for the
// gate. The half that cannot be executed — "no other send path composes these
// sections without the gate" — is asserted by grepping every route that sends
// mail for the builders' names.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  QUOTE_EMAIL_SECTION_KEYS,
  QUOTE_EMAIL_SECTIONS,
  QUOTE_EMAIL_COMPANY_SELECT,
  QUOTE_EMAIL_QUOTE_SELECT,
  resolveQuoteEmailSections,
  emptyIncludedSections,
  quoteEmailSectionGate,
  assertQuoteEmailSectionsReady,
  assertSectionFieldsLoaded,
  sanitiseReferences,
  sanitiseBeforeAfter,
  sectionActions,
  telHref,
  QuoteEmailSectionsIncomplete,
} from "../lib/quotes/emailSections.js";
import { buildQuoteEmail } from "../lib/email/quoteEmail.js";
import { documentTheme, fillPair } from "../lib/documents/theme.js";
import { contrastRatio, ensureContrast, accessiblePair } from "../lib/brand/colour.js";
import { SERVICE_PALETTE } from "../lib/documents/serviceContent.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let checks = 0;
let failures = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const REFS = [
  { id: "r1", name: "Anna", phone: "(819) 238-7263" },
  { id: "r2", name: "Felicia", phone: "613-302-2090" },
];
const PAIRS = [
  {
    id: "p1",
    beforeUrl: "https://res.cloudinary.com/x/before1.jpg",
    afterUrl: "https://res.cloudinary.com/x/after1.jpg",
    caption: "Kitchen on Bank St",
  },
];

// Every column resolveQuoteEmailSections reads, so assertSectionFieldsLoaded
// is satisfied. Built from the SELECT constants rather than typed out, which
// is what keeps this fixture honest when a third section is added.
function companyRow(overrides = {}) {
  const base = {};
  for (const field of Object.keys(QUOTE_EMAIL_COMPANY_SELECT)) base[field] = null;
  return {
    name: "Northline Painting",
    brandColor: "#06356b",
    phone: "613-555-0100",
    currency: "CAD",
    ...base,
    quoteEmailIncludeReferences: false,
    quoteEmailIncludeBeforeAfter: false,
    ...overrides,
  };
}

function quoteRow(overrides = {}) {
  const base = {};
  for (const field of Object.keys(QUOTE_EMAIL_QUOTE_SELECT)) base[field] = null;
  return {
    id: "q1",
    quoteNumber: "Q-1042",
    total: 14250,
    validUntil: new Date("2026-09-30T00:00:00Z"),
    processNotes: "We work 8–4 and keep the driveway clear for your car.",
    lineItems: null,
    ...base,
    ...overrides,
  };
}

const SCOPE_GROUPS = [
  {
    label: "Roof replacement",
    subtotal: 12000,
    category: { key: "roofing_service", label: "Roofing" },
    companySettings: null,
    lineItems: [
      { description: "Tear-off, one layer", quantity: 24, amount: 3600 },
      { description: "Architectural shingles, installed", quantity: 24, amount: 8400 },
    ],
  },
  {
    label: "Attic insulation",
    subtotal: 2250,
    category: { key: "insulation", label: "Insulation" },
    companySettings: null,
    lineItems: [{ description: "Blown cellulose to R-60", quantity: 1, amount: 2250 }],
  },
];

// ── 1. Sanitisers, against rows a form would rather not send ───────────────

console.log("\nSanitisers\n");

ok("a reference with no phone is dropped, not repaired",
  sanitiseReferences([{ name: "Anna" }]).length === 0);
ok("a reference with no name is dropped",
  sanitiseReferences([{ phone: "613-555-0100" }]).length === 0);
ok("a phone with no dialable digits is dropped",
  sanitiseReferences([{ name: "Anna", phone: "call me" }]).length === 0);
ok("a short number is not a phone number",
  sanitiseReferences([{ name: "Anna", phone: "1234" }]).length === 0);
ok("whitespace-only fields are absence, not content",
  sanitiseReferences([{ name: "   ", phone: "  " }]).length === 0);
ok("non-objects don't throw",
  sanitiseReferences([null, 7, "Anna", undefined]).length === 0);
ok("a non-array is an empty list, not a crash",
  sanitiseReferences("Anna, 613-555-0100").length === 0);
ok("a good pair survives", sanitiseReferences(REFS).length === 2);
ok("the number is printed exactly as typed",
  sanitiseReferences(REFS)[0].phone === "(819) 238-7263");
ok("…and dialled from a derived tel:",
  telHref("(819) 238-7263") === "tel:8192387263");
ok("a leading + is kept, a stray one is not",
  telHref("+1 (819) 238+7263") === "tel:+18192387263");

ok("half a before/after is dropped",
  sanitiseBeforeAfter([{ beforeUrl: "https://x/1.jpg" }]).length === 0);
ok("a javascript: URL never reaches an <img src>",
  sanitiseBeforeAfter([
    { beforeUrl: "javascript:alert(1)", afterUrl: "https://x/2.jpg" },
  ]).length === 0);
ok("a data: URL is refused too",
  sanitiseBeforeAfter([
    { beforeUrl: "data:image/png;base64,AAA", afterUrl: "data:image/png;base64,BBB" },
  ]).length === 0);
ok("a complete pair survives with its caption",
  sanitiseBeforeAfter(PAIRS)[0].caption === "Kitchen on Bank St");

// ── 2. Resolution: three states, and what each means ───────────────────────

console.log("\nCompany default vs per-quote decision\n");

{
  const company = companyRow({
    quoteEmailIncludeReferences: true,
    quoteEmailReferences: REFS,
  });

  const inherited = resolveQuoteEmailSections({ company, quote: quoteRow() });
  ok("null on the quote follows the company default",
    inherited.references.included && inherited.references.inherited);
  ok("…and takes the company's list",
    inherited.references.source === "company" && inherited.references.items.length === 2);

  const off = resolveQuoteEmailSections({
    company,
    quote: quoteRow({ emailIncludeReferences: false }),
  });
  ok("false on the quote overrides a company default of true",
    !off.references.included && !off.references.inherited);

  const on = resolveQuoteEmailSections({
    company: companyRow({ quoteEmailReferences: REFS }),
    quote: quoteRow({ emailIncludeReferences: true }),
  });
  ok("true on the quote overrides a company default of false", on.references.included);

  const ownList = resolveQuoteEmailSections({
    company,
    quote: quoteRow({ emailReferences: [REFS[0]] }),
  });
  ok("an array on the quote replaces the company list",
    ownList.references.source === "quote" && ownList.references.items.length === 1);

  const emptyOwnList = resolveQuoteEmailSections({
    company,
    quote: quoteRow({ emailReferences: [] }),
  });
  ok("an EMPTY array on the quote is a real override, not a fallback",
    emptyOwnList.references.source === "quote" && emptyOwnList.references.items.length === 0,
    "falling back to the company list here would send references the quote replaced");
  ok("…and that is exactly what blocks the send",
    emptyIncludedSections(emptyOwnList).includes("references"));

  const capped = resolveQuoteEmailSections({
    company: companyRow({
      quoteEmailIncludeReferences: true,
      quoteEmailReferences: Array.from({ length: 20 }, (_, i) => ({
        name: `Ref ${i}`,
        phone: "613-555-0100",
      })),
    }),
    quote: quoteRow(),
  });
  ok("the list is capped, so an email cannot become a wall of phone numbers",
    capped.references.items.length === QUOTE_EMAIL_SECTIONS.references.max);
}

// ── 3. The gate ────────────────────────────────────────────────────────────

console.log("\nThe empty-section gate\n");

{
  const clean = quoteEmailSectionGate({
    company: companyRow(),
    quote: quoteRow(),
  });
  ok("nothing switched on, nothing blocked", clean.ok);

  const filled = quoteEmailSectionGate({
    company: companyRow({
      quoteEmailIncludeReferences: true,
      quoteEmailReferences: REFS,
    }),
    quote: quoteRow(),
  });
  ok("switched on with content, nothing blocked", filled.ok);

  const empty = quoteEmailSectionGate({
    company: companyRow({ quoteEmailIncludeReferences: true }),
    quote: quoteRow(),
  });
  ok("switched on with nothing in it, blocked", !empty.ok);
  ok("…and the block NAMES the section", empty.blocked[0].key === "references");
  ok("…and carries a way to fill it", Boolean(empty.blocked[0].actions.fill.href));
  ok("…and a way to remove it", Boolean(empty.blocked[0].actions.remove.href));
  ok("removing writes the QUOTE's flag, never the company's",
    empty.blocked[0].actions.remove.body.emailIncludeReferences === false &&
      !("quoteEmailIncludeReferences" in empty.blocked[0].actions.remove.body),
    "one rushed quote must not switch the section off for every future one");

  const both = quoteEmailSectionGate({
    company: companyRow({
      quoteEmailIncludeReferences: true,
      quoteEmailIncludeBeforeAfter: true,
    }),
    quote: quoteRow(),
  });
  ok("two empty sections are both named, not just the first",
    both.blocked.length === 2);

  // A section only half-repaired is still refused.
  const halfPair = quoteEmailSectionGate({
    company: companyRow({
      quoteEmailIncludeBeforeAfter: true,
      quoteEmailBeforeAfter: [{ beforeUrl: "https://x/1.jpg" }],
    }),
    quote: quoteRow(),
  });
  ok("a stored row the sanitiser drops leaves the section empty and blocked",
    !halfPair.ok && halfPair.blocked[0].key === "beforeAfter");
}

// ── 4. buildQuoteEmail refuses too — the second enforcement point ──────────

console.log("\nbuildQuoteEmail is the second gate, not a bystander\n");

{
  let threw = null;
  try {
    buildQuoteEmail({
      quote: quoteRow(),
      client: { name: "Jane Fournier" },
      company: companyRow({ quoteEmailIncludeReferences: true }),
      url: "https://app.fieldquo.com/q/abc",
      scopeGroups: SCOPE_GROUPS,
    });
  } catch (err) {
    threw = err;
  }
  ok("an included-but-empty section throws rather than rendering",
    threw instanceof QuoteEmailSectionsIncomplete,
    threw ? threw.name : "nothing thrown");
  ok("…with a code a route can turn into a 409",
    threw?.code === "email_sections_empty");
  ok("…naming the section", threw?.sections?.includes("references"));

  // The subtler failure: a Prisma select that forgot the columns. Boolean
  // (undefined) is false, so without this guard the section is silently off
  // for every quote that route sends.
  let selectErr = null;
  try {
    buildQuoteEmail({
      quote: quoteRow(),
      client: { name: "Jane" },
      company: { name: "Northline", brandColor: "#06356b" },
      url: "https://app.fieldquo.com/q/abc",
      scopeGroups: SCOPE_GROUPS,
    });
  } catch (err) {
    selectErr = err;
  }
  ok("a company row missing the columns fails loudly instead of resolving to 'off'",
    Boolean(selectErr) && /weren't loaded/.test(selectErr.message));

  ok("assertQuoteEmailSectionsReady passes a clean resolution straight through",
    assertQuoteEmailSectionsReady(
      resolveQuoteEmailSections({ company: companyRow(), quote: quoteRow() }),
    ).references.included === false);

  let missing = null;
  try {
    assertSectionFieldsLoaded({}, null);
  } catch (err) {
    missing = err;
  }
  ok("assertSectionFieldsLoaded names the columns that were not selected",
    Boolean(missing) && missing.message.includes("company.quoteEmailIncludeReferences"));
}

// ── 5. The rendered email actually carries the substance ───────────────────

console.log("\nWhat the email contains\n");

const rendered = buildQuoteEmail({
  quote: quoteRow(),
  client: { name: "Jane Fournier" },
  company: companyRow({
    quoteEmailIncludeReferences: true,
    quoteEmailReferences: REFS,
    quoteEmailIncludeBeforeAfter: true,
    quoteEmailBeforeAfter: PAIRS,
  }),
  url: "https://app.fieldquo.com/q/abc123",
  scopeGroups: SCOPE_GROUPS,
});

const html = rendered.html;

ok("the scope groups are named", html.includes("Roof replacement") && html.includes("Attic insulation"));
ok("their line items are priced", html.includes("Tear-off, one layer"));
ok("each group carries its own subtotal", html.includes("$12,000.00"));
ok("what's included is printed, from serviceContent",
  html.includes("Existing material stripped and removed from site"));
ok("what could change the price is printed where the trade declares one",
  html.includes("The condition of the decking"));
// The dominant group by value is the roof, so the steps are the roofing set —
// which is the rule dominantProcessSteps states, asserted rather than assumed.
ok("the process steps are the DOMINANT trade's, numbered",
  html.includes("Consultation and selection") && html.includes("Installation and walkthrough"));
ok("a trade with no published durations prints no invented ones",
  !/·\s*\d+[–-]\d+\s*(days|weeks)/.test(html),
  "MEASURE_SUPPLY_INSTALL carries no timeline, and absence is not a guess");
ok("the company's own process notes are carried",
  html.includes("keep the driveway clear"));
ok("references appear with their numbers", html.includes("Anna") && html.includes("(819) 238-7263"));
ok("…as tel: links", html.includes('href="tel:8192387263"'));
ok("before/after images are there", html.includes("before1.jpg") && html.includes("after1.jpg"));

// The whole point of the ordering: the approve button must not be buried.
const firstCta = html.indexOf("https://app.fieldquo.com/q/abc123");
const firstScope = html.indexOf("Roof replacement");
ok("the approve link comes BEFORE the detail, so the click-through is not lost",
  firstCta !== -1 && firstScope !== -1 && firstCta < firstScope);
ok("…and repeats at the end for the reader who scrolled",
  html.lastIndexOf("https://app.fieldquo.com/q/abc123") > firstScope);

ok("no HTML comment travels to the recipient (Gmail clips at 102KB)",
  !html.includes("<!--") || html.indexOf("<!--") === html.indexOf("<!-- Both of these were missing"),
  "the only permitted one is the charset note in documentEmailLayout");
ok("the email is comfortably under Gmail's clip threshold",
  Buffer.byteLength(html, "utf8") < 102 * 1024,
  `${Math.round(Buffer.byteLength(html, "utf8") / 1024)}KB`);

ok("the plain-text part carries the same argument, not just a link",
  rendered.text.includes("Roof replacement") &&
    rendered.text.includes("Anna") &&
    rendered.text.includes("Existing material stripped"));

// A quote with no groups at all still renders — the flat lineItems path.
{
  const flat = buildQuoteEmail({
    quote: quoteRow({ lineItems: [{ description: "Callout", quantity: 1, amount: 180 }] }),
    client: { name: "Jane" },
    company: companyRow(),
    url: "https://app.fieldquo.com/q/x",
  });
  ok("a quote with no scope groups falls back to its flat line items",
    flat.html.includes("Callout"));
}

// The other half of that: a trade that DOES publish durations prints them.
{
  const insulationLed = buildQuoteEmail({
    quote: quoteRow(),
    client: { name: "Jane" },
    company: companyRow(),
    url: "https://app.fieldquo.com/q/x",
    scopeGroups: [SCOPE_GROUPS[1], { ...SCOPE_GROUPS[0], subtotal: 500 }],
  });
  ok("a trade with published timelines prints them beside the step",
    insulationLed.html.includes("Project review") &&
      insulationLed.html.includes("1–2 days"));
  ok("…and the plain-text part carries them too",
    insulationLed.text.includes("(1–2 days)"));
}

// Removed means removed: no heading, no empty box.
{
  const removed = buildQuoteEmail({
    quote: quoteRow({ emailIncludeReferences: false }),
    client: { name: "Jane" },
    company: companyRow({
      quoteEmailIncludeReferences: true,
      quoteEmailReferences: REFS,
    }),
    url: "https://app.fieldquo.com/q/x",
    scopeGroups: SCOPE_GROUPS,
  });
  ok("a section removed from this quote leaves NO trace in the email",
    !removed.html.includes("Anna") &&
      !removed.html.toUpperCase().includes("SPEAK TO PAST CLIENTS"));
}

// Language follows the client, including the new headings.
{
  const fr = buildQuoteEmail({
    quote: quoteRow(),
    client: { name: "Jean" },
    company: companyRow({
      quoteEmailIncludeReferences: true,
      quoteEmailReferences: REFS,
    }),
    url: "https://app.fieldquo.com/q/x",
    scopeGroups: SCOPE_GROUPS,
    language: "fr",
  });
  ok("the new headings are translated, not bolted on in English",
    fr.html.includes("CE QUI EST COMPRIS") &&
      fr.html.includes("PARLEZ À D'ANCIENS CLIENTS"));
  ok("…and so is the sentence introducing the references",
    fr.html.includes("accepté de recevoir un appel"));
}

// ── 5b. Contrast, measured across hostile brand colours ────────────────────
//
// Every colour pairing this feature introduced, computed rather than eyeballed.
// The brands below are the ones contractors actually pick and the ones that
// break the naive "is it dark? use white" rule: white, yellow, mid grey, hot
// pink, safety orange.

console.log("\nContrast, on the brands that break the naive rule\n");

const HOSTILE = ["#ffffff", "#f7e017", "#808080", "#ff69b4", "#ff6a13", "#0b0b0b", "#06356b"];

for (const brand of HOSTILE) {
  const t = documentTheme({ brandColor: brand });
  const pairs = [
    ["section heading on white", t.accentText, "#ffffff"],
    ["body text on white", t.inkMuted, "#ffffff"],
    ["micro-label on white", t.inkMuted, "#ffffff"],
    ["reference name on the white chip", t.ink, "#ffffff"],
    ["reference phone link on the white chip", t.accentText, "#ffffff"],
    ["references heading on the wash", ensureContrast(t.accent, t.accentWash, 4.5), t.accentWash],
    ["references intro on the wash", t.inkMutedOnWash, t.accentWash],
    ["process notes on the wash", t.inkOnWash, t.accentWash],
    ["step number on its bubble", fillPair(t).fg, fillPair(t).bg],
  ];
  const worst = pairs
    .map(([label, fg, bg]) => ({ label, ratio: contrastRatio(fg, bg) }))
    .sort((a, b) => a.ratio - b.ratio)[0];
  ok(`brand ${brand}: every new pairing clears 4.5:1`,
    worst.ratio >= 4.5,
    `worst is ${worst.label} at ${worst.ratio.toFixed(2)}:1`);
}

// The per-trade badge is the one place a trade accent is a FILL under text.
for (const [name, accent] of Object.entries(SERVICE_PALETTE)) {
  const badge = accessiblePair(accent);
  ok(`trade accent ${name}: the numbered badge clears 4.5:1`,
    contrastRatio(badge.fg, badge.bg) >= 4.5,
    `${contrastRatio(badge.fg, badge.bg).toFixed(2)}:1`);
  ok(`trade accent ${name}: its bullet glyph clears 4.5:1 on the card`,
    contrastRatio(ensureContrast(accent, "#ffffff", 4.5), "#ffffff") >= 4.5);
}

// ── 6. Every send path, read as text ───────────────────────────────────────

console.log("\nNo send path composes these sections without the gate\n");

const sendRoute = read("app/api/quotes/[id]/send/route.js");
ok("the manual send calls the gate", sendRoute.includes("quoteEmailSectionGate("));
ok("…and answers 409 with the blocked sections",
  /code:\s*"email_sections_empty"/.test(sendRoute) && sendRoute.includes("gate.blocked"));
ok("…before it mints a share token or renders a PDF",
  sendRoute.indexOf("quoteEmailSectionGate(") < sendRoute.indexOf("randomBytes(32)"),
  "a refused send must not leave side effects behind");
ok("…and selects the columns the resolver needs",
  sendRoute.includes("QUOTE_EMAIL_COMPANY_SELECT"));
ok("the same route handles the follow-up, so a resend is gated identically",
  sendRoute.includes('body?.kind === "follow_up"'));

// Every route that sends mail. Any of them that starts composing the optional
// sections has to call the gate — buildQuoteEmail's throw covers the case
// where it uses the builder, and this covers the case where it doesn't.
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name === "route.js") out.push(full);
  }
  return out;
}

const SECTION_BUILDERS = ["referencesHtml", "beforeAfterHtml", "resolveQuoteEmailSections"];
let composedWithoutGate = [];
for (const file of walk("app/api")) {
  const src = read(file);
  const sends = /sendEmail\s*\(|resend\.emails\.send/.test(src);
  if (!sends) continue;
  const composes =
    SECTION_BUILDERS.some((name) => src.includes(name)) || src.includes("buildQuoteEmail");
  if (!composes) continue;
  const gated =
    src.includes("quoteEmailSectionGate") || src.includes("buildQuoteEmail");
  if (!gated) composedWithoutGate.push(file);
}
ok("no mail-sending route composes the sections outside the gate",
  composedWithoutGate.length === 0,
  composedWithoutGate.join(", "));

// The follow-up cron renders a company's own template blocks and carries none
// of this. The comment in lib/quotes/emailSections.js says so; this is what
// keeps that from becoming a promise nobody kept.
const cron = read("app/api/cron/follow-ups/route.js");
ok("the follow-up cron still carries none of the optional sections",
  SECTION_BUILDERS.every((name) => !cron.includes(name)) &&
    !cron.includes("buildQuoteEmail"),
  "wire them in there and it needs a gate a cron cannot ask a human to satisfy");

// ── 7. The UI offers both ways out, and every key it uses exists ───────────

console.log("\nThe dialog offers both actions, in words that exist\n");

const modal = read("app/app/quotes/[id]/EmailSectionsBlockedModal.js");
ok("the dialog offers 'add content'", modal.includes("app.quoteEmail.fillAction"));
ok("the dialog offers 'leave it out'", modal.includes("app.quoteEmail.removeAction"));
ok("…and fires the server's OWN remove action rather than a copy of it",
  modal.includes("section.actions?.remove"));

const page = read("app/app/quotes/[id]/page.js");
ok("the quote page opens the dialog on the 409 instead of a red banner",
  page.includes('data?.code === "email_sections_empty"'));
ok("…and the builder's Save & Send hands it over rather than dead-ending",
  read("app/app/quotes/new/page.js").includes("sendBlocked=quote"));

const en = APP_MESSAGES.en || {};
const fr = APP_MESSAGES.fr || {};
for (const key of QUOTE_EMAIL_SECTION_KEYS) {
  const meta = QUOTE_EMAIL_SECTIONS[key];
  ok(`${key}: its label is a defined English string`, typeof en[meta.labelKey] === "string");
  ok(`${key}: and a defined French one`, typeof fr[meta.labelKey] === "string");
  ok(`${key}: the "it's empty" sentence exists in both`,
    typeof en[meta.emptyKey] === "string" && typeof fr[meta.emptyKey] === "string");
  const [fillPath, anchor] = meta.fillHref.split("#");
  const settingsPage = `app${fillPath}/page.js`;
  ok(`${key}: the fill action points at a settings page that exists`,
    fs.existsSync(path.join(ROOT, settingsPage)), meta.fillHref);
  ok(`${key}: …and its #anchor lands on something`,
    !anchor || read(settingsPage).includes(`id="${anchor}"`),
    "a link that scrolls nowhere is a small dead control");
  const actions = sectionActions(key, "q1");
  ok(`${key}: the remove action points at a route that exists`,
    fs.existsSync(path.join(ROOT, "app/api/quotes/[id]/email-sections/route.js")),
    actions.remove.href);
}

console.log(
  `\n${checks} checks, ${failures} failure(s).${
    failures ? "" : " An empty section cannot leave the building."
  }\n`,
);
if (failures) process.exitCode = 1;
