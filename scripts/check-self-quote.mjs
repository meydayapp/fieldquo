// scripts/check-self-quote.mjs
//
//   npm run check:self-quote
//
// The public self-quote flow: /quote/<slug>, its two API routes, the
// confirmation document and the confirmation email.
//
// ── What this is actually guarding ──────────────────────────────────────────
//
// Five things, all of which were broken or absent when it was written:
//
//   1. The public endpoint must return NO rate or price field. It is
//      unauthenticated, and a rate card on it is handed to every competitor in
//      the city (AGENTS.md non-negotiable 4).
//   2. The confirmation must be COMPOSED from the shared document furniture —
//      lib/selfQuote/confirmation.js, lib/email/documentEmailLayout.js — not
//      hand-built twice. The email and the screen saying different things
//      about the same submission is the failure this exists to prevent.
//   3. Every language the company says it sends in must be offered, and the
//      primary must lead.
//   4. The chosen language must reach the created record and survive
//      conversion into a quote. It was destructured from the request body and
//      dropped on the floor.
//   5. Contrast at 4.5:1 on the pairings this page introduces, measured
//      against the brands contractors actually pick — the near-white, the
//      bright yellow and the mid grey, not just navy.
//
// Executed, not read: the pure modules are imported and run. The two React/
// route files are checked textually, for the reason check-brand-scope.mjs
// gives — what is being asserted about them is which module they compose
// from, and that is a property of the source rather than of any one render.

import fs from "node:fs";
import { buildConfirmation, budgetOptions, timelineOptions, currencySymbol } from "@/lib/selfQuote/confirmation";
import { buildSelfQuoteEmail } from "@/lib/email/selfQuoteEmail";
import { escapeHtml } from "@/lib/email/documentEmailLayout";
import { sendLanguagesFor, primarySendLanguage, resolveRequestedLanguage } from "@/lib/company/sendLanguages";
import { publicIntakeFields, getIntakeFields, INTAKE_FIELDS } from "@/app/data/quoteIntakeFields";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentTheme, fillPair, ruleColor } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { LANGUAGE_CODES } from "@/app/i18n/languages";

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};

const read = (p) => fs.readFileSync(p, "utf8");
// Comments are stripped before scanning source, for the reason
// check-imports.mjs gives: a scanner that reads prose as code eventually flags
// the paragraph explaining why the code is right. Every file here carries
// comments naming the very things being asserted absent.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FLOW = "app/quote/[companySlug]/SelfQuoteFlow.js";
const GET_ROUTE = "app/api/self-quote/[companySlug]/route.js";
const POST_ROUTE = "app/api/self-quote/route.js";

const flowSrc = strip(read(FLOW));
const getSrc = strip(read(GET_ROUTE));
const postSrc = strip(read(POST_ROUTE));

// The brands contractors actually pick. The first three are the hostile ones —
// each defeats a different naive rule — and two are real rows in the product's
// own database (a near-white #ffffff and a pale yellow #fefcdd).
const BRANDS = {
  navy: "#06356b",
  "bright yellow": "#FFEB00",
  white: "#ffffff",
  "pale yellow": "#fefcdd",
  "mid grey": "#808080",
  "olive (mid-tone)": "#7a7d3c",
  black: "#000000",
  lime: "#32CD32",
};

const company = (brandColor, extra = {}) => ({
  name: "Big painter Inc",
  brandColor,
  email: "hello@bigpainter.test",
  phone: "613-555-0100",
  currency: "CAD",
  defaultLanguage: "en",
  sendLanguages: [],
  ...extra,
});

const SERVICE = {
  label: "Interior painting",
  fields: [
    { key: "rooms", label: "Rooms" },
    { key: "ceilingHeight", label: "Ceiling height" },
  ],
};

const SUBMISSION = {
  contact: {
    name: "Sam Rivera",
    email: "sam@example.test",
    phone: "613-555-0142",
    address: "12 King St W, Ottawa",
  },
  service: SERVICE,
  details: { rooms: "4", ceilingHeight: "over_9ft" },
  description: "Two coats, cutting in around new trim.",
  budgetBand: "1k_5k",
  timeline: "2_weeks",
};

// ───────────────────────────────────────────────────────────────────────────
console.log("\n1. The public API never returns a rate or a price");

// Every key the GET route hands back, read off the source rather than guessed,
// so a field added later is caught by the same rule.
const PRICE_WORDS = /\b(rate|rates|price|prices|pricing|amount|cost|costs|total|subtotal|unitPrice|hourlyRate|markup|margin|rateCard)\b/i;
const responseBlock = getSrc.slice(getSrc.indexOf("NextResponse.json("));
ok("GET returns no price-shaped field", !PRICE_WORDS.test(responseBlock), responseBlock.match(PRICE_WORDS)?.[0]);
ok("GET selects no rate column from the company", !/\brates?\b|\bcabinetRates\b|\bpricing\b/i.test(getSrc.slice(0, getSrc.indexOf("findBookingCompany") + 400)));
ok("GET does not select every company field", !/findBookingCompany\(\s*companySlug\s*\)/.test(getSrc));

// The field list the form shows is capped and typed. A category whose intake
// includes a priced field must not leak it through the public helper.
// Swept across every category rather than a sample: the cap and the type
// filter are only interesting on the categories where they actually bite, and
// picking one by hand is how a check ends up asserting a no-op. 22 of the 60
// categories have a boolean/text/photo field inside the first three, so a
// dropped filter shows up here and nowhere else.
const ALL_CATEGORIES = Object.keys(INTAKE_FIELDS);
ok("there are categories to sweep", ALL_CATEGORIES.length > 50, ALL_CATEGORIES.length);
ok("every category caps at 3 public fields", ALL_CATEGORIES.every((k) => publicIntakeFields(k).length <= 3), ALL_CATEGORIES.filter((k) => publicIntakeFields(k).length > 3));
ok("every category exposes only number/select", ALL_CATEGORIES.every((k) => publicIntakeFields(k).every((f) => f.type === "number" || f.type === "select")), ALL_CATEGORIES.filter((k) => publicIntakeFields(k).some((f) => f.type !== "number" && f.type !== "select")));
// Shape, not vocabulary. A word filter here flags the QUESTIONS ("Total Wall
// Length", "Pricing Method") — which are what the form asks, not what the
// company charges — while missing the thing that would actually matter: a rate
// riding along as an extra property on the field object. So the assertion is
// that a public field carries these four keys and nothing else. Anything the
// pricing config hangs off a field definition later fails here.
const FIELD_KEYS = new Set(["key", "label", "type", "options", "unit", "placeholder", "help"]);
const strayKeys = ALL_CATEGORIES.flatMap((k) => publicIntakeFields(k).flatMap((f) => Object.keys(f).filter((p) => !FIELD_KEYS.has(p))));
ok("no public field carries a property beyond its definition", strayKeys.length === 0, [...new Set(strayKeys)]);
ok("no public field carries a numeric value of its own", ALL_CATEGORIES.every((k) => publicIntakeFields(k).every((f) => typeof f.value === "undefined" && typeof f.rate === "undefined" && typeof f.price === "undefined")));
ok("select options are plain strings, never priced pairs", ALL_CATEGORIES.every((k) => publicIntakeFields(k).every((f) => !f.options || f.options.every((o) => typeof o === "string"))));
ok("the type filter is a real narrowing on some category", ALL_CATEGORIES.some((k) => getIntakeFields(k).slice(0, 3).some((f) => f.type !== "number" && f.type !== "select")));
ok("the cap is a real narrowing on some category", ALL_CATEGORIES.some((k) => getIntakeFields(k).filter((f) => f.type === "number" || f.type === "select").length > 3));
ok("an unknown category yields nothing rather than throwing", publicIntakeFields("not_a_trade").length === 0);

// The POST is where a figure could most plausibly creep back in.
ok("POST sends no estimate to the browser", !/estimate\s*:/.test(postSrc.slice(postSrc.indexOf("return NextResponse.json"))));

const emailHtml = buildSelfQuoteEmail({ company: company("#06356b"), ...SUBMISSION, language: "en" }).html;

// The ONLY currency text allowed anywhere in this email is the budget band the
// homeowner chose from a closed list of five — their own words handed back.
// Everything else with a currency symbol in it would be the company's money,
// and none of the company's money has been calculated.
const noBudget = buildSelfQuoteEmail({ company: company("#06356b"), ...SUBMISSION, budgetBand: null, language: "en" }).html;
ok("with no budget band, the email has no currency figure at all", !/[$€£]\s?\d/.test(noBudget), noBudget.match(/[$€£]\s?\d[\d,.]*/)?.[0]);
const bandLabels = budgetOptions(clientDocCopy("en").selfQuote, "$").map((o) => o.label);
const figures = emailHtml.match(/[$€£]\s?[\d,.]+/g) || [];
ok("with a budget band, every currency figure is that band's own label", figures.length > 0 && figures.every((f) => bandLabels.some((l) => l.includes(f))), figures);
ok("the gated path renders no amount block", !emailHtml.includes("font-size:30px"));

// "Reads as intentional, not as a failure": the withheld figure has to be
// replaced by a SENTENCE, and that exact sentence has to reach both surfaces.
// Asserting merely that the word "priced" appears somewhere was too weak —
// step 2 of "what happens next" also contains it, so blanking the note would
// have passed.
const gatedDoc = buildConfirmation({ company: company("#06356b"), ...SUBMISSION, language: "en" });
ok("the gate is closed on every self-quote", gatedDoc.amount.show === false);
ok("...and carries no low/high at all", gatedDoc.amount.low === undefined && gatedDoc.amount.high === undefined, gatedDoc.amount);
ok("...and the withheld figure is replaced by a real sentence", typeof gatedDoc.amount.note === "string" && gatedDoc.amount.note.length > 40, gatedDoc.amount.note);
ok("...that sentence appears in the email, escaped exactly as the layout escapes it", emailHtml.includes(escapeHtml(gatedDoc.amount.note)), gatedDoc.amount.note);
ok("...and the page renders doc.amount.note rather than a blank", /doc\.amount\.note/.test(flowSrc));
ok("...translated, not English on a French request", buildConfirmation({ company: company("#06356b"), language: "fr" }).amount.note !== gatedDoc.amount.note);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n2. The confirmation composes from shared furniture, not bespoke markup");

ok("flow imports the shared confirmation builder", /from "@\/lib\/selfQuote\/confirmation"/.test(flowSrc));
ok("flow calls buildConfirmation", /buildConfirmation\(/.test(flowSrc));
ok("flow themes from lib/documents/theme", /from "@\/lib\/documents\/theme"/.test(flowSrc));
ok("email pours into the shared document shell", /documentEmailHtml\(/.test(strip(read("lib/email/selfQuoteEmail.js"))));
ok("email uses the shared prepared-for panel", /preparedForBlock\(/.test(strip(read("lib/email/selfQuoteEmail.js"))));
ok("email uses the shared amount block", /amountBlock\(/.test(strip(read("lib/email/selfQuoteEmail.js"))));
ok("the quote email uses that same shell", /documentEmailHtml\(/.test(strip(read("lib/email/quoteEmail.js"))));
ok("ClientInfoSection delegates to the same panel", /preparedForBlock\(/.test(strip(read("lib/documentSections/ClientInfoSection.js"))));

// The point of sharing: page and email describe ONE submission identically.
const doc = buildConfirmation({ company: company("#06356b"), ...SUBMISSION, language: "en" });
ok("doc names the service", doc.requested.title === "Interior painting");
ok("doc labels intake keys, not raw field names", doc.requested.lines.some((l) => l.label === "Rooms" && l.value === "4"));
ok("doc humanises an unknown key rather than dropping it", buildConfirmation({ company: company("#06356b"), details: { doorCount: 40 }, language: "en" }).requested.lines[0].label === "Door Count");
ok("doc translates the timeline key, never echoes it", doc.requested.lines.some((l) => l.value === "Within 2 weeks") && !JSON.stringify(doc.requested.lines).includes("2_weeks"));
ok("doc translates the budget band", doc.requested.lines.some((l) => /1,000/.test(l.value)));
ok("doc's client panel is ClientInfoSection's shape", ["name", "address", "email", "phone"].every((k) => k in doc.client));
ok("email repeats the page's service line", emailHtml.includes("Interior painting"));
ok("email repeats the page's prepared-for name", emailHtml.includes("Sam Rivera"));
ok("email heading is the document word, not QUOTE", emailHtml.includes("REQUEST") && !/>QUOTE</.test(emailHtml));
ok("doc word is Request, not Quote", doc.masthead.word === "Request");

// Absent data stays absent — no invented dashes, zeroes or Mon-Fri padding.
const bare = buildConfirmation({ company: company("#06356b"), contact: { name: "Sam" }, language: "en" });
ok("blank intake yields no lines", bare.requested.lines.length === 0, bare.requested.lines);
ok("blank description yields no note", bare.requested.note === null);
ok("no service yields no title", bare.requested.title === null);
ok("empty answers are dropped, not rendered blank", buildConfirmation({ company: company("#06356b"), details: { rooms: "", ceilingHeight: null }, language: "en" }).requested.lines.length === 0);
ok("nothing to say -> email omits the prepared-for panel", !buildSelfQuoteEmail({ company: company("#06356b"), contact: {}, language: "en" }).html.includes("PREPARED FOR"));

// Hostile input: the homeowner controls every one of these strings.
const xss = buildSelfQuoteEmail({
  company: { name: "<script>alert(1)</script>", brandColor: "#06356b" },
  contact: { name: '"><img src=x onerror=alert(1)>', address: "<b>12 King</b>" },
  service: { label: "<svg onload=1>", fields: [] },
  details: { "<i>k</i>": "<u>v</u>" },
  description: "</td></table><script>x</script>",
  language: "en",
});
ok("no unescaped <script> survives into the email", !/<script/i.test(xss.html));
ok("no unescaped <img onerror> survives", !/<img src=x/i.test(xss.html));
ok("no unescaped <svg onload> survives", !/<svg onload/i.test(xss.html));
ok("the attacker's angle brackets are entities", xss.html.includes("&lt;"));
ok("plain-text alternative exists and is not empty", xss.text.length > 40);
ok("missing everything still builds", typeof buildSelfQuoteEmail({}).html === "string");
ok("missing everything still has a subject", buildSelfQuoteEmail({}).subject.length > 0);

// ───────────────────────────────────────────────────────────────────────────
console.log("\n3. Every language the company sends in is offered, primary first");

ok("flow reads the API's languages list", /data\.languages|d\.languages/.test(flowSrc));
// Specifically the INITIAL value: defaulting to a literal "en" would render a
// picker that works and opens on the wrong language for every francophone
// company, which no amount of "the list is read somewhere" would catch.
ok("flow opens on the primary from that list", /setLanguage\(\s*d\.languages\?\.\[0\]/.test(flowSrc));
ok("flow hardcodes no language for the picker", !/setLanguage\("(en|fr|es|uk|pa|tl)"\)/.test(flowSrc));
ok("flow renders a picker", /LanguagePicker/.test(flowSrc));
ok("picker is hidden when there is no choice", /languages\.length > 1/.test(flowSrc));
ok("GET returns the shared list", /sendLanguagesFor\(company\)/.test(getSrc));

ok("no stated list -> the default only", sendLanguagesFor({ defaultLanguage: "fr", sendLanguages: [] }).join() === "fr");
ok("no stated list -> never all six", sendLanguagesFor({ defaultLanguage: "en", sendLanguages: [] }).length === 1);
ok("null sendLanguages -> the default only", sendLanguagesFor({ defaultLanguage: "es", sendLanguages: null }).join() === "es");
ok("garbage defaultLanguage -> en", sendLanguagesFor({ defaultLanguage: "klingon", sendLanguages: [] }).join() === "en");
ok("no company at all -> en", sendLanguagesFor().join() === "en");

const stated = sendLanguagesFor({ defaultLanguage: "en", sendLanguages: ["fr", "en", "es"] });
ok("every stated language is offered", ["en", "fr", "es"].every((l) => stated.includes(l)), stated);
ok("...primary leads", stated[0] === "en", stated);
ok("...no duplicates", new Set(stated).size === stated.length);
ok("default not in the stated list does not jump the queue", sendLanguagesFor({ defaultLanguage: "en", sendLanguages: ["fr", "es"] })[0] === "fr");
ok("unsupported codes are filtered out", !sendLanguagesFor({ defaultLanguage: "en", sendLanguages: ["fr", "klingon"] }).includes("klingon"));
ok("primarySendLanguage agrees with the list head", primarySendLanguage({ defaultLanguage: "fr", sendLanguages: ["en", "fr"] }) === "fr");

// Every offered language must actually have copy, or the picker offers a
// language the page cannot render.
for (const code of LANGUAGE_CODES) {
  const cp = clientDocCopy(code).selfQuote;
  ok(`${code}: self-quote copy exists`, Boolean(cp));
  ok(`${code}: copy is not the English fallback`, code === "en" || cp.confirmTitle !== clientDocCopy("en").selfQuote.confirmTitle, cp?.confirmTitle);
  ok(`${code}: budget labels interpolate the symbol`, budgetOptions(cp, "£")[0].label.includes("£"));
  ok(`${code}: all four timeline options are translated`, timelineOptions(cp).every((o) => typeof o.label === "string" && o.label.length > 2));
  ok(`${code}: every key the English set has`, Object.keys(clientDocCopy("en").selfQuote).every((k) => k in cp), Object.keys(clientDocCopy("en").selfQuote).filter((k) => !(k in cp)));
}
ok("currencySymbol falls back to the code, never undefined", currencySymbol("XYZ") === "XYZ " && currencySymbol() === "$");

// ───────────────────────────────────────────────────────────────────────────
console.log("\n4. The chosen language reaches the created record and survives");

// Sliced to the exact call, not searched across the whole file: the language
// is threaded through three separate calls in this route, and a whole-file
// regex passes as long as ANY of them still mentions it — which is how a
// dropped one hides.
const sliceCall = (src, open) => {
  const from = src.indexOf(open);
  if (from < 0) return "";
  const to = src.indexOf("});", from);
  return to < 0 ? "" : src.slice(from, to);
};
const createCall = sliceCall(postSrc, "createScoredLead({");
const emailCall = sliceCall(postSrc, "buildSelfQuoteEmail({");
ok("the createScoredLead call was found to inspect", createCall.length > 40);
ok("the email call was found to inspect", emailCall.length > 40);

ok("POST reads language off the body", /\blanguage,/.test(postSrc));
ok("POST resolves it against the company's list", /resolveRequestedLanguage\(company, language\)/.test(postSrc));
ok("POST writes it onto the LEAD", /language:\s*docLanguage/.test(createCall), createCall.slice(0, 80));
ok("POST writes the same one into the EMAIL", /language:\s*docLanguage/.test(emailCall));
ok("the two are the same variable, resolved once", (postSrc.match(/const docLanguage =/g) || []).length === 1);
ok("createScoredLead persists it", /language:\s*isSupported\(input\.language\)/.test(strip(read("lib/leads/createLead.js"))));
ok("the schema has somewhere to put it", /model LeadRequest[\s\S]*?\blanguage\s+String\?/.test(read("prisma/schema.prisma")));
ok("conversion seeds Quote.language from the lead", /language:\s*lead\.language\s*\|\|/.test(strip(read("lib/leads/convertLead.js"))));
ok("...and does NOT hardcode the company default alone", !/language:\s*company\.defaultLanguage \|\| "en",/.test(strip(read("lib/leads/convertLead.js"))));
// Same trap on the client: `language: lang,` appears both in the POST body and
// in the buildConfirmation call, so it has to be asserted inside the request.
const bodyStart = flowSrc.indexOf("body: JSON.stringify({");
const postBody = flowSrc.slice(bodyStart, flowSrc.indexOf("}),", bodyStart));
ok("flow posts the language it rendered in", /language:\s*lang,/.test(postBody), postBody.slice(0, 60));
ok("flow builds the confirmation in that same language", /language:\s*lang,/.test(flowSrc.slice(flowSrc.indexOf("buildConfirmation({"))));

// The server must not accept a language the company never offered.
const co = { defaultLanguage: "en", sendLanguages: ["en", "fr"] };
ok("an offered language is kept", resolveRequestedLanguage(co, "fr") === "fr");
ok("an unoffered language falls back to primary", resolveRequestedLanguage(co, "es") === "en");
ok("a garbage language falls back to primary", resolveRequestedLanguage(co, "'; DROP TABLE") === "en");
ok("no language at all falls back to primary", resolveRequestedLanguage(co, undefined) === "en");
ok("single-language company pins everything to it", resolveRequestedLanguage({ defaultLanguage: "es", sendLanguages: [] }, "fr") === "es");

// The document is CREATED in the language, never translated at send time.
const fr = buildSelfQuoteEmail({ company: company("#06356b"), ...SUBMISSION, language: "fr" });
ok("a French request produces a French subject", /Votre demande/.test(fr.subject), fr.subject);
ok("a French request produces a French masthead word", fr.html.includes("DEMANDE"));
ok("a French request produces a French prepared-for label", fr.html.includes("PRÉPARÉ POUR"));
ok("an English request stays English", buildSelfQuoteEmail({ company: company("#06356b"), ...SUBMISSION, language: "en" }).html.includes("PREPARED FOR"));
ok("nothing machine-translates the homeowner's own words", fr.html.includes("Two coats, cutting in around new trim."));
ok("the doc reports the language it was built in", buildConfirmation({ company: company("#06356b"), language: "uk" }).language === "uk");

// ───────────────────────────────────────────────────────────────────────────
console.log("\n5. Contrast, measured, across the brands contractors actually pick");

const AA = 4.5;
for (const [name, hex] of Object.entries(BRANDS)) {
  const t = documentTheme({ brandColor: hex });
  const f = fillPair(t);

  ok(`${name}: fill vs its foreground`, contrastRatio(f.fg, f.bg) >= AA, contrastRatio(f.fg, f.bg).toFixed(2));
  ok(`${name}: accentText on paper (masthead word, next-steps heading)`, contrastRatio(t.accentText, t.paper) >= AA, contrastRatio(t.accentText, t.paper).toFixed(2));
  ok(`${name}: ink on paper`, contrastRatio(t.ink, t.paper) >= AA, contrastRatio(t.ink, t.paper).toFixed(2));
  ok(`${name}: inkMuted on paper (hints, labels)`, contrastRatio(t.inkMuted, t.paper) >= AA, contrastRatio(t.inkMuted, t.paper).toFixed(2));
  ok(`${name}: inkOnWash (prepared-for name, chip text)`, contrastRatio(t.inkOnWash, t.accentWash) >= AA, contrastRatio(t.inkOnWash, t.accentWash).toFixed(2));
  ok(`${name}: inkMutedOnWash (prepared-for contact line)`, contrastRatio(t.inkMutedOnWash, t.accentWash) >= AA, contrastRatio(t.inkMutedOnWash, t.accentWash).toFixed(2));
  ok(`${name}: ink on page behind the card`, contrastRatio(t.ink, t.page) >= AA, contrastRatio(t.ink, t.page).toFixed(2));
  // The rule across the top of the card is decoration, not text — 3:1 is the
  // bar, and the point is that a near-white brand must not draw an invisible
  // line that reads as a rendering fault.
  ok(`${name}: brand rule is visible against paper`, contrastRatio(ruleColor(t), t.paper) >= 1.6, contrastRatio(ruleColor(t), t.paper).toFixed(2));
}

// The regression this replaces: the raw brand hex used as text on white.
const pale = documentTheme({ brandColor: "#fefcdd" });
ok("the raw brand hex on paper would have failed (why accentText exists)", contrastRatio(pale.accent, pale.paper) < AA, contrastRatio(pale.accent, pale.paper).toFixed(2));
ok("...and the flow never paints text with the raw hex", !/color:\s*accent\b/.test(flowSrc) && !/brandColor\b/.test(flowSrc));
ok("the flow imports no hand-rolled fallback hex", !/#06356b/.test(flowSrc));

// ───────────────────────────────────────────────────────────────────────────
console.log("\n6. The controls the owner reported missing exist and are wired");

ok("address field is the Google autocomplete component", /<AddressAutocomplete/.test(flowSrc));
ok("...and its onChange still writes the typed value (degrades without Maps)", /onChange=\{\(v\) => setContact/.test(flowSrc));
ok("...and it is not gated on isLoaded here", !/isLoaded/.test(flowSrc));
ok("phone is formatted as it is typed", /formatPhoneInput\(e\.target\.value\)/.test(flowSrc));
ok("...from the shared helper, not a local copy", /from "@\/lib\/validation"/.test(flowSrc) && !/replace\(\/\\D\/g/.test(flowSrc));
ok("the confirmation is not the old four-line card", !/we&apos;ve got it/.test(flowSrc));
ok("the flow no longer hardcodes English sentences", !/Where should we send it\?/.test(flowSrc) && !/Rough budget/.test(flowSrc));
ok("the POST sends a confirmation email", /buildSelfQuoteEmail\(/.test(postSrc) && /sendEmail\(/.test(postSrc));
ok("...on the company's own sender, not FieldQuo's", /resolveSender\(company/.test(postSrc));
ok("...best-effort, so mail cannot fail the submission", /catch \(err\)[\s\S]{0,200}confirmation email failed/.test(read(POST_ROUTE)));
ok("the page only claims a copy was sent when one was", /done\.emailed/.test(flowSrc));
ok("both halves of the round trip resolve the slug the same way", /findBookingCompany\(/.test(getSrc) && /findBookingCompany\(/.test(postSrc));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
