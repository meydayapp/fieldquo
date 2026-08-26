// scripts/check-tax-send-gate.mjs
//
//   npm run check:tax-send
//
// Bundled with esbuild before it runs (see package.json), for the same reason
// scripts/check-takeoff-render.jsx is: it imports the REAL document renderer,
// and lib/documentSections/* is JSX that plain node cannot parse. Asserting
// against the renderer's actual output is the point — a check that read the
// source instead would pass on a template string that still says "$0.00".
//
// EXECUTES lib/tax/documentTax.js — the layered resolution, the four
// statements a tax line can make, and the refusal that stops a send.
//
// ══ What went wrong ════════════════════════════════════════════════════════
//
// Q-2026-0011 reached a homeowner reading:
//
//     Subtotal   $5,250.00
//     Tax            $0.00
//     TOTAL      $5,250.00
//
// with `taxEnabled: true` on the row. The quote asserted tax applied and
// charged none. On Ontario work that is $682.50 of HST the contractor either
// absorbs or goes back to the customer for, after they have seen a total.
//
// The tax library was never at fault. resolveTaxRate refused to invent a rate
// for a client with no province and no country, which is correct and stays.
// The defect was that the quote was SENT anyway, and that "$0.00" in a money
// column looked like an answer.
//
// So the assertions below are about three things and nothing else:
//   1. the resolution never invents, and says so loudly when it assumes;
//   2. an unresolved tax line never renders as a figure;
//   3. a document that cannot say what tax is owed does not leave the building.
//
// ══ Why hostile input, not just the happy path ═════════════════════════════
//
// Every real bug in this area came from a shape nobody pictured: a client with
// a province and no country, a company with a country and no province, a
// `vatRegistered` that is null rather than false. Those are the cases here.

import { renderEmailHtml } from "@/lib/documentSections/TotalsSection";
import {
  resolveDocumentTax,
  taxStatement,
  taxSendRefusal,
  companyStatesNoTax,
  clientJurisdictionKnown,
} from "@/lib/tax/documentTax";
import { resolveTaxRate } from "@/lib/tax/resolveTaxRate";
import { documentLabels } from "@/lib/i18n/documentLabels";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";
import { LANGUAGES } from "@/app/i18n/languages.js";

let pass = 0;
let fail = 0;
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `\n        got: ${got}` : ""}`);
  }
}
function section(title) {
  console.log(`\n${title}`);
}

/* ── The fixtures, taken from the real rows ──────────────────────────────── */

// The owner's company: Ottawa, Ontario. No rate ever typed, auto-apply on, no
// TaxRate rows — which is every one of the 29 companies in production.
const OTTAWA = {
  country: "CA",
  province: "ON",
  taxRate: 0,
  autoApplyLocalTax: true,
  vatRegistered: null,
};
// Same, but nobody ever filled in the province. Ten companies look like this.
const NO_PROVINCE = { ...OTTAWA, province: null };

// "emilio" — the client on Q-2026-0011. Nothing to resolve from.
const BLANK_CLIENT = {
  id: "c1",
  name: "emilio",
  address: null,
  city: null,
  province: null,
  country: null,
};
// The same person, once someone fills the two fields in.
const ONTARIO_CLIENT = { ...BLANK_CLIENT, province: "ON", country: "CA" };
// "Emilio Boves" — Gatineau, across the river. The case a company-province
// default gets WRONG, which is why the assumption has to be visible.
const QUEBEC_CLIENT = {
  id: "c2",
  name: "Emilio Boves",
  province: "QC",
  country: "CA",
};
// Three production rows look exactly like this: a province, no country.
const HALF_CLIENT = { id: "c3", name: "janet", province: "ON", country: null };

/* ══ 1. The resolution ═══════════════════════════════════════════════════ */

section("Layer 1 — the client's own record wins whenever it can answer");

ok(
  "a client with province + country is 'known'",
  clientJurisdictionKnown(ONTARIO_CLIENT) === true,
);
ok(
  "a client with a province and NO country is not",
  clientJurisdictionKnown(HALF_CLIENT) === false,
  "a region code alone cannot identify a jurisdiction",
);

const ontario = resolveDocumentTax({ company: OTTAWA, client: ONTARIO_CLIENT });
ok("Ontario client resolves to 13%", ontario.rate === 13, ontario.rate);
ok("…from the client, not an assumption", ontario.basis === "client" && !ontario.assumed);

const quebec = resolveDocumentTax({ company: OTTAWA, client: QUEBEC_CLIENT });
ok("Quebec client resolves to 14.975%", quebec.rate === 14.975, quebec.rate);
ok("…and is not marked assumed", quebec.assumed === false);

// The whole reason the assumption is dangerous, asserted rather than argued:
// the same Ottawa company owes two different rates on two clients, and only
// the client's own address can tell them apart.
ok(
  "an Ottawa company owes a DIFFERENT rate in Gatineau than in Toronto",
  ontario.rate !== quebec.rate,
  `${ontario.rate} vs ${quebec.rate}`,
);

section("Layer 2 — the company's own province, assumed and labelled");

const assumed = resolveDocumentTax({ company: OTTAWA, client: BLANK_CLIENT });
ok("a blank client falls back to the company's province", assumed.rate === 13, assumed.rate);
ok("…flagged as an assumption", assumed.assumed === true);
ok("…naming the province it assumed", /ontario/i.test(assumed.assumedRegion || ""), assumed.assumedRegion);
ok("…with basis 'company_assumed'", assumed.basis === "company_assumed");

// The half-filled client must take the SAME path as the blank one. A stray
// "ON" beside a null country must not be merged over the company's country to
// manufacture a determination out of two halves.
const half = resolveDocumentTax({ company: OTTAWA, client: HALF_CLIENT });
ok(
  "a province-only client is assumed, not treated as determined",
  half.assumed === true && half.basis === "company_assumed",
  `${half.basis} assumed:${half.assumed}`,
);

// And it must not leak across countries.
const usCompany = { country: "US", province: "TX", taxRate: 0, autoApplyLocalTax: true };
const usAssumed = resolveDocumentTax({ company: usCompany, client: HALF_CLIENT });
ok(
  "a US company never inherits a Canadian rate from a client's stray 'ON'",
  usAssumed.rate === 0 && usAssumed.assumed === false,
  `${usAssumed.rate} / ${usAssumed.source}`,
);

section("Layer 3 — nothing to assume from");

const nothing = resolveDocumentTax({ company: NO_PROVINCE, client: BLANK_CLIENT });
ok("company with no province resolves to nothing", nothing.rate === 0, nothing.rate);
ok("…and claims no assumption", nothing.assumed === false && nothing.basis === "none");

ok(
  "the underlying resolver is untouched — same answer for a known client",
  resolveTaxRate({ company: OTTAWA, client: ONTARIO_CLIENT }).rate ===
    resolveDocumentTax({ company: OTTAWA, client: ONTARIO_CLIENT }).rate,
);

/* ══ 2. What the tax line says ═══════════════════════════════════════════ */

section("The four statements — and the one that must never be a figure");

const charged = taxStatement({ taxEnabled: true, tax: 682.5, company: OTTAWA, client: ONTARIO_CLIENT });
ok("an amount charged is 'charged'", charged.kind === "charged", charged.kind);

const off = taxStatement({ taxEnabled: false, tax: 0, company: OTTAWA, client: ONTARIO_CLIENT });
ok("tax switched off is 'off', not 'unresolved'", off.kind === "off", off.kind);

// Q-2026-0011 itself.
const q11 = taxStatement({ taxEnabled: true, tax: 0, company: NO_PROVINCE, client: BLANK_CLIENT });
ok("Q-2026-0011's exact shape is 'unresolved'", q11.kind === "unresolved", q11.kind);

// A company that has ANSWERED the VAT question. A stated position, and a
// different sentence from "nobody worked this out".
const irish = { country: "IE", province: null, taxRate: 0, autoApplyLocalTax: true, vatRegistered: false };
ok("an explicitly unregistered company states no tax", companyStatesNoTax(irish) === true);
const none = taxStatement({ taxEnabled: true, tax: 0, company: irish, client: { country: "IE" } });
ok("…so its zero is 'none', not 'unresolved'", none.kind === "none", none.kind);

// And the trap: an UNANSWERED question is not an answer.
const unanswered = { ...irish, vatRegistered: null };
ok(
  "an UNANSWERED VAT question is not a statement of no tax",
  companyStatesNoTax(unanswered) === false,
);

// taxRate: 0 is a column nobody typed into. It must never be read as a policy.
ok(
  "a company default of 0% is not a statement either",
  taxStatement({ taxEnabled: true, tax: 0, company: NO_PROVINCE, client: BLANK_CLIENT }).kind ===
    "unresolved",
);

// Missing taxEnabled must not be read as "switched off".
ok(
  "an unloaded taxEnabled field is read as ON, not as a decision",
  taxStatement({ taxEnabled: undefined, tax: 0, company: NO_PROVINCE, client: BLANK_CLIENT })
    .kind === "unresolved",
);

// A charged amount is never contradicted, whatever the resolver now thinks.
// A sent document keeps the tax it was sent with.
ok(
  "a document carrying an amount stays 'charged' even with no company context",
  taxStatement({ taxEnabled: true, tax: 682.5 }).kind === "charged",
);

/* ══ 3. The send gate ════════════════════════════════════════════════════ */

section("The send: refused when nothing can explain the zero");

const refusal = taxSendRefusal(q11, { client: BLANK_CLIENT });
ok("an unresolved document is refused", refusal !== null);
ok("…with a machine-readable code", refusal?.code === "tax_unresolved", refusal?.code);
ok("…naming the client", refusal?.error.includes("emilio"), refusal?.error);
ok(
  "…and naming what is missing",
  Array.isArray(refusal?.missing) &&
    refusal.missing.includes("country") &&
    refusal.missing.includes("province"),
  JSON.stringify(refusal?.missing),
);
ok(
  "…carrying the client id, so the fix is one step and not a search",
  refusal?.clientId === "c1",
);

// The half-filled client: country is what's missing, and the refusal must say
// THAT rather than listing both and sending someone to re-type a correct
// province.
const halfRefusal = taxSendRefusal(
  taxStatement({ taxEnabled: true, tax: 0, company: NO_PROVINCE, client: HALF_CLIENT }),
  { client: HALF_CLIENT },
);
ok(
  "a client with a province needs only a country, and is told so",
  halfRefusal?.missing.join() === "country",
  JSON.stringify(halfRefusal?.missing),
);

section("The send: allowed in every case that CAN explain itself");

for (const [label, statement, client] of [
  ["a quote charging 13%", charged, ONTARIO_CLIENT],
  ["a quote with tax deliberately switched off", off, ONTARIO_CLIENT],
  ["a company that has told us it isn't VAT registered", none, { country: "IE" }],
  [
    "a quote resolved from the company's province",
    taxStatement({ taxEnabled: true, tax: 682.5, company: OTTAWA, client: BLANK_CLIENT }),
    BLANK_CLIENT,
  ],
])
  ok(`${label} sends`, taxSendRefusal(statement, { client }) === null);

// The scenario the owner asked for by name: fix the client, and it goes.
const fixed = taxStatement({
  taxEnabled: true,
  tax: 682.5,
  company: NO_PROVINCE,
  client: ONTARIO_CLIENT,
});
ok(
  "the SAME client with a province and country set resolves to 13% and sends",
  resolveDocumentTax({ company: NO_PROVINCE, client: ONTARIO_CLIENT }).rate === 13 &&
    taxSendRefusal(fixed, { client: ONTARIO_CLIENT }) === null,
);

/* ══ 4. No surface renders an unresolved tax as a figure ═════════════════ */

section("No surface renders an unresolved tax as $0.00");

// Executed rather than read: the email HTML is a string the real renderer
// produces, so the assertion is on the output and not on the source.
const unresolvedHtml = renderEmailHtml({
  data: {
    subtotal: 5250,
    discount: 0,
    tax: 0,
    total: 5250,
    taxEnabled: true,
    client: BLANK_CLIENT,
  },
  company: { ...NO_PROVINCE, currency: "CAD" },
  language: "en",
});
ok(
  "the quote email shows no $0.00 tax figure",
  !/\$0\.00/.test(unresolvedHtml),
  unresolvedHtml.replace(/\s+/g, " ").slice(0, 200),
);
ok(
  "…it says the tax is unresolved instead",
  unresolvedHtml.includes(documentLabels("en").taxUnresolved),
);
ok(
  "…and the TOTAL is untouched — nothing is re-priced",
  unresolvedHtml.includes("5,250.00"),
);

const chargedHtml = renderEmailHtml({
  data: {
    subtotal: 5250,
    discount: 0,
    tax: 682.5,
    total: 5932.5,
    taxEnabled: true,
    client: ONTARIO_CLIENT,
  },
  company: { ...OTTAWA, currency: "CAD" },
  language: "en",
});
ok("a real tax figure still renders as money", /682\.50/.test(chargedHtml));
ok(
  "…with no assumption note, because none was made",
  !chargedHtml.includes("based on ours"),
);

const assumedHtml = renderEmailHtml({
  data: {
    subtotal: 5250,
    discount: 0,
    tax: 682.5,
    total: 5932.5,
    taxEnabled: true,
    client: BLANK_CLIENT,
  },
  company: { ...OTTAWA, currency: "CAD" },
  language: "en",
});
ok(
  "an assumed rate says so on the client's own copy, naming the province",
  /Ontario/.test(assumedHtml) && assumedHtml.includes("based on ours"),
  assumedHtml.replace(/\s+/g, " ").slice(-260),
);

// A zero the company MEANT is a different sentence, not the same one.
const offHtml = renderEmailHtml({
  data: { subtotal: 5250, discount: 0, tax: 0, total: 5250, taxEnabled: false },
  company: { ...OTTAWA, currency: "CAD" },
  language: "en",
});
ok("a deliberate zero reads as 'None', not '$0.00'", !/\$0\.00/.test(offHtml));
ok(
  "…and is worded differently from an unresolved one",
  offHtml.includes(documentLabels("en").taxNone) &&
    !offHtml.includes(documentLabels("en").taxUnresolved),
);

/* ══ 5. The strings exist in every language that claims to have them ═════ */

section("Strings");

for (const { code } of LANGUAGES)
  for (const key of ["taxUnresolved", "taxNone", "taxAssumedNote"])
    ok(
      `documentLabels.${code}.${key} is present and translated`,
      Boolean(documentLabels(code)[key]),
      code,
    );

ok(
  "the assumption note has a {region} placeholder to fill",
  LANGUAGES.every(({ code }) =>
    documentLabels(code).taxAssumedNote.includes("{region}"),
  ),
);

// English and French are the gated pair for the app catalogue — see the header
// of appMessages.js for why the other four are reported and not blocked.
for (const key of [
  "app.tax.line.unresolved",
  "app.tax.line.none",
  "app.tax.assumed.badge",
  "app.tax.assumed.note",
  "app.tax.blocked.title",
  "app.tax.blocked.noTaxAction",
  "app.tax.blocked.retry",
])
  ok(
    `${key} exists in English and French`,
    Boolean(APP_MESSAGES.en[key]) && Boolean(APP_MESSAGES.fr[key]),
  );

console.log(
  `\n${fail ? "FAILED" : "PASSED"} — ${pass}/${pass + fail} assertions`,
);
process.exit(fail ? 1 : 0);
