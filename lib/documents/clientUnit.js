// lib/documents/clientUnit.js
//
// The department or branch an organisation client's work is for, printed
// under the client's name on the quote and the invoice (owner, 2026-10-14):
// "Public Services and Procurement Canada" over "Science and Parliamentary
// Infrastructure Branch". Client.organizationUnit is written by the
// Organization card (app/components/clients/OrganizationCard.js) through
// PATCH /api/clients/[id].
//
// ONE function, asked by every surface that draws the client block — the
// staff quote page and both builders (DocumentParties), the staff invoice
// page, the client's /q page (quotePageClientFacts), the PDF panel and the
// email panel (ClientInfoSection, preparedForBlock) — so a quote and its
// invoice cannot print the branch on one surface and not another.
//
// ══ Company clients only ═══════════════════════════════════════════════════
//
// The card keeps the unit when a client is switched back to an individual
// ("kept, never shown for one" — prisma/schema.prisma). A homeowner's
// documents must stay exactly what they were, so `type !== "company"` is no
// line at all, whatever the column holds. A company with no unit is also no
// line: absence is not a statement, and nothing is padded in its place.
//
// ══ The client's own words ═════════════════════════════════════════════════
//
// No label, no translation. A document keeps the language it was created in
// (non-negotiable #6), and the branch's name is not FieldQuo's to translate:
// a French quote to a federal client prints the branch as the client wrote it.
//
// Whitespace runs (a name typed over two lines in the card's input) become one
// space so a PDF panel never gains a blank line; the text is capped because
// the card accepts 2000 characters (lib/clients/contacts.js ORG_TEXT_MAX) and a
// client block is not the place for a paragraph. Long names WRAP on every
// surface — none of them truncates to one line.

export const CLIENT_UNIT_MAX = 300;

/**
 * The line to print under the client's name, or null for none. Pure.
 *
 * @param client  { type, organizationUnit } — any shape; junk is null
 * @returns {string|null}
 */
export function clientUnitLine(client) {
  if (!client || typeof client !== "object" || client.type !== "company") return null;
  const raw = client.organizationUnit;
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > CLIENT_UNIT_MAX ? `${text.slice(0, CLIENT_UNIT_MAX - 1).trimEnd()}…` : text;
}
