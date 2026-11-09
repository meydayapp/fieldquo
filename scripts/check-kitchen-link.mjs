// scripts/check-kitchen-link.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-kitchen-link.mjs
//
// ── What this is guarding ───────────────────────────────────────────────────
//
// /quote/<slug>/kitchen — the public "design your own kitchen" page — existed,
// worked, and was handed out by nothing. A company that switched "Kitchen
// Design & New Installs" on had a page a stranger could draw a kitchen on and
// no screen in /app that told them its address. Three surfaces now offer it,
// and each must offer it under EXACTLY the condition the page renders on
// (companyOffersKitchenDesign: since 2026-09-25 a kitchen-building trade is
// enabled, unless the company's own override says otherwise — the rule is
// kitchenDesignerOnPure in lib/kitchen/key.js, executed in
// check-kitchen-access.mjs) — a link that 404s on a bio page is the failure
// the bio-link module exists to stop.
//
//   1. the bio-link page (lib/links/candidates.js) — executed here
//   2. Share your links (app/app/settings/lead-form) — source-checked
//   3. the self-quote form's kitchen step (SelfQuoteFlow) — source-checked
//   4. the quote builder's "Save & design" (2026-11-08) — source-checked
//
// Surface 4 is the INTERNAL designer, /app/quotes/<id>/kitchen, rather than
// the public page the first three hand out — but it is the same failure
// guarded the same way. The owner, 2026-11-07: "if I'm building a quote. I
// don't have the edit and save that's after a quote is created." The designer
// needs a quote id, so an unsaved builder cannot link to it and a plain link
// would 404; the control saves first and then goes.
//
// And the slug: the page used to resolve Company.slug alone while every other
// public link is built from bookingSlug, so the link this hands out would
// have 404'd for a company whose two slugs differ.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { linkCandidates } from "@/lib/links/candidates";
import { linkLabels } from "@/lib/links/labels";
import { KITCHEN_DESIGN_KEY } from "@/lib/kitchen/key";
import { CLIENT_DOC_COPY } from "@/lib/i18n/clientDocCopy";
import { LANGUAGES } from "@/app/i18n/languages";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const exists = (p) => fs.existsSync(path.join(ROOT, p));

/**
 * Source with comments removed.
 *
 * Section 4 asserts that the quote builder does NOT re-derive the kitchen
 * rule — and the builder's own comment explains that it must not, naming
 * kitchenDesignerOnPure and the granting trades while doing so. Grepping raw
 * source would read that explanation as the offence it warns against, which
 * is the false-pass-in-reverse this file's module doc already cautions about
 * for the other direction.
 */
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n${title}\n`);
}

const company = { slug: "acme", bookingSlug: "acme-kitchens", name: "Acme", defaultLanguage: "fr" };
const base = { company, site: null, activeEventTypes: 0, enabledEstimators: 0, funnels: [] };

section("The bio-link row exists only when the service is on");
const on = linkCandidates({ ...base, offersKitchenDesign: true });
const off = linkCandidates({ ...base, offersKitchenDesign: false });
const unsaid = linkCandidates({ ...base });
const kitchenOn = on.find((r) => r.key === "kitchen");
ok("service on → a kitchen row", Boolean(kitchenOn));
ok("service off → no kitchen row", !off.some((r) => r.key === "kitchen"));
ok("flag absent → no kitchen row (absence is not 'on')", !unsaid.some((r) => r.key === "kitchen"));
ok("a truthy non-boolean ('yes', 1) is not 'on' either", !linkCandidates({ ...base, offersKitchenDesign: "yes" }).some((r) => r.key === "kitchen") && !linkCandidates({ ...base, offersKitchenDesign: 1 }).some((r) => r.key === "kitchen"));
ok("the row's URL is the public designer, built from bookingSlug like every other row", kitchenOn?.url === "/quote/acme-kitchens/kitchen");
ok("the row sits under 'Get a price' with the quote form, on by default", kitchenOn?.group === "price" && kitchenOn?.defaultOn === true && kitchenOn?.kind === "internal");
ok("the label is in the company's language (fr)", kitchenOn?.label === "Concevez votre cuisine");
ok("every other row is unchanged by the flag", on.filter((r) => r.key !== "kitchen").length === off.length);
ok("the kitchen row comes after the quote form and before booking", on.findIndex((r) => r.key === "kitchen") > on.findIndex((r) => r.key === "quote"));
ok("no slug → no rows at all, kitchen included", !linkCandidates({ ...base, company: { ...company, slug: "", bookingSlug: "" }, offersKitchenDesign: true }).some((r) => r.key === "kitchen"));

section("Labels in every offered language");
for (const { code } of LANGUAGES) {
  const label = linkLabels(code).kitchenDesign;
  ok(`${code}: kitchenDesign label present`, typeof label === "string" && label.length > 0);
}
ok("the self-quote form's kitchen link copy exists in every offered language",
  LANGUAGES.every(({ code }) => typeof CLIENT_DOC_COPY[code]?.selfQuote?.designKitchen === "string" && CLIENT_DOC_COPY[code].selfQuote.designKitchen.length > 0));

section("The gate is the service, everywhere, spelled once");
ok("KITCHEN_DESIGN_KEY is the service key", KITCHEN_DESIGN_KEY === "kitchen_design");
const keyModule = read("lib/kitchen/key.js");
ok("lib/kitchen/key.js has no imports, so a client component can read it without lib/db", !/^import /m.test(keyModule));
const access = read("lib/kitchen/access.js");
ok("lib/kitchen/access.js re-exports the same constant rather than restating it", /export \{ KITCHEN_DESIGN_KEY \} from "\.\/key"/.test(access) && !/KITCHEN_DESIGN_KEY = "kitchen_design"/.test(access));
const load = read("lib/links/load.js");
// Since 2026-09-25 the row follows the one rule (kitchenDesignerOnPure in
// lib/kitchen/key.js — granting trades plus the company override), called
// over the keys already read, not a second copy of "is kitchen_design on".
ok("the bio-link loader derives the row from the one rule over the enabled keys and the override",
  /offersKitchenDesign: kitchenDesignerOnPure\(categoryKeys, company\.kitchenDesignerOverride\)/.test(load) &&
    /kitchenDesignerOverride: true/.test(load));
ok("…read once and shared with the painting-scope rule (no second query for a stranger on a phone)", /priceableEstimators\(company, categoryKeys\)/.test(load) && (load.match(/companyEnabledCategoryKeys\(/g) || []).length === 1);
const icons = read("app/components/links/linkIcons.js");
ok("the row has an icon of its own", /kitchen: Ruler/.test(icons));

section("Share your links");
const leadForm = read("app/app/settings/lead-form/page.js");
ok("asks the server's gate (GET /api/settings/kitchen-designer) rather than re-deriving the rule",
  /\/api\/settings\/kitchen-designer/.test(leadForm) && /state\?\.on === true/.test(leadForm) && !/KITCHEN_DESIGN_KEY/.test(leadForm));
ok("the card renders only behind that flag", /\{kitchenOffered && \(/.test(leadForm));
ok("the URL is built from the same slug the other three cards use", /const kitchenUrl = `\$\{origin\}\/quote\/\$\{slug\}\/kitchen`/.test(leadForm));
ok("no embed snippet is promised for it (there is no embed widget)", !/embed=\{embed\("kitchen"\)\}/.test(leadForm));
ok("a client page never imports lib/kitchen/access (it would drag lib/db into the browser)", !/lib\/kitchen\/access/.test(leadForm));

section("The self-quote form's kitchen step");
const flow = read("app/quote/[companySlug]/SelfQuoteFlow.js");
ok("offers the designer only when the server says the page exists, and only on a kitchen-building service",
  /data\.kitchenDesigner === true && KITCHEN_GRANTING_TRADE_KEYS\.includes\(service\.key\) && \(/.test(flow));
const selfQuoteApi = read("app/api/self-quote/[companySlug]/route.js");
ok("…where kitchenDesigner is the one rule over the same enabled keys and the override",
  /kitchenDesigner: kitchenDesignerOnPure\(/.test(selfQuoteApi) && /kitchenDesignerOverride: true/.test(selfQuoteApi));
ok("…linking to the public page under the slug the form was opened with", /href=\{`\/quote\/\$\{encodeURIComponent\(companySlug\)\}\/kitchen`\}/.test(flow));
ok("…in the document's language via clientDocCopy", /copy\.designKitchen/.test(flow));

section("The public page resolves the slug like its siblings");
const page = read("app/quote/[companySlug]/kitchen/page.js");
const api = read("app/api/self-quote/kitchen/route.js");
ok("the page uses findBookingCompany (bookingSlug first, then slug)", /findBookingCompany\(companySlug/.test(page) && !/db\.company\.findUnique/.test(page));
ok("the page still refuses a company without the service", /companyOffersKitchenDesign\(company\.id\)/.test(page));
ok("the POST uses the same resolver", /findBookingCompany\(String\(companySlug\)/.test(api));
ok("…and still refuses through the same gate as the page", /companyOffersKitchenDesign\(company\.id\)/.test(api));

section("The quote builder's \"Save & design\" (the fourth surface)");
{
  // Read with comments stripped — see stripComments above.
  const builder = stripComments(read("app/components/quotes/builder/QuoteBuilder.js"));
  const docBuilder = stripComments(read("app/components/quotes/builder/DocumentBuilder.js"));
  const bar = stripComments(read("app/components/quotes/builder/QuoteTotalsBar.js"));
  const detail = stripComments(read("app/app/quotes/[id]/page.js"));

  // The destination has to be real. A control that saves a quote and then
  // routes to a page that does not exist is worse than no control: the quote
  // is created and the person is on a 404.
  ok("the page it routes to exists", exists("app/app/quotes/[id]/kitchen/page.js"));

  // Same condition the page renders on, asked of the server's one gate.
  ok(
    "the builder asks GET /api/settings/kitchen-designer for the gate",
    /\/api\/settings\/kitchen-designer/.test(builder) && /state\?\.on === true/.test(builder),
  );
  ok(
    "…and does NOT re-derive the rule from the quote's own services",
    !/kitchenDesignerOnPure/.test(builder) &&
      !/kitchenGrantingKeys/.test(builder) &&
      !/KITCHEN_GRANTING_TRADE_KEYS/.test(builder),
  );
  ok(
    "a builder screen never imports lib/kitchen/access (it would drag lib/db into the browser)",
    !/lib\/kitchen\/access/.test(builder) && !/lib\/kitchen\/access/.test(docBuilder),
  );
  ok("the gate starts closed, so the button cannot flicker in", /useState\(false\)/.test(builder));

  // The action saves first, then navigates — the whole reason it is not a link.
  ok('the "design" action routes to the designer', /if \(action === "design"\) \{/.test(builder));
  ok(
    "…at the saved quote's own id",
    /router\.push\(`\/app\/quotes\/\$\{id\}\/kitchen`\)/.test(builder),
  );
  // Deliberately against the RAW source, not the stripped copy: this one
  // asserts a DOC COMMENT, because handleSave's action is a bare string and
  // the list of legal actions exists nowhere else. AGENTS.md treats a comment
  // that has drifted as a defect, and the two places that enumerate the
  // actions — the saving-state note and handleSave's @param — are what a
  // reader trusts when adding a fifth one.
  const builderRaw = read("app/components/quotes/builder/QuoteBuilder.js");
  ok(
    "…and both doc comments that list the actions name it",
    (builderRaw.match(/"draft" \| "sent" \| "review" \| "design"/g) || []).length === 2,
  );

  // Both builders draw the same dock, so both must pass it.
  ok(
    "the classic card passes onSaveAndDesign, gated on the company having it",
    /onSaveAndDesign=\{kitchenOffered \? \(\) => handleSave\("design"\) : null\}/.test(builder),
  );
  ok(
    "the document-shaped builder passes it too, from the same answer",
    /onSaveAndDesign=\{b\.kitchenOffered \? \(\) => b\.handleSave\("design"\) : null\}/.test(docBuilder),
  );
  ok("…reading it off the bundle the parent hands down", /\bkitchenOffered,/.test(builder));

  // A null handler must render NOTHING, not a disabled button — the dock's
  // own documented convention for onSaveAndSend and onSaveAndReview.
  ok("the dock renders the button only behind the handler", /\{onSaveAndDesign && \(/.test(bar));
  ok(
    "…and forwards the prop from the card to the dock",
    /onSaveAndDesign=\{onSaveAndDesign\}/.test(bar),
  );
  ok(
    "the spinner is keyed to this action alone, so the pressed button is the one that spins",
    /saving === "design"/.test(bar),
  );

  // The label must not hide what pressing it does. reviewShort can say
  // "Review" because the card above carries a sentence saying it saves first
  // (showReviewHint); this has no such sentence, so the save lives in the
  // label — and a button that silently creates a database record is exactly
  // what that sentence exists to prevent.
  ok(
    "the full sentence is the title and the accessible name",
    /title=\{t\("app\.quoteNew\.saveAndDesign"\)\}/.test(bar) &&
      /aria-label=\{t\("app\.quoteNew\.saveAndDesign"\)\}/.test(bar),
  );
  ok("the visible label is the short key", /t\("app\.quoteNew\.designShort"\)/.test(bar));
  const short = APP_MESSAGES.en["app.quoteNew.designShort"];
  ok(
    'the English short label still says "Save", because nothing else does',
    typeof short === "string" && /save/i.test(short),
    short,
  );
  for (const { code } of LANGUAGES) {
    const table = APP_MESSAGES[code];
    if (!table) continue; // a language whose app catalogue has not landed yet
    for (const key of ["app.quoteNew.saveAndDesign", "app.quoteNew.designShort"]) {
      ok(`${code}: ${key} is translated`, typeof table[key] === "string" && table[key].length > 0);
    }
  }

  // The saved quote's own button and this one are one feature. The comment on
  // that button claimed a per-quote kitchen test that the variable never held,
  // which would send a reader looking for a rule that does not exist.
  ok(
    "the saved quote's button reads the same server-side answer",
    /quote\.canOpenKitchenDesigner/.test(detail),
  );
}

console.log(`\n${checks} checks, ${failures} failure(s).${failures ? "" : " The kitchen designer is reachable, and only where it works."}\n`);
if (failures) process.exitCode = 1;
