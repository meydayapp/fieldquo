// scripts/check-tax-id.mjs
//
// Company Settings collected taxIdName/taxIdNumber and told the contractor
// "Tax ID name and number will appear on invoices." It appeared on nothing a
// client ever saw — the only reader was FieldQuo's own platform console. The
// hint was false in all six languages.
//
// Not a cosmetic gap. A GST/HST registrant in Canada must show the number on
// an invoice for the customer to claim input tax credits; VAT works the same
// way in the EU and UK. So a contractor who typed it in, watched it save, and
// sent invoices without it was issuing documents their clients could not fully
// claim on.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-tax-id.mjs

import { taxIdLine } from "@/lib/documents/taxId";
import { taxRegistrationFor } from "@/lib/compliance/taxRegistration";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");

console.log("\nThe line itself");
t("label and number", taxIdLine({ taxIdName: "GST/HST", taxIdNumber: "123456789 RT0001" }),
  "GST/HST: 123456789 RT0001");
// The number is the compliance-relevant half; a missing label is cosmetic and
// must not withhold it.
t("a number with no label still renders", taxIdLine({ taxIdNumber: "123456789" }), "123456789");
t("whitespace is trimmed", taxIdLine({ taxIdName: "  GST  ", taxIdNumber: "  99  " }), "GST: 99");

console.log("\nAbsence stays absence — never a label with nothing after it");
t("no number, no line", taxIdLine({ taxIdName: "VAT", taxIdNumber: "" }), "");
t("empty object", taxIdLine({}), "");
for (const bad of [null, undefined, "junk", 42, [], true])
  t(`${String(bad)} → empty`, taxIdLine(bad), "");

console.log("\nIt reaches every surface a client sees");
t("document footer (PDF + email sections)",
  /taxIdLine\(company\)/.test(read("../lib/documentSections/FooterSection.js")));
t("the branded email layout's contact line",
  /taxIdLine\(company\)/.test(read("../lib/email/documentEmailLayout.js")));
t("the client portal invoice", /taxIdLine\(c\)/.test(read("../app/portal/[token]/invoices/[id]/PortalInvoice.js")));
// The portal's select is narrowed by hand, and was the one place the columns
// were not even loaded.
const PORTAL_API = read("../app/api/portal/[token]/route.js");
t("...and the portal API actually loads the columns",
  /taxIdName: true/.test(PORTAL_API) && /taxIdNumber: true/.test(PORTAL_API));

console.log("\nThe hint no longer promises invoices only");
const MSGS = read("../app/i18n/appMessages.js");
const hints = [...MSGS.matchAll(/"app\.setCompany\.taxIdHint": "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
t("all six locales present", hints.length, 6);
t("none still says 'invoices' alone in English",
  !/^Tax ID name and number will appear on invoices\.$/.test(hints[0]));
t("the English hint mentions quotes too", /quotes/i.test(hints[0]));

// ── Asking for it in the first place ───────────────────────────────────────
//
// Printing the number was only half the problem: nothing ever ASKED for it, so
// a contractor could invoice for months before a client's bookkeeper noticed.
// lib/compliance/taxRegistration.js is what the onboarding step and Company
// Settings read to know what the registration is CALLED and whether it belongs
// on an invoice there.

console.log("\nJurisdiction lookup");
t("Canada is GST/HST and required", taxRegistrationFor("CA").nameKey, "app.taxReg.name.ca");
t("...and Canada cannot be dismissed", taxRegistrationFor("CA").dismissible, false);
t("lower case works too", taxRegistrationFor("ca").profile, "ca");
t("padded input works too", taxRegistrationFor("  gb  ").profile, "gb");
t("an EU state resolves to the shared VAT profile", taxRegistrationFor("IT").profile, "eu");
t("Liechtenstein follows Swiss VAT, not the EEA", taxRegistrationFor("LI").profile, "ch");
t("Norway is EEA but outside the EU VAT area", taxRegistrationFor("NO").whyKey, "app.taxReg.why.eea");

console.log("\nSafe fallback — an unknown country asserts nothing");
for (const bad of [null, undefined, "", "ZZ", "  ", 42, {}, []]) {
  const r = taxRegistrationFor(bad);
  t(`${JSON.stringify(bad)} → generic`, r.profile, "generic");
  t(`${JSON.stringify(bad)} → not required`, r.required, false);
  t(`${JSON.stringify(bad)} → dismissible`, r.dismissible, true);
}

console.log("\nThings this product must not claim");
// The USA has no federal requirement to show an EIN or a sales-tax permit
// number on an invoice. Marking it required to make the table look symmetrical
// would be a lie told to every American contractor on the platform.
t("the US is OPTIONAL", taxRegistrationFor("US").required, false);
t("...and therefore dismissible", taxRegistrationFor("US").dismissible, true);
t("the US sentence says there is no federal rule",
  /no federal rule/i.test(APP_MESSAGES.en[taxRegistrationFor("US").whyKey]));

// Mexico (CFDI via the SAT) and Brazil (NFS-e, per municipality) are full
// electronic invoicing regimes. Printing an RFC or a CNPJ on a PDF does not
// make anyone compliant there, so there is no entry for them — capturing the
// number would imply a capability the product does not have. They fall through
// to the neutral profile, which asks for nothing and says nothing about their
// law. If either of these starts failing, something added them back as config
// rows; read the header of lib/compliance/taxRegistration.js first.
for (const code of ["MX", "BR"]) {
  const r = taxRegistrationFor(code);
  t(`${code} falls through to the neutral profile`, r.profile, "generic");
  t(`${code} is never marked required`, r.required, false);
  t(`${code} can be waved away`, r.dismissible, true);
}
t("no CFDI/NFS-e copy is left in the catalogue",
  !Object.keys(APP_MESSAGES.en).some((k) => k.startsWith("app.taxReg.eInvoicing")));
t("the config records WHY they are absent",
  /Why Mexico and Brazil are not in this file/.test(
    read("../lib/compliance/taxRegistration.js"),
  ));

console.log("\nEvery profile's copy exists in every locale");
const REG_KEYS = new Set();
for (const code of ["CA", "US", "GB", "IT", "CH", "NO", "IS", "AU", "NZ", "MX", "BR", "ZZ"]) {
  const r = taxRegistrationFor(code);
  REG_KEYS.add(r.nameKey);
  REG_KEYS.add(r.whyKey);
}
for (const [locale, dict] of Object.entries(APP_MESSAGES)) {
  const missing = [...REG_KEYS].filter((k) => !dict[k]);
  t(`${locale}: ${REG_KEYS.size} keys`, missing.length ? missing.join(",") : 0, 0);
}

console.log("\nThe onboarding step");
const ONBOARDING = read("../lib/onboarding.js");
t("a step exists", /key: "tax_registration"/.test(ONBOARDING));
// Done reads the same column the document renderer reads, so a tick here means
// the number really is on the next invoice.
t("done reads taxIdNumber", /company\.taxIdNumber/.test(ONBOARDING));
// A step that can never be completed is worse than no step; one that can never
// be removed is the same bug wearing a hat.
//
// The answer is a checkbox in Company Settings — "I don't have one" — and it
// is honoured in EVERY jurisdiction, not only where the config marks the
// number optional. "Required" in every one of these rules means "required IF
// registered", and a Canadian sole trader under the $30k threshold has no GST
// number to give. Gating the answer on the country would leave exactly the
// smallest businesses carrying an item they can never tick.
t("saying you have none removes the step",
  /taxRegDone \|\| !taxRegDismissed/.test(ONBOARDING));
t("...in every jurisdiction, not just the optional ones",
  !/taxRegDismissed && taxReg\.dismissible/.test(ONBOARDING));
t("the card carries no dismiss control of its own — the answer is recorded, not waved away",
  /dismissible: false/.test(ONBOARDING));

const SETTINGS_PAGE = read("../app/app/settings/company/page.js");
const BIZ = read("../app/api/settings/business-info/route.js");
t("the checkbox lives in Company Settings", /taxRegNotRegistered/.test(SETTINGS_PAGE));
t("...and hides once a number is entered",
  /!String\(form\.taxIdNumber \|\| ""\)\.trim\(\) && \(/.test(SETTINGS_PAGE));
t("saving a number clears the flag, so the two cannot contradict",
  /taxRegistrationDismissedAt: null/.test(BIZ));

// The whole point: a reminder, never a gate. A company with the field empty
// runs its business exactly as before — it is their registration and their
// filing, and FieldQuo's job was only to stop them hearing about the field
// from a client's bookkeeper.
for (const [label, rel] of [
  ["sending a quote", "../app/api/quotes/[id]/send/route.js"],
  ["sending an invoice", "../app/api/invoices/[id]/send/route.js"],
  ["recording a payment", "../app/api/payments/route.js"],
  ["creating an invoice", "../app/api/invoices/route.js"],
]) {
  t(`${label} does not check for a tax number`, !/taxId/.test(read(rel)));
}

// ── There is no dismiss ENDPOINT, and there must not be one ────────────────
//
// These five assertions used to guard POST /api/onboarding-status: that it
// existed, re-checked the jurisdiction, wrote the column, sat behind a
// permission check, and refused in the words it meant. All true, and all about
// code nothing could reach — the only caller was a button gated on
// `step.dismissible`, which lib/onboarding.js sets to false on the one step
// that ever carried the flag. The endpoint was removed rather than wired up,
// because the design it belonged to is the one the comment beside
// `dismissible: false` argues against: a dismiss button records that somebody
// wanted the ask gone, and the checkbox records WHY.
//
// So the claim flips. Not "the endpoint is correct" — "there is no second door
// to this column", leaving the Settings checkbox above (already asserted
// against both the page and the route that saves it) as the only way to say it.
// Comments are stripped first: this file's own prose names the endpoint it is
// asserting the absence of, and a check that reads its own explanation as
// evidence is worse than no check.
const stripComments = (src) =>
  src
    .split("\n")
    .filter((line) => {
      const l = line.trim();
      return !(l.startsWith("//") || l.startsWith("*") || l.startsWith("/*"));
    })
    .join("\n");
const ROUTE = stripComments(read("../app/api/onboarding-status/route.js"));
t("the onboarding-status route is read-only — no dismiss endpoint",
  !/export async function (POST|PATCH|PUT|DELETE)/.test(ROUTE));
t("...and does not write the column behind the checkbox's back",
  !/taxRegistrationDismissedAt/.test(ROUTE));
t("the column exists in the schema",
  /taxRegistrationDismissedAt\s+DateTime\?/.test(read("../prisma/schema.prisma")));

const CARD = stripComments(read("../app/components/dashboard/OnboardingProgress.js"));
t("the card renders the local name", /t\(step\.nameKey\)/.test(CARD));
t("the card renders the reason", /t\(step\.whyKey\)/.test(CARD));
// The dead button's real cost was that it looked like the feature: anyone
// asking "can they skip this?" found a control, not the checkbox. Nothing on
// the card may offer to dismiss a step again.
t("the card offers no dismiss control",
  !/step\.dismissible/.test(CARD) && !/\/api\/onboarding-status"[\s\S]{0,120}POST/.test(CARD));

console.log("\nCompany Settings labels the field the way the country does");
const SETTINGS = read("../app/app/settings/company/page.js");
t("the number field uses the local name", /t\(taxReg\.nameKey\)/.test(SETTINGS));
t("the reason is shown", /t\(taxReg\.whyKey\)/.test(SETTINGS));
t("it does not claim to register or file anyone",
  /taxRegDisclaimer/.test(SETTINGS) &&
    /does not register you/i.test(APP_MESSAGES.en["app.setCompany.taxRegDisclaimer"]));

// No regex, deliberately. Formats vary by country and change when a country
// reforms its register; a false rejection costs the contractor the compliance
// the field exists to give them, a typo costs one correction.
console.log("\nNo format validation anywhere near the number");
t("the config carries no regex", !/RegExp|test\(|\/\^/.test(read("../lib/compliance/taxRegistration.js")));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — the number reaches the document, gets asked for, and nothing overclaims\n");
process.exit(fail ? 1 : 0);
