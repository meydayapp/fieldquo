// scripts/check-document-money.mjs
//
// The client-facing quote and invoice rendered "$2100.00" — no thousands
// separator — on line items, subtotal and total, while every internal screen
// showed "$2,100.00". Two formats for the same number, and the wrong one was
// on the document the homeowner keeps.
//
// The cause was a default parameter doing less than it looked like it did:
//
//   documentFormatters(language, currency = "CAD")
//
// A default only fires for `undefined`. Company.currency is String?, so a
// company that never opened the setting stores NULL — which survived the
// default, made Intl throw RangeError, and dropped into a catch that returned
// toFixed(2) with no grouping.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-document-money.mjs

import { documentFormatters, DOCUMENT_LABELS } from "@/lib/i18n/documentLabels";
import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");
const money = (cur, n = 2100) => documentFormatters("en", cur).money(n);

console.log("\nEvery way a currency can be absent still groups");
// null is the one that shipped broken. The others are the same class.
t("null (the real stored value)", money(null), "$2,100.00");
t("undefined", money(undefined), "$2,100.00");
t("empty string", money(""), "$2,100.00");
t("explicit CAD", money("CAD"), "$2,100.00");

console.log("\nThe company's currency is honoured, not overwritten with CAD");
t("USD keeps its own symbol", money("USD"), "US$2,100.00");
t("EUR keeps its own symbol", money("EUR"), "€2,100.00");
t("an unknown code does not throw", /2,100/.test(money("ZZZ")));

console.log("\nThe numbers from the QA report specifically");
t("the quote total", money("CAD"), "$2,100.00");
t("the estimated cost", money("CAD", 1113.11), "$1,113.11");
t("zero is not blank", money("CAD", 0), "$0.00");
t("cents are never dropped", money("CAD", 125.5), "$125.50");
t("a non-number is not NaN on a document", money("CAD", "abc"), "$0.00");
t("null amount reads as zero", money("CAD", null), "$0.00");

console.log("\nLanguage changes the formatting, never the money");
// A francophone homeowner buying from a Toronto contractor is still billed in
// Canadian dollars — the separator and symbol placement move, the currency
// does not.
const fr = documentFormatters("fr", "CAD").money(2100);
t("French groups with its own conventions", /2\s?100/.test(fr));
t("...and is still dollars", /\$/.test(fr));
t("French is NOT the same string as English", fr !== money("CAD"));

console.log("\nThe degraded path looks like the good one");
// If Intl currency data is ever missing, the fallback must still group —
// otherwise the broken render is visually distinct from the correct one on
// the same page, which is exactly the bug being fixed.
const src = read("../lib/i18n/documentLabels.js");
t("the fallback groups rather than using bare toFixed",
  /minimumFractionDigits: 2,\s*\n\s*maximumFractionDigits: 2,/.test(src));
t("the coalesce exists and is used", /const code = currency \|\| "CAD";/.test(src));
t("...and money() reads the coalesced code", /currency: code,/.test(src));

console.log("\nEvery money-rendering document section receives the currency");
for (const f of [
  "TotalsSection", "ScopeGroupsSection", "PaymentSummarySection", "SignatureSection",
]) {
  const s = read(`../lib/documentSections/${f}.js`);
  t(`${f} passes company currency`, !/documentFormatters\(language\)/.test(s));
}
for (const f of ["quoteEmail", "invoiceEmail"]) {
  const s = read(`../lib/email/${f}.js`);
  t(`${f} passes company currency`, !/documentFormatters\(language\)/.test(s));
}
// Date-only callers legitimately pass no currency; asserted so a later sweep
// doesn't "fix" them into needing a company they don't have.
for (const f of ["HeaderSection", "ClientInfoSection"]) {
  const s = read(`../lib/documentSections/${f}.js`);
  t(`${f} is date-only and needs no currency`, !/\bmoney\(/.test(s));
}

// ── The signed quote's PDF actually shows the signature ────────────────────
//
// An acceptance email used to attach a PDF with no signature on it: the
// section that draws the drawn mark, name, date, IP and document hash
// (lib/documentSections/SignatureSection.js) was already built and wired into
// the default quote_pdf sections, but the acceptance route rendered the PDF
// from a `quote` object that was loaded from the database BEFORE this same
// request wrote the signature to it — so `data.signature` was always
// undefined at render time, and the section quietly took its "unsigned"
// branch. Fixed by threading the just-built signature record into the
// renderer explicitly rather than trusting the stale row.
//
// Also: the labels around the signature block ("Approval", "Signature",
// "Date signed", "Electronically signed"…) used to be hardcoded English on a
// document whose language is fixed at creation (AGENTS.md non-negotiable
// #6) — a French quote's signed copy would read the block in English forever.
console.log("\nThe signed quote's PDF shows the signature, in the document's own language");
{
  const sig = read("../lib/documentSections/SignatureSection.js");
  t("SignatureSection imports documentLabels rather than hardcoding English",
    /import\s*\{[^}]*documentLabels[^}]*\}\s*from\s*"@\/lib\/i18n\/documentLabels"/.test(sig));
  // The give-away for a hardcoded string sneaking back in: a bare English
  // word as JSX text where a `{labels.…}` expression belongs. Whitespace/
  // newline-tolerant (`>\s*word\s*<`) because this file's JSX text nodes sit
  // on their own line between the opening and closing tags, not inline —
  // a plain substring check like `.includes(">Approval<")` would miss that
  // shape and pass even on the original, never-fixed hardcoded version.
  for (const word of ["Approval", "Signature", "Name", "Date signed"]) {
    const re = new RegExp(`>\\s*${word}\\s*<`);
    t(`SignatureSection does not hardcode "${word}" as JSX text`, !re.test(sig));
  }
  t("the blank-field labels come from the labels object, not a literal array",
    !/\["Signature", "Name", "Date"\]/.test(sig));
  t("the audit line reads labels.signatureElectronicallySigned",
    /labels\.signatureElectronicallySigned/.test(sig));

  // This counted occurrences of `key:` in the source and compared them to a
  // hardcoded 6, which went stale the day German and Italian were added to the
  // table — and read "translated in all 6 … got=8" while failing, which points
  // at the wrong thing entirely. Ask the table, and name the language that is
  // actually short.
  const short = (key) =>
    Object.entries(DOCUMENT_LABELS)
      .filter(([, tbl]) => typeof tbl[key] !== "string" || !tbl[key].trim())
      .map(([code]) => code);
  const langCount = Object.keys(DOCUMENT_LABELS).length;
  for (const key of [
    "signatureApproval", "signatureAcceptWithTotal", "signatureAcceptNoTotal",
    "signatureFieldLabel", "signatureNameFieldLabel", "signatureDateFieldLabel",
    "signatureDateSignedLabel", "signatureElectronicallySigned", "signatureFromIp",
    "signatureDocumentRef",
  ]) {
    t(`${key} is translated in all ${langCount} document languages`, short(key).join(",") || "none", "none");
  }

  const route = read("../app/api/public/quotes/[token]/route.js");
  t("dispatchDecisionEmails accepts the just-built signature record",
    /async function dispatchDecisionEmails\([^)]*signatureRecord[^)]*\)/.test(route));
  t("the acceptance handler passes signatureRecord to dispatchDecisionEmails",
    /dispatchDecisionEmails\(updated, quote, decision, priced, signatureRecord\)/.test(route));
  t("renderApprovedQuotePdf accepts the signature record",
    /async function renderApprovedQuotePdf\([^)]*signatureRecord[^)]*\)/.test(route));
  t("renderApprovedQuotePdf is called with the signature record",
    /renderApprovedQuotePdf\(\s*quote,\s*updated\.companyId,\s*priced,\s*language,\s*signatureRecord,?\s*\)/.test(route));
  t("the PDF's data payload carries the signature (falling back to the stored row)",
    /signature:\s*signatureRecord\s*\|\|\s*quote\.signature\s*\|\|\s*null/.test(route));

  // Both sides keep a copy of what was agreed to: the same rendered
  // `attachments` (built once, from `pdfBuffer`) is passed to the internal
  // owners/admins notification AND the client's confirmation — not just one
  // of the two sends this function makes on acceptance.
  //
  // Matched on sendEmail rather than resend.emails.send: this route built its
  // own Resend client until lib/email/resend.js became the single seam the
  // demo interception sits at (see scripts/check-demo-email.mjs). The property
  // asserted here — two sends, both carrying the attachment — is unchanged;
  // only the name of the call is.
  const sendCalls = [...route.matchAll(/sendEmail\(\{([\s\S]*?)\}\);/g)].map((m) => m[1]);
  t("exactly two emails are sent from the acceptance/decline path", sendCalls.length, 2);
  const withAttachments = sendCalls.filter((c) => /\battachments\b/.test(c));
  t("both the internal (company) email and the client email attach the signed PDF",
    withAttachments.length, 2);
}

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — one money format, in the company's own currency\n");
process.exit(fail ? 1 : 0);
