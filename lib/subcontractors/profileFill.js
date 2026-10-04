// lib/subcontractors/profileFill.js
//
// A subcontractor's details on the general contractor's roster, filled from
// the sub's own FieldQuo company profile — owner decision 2026-10-03, closing
// the ROADMAP note "the sub's owner name is NOT copied … and Subcontractor has
// no address column — both left empty rather than invented".
//
// ── Only what the sub prints on its own documents ───────────────────────────
//
// The rule (owner): fill from the profile "only fields that company has chosen
// to show on its documents (what it prints on its own quotes/invoices), never
// private account data". What a FieldQuo company prints is its document
// identity — the masthead of the quote and invoice page
// (app/components/document/QuoteDocument.js DocumentMasthead: address, email,
// phone, website) and the email footer (lib/email/emailTheme.js: phone, email,
// website and formatAddress(company)). A company chooses what is printed by
// filling those boxes in Settings › Business info; a blank box prints nothing,
// and so fills nothing here. So:
//
//   name      Company.name                       — always printed
//   email     Company.email                      — printed when set
//   phone     Company.phone                      — printed when set
//   address   formatAddress(Company)              — the address line exactly
//             as the email footer prints it (street, city, province, postal
//             code, never the city twice)
//
// NOT read, on purpose: any member's or owner's own name, login email or
// phone (account data, never on a document), billing / Stripe / tax-number
// settings, the website (the roster has no column for it).
//
// ── The contact person ──────────────────────────────────────────────────────
//
// The owner asked for the owner/contact name too. No FieldQuo document prints
// a person: the masthead, the PDF header and footer, the signature block and
// the covering email's From line all carry the COMPANY (the From line is the
// company name — lib/email/resend.js senderFor). Company has no contact-name
// column, and the only names on file are members' account names — exactly the
// private account data the rule excludes. So contactName is never filled; the
// roster says it is not on the sub's documents and the GC types it. If the
// product decides companies should print a contact person (a Business info
// box), this is the one place that reads it.
//
// ── Blanks only, and where each came from ───────────────────────────────────
//
// A value the GC already has — typed by hand, or filled earlier — is never
// overwritten: only a blank (null, "", whitespace) is filled. What was filled
// is recorded in Subcontractor.profileFilled as { field: value }; the roster
// reads a field as "from their FieldQuo profile" only while its value still
// EQUALS what was filled, so the moment the GC edits it the label goes —
// derived at read time, with nothing for the edit route to keep in step.
//
// Pure: no database. lib/subcontractors/sourceLink.js (acceptance) and
// app/api/jobs/[id]/subcontractors (the job panel's "from an import") call it
// with the profile they read through the QuoteImport row — the one record both
// tenants share — and scripts/check-subcontractors.mjs runs it against
// hostile input.

import { formatAddress } from "@/lib/format/address";

/** The fields this fills, in the order the roster lists them. */
export const PROFILE_FIELDS = Object.freeze(["email", "phone", "address"]);

/**
 * The Company columns read — select THIS, never the row. Everything here is
 * printed on the company's own client documents.
 */
export const PROFILE_COMPANY_SELECT = Object.freeze({
  name: true,
  email: true,
  phone: true,
  address: true,
  city: true,
  province: true,
  postalCode: true,
});

const LIMITS = { name: 160, email: 200, phone: 40, address: 300 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};
const blank = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim());

/**
 * What the sub's documents show, as the roster's columns. A box the company
 * left empty — or filled with something that is not an email — is absent.
 */
export function documentProfileOf(company) {
  if (!company || typeof company !== "object") return {};
  const out = {};
  const name = clean(company.name, LIMITS.name);
  if (name) out.name = name;
  const email = clean(company.email, LIMITS.email);
  if (email && EMAIL.test(email)) out.email = email.toLowerCase();
  const phone = clean(company.phone, LIMITS.phone);
  if (phone) out.phone = phone;
  const address = clean(formatAddress(company), LIMITS.address);
  if (address) out.address = address;
  return out;
}

/**
 * The write that fills a roster entry's blanks from the profile.
 *
 * @param existing  the roster row as it stands ({} / null for a new one)
 * @param profile   documentProfileOf(sourceCompany)
 * @returns { data, filled } — `data` is the column patch (only blanks, plus
 *   `profileFilled`, merged with what was filled before, when anything was
 *   filled); {} when there is nothing to fill. `filled` lists the fields.
 */
export function profileFillPatch(existing, profile) {
  const row = existing && typeof existing === "object" ? existing : {};
  const src = profile && typeof profile === "object" ? profile : {};
  const data = {};
  const filled = [];
  for (const field of PROFILE_FIELDS) {
    if (!blank(row[field])) continue;
    if (blank(src[field])) continue;
    data[field] = src[field];
    filled.push(field);
  }
  if (!filled.length) return { data: {}, filled };
  const before = row.profileFilled && typeof row.profileFilled === "object" && !Array.isArray(row.profileFilled) ? row.profileFilled : {};
  const record = {};
  for (const f of PROFILE_FIELDS) if (typeof before[f] === "string") record[f] = before[f];
  for (const f of filled) record[f] = data[f];
  return { data: { ...data, profileFilled: record }, filled };
}

/**
 * Where each of a roster entry's details came from, for the screen:
 *   "profile"  filled from their FieldQuo profile, and unchanged since
 *   "typed"    a value the GC typed (or edited after it was filled)
 *   null       empty
 * contactName is always "typed" or null — see the header.
 */
export function fieldSources(sub) {
  const row = sub && typeof sub === "object" ? sub : {};
  const rec = row.profileFilled && typeof row.profileFilled === "object" && !Array.isArray(row.profileFilled) ? row.profileFilled : {};
  const out = {};
  for (const f of [...PROFILE_FIELDS, "contactName"]) {
    const v = row[f];
    if (blank(v)) out[f] = null;
    else out[f] = PROFILE_FIELDS.includes(f) && typeof rec[f] === "string" && rec[f] === v ? "profile" : "typed";
  }
  return out;
}

/** The Subcontractor columns the fill reads before it writes. */
export const ROSTER_FILL_SELECT = Object.freeze({
  id: true,
  email: true,
  phone: true,
  address: true,
  profileFilled: true,
});
