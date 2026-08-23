// lib/documents/taxId.js
//
// The company's tax registration line, as it appears on a document.
//
// ── Why this renders at all ────────────────────────────────────────────────
//
// Company Settings collects taxIdName and taxIdNumber, and its own hint says
// "Tax ID name and number will appear on invoices." That sentence was false in
// all six languages: the pair was written, stored, shown back in FieldQuo's own
// platform console, and rendered on nothing a client ever saw.
//
// It is not decoration. A GST/HST registrant in Canada must show their
// registration number on an invoice for the customer to claim input tax
// credits; VAT registration numbers carry the same requirement in the EU and
// UK. A contractor who typed their number in, saw it save, and sent invoices
// without it has been issuing documents their clients cannot fully claim on.
// That is the "control that appears to work" rule with a tax authority
// attached.
//
// ── Why it is not a placement setting ──────────────────────────────────────
//
// The obvious next feature is letting each company choose where it sits. That
// would be a worse product: there is one conventional position — with the
// contact details, at the foot of the document — and offering four wrong ones
// plus the right one makes the contractor responsible for a layout decision
// they have no reason to have an opinion about. The compliance requirement is
// that the number is PRESENT and legible, not where it sits.
//
// ── Absence is absence ─────────────────────────────────────────────────────
//
// Returns "" when either half is missing, so a contractor who is not
// registered gets no line at all — never a label with nothing after it. A
// blank "Tax ID:" under someone's name is worse than silence: it reads as a
// system that lost the number.

/**
 * @param {object} company  { taxIdName, taxIdNumber }
 * @returns {string} e.g. "GST/HST: 123456789 RT0001", or "" if not registered.
 */
export function taxIdLine(company) {
  if (!company || typeof company !== "object") return "";
  const label = String(company.taxIdName ?? "").trim();
  const number = String(company.taxIdNumber ?? "").trim();

  // The NUMBER is the part that matters. A company that typed a number and no
  // label still gets the number on the document — dropping it because the
  // label is blank would withhold the compliance-relevant half over a cosmetic
  // one.
  if (!number) return "";
  return label ? `${label}: ${number}` : number;
}
