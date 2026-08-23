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

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — the number reaches the document, and the hint is true\n");
process.exit(fail ? 1 : 0);
