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
t("it honours the jurisdiction's dismissibility",
  /taxReg\.dismissible/.test(ONBOARDING));
t("a dismissed step is dropped, not left greyed out",
  /taxRegDone \|\| !\(taxRegDismissed && taxReg\.dismissible\)/.test(ONBOARDING));

const ROUTE = read("../app/api/onboarding-status/route.js");
t("the dismiss endpoint exists", /export async function POST/.test(ROUTE));
// Hiding the button is not access control — the server re-checks the country
// rather than trusting a flag that came back from GET.
t("...and re-checks the jurisdiction server-side",
  /taxRegistrationFor\(company\.country\)\.dismissible/.test(ROUTE));
t("...and writes the column", /taxRegistrationDismissedAt/.test(ROUTE));
t("...behind a permission check", /requirePermission\(member\.role/.test(ROUTE));
t("the column exists in the schema",
  /taxRegistrationDismissedAt\s+DateTime\?/.test(read("../prisma/schema.prisma")));

const CARD = read("../app/components/dashboard/OnboardingProgress.js");
t("the card renders the local name", /t\(step\.nameKey\)/.test(CARD));
t("the card renders the reason", /t\(step\.whyKey\)/.test(CARD));
t("dismiss failures are reported, not swallowed",
  /reportResponseError\(res/.test(CARD) && /showError\(/.test(CARD));

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
