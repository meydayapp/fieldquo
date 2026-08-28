// scripts/check-leave-templates.mjs
//
// The leave screen asked a company which country it was in. We had the answer.
//
// ══ The second report of the same defect ═══════════════════════════════════
//
// /app/settings/leave listed Canada, the United States and the United Kingdom
// as three equal starter sets, each with its own caveat paragraph, to a company
// whose address has been on file since signup. The owner: "we know the address
// of the company from sign up and company settings, we know which country they
// live. so this should be done automatically."
//
// app/api/settings/plans/route.js had it first — it told a Canadian company
// with a Canadian address that we needed to know where their business was — and
// lib/company/resolveCountry.js was written to fix it. This is the same fix on
// the same reader, so these assertions are mostly about that reader continuing
// to READ rather than guess.
//
// ══ What the three awkward companies must get ══════════════════════════════
//
//   null column + full address   the three legacy Canadian rows. Led with
//                                Canada, from the address, never asked.
//   nothing states a country     asked, and pointed at Company Settings. NOT
//                                defaulted to Canada — absence of a statement
//                                is not a statement, and a company nudged into
//                                another country's employment terms would have
//                                no idea why.
//   a country with no set        told plainly that there is no starter for
//                                Australia, then offered the three as borrowed
//                                starting points.
//
// ══ Led with, not applied ══════════════════════════════════════════════════
//
// Seeding writes LeavePolicy rows and accrues balances against every worker on
// the spot. Those are employment terms, so the country picks which set is
// offered first and the human still presses the button — the same call the
// owner made on seats ("no auto add"). The last section is what would catch a
// later version that pressed it for them.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-leave-templates.mjs

import { readFileSync } from "node:fs";
import { resolveCountry, statedCountry, countryKeyIn } from "@/lib/company/resolveCountry";
import { currencyForCountry } from "@/lib/pricing/ladder";
import { COUNTRIES } from "@/lib/currency";
import { LEAVE_TEMPLATES, LEAVE_REGIONS } from "@/lib/leave/policyTemplates";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
const is = (label, got, want) => ok(label, got === want, JSON.stringify(got));

const ROUTE = readFileSync("app/api/settings/leave-policies/route.js", "utf8");
const PAGE = readFileSync("app/app/settings/leave/page.js", "utf8");

console.log("\nThe company we already know about");
// The three real rows, verbatim from the database — null country column, a
// complete Google-formatted address in the columns beside it.
for (const address of [
  "1039 Bank St, Ottawa, ON K1X 1H4, Canada",
  "8293 Old Waneta Rd, Trail, BC V1R 4W9, Canada",
  "9177 154 St, Surrey, BC V3R 9G8, Canada",
]) {
  const r = statedCountry({ country: null, address, province: null });
  ok(`"${address.slice(0, 22)}…" is Canada, from the address`,
    r.country === "CA" && r.source === "address", JSON.stringify(r));
  is("...and that Canadian set is the one led with",
    countryKeyIn(r.country, LEAVE_REGIONS), "CA");
}
is("a stated country is used", statedCountry({ country: "US" }).country, "US");
is("...and reported as the column", statedCountry({ country: "US" }).source, "column");
is("a lowercase column still reads", statedCountry({ country: "us" }).country, "US");
is("a province alone is enough", statedCountry({ province: "ON" }).country, "CA");
is("...reported as the province", statedCountry({ province: "ON" }).source, "province");
// The column is what a human picked from a list. A company that chose Ireland
// while its address still reads Ottawa has answered the question, and reading
// the address over it would overrule them with a stale field.
is("the column beats a contradicting address",
  statedCountry({ country: "IE", address: "1039 Bank St, Ottawa, ON K1X 1H4, Canada" }).country,
  "IE");

console.log("\nAnd when NOTHING states one, it says so");
// Every one of these must be null so the screen ASKS. Defaulting any of them to
// Canada is the failure this whole file exists to prevent: it would seed one
// country's employment terms behind a button labelled "your country".
for (const [label, rec] of [
  ["an empty record", {}],
  ["null", null],
  ["a string instead of a record", "CA"],
  ["blank strings", { country: "", address: "", province: "" }],
  ["a country column holding a NAME, not a code", { country: "Canada" }],
  ["a code nobody offers", { country: "ZZ" }],
  ["a US state, deliberately not inferred", { province: "TX" }],
  ["an address in a country we cannot name", { address: "10 Downing St, London, UK" }],
]) {
  is(`${label} -> null`, statedCountry(rec).country, null);
  is(`...and its source -> null`, statedCountry(rec).source, null);
}

console.log("\nresolveCountry itself did not move");
// It answers the narrower question — which of the two countries we PRICE IN —
// and widening it would have priced a British company in CAD. statedCountry was
// added beside it precisely so this could stay as it is.
is("a UK address is still not a priced country",
  resolveCountry({ address: "10 Downing St, London, UK" }).country, null);
is("a GB column is still not a priced country", resolveCountry({ country: "GB" }).country, null);
is("...while the wider reader hears it", statedCountry({ country: "GB" }).country, "GB");
is("Canada still resolves", resolveCountry({ address: "1039 Bank St, Ottawa, ON, Canada" }).country, "CA");
is("the USA still resolves", resolveCountry({ address: "12 Main St, Buffalo, NY 14201, USA" }).country, "US");
// The trap the endings are anchored for; a substring match prices Buffalo in CAD.
is("a street called Canada, in the USA, is still the USA",
  resolveCountry({ address: "9 Canada Street, Buffalo, NY, USA" }).country, "US");
// And the widening must not leak into money: GB is an answer, not a price.
is("a GB company still gets no billing currency",
  currencyForCountry(statedCountry({ country: "GB" }).country), null);
is("a CA company still bills in CAD",
  currencyForCountry(statedCountry({ country: null, address: "1039 Bank St, Ottawa, ON, Canada" }).country),
  "CAD");

console.log("\nGB and UK are one country spelled twice");
// Google's address components and ISO-3166 say GB, so GB is what lands in
// Company.country. LEAVE_TEMPLATES is keyed "UK", because that is what the set
// is called. Matching on the code alone tells a British company we have nothing
// for them with a United Kingdom set sitting in the list underneath.
is("GB finds the UK set", countryKeyIn("GB", LEAVE_REGIONS), "UK");
is("UK finds it too", countryKeyIn("UK", LEAVE_REGIONS), "UK");
is("lowercase gb finds it", countryKeyIn("gb", LEAVE_REGIONS), "UK");
is("CA finds the Canadian set", countryKeyIn("CA", LEAVE_REGIONS), "CA");
is("US finds the American set", countryKeyIn("US", LEAVE_REGIONS), "US");
is("a country with no set gets null, not the first one",
  countryKeyIn("AU", LEAVE_REGIONS), null);
is("no country gets null", countryKeyIn(null, LEAVE_REGIONS), null);
is("an empty set matches nothing", countryKeyIn("CA", []), null);
is("a missing set matches nothing", countryKeyIn("CA", null), null);

console.log("\nEvery set is reachable, and the gap is reachable too");
// A set no country can select is a starter nobody is ever led to — the state
// the UK set was in before this change, when the only reader returned CA or US.
for (const key of LEAVE_REGIONS) {
  const reachedBy = COUNTRIES.filter((c) => countryKeyIn(c.code, LEAVE_REGIONS) === key);
  ok(`the ${key} set is reachable — ${reachedBy.map((c) => c.code).join(", ") || "NOBODY"}`,
    reachedBy.length > 0);
}
// And the "no starter for your country" branch must be a real case rather than
// dead code: eight of the eleven countries we sign companies up in have no set.
const uncovered = COUNTRIES.filter((c) => countryKeyIn(c.code, LEAVE_REGIONS) === null);
ok(`countries with no starter set exist — ${uncovered.map((c) => c.code).join(", ")}`,
  uncovered.length > 0);
ok("...and Australia is one of them, exactly as the screen says",
  uncovered.some((c) => c.code === "AU"));

console.log("\nThe caveats survive — they are the honesty of the feature");
for (const key of LEAVE_REGIONS) {
  const tpl = LEAVE_TEMPLATES[key];
  ok(`${key} still carries its note`, typeof tpl.note === "string" && tpl.note.length > 40);
  ok(`${key} still states the year its figures come from`, Number.isInteger(tpl.sourceYear));
  ok(`${key} still has policies to seed`, Array.isArray(tpl.policies) && tpl.policies.length > 0);
}
// The two sentences a company would be misled without.
ok("Canada still says the 4% is the two-week minimum", /4%/.test(LEAVE_TEMPLATES.CA.note));
ok("the UK still says 28 days INCLUDES bank holidays",
  /INCLUDES bank holidays/.test(LEAVE_TEMPLATES.UK.note));
ok("the US still says there is no federal entitlement",
  /No federal paid-leave entitlement/i.test(LEAVE_TEMPLATES.US.note));
// One button component, one copy of the note. Two copies is how the leading
// card keeps its caveat and the others quietly lose theirs.
ok("the screen renders each note in exactly one place",
  (PAGE.match(/\{tpl\.note\}/g) || []).length === 1,
  (PAGE.match(/\{tpl\.note\}/g) || []).length);
ok("...and the route still forwards note, sourceYear and policies",
  /note: LEAVE_TEMPLATES\[key\]\.note/.test(ROUTE) &&
    /sourceYear: LEAVE_TEMPLATES\[key\]\.sourceYear/.test(ROUTE) &&
    /policies: LEAVE_TEMPLATES\[key\]\.policies/.test(ROUTE));
ok("...all of them, not just the company's own",
  /templates: LEAVE_REGIONS\.map\(/.test(ROUTE));

console.log("\nThe route reads the company's own record");
// The whole statement, not just the call: `false ? statedCountry(company) : …`
// contains the call and answers null, which is how a guard gets switched off
// under a check that only looks for the function name.
ok("it asks the wider reader, not the pricing one", /const where = statedCountry\(company\);/.test(ROUTE));
ok("...and matches it against the sets it has", /countryKeyIn\(where\.country, LEAVE_REGIONS\)/.test(ROUTE));
// The address, not just the column — that is the whole point of the plans fix.
ok("it selects country AND address AND province",
  /select: \{ country: true, address: true, province: true \}/.test(ROUTE));
ok("...from the caller's own company", /where: \{ id: member\.companyId \}/.test(ROUTE));
ok("and reports country, source and templateKey",
  /home: \{[\s\S]{0,200}country: where\.country[\s\S]{0,200}source: where\.source[\s\S]{0,200}templateKey:/.test(ROUTE));
// A hardcoded country anywhere in either file is the defect coming back.
ok("the route hardcodes no country of its own", !/["'](CA|US|UK|GB)["']/.test(ROUTE));
ok("the screen hardcodes no country of its own", !/["'](CA|US|UK|GB)["']/.test(PAGE));

console.log("\nThe screen leads with it and decides nothing");
// The picker can only lead with what it is handed. A component that reads
// `home` while the page passes it nothing is the dead control this repo keeps
// finding, and every source check below would still pass.
ok("the page hands the server's answer to the picker", /home=\{data\.home\}/.test(PAGE));
ok("it reads the template the server matched", /home\?\.templateKey/.test(PAGE));
ok("...and the country separately, for the no-set case", /home\?\.country/.test(PAGE));
// Three states, and the unknown one must not be the known one wearing a hat.
ok("an unresolved country still offers all three",
  /templates\.map\(/.test(PAGE) && /others\.map\(/.test(PAGE));
// Two links, and they are not interchangeable: one offers to CHANGE a country
// we read, the other asks for one we never had. A first version of this check
// looked for the href alone and passed happily with the second link deleted,
// because the first one still matched.
ok("...and points at where to fill the address in",
  /templateNoCountryCta/.test(PAGE) &&
    (PAGE.match(/href="\/app\/settings\/company"/g) || []).length === 2,
  (PAGE.match(/href="\/app\/settings\/company"/g) || []).length);
ok("a country with no set says so by name",
  /templateNoneForCountry/.test(PAGE) && /\{ country: countryName \}/.test(PAGE));
ok("...and the name comes from the shared country list",
  /COUNTRIES\.find\(\(c\) => c\.code === home\.country\)/.test(PAGE));
// `const sourceLine = null && { column: … }` renders nothing and still contains
// every word a looser pattern looks for, so the assignment is matched whole.
ok("where we read it is shown, per source",
  /const sourceLine = \{[\s\S]{0,600}column:[\s\S]{0,400}address:[\s\S]{0,400}province:/.test(PAGE));
// Leading with a set only helps if the reader can see WHICH one was led with.
// Three identical cards in a different order is the old screen with extra steps.
// The CALL SITE, not just the prop: `isHome` alone matches the parameter in the
// component's own signature, which survives the badge being switched off.
ok("the leading set is named in the heading and marked on the card",
  /startTemplateHome[\s\S]{0,200}country: homeTemplate\.label/.test(PAGE) &&
    /<TemplateButton\s+tpl=\{homeTemplate\}\s+isHome/.test(PAGE) &&
    /templateHomeBadge/.test(PAGE));

console.log("\nSeeding is still a press");
// Nothing may call seed() for them. The definition is the only occurrence; a
// second one is an auto-apply, which is the owner's "no auto add" ruling with
// employment terms attached instead of a seat.
const seedCalls = (PAGE.match(/(?<![A-Za-z])seed\(/g) || []).length;
ok("nothing on the screen calls seed() but the button", seedCalls === 1, seedCalls);
ok("...and the button is what calls it", /onClick=\{\(\) => onSeed\(tpl\.key\)\}/.test(PAGE));
ok("...through one shared component, so both cards behave the same",
  (PAGE.match(/<TemplateButton/g) || []).length === 3);
// The server takes any region, not only the company's own: a Canadian company
// can legitimately hire in the US, and gating the POST on `home` would turn a
// hint into a wall.
const post = ROUTE.slice(ROUTE.indexOf("export async function POST"));
ok("the seed route still accepts any region", /if \(!LEAVE_TEMPLATES\[region\]\)/.test(post));
ok("...and never consults the company's country",
  !/statedCountry|countryKeyIn|home\b/.test(post));

// ── Not an assertion: the figures are two years old ────────────────────────
//
// Every set says sourceYear 2024 and the screen prints "figures as of 2024".
// Nothing here can tell whether they are still right, and inventing a newer
// number would be worse than a stale one that says its own age. Reported so
// somebody who can check, checks.
const thisYear = new Date().getUTCFullYear();
const stale = LEAVE_REGIONS.filter((k) => thisYear - LEAVE_TEMPLATES[k].sourceYear >= 2);
if (stale.length) {
  console.log(
    `\n  ! ${stale.length} starter set(s) carry figures from ${stale
      .map((k) => `${k} ${LEAVE_TEMPLATES[k].sourceYear}`)
      .join(", ")} — it is ${thisYear}. The screen says so; nobody has re-checked them.`,
  );
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
