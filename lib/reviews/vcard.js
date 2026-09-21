// lib/reviews/vcard.js
//
// The company as a contact card: a vCard 3.0 in two sizes.
//
// ── Two variants, because a tag is 504 bytes ─────────────────────────────────
//
//   full     what /c/<slug>/contact.vcf serves and "Save contact" downloads:
//            name, phone, email, website, address, the logo as a base64 JPEG
//            (capped at 100 KB) and a NOTE carrying the booking and review
//            links. Size is not a constraint over HTTP.
//
//   compact  what goes onto an NFC tag and into the "scan to save our
//            contact" QR: the same fields minus PHOTO and NOTE, plus URL set
//            to the card page — so the phone that taps it gets a contact
//            whose one link opens everything else. An NTAG215 holds 504
//            bytes of NDEF and the MIME wrapper for text/vcard costs about
//            twenty, so `ntag215Fits()` tells the screen which tag to buy.
//
// vCard 3.0 rather than 4.0 because it is the version iOS Camera, Android's
// camera/Lens and NFC Tools all recognise on sight and prompt "Add contact"
// for; 4.0's PHOTO syntax is still not read by every Contacts app. MECARD was
// considered and rejected: it has no ORG-vs-N distinction and no ADR
// structure, so a company card came out as a person with no address.
//
// ── What is never in it ──────────────────────────────────────────────────────
//
// The word FieldQuo. The card is the contractor's, and a contact saved to a
// homeowner's phone with our name in it would be the exact leak the
// white-label rule forbids. No PRODID line for the same reason — the
// convention is to name the generator there, and the generator is us.
//
// Pure: no imports beyond node's crypto-free string handling. The check
// parses what this emits.

const CRLF = "\r\n";

/** RFC 6350 §3.4 text escaping, shared by 3.0 in practice. */
export function escapeVCardText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\;");
}

/** Fold a content line at 75 octets with a leading space on continuations (RFC 2425 §5.8.1). */
export function foldLine(line) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out = [];
  let start = 0;
  let first = true;
  while (start < bytes.length) {
    const max = first ? 75 : 74;
    let end = Math.min(bytes.length, start + max);
    // Never split inside a UTF-8 sequence: back off to a boundary.
    while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((first ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
    first = false;
  }
  return out.join(CRLF);
}

function line(name, value, params = "") {
  return foldLine(`${name}${params}:${value}`);
}

function digitsForTel(phone) {
  const v = String(phone || "").trim();
  return v.replace(/[^\d+()\-\s.]/g, "").trim();
}

/**
 * @param company   { name, phone, email, website, address, city, province, postalCode, country }
 * @param cardUrl   the /c/<slug> page, absolute
 * @param bookingUrl / reviewUrl  absolute or null — go into NOTE (full only)
 * @param photo     { base64, type: "JPEG"|"PNG" } or null (full only)
 * @param note      { book, review } label words in the company's language
 * @param variant   "full" | "compact"
 */
export function buildVCard({
  company = {},
  cardUrl = null,
  bookingUrl = null,
  reviewUrl = null,
  photo = null,
  labels = {},
  variant = "full",
} = {}) {
  const name = String(company.name || "").trim();
  if (!name) return null;
  const compact = variant === "compact";
  const lines = ["BEGIN:VCARD", "VERSION:3.0"];

  // N is required by 3.0; a company has no family/given name, so the
  // organisation's name sits in the family slot the way every business card
  // app writes it, and FN/ORG carry it properly.
  lines.push(line("N", `${escapeVCardText(name)};;;;`));
  lines.push(line("FN", escapeVCardText(name)));
  lines.push(line("ORG", escapeVCardText(name)));

  const tel = digitsForTel(company.phone);
  if (tel) lines.push(line("TEL", tel, ";TYPE=CELL,VOICE"));

  const email = String(company.email || "").trim();
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) lines.push(line("EMAIL", email, ";TYPE=INTERNET,WORK"));

  const website = String(company.website || "").trim();
  if (compact) {
    if (cardUrl) lines.push(line("URL", cardUrl));
  } else {
    if (website && /^https?:\/\//i.test(website)) lines.push(line("URL", website, ";TYPE=WORK"));
    if (cardUrl) lines.push(line("URL", cardUrl, ";TYPE=PROFILE"));
  }

  const street = String(company.address || "").trim();
  const city = String(company.city || "").trim();
  const region = String(company.province || "").trim();
  const postal = String(company.postalCode || "").trim();
  const country = String(company.country || "").trim();
  if (street || city || region || postal) {
    lines.push(
      line(
        "ADR",
        [";;", escapeVCardText(street), escapeVCardText(city), escapeVCardText(region), escapeVCardText(postal), escapeVCardText(country)].join(";").replace(/^;;;/, ";;"),
        ";TYPE=WORK",
      ),
    );
  }

  if (!compact) {
    if (photo?.base64 && /^[A-Za-z0-9+/=]+$/.test(photo.base64)) {
      const type = photo.type === "PNG" ? "PNG" : "JPEG";
      lines.push(line("PHOTO", photo.base64, `;ENCODING=b;TYPE=${type}`));
    }
    const notes = [];
    if (bookingUrl) notes.push(`${labels.book || "Book a visit"}: ${bookingUrl}`);
    if (reviewUrl) notes.push(`${labels.review || "Leave us a review"}: ${reviewUrl}`);
    if (notes.length) lines.push(line("NOTE", escapeVCardText(notes.join("\n"))));
  }

  lines.push("END:VCARD");
  return lines.join(CRLF) + CRLF;
}

/** Usable NDEF bytes on the two tags a contractor will actually be sold. */
export const NTAG213_BYTES = 144;
export const NTAG215_BYTES = 504;
export const NTAG216_BYTES = 888;
/** NDEF message + MIME record header for "text/vcard": TLV (4) + record header (3+1+len) + type (10). */
export const NDEF_VCARD_OVERHEAD = 24;

export function ndefSize(text) {
  return Buffer.byteLength(String(text || ""), "utf8") + NDEF_VCARD_OVERHEAD;
}

/** Which tag the compact card fits, by name, or null when it fits none of the three. */
export function tagThatFits(text) {
  const size = ndefSize(text);
  if (size <= NTAG213_BYTES) return "NTAG213";
  if (size <= NTAG215_BYTES) return "NTAG215";
  if (size <= NTAG216_BYTES) return "NTAG216";
  return null;
}

export function ntag215Fits(text) {
  return ndefSize(text) <= NTAG215_BYTES;
}

/**
 * The parser the check uses, and the settings page's proof that the file is
 * a card: unfold, split, and return { version, props: [{ name, params, value }] }.
 */
export function parseVCard(text) {
  const unfolded = String(text || "").replace(/\r?\n[ \t]/g, "");
  const rows = unfolded.split(/\r?\n/).filter(Boolean);
  if (rows[0] !== "BEGIN:VCARD" || rows[rows.length - 1] !== "END:VCARD") return null;
  const props = [];
  for (const row of rows.slice(1, -1)) {
    const colon = row.indexOf(":");
    if (colon < 0) return null;
    const [name, ...params] = row.slice(0, colon).split(";");
    props.push({ name: name.toUpperCase(), params, value: row.slice(colon + 1) });
  }
  const version = props.find((p) => p.name === "VERSION")?.value || null;
  return { version, props };
}
