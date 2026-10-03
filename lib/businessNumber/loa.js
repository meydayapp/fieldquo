// lib/businessNumber/loa.js
//
// The Letter of Authorization wording for a port FieldQuo files by hand (a
// Canadian number — Twilio has no Canadian port API). PURE and import-free,
// so the settings screen shows the company EXACTLY the text the platform
// package later prints with their signature under it: one function, two
// readers, no second copy to drift.
//
// Twilio's own e-signature (HelloSign) covers hosted orders and US ports; this
// text is only for the Canadian path, and it says what Twilio's Canadian
// guideline asks an LOA to carry: the authorized user's name, the service
// address exactly as the carrier has it, the number, and the account details.
// Whether Twilio accepts this typed signature or asks for its own form to be
// signed is Twilio's call — the package says so, and FieldQuo staff ask the
// company to sign Twilio's version if it is requested.

/** @param row  { e164, holderName, customerType, serviceAddress, carrierName, loaSignedName, loaSignedAt } */
export function loaText(row = {}) {
  const a = row.serviceAddress || {};
  const address = [a.street, a.street2, a.city, a.region, a.postalCode, a.country].filter(Boolean).join(", ");
  const lines = [
    "LETTER OF AUTHORIZATION — PORT OF TELEPHONE NUMBER",
    "",
    `Telephone number: ${row.e164 || "—"}`,
    `Current provider: ${row.carrierName || "as shown on the attached bill"}`,
    `Account holder (as on the provider's records): ${row.holderName || "—"}${row.customerType ? ` (${row.customerType})` : ""}`,
    `Service address (as on the provider's records): ${address || "—"}`,
    "",
    "I authorize Twilio Inc., acting for FieldQuo, to act as my agent to transfer the telephone number above from my current provider to Twilio, and to take the steps needed to complete that transfer.",
    "I confirm that I am the account holder, or am authorized by the account holder, to make this request, and that the details above match my provider's records.",
    "I understand that once the transfer completes, the number will no longer work with my current provider or on my current SIM, and that any services I keep with that provider (including the line itself) remain my responsibility, as do any early-termination or contract charges.",
  ];
  if (row.loaSignedName && row.loaSignedAt) {
    lines.push("", `Signed electronically by ${row.loaSignedName} on ${new Date(row.loaSignedAt).toISOString()}.`);
  }
  return lines.join("\n");
}
