// scripts/check-form-look.mjs
//
//   npm run check:form-look
//   node --import ./scripts/alias-loader.mjs scripts/check-form-look.mjs
//
// The public form's configurable fields and its appearance presets, executed
// rather than read:
//
//   1. lib/estimate/formFields.js against hostile input — unknown field
//      names, unknown states, both contact fields hidden, non-objects — and
//      the two locks (a measured address, a service area).
//   2. lib/estimate/formAppearance.js against hostile input — a radius
//      outside the set, unknown keys, arrays — and the default really being
//      the default.
//   3. Every preset × surface × field style measured on the real brand
//      colours in the database (TrueFinish's gold, the navy default) and on
//      the hostile set (white, silver, pale yellow, lime, black, mid-grey,
//      red): every TEXT pair ≥ 4.5:1, printed as a table.
//   4. The wiring: the public payload carries `fields` and no rate; the
//      request route reads the same table and refuses what it must; the
//      settings route normalises and refuses both-hidden; the pages and the
//      embed read the look on the server and never off the URL; the wrapper
//      renders nothing on the default look; the copy carries the new
//      sentences in all three languages.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  FORM_FIELD_KEYS,
  DEFAULT_FORM_FIELDS,
  normaliseFormFields,
  effectiveFormFields,
  contactRule,
  contactSatisfied,
} from "@/lib/estimate/formFields";
import {
  DEFAULT_FORM_APPEARANCE,
  FIELD_STYLES,
  RADII,
  FONT_PRESET_KEYS,
  BUTTON_STYLES,
  SURFACES,
  DENSITIES,
  normaliseFormAppearance,
  isDefaultAppearance,
  formPalette,
  formLookVars,
  fontStylesheetUrl,
  themeUnderLook,
  FORM_LOOK_CSS,
} from "@/lib/estimate/formAppearance";
import { documentTheme } from "@/lib/documents/theme";
import { INSTANT_QUOTE_COPY, INSTANT_QUOTE_LANGUAGES } from "@/lib/i18n/instantQuoteCopy";

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got === undefined ? "" : `\n      got: ${JSON.stringify(got)}`}`);
  }
};

// ── 1. Fields ───────────────────────────────────────────────────────────────
console.log("\nFields — hostile input");
{
  const r = normaliseFormFields({ photos: "optional", budget: "banana", bogus: 1, __proto__: { x: 1 } });
  ok("unknown state falls back to the default and is named", r.fields.budget === "required" && r.problems.some((p) => p.key === "budget" && p.problem === "unknown_state"));
  ok("unknown field is dropped and named", !("bogus" in r.fields) && r.problems.some((p) => p.key === "bogus"));
  ok("a valid state is kept", r.fields.photos === "optional");
  ok("nothing else changed", FORM_FIELD_KEYS.filter((k) => k !== "photos").every((k) => r.fields[k] === DEFAULT_FORM_FIELDS[k]));
  const both = normaliseFormFields({ phone: "hidden", email: "hidden" });
  ok("both contact fields hidden is named `contact`", both.problems.some((p) => p.key === "contact" && p.problem === "both_hidden"));
  ok("...and corrected to both optional rather than saved", both.fields.phone === "optional" && both.fields.email === "optional");
  for (const junk of [null, undefined, "required", 42, [], ["photos"], true]) {
    const j = normaliseFormFields(junk);
    ok(`${JSON.stringify(junk)} -> the defaults, no throw`, JSON.stringify(j.fields) === JSON.stringify(DEFAULT_FORM_FIELDS));
  }
  ok("the defaults are today's behaviour: photos, budget, when and address required; notes, phone, email optional",
    DEFAULT_FORM_FIELDS.photos === "required" && DEFAULT_FORM_FIELDS.budget === "required" && DEFAULT_FORM_FIELDS.timeline === "required" && DEFAULT_FORM_FIELDS.address === "required" && DEFAULT_FORM_FIELDS.notes === "optional" && DEFAULT_FORM_FIELDS.phone === "optional" && DEFAULT_FORM_FIELDS.email === "optional");
}
console.log("\nFields — the two locks");
{
  for (const measure of ["roof_address", "gutter_address", "lawn_address"]) {
    const e = effectiveFormFields({ address: "hidden" }, { measure });
    ok(`${measure}: address locked to required (measured)`, e.fields.address === "required" && e.locks.address === "measured");
  }
  const area = effectiveFormFields({ address: "optional" }, { measure: "manual_units", serviceAreaConfigured: true });
  ok("service area drawn: address locked to required (service_area)", area.fields.address === "required" && area.locks.address === "service_area");
  const free = effectiveFormFields({ address: "hidden" }, { measure: "manual_units", serviceAreaConfigured: false });
  ok("no area, not measured: the owner's `hidden` stands", free.fields.address === "hidden" && free.locks.address === null);
  const ph = effectiveFormFields({ phone: "hidden" }, { measure: "manual_units" });
  ok("phone hidden -> email required, lock names email", ph.fields.email === "required" && ph.locks.contact === "email");
  const em = effectiveFormFields({ email: "hidden", phone: "optional" }, { measure: "manual_units" });
  ok("email hidden -> phone required, lock names phone", em.fields.phone === "required" && em.locks.contact === "phone");
  ok("rule: both optional -> either", contactRule(DEFAULT_FORM_FIELDS) === "either");
  ok("rule: both required -> both", contactRule({ phone: "required", email: "required" }) === "both");
  ok("either: a phone alone satisfies", contactSatisfied(DEFAULT_FORM_FIELDS, { phone: "613 555 0100" }));
  ok("either: whitespace is not a phone", !contactSatisfied(DEFAULT_FORM_FIELDS, { phone: "   ", email: "" }));
  ok("phone required: an email alone does not satisfy", !contactSatisfied({ phone: "required", email: "optional" }, { email: "a@b.co" }));
  ok("both required: one is not enough", !contactSatisfied({ phone: "required", email: "required" }, { phone: "1" }));
  ok("non-string contact values never satisfy", !contactSatisfied(DEFAULT_FORM_FIELDS, { phone: 5551234, email: { a: 1 } }));
}

// ── 2. Appearance ───────────────────────────────────────────────────────────
console.log("\nAppearance — hostile input");
{
  const r = normaliseFormAppearance({ radius: "huge", fieldStyle: "pill", nope: 1, surface: "dark", fontPreset: "Comic Sans" });
  ok("a radius outside the set falls back and is named", r.appearance.radius === "medium" && r.problems.some((p) => p.key === "radius"));
  ok("an unknown key is dropped and named", !("nope" in r.appearance) && r.problems.some((p) => p.key === "nope"));
  ok("an unknown font falls back to system", r.appearance.fontPreset === "system");
  ok("valid values are kept", r.appearance.fieldStyle === "pill" && r.appearance.surface === "dark");
  for (const junk of [null, undefined, "dark", 7, [], ["dark"], true]) {
    ok(`${JSON.stringify(junk)} -> the default, no throw`, isDefaultAppearance(normaliseFormAppearance(junk).appearance));
  }
  ok("the default is the default", isDefaultAppearance(DEFAULT_FORM_APPEARANCE) && isDefaultAppearance({}) && isDefaultAppearance({ radius: "medium" }));
  ok("one changed key is not the default", !isDefaultAppearance({ radius: "none" }));
  ok("system font has no stylesheet", fontStylesheetUrl("system") === null && fontStylesheetUrl("bogus") === null);
  ok("every other preset has a Google Fonts css2 url with display=swap", FONT_PRESET_KEYS.filter((k) => k !== "system").every((k) => /^https:\/\/fonts\.googleapis\.com\/css2\?family=.+&display=swap$/.test(fontStylesheetUrl(k))));
  ok("FORM_LOOK_CSS is scoped to .fq-look on every rule", FORM_LOOK_CSS.split("\n").filter((l) => l.trim()).every((l) => l.startsWith(".fq-look")));
  ok("...and uses no !important", !/!important/.test(FORM_LOOK_CSS));
  const vars = formLookVars(formPalette("#bd9d60", { surface: "dark" }));
  ok("the wrapper sets Tailwind's theme variables", ["--background", "--card", "--foreground", "--muted-foreground", "--border"].every((k) => k in vars));
  const t = documentTheme({ brandColor: "#bd9d60" });
  ok("themeUnderLook: no palette -> the theme untouched", themeUnderLook(t, null) === t);
  ok("themeUnderLook: a light palette changes the page only", (() => { const u = themeUnderLook(t, formPalette("#bd9d60", { surface: "brand-wash" })); return u.ink === t.ink && u.page !== t.page; })());
  ok("themeUnderLook: a dark palette swaps the inks", themeUnderLook(t, formPalette("#bd9d60", { surface: "dark" })).ink !== t.ink);
}

// ── 3. Contrast ─────────────────────────────────────────────────────────────
console.log("\nContrast — every preset × surface × field style × button style");
{
  // The real brand colours in the database on 2026-09-24 (read by hand):
  // TrueFinish Cabinets #bd9d60; Test Inc., Sunset Space and Luma Painting
  // all on the default navy #06356b. Then the hostile set the theme module
  // is already checked against.
  const BRANDS = [
    ["TrueFinish", "#bd9d60"],
    ["navy default", "#06356b"],
    ["white", "#ffffff"],
    ["silver", "#c0c0c0"],
    ["pale yellow", "#fefcdd"],
    ["lime", "#84cc16"],
    ["black", "#000000"],
    ["mid grey", "#808080"],
    ["red", "#dc2626"],
    ["invalid", "not-a-colour"],
  ];
  const rows = [];
  let combos = 0;
  let worst = { ratio: 99 };
  for (const [name, hex] of BRANDS) {
    for (const surface of SURFACES) {
      let minForSurface = 99;
      for (const fieldStyle of FIELD_STYLES) {
        for (const buttonStyle of BUTTON_STYLES) {
          for (const radius of RADII) {
            for (const density of DENSITIES) {
              combos++;
              const p = formPalette(hex, { surface, fieldStyle, buttonStyle, radius, density, fontPreset: "system" });
              const min = Math.min(...p.checks.filter((c) => c.need >= 4.5).map((c) => c.ratio));
              if (min < minForSurface) minForSurface = min;
              if (min < worst.ratio) worst = { ratio: min, name, surface, fieldStyle, buttonStyle };
              if (p.failures.length) {
                ok(`${name} ${surface} ${fieldStyle} ${buttonStyle}: no text pair under 4.5`, false, p.failures.map((f) => `${f.label} ${f.ratio}`));
              }
            }
          }
        }
      }
      rows.push([name, hex, surface, minForSurface.toFixed(2)]);
    }
  }
  ok(`${combos} combinations measured, none with a text pair under 4.5:1 (worst ${worst.ratio} — ${worst.name} ${worst.surface} ${worst.fieldStyle} ${worst.buttonStyle})`, worst.ratio >= 4.5, worst);
  console.log("\n  brand            hex          surface      min text ratio");
  for (const [name, hex, surface, min] of rows) {
    console.log(`  ${name.padEnd(16)} ${hex.padEnd(12)} ${surface.padEnd(12)} ${min}`);
  }
  const gold = formPalette("#bd9d60", { surface: "light", buttonStyle: "solid" });
  ok("TrueFinish light solid: button edge on card ≥ 3 (drawn by the accentText border, as today)", gold.checks.find((c) => c.key === "button_edge").ok);
  const navyDark = formPalette("#06356b", { surface: "dark", buttonStyle: "solid" });
  ok("navy on dark: the button fill was lifted off the card (edge ≥ 3)", navyDark.checks.find((c) => c.key === "button_edge").ok && navyDark.button.bg !== "#06356b", navyDark.button);
  const whiteDark = formPalette("#ffffff", { surface: "dark", buttonStyle: "outline" });
  ok("white brand, dark outline: label and edge both legible", whiteDark.checks.find((c) => c.key === "button_label").ok && whiteDark.checks.find((c) => c.key === "button_edge").ok);
  const under = formPalette("#06356b", { surface: "light", fieldStyle: "underlined" });
  ok("underlined: the line is ≥ 3:1 on the card (it IS the field)", under.checks.find((c) => c.key === "field_line").ok, under.checks.find((c) => c.key === "field_line"));
  ok("every check carries a key the settings screen can translate", gold.checks.every((c) => /^[a-z_]+$/.test(c.key)));
}

// ── 4. Wiring ───────────────────────────────────────────────────────────────
console.log("\nWiring");
{
  const server = read("lib/estimate/instantQuoteServer.js");
  const request = read("app/api/instant-quote/[companySlug]/request/route.js");
  const settings = read("app/api/settings/instant-quote/route.js");
  const flow = read("app/instant-quote/[companySlug]/InstantQuoteFlow.js");
  const self = read("app/quote/[companySlug]/SelfQuoteFlow.js");
  const embed = read("app/embed/[companySlug]/[widget]/page.js");
  const instantPage = read("app/instant-quote/[companySlug]/page.js");
  const quotePage = read("app/quote/[companySlug]/page.js");
  const preview = read("app/form-preview/[companySlug]/page.js");
  const wrapper = read("app/components/public/FormLook.js");
  const loader = read("lib/estimate/publicFormLook.js");
  const card = read("app/app/settings/instant-quotes/TradeCard.js");
  const page = read("app/app/settings/instant-quotes/page.js");

  ok("public payload: each trade carries effectiveFormFields(...).fields", /fields: effectiveFormFields\(config\?\.fields, \{ measure: spec\.measure, serviceAreaConfigured: areaConfigured \}\)\.fields/.test(server));
  ok("public payload: the area verdict is computed server-side from the row", /const areaConfigured = serviceAreaConfigured\(company\)/.test(server));
  ok("request route: reads the same table with the same locks", /effectiveFormFields\(await loadInstantFormFields\(company\.id, trade\), \{\s*measure: measureKind,\s*serviceAreaConfigured: serviceAreaConfigured\(company\),\s*\}\)/.test(request));
  ok("request route: hidden email/phone/photos are dropped, not stored", /fields\.email === "hidden" \? null : body\?\.email/.test(request) && /fields\.phone === "hidden" \? null : body\?\.phone/.test(request) && /fields\.photos === "hidden" \? \[\] : body\?\.media/.test(request));
  ok("request route: contact rule enforced with the rule's own sentence", /contactSatisfied\(fields, \{ phone, email \}\)/.test(request) && /t\.missingPhoneAndEmail/.test(request) && /t\.missingPhone\b/.test(request) && /t\.missingEmail\b/.test(request));
  ok("request route: required photos counted through normaliseMediaList", /fields\.photos === "required" && normaliseMediaList\(media\)\.length === 0/.test(request));
  ok("request route: required budget refused after pricing", /fields\.budget === "required" && !budgetBand/.test(request));
  ok("request route: required address refused for a non-measured trade", /fields\.address === "required" && !ADDRESS_MEASURED\.has\(measureKind\)/.test(request));
  ok("request route: a hidden `when` is not recorded", /fields\.timeline === "hidden"/.test(request) && /homeowner\.whenNeeded = null/.test(request));
  ok("settings PUT: fields normalised before the write", /normaliseFormFields\(config\.fields\)/.test(settings) && /config = \{ \.\.\.config, fields \}/.test(settings));
  ok("settings PUT: both-hidden refused with a 400", /p\.key === "contact"/.test(settings) && /can't both be hidden/.test(settings));
  ok("settings PUT: appearance measured and refused on a text failure", /formPalette\(company\?\.brandColor, appearance\)/.test(settings) && /palette\.failures\.length/.test(settings));
  ok("settings PUT: the default look is stored as null", /isDefaultAppearance\(appearance\) \? null : appearance/.test(settings));
  ok("settings GET: serves the look, the brand and the area verdict", /formAppearance: normaliseFormAppearance\(company\?\.publicFormAppearance\)\.appearance/.test(settings) && /serviceAreaConfigured: serviceAreaConfigured\(company\)/.test(settings));
  ok("flow: reads the trade's fields with the defaults as fallback", /const fields = trade\?\.fields \|\| DEFAULT_FORM_FIELDS/.test(flow));
  for (const key of ["photos", "budget", "timeline", "address", "notes", "email", "phone"]) {
    ok(`flow: ${key} honours "hidden"`, new RegExp(`fields\\.${key} !== "hidden"`).test(flow));
  }
  ok("flow: the missing list reads photos/budget/when/address states", /fields\.photos === "required" && media\.length === 0/.test(flow) && /fields\.budget === "required" && budgetBands\.length > 0/.test(flow) && /fields\.timeline === "required" && !whenNeeded/.test(flow) && /fields\.address === "required" && siteAddress/.test(flow));
  ok("flow: wraps every return in FormLook", (flow.match(/<FormLook look=\{look\}>/g) || []).length === 4);
  ok("self-quote flow: wraps every return in FormLook", (self.match(/<FormLook look=\{look\}>/g) || []).length === 4);
  ok("self-quote flow: the theme goes through themeUnderLook", /themeUnderLook\(documentTheme\(c\), look\?\.palette\)/.test(self));
  ok("wrapper: null look renders children with no element", /if \(!look\) return children;/.test(wrapper));
  ok("wrapper: the default preset resolves to null", /if \(isDefaultAppearance\(appearance\)\) return null;/.test(wrapper));
  ok("wrapper: the font link is hoisted with a precedence", /<link rel="stylesheet" href=\{look\.fontUrl\} precedence=/.test(wrapper));
  ok("loader: reads the look from the company row", /publicFormAppearance: true/.test(loader) && /isDefaultAppearance\(appearance\)\) return null/.test(loader));
  ok("instant page: look is server-read and passed as a prop", /const look = await loadPublicFormLook\(companySlug\)/.test(instantPage) && /look=\{look\}/.test(instantPage));
  ok("quote page: same", /const look = await loadPublicFormLook\(companySlug\)/.test(quotePage) && /look=\{look\}/.test(quotePage));
  ok("embed page: same, and never from the URL", /await loadPublicFormLook\(companySlug\)/.test(embed) && /<InstantQuoteFlow companySlug=\{companySlug\} embedded look=\{look\} \/>/.test(embed) && !/searchParams/.test(embed));
  ok("embed page: the booking flow is mounted exactly as before", /<BookingFlow companySlug=\{companySlug\} embedded \/>/.test(embed));
  ok("no public route reads an appearance off the request", ![request, embed, instantPage, quotePage, read("app/api/instant-quote/[companySlug]/route.js")].some((src) => /searchParams\.get\(["']a["']\)|body\??\.appearance|body\??\.look/.test(src)));
  ok("preview page: gated on a member of the owning company", /canPreviewCompanyDocument\(\{ headers: await headers\(\) \}, company\.id\)/.test(preview) && /notFound\(\)/.test(preview));
  ok("preview page: noindex", /robots: \{ index: false, follow: false \}/.test(preview));
  ok("preview page: the draft goes through the normaliser", /normaliseFormAppearance\(parseDraft\(query\?\.a\)\)/.test(preview));
  ok("settings card: the per-trade editor renders every field with three states", /FORM_FIELD_KEYS\.map/.test(card) && /FORM_FIELD_STATES\.map/.test(card) && /effectiveFormFields\(fields, \{ measure, serviceAreaConfigured \}\)/.test(card));
  ok("settings card: a locked row says why", /addressMeasured/.test(card) && /addressServiceArea/.test(card) && /contactLocked/.test(card));
  ok("settings page: the appearance card previews on /form-preview and lists the measured pairs", /\/form-preview\/\$\{encodeURIComponent\(slug\)\}/.test(page) && /palette\.checks\.map/.test(page));
  ok("settings page: save is disabled on a failure", /disabled=\{saving \|\| !dirty \|\| palette\.failures\.length > 0\}/.test(page));
  ok("settings page: the embed note names the saved look", /look\.servedNote/.test(page));

  for (const key of ["missingPhone", "missingEmail", "missingPhoneAndEmail", "missingAddress", "missingPhotos", "missingBudget"]) {
    ok(`copy: ${key} in ${INSTANT_QUOTE_LANGUAGES.join("/")}`, INSTANT_QUOTE_LANGUAGES.every((l) => typeof INSTANT_QUOTE_COPY[l][key] === "string" && INSTANT_QUOTE_COPY[l][key].length > 10));
  }
  for (const key of ["yourPhone", "yourEmail", "phoneAndEmail"]) {
    ok(`copy: missing.${key} in ${INSTANT_QUOTE_LANGUAGES.join("/")}`, INSTANT_QUOTE_LANGUAGES.every((l) => typeof INSTANT_QUOTE_COPY[l].missing[key] === "string"));
  }
  ok("copy: the three languages say different things", new Set(INSTANT_QUOTE_LANGUAGES.map((l) => INSTANT_QUOTE_COPY[l].missingPhotos)).size === 3);
  const schema = read("prisma/schema.prisma");
  ok("schema: Company.publicFormAppearance Json? exists", /publicFormAppearance Json\?/.test(schema));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
