// lib/reviews/printSheet.js
//
// The printable card sheet: the company's logo or name, TWO QR codes, and the
// address each one encodes written out underneath. Made for a van door, a
// fridge magnet, a counter card, the back of a business card — anything a
// homeowner sees after the crew has left.
//
//   the page QR     opens the digital business card (/c/<slug>?ref=sticker):
//                   book, get a price, leave a review, call, save the contact
//   the contact QR  IS the contact — the compact vCard, so a camera prompts
//                   "Add contact" without opening anything
//
// ── The URL is printed as well as encoded ─────────────────────────────────────
//
// Two reasons. A printed sheet is what a contractor holds while writing an
// NFC tag with a phone app, and the tag wants the same address the QR carries
// — printing it is how they get it right. And a camera that will not focus
// on a scuffed sticker still leaves a person who can type.
//
// ── Brand colour on the sentence, measured ────────────────────────────────────
//
// The QRs stay black on white, always — a phone camera is tuned for that and
// a brand-yellow QR is a QR nobody scans. The sentence takes the company's
// colour through theme.accentText — the accent as TEXT on paper, measured to
// 4.5:1 by lib/documents/theme.js — so a mid-grey or a pale yellow brand
// still reads on the white card. Not accentFill: FieldQuo's own orange is
// 5.6:1 as a fill and 2.9:1 as text, and a sentence is text.
//
// Nothing on the sheet names FieldQuo.

import { escapeHtml, escapeAttr, safeUrl } from "@/lib/email/emailTheme";
import { documentTheme } from "@/lib/documents/theme";
import { qrSvg } from "./qr";
import { reviewQrCopy } from "./reviewQrCopy";
import { cardCopy } from "./cardCopy";

/**
 * @param company    { name, logoUrl, brandColor, brandColors, defaultLanguage }
 * @param cardUrl    the card page's address with ?ref=sticker — the page QR
 * @param vcard      the compact vCard text — the contact QR; omitted when the
 *                   company has no name to put on one
 * @param language   one of the eight document languages; company default otherwise
 * @param printLabel the toolbar button's word, in the CONTRACTOR's interface
 *                   language (the route reads it off appMessages) — the only
 *                   thing on the page that is for them rather than the customer
 * @returns a complete HTML document, or null without a usable card URL
 */
export function printSheetHtml({ company = {}, cardUrl, vcard = null, language, printLabel = "Print" } = {}) {
  const url = safeUrl(cardUrl);
  if (!url) return null;

  const lang = language || company.defaultLanguage || "en";
  const t = reviewQrCopy(lang);
  const c = cardCopy(lang);
  const theme = documentTheme(company);
  const accent = theme.accentText;
  const name = company.name || "";
  const logo = safeUrl(company.logoUrl);
  const pageQr = qrSvg(url, { size: 640, margin: 4, title: c.scanCard });
  const contactQr = vcard ? qrSvg(vcard, { size: 640, margin: 4, title: c.scanSave }) : null;

  const brand = (cls) =>
    logo
      ? `<img class="logo ${cls}" src="${escapeAttr(logo)}" alt="${escapeAttr(name)}">`
      : `<div class="name ${cls}">${escapeHtml(name)}</div>`;

  // One large card for a counter or a door, then the two small ones for a
  // magnet or a business card: the page QR, and the contact QR. The person
  // prints the page and cuts.
  const large = `
    <section class="card large">
      ${brand("")}
      <div class="qr">${pageQr}</div>
      <p class="sentence">${escapeHtml(c.scanCard)}</p>
      <p class="url">${escapeHtml(t.orVisit)} <span>${escapeHtml(url)}</span></p>
    </section>`;
  const smallPage = `
    <section class="card small">
      ${brand("")}
      <div class="qr">${pageQr}</div>
      <p class="sentence">${escapeHtml(c.scanCard)}</p>
      <p class="url"><span>${escapeHtml(url)}</span></p>
    </section>`;
  const smallContact = contactQr
    ? `
    <section class="card small">
      ${brand("")}
      <div class="qr">${contactQr}</div>
      <p class="sentence">${escapeHtml(c.scanSave)}</p>
    </section>`
    : "";

  return `<!doctype html>
<html lang="${escapeAttr(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(name || c.scanCard)}</title>
<style>
  :root { --accent: ${accent}; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f4f6; color: #111827; font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; }
  .page { max-width: 8.5in; margin: 0 auto; padding: 24px; display: grid; gap: 24px; }
  .toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; font-size: 14px; color: #374151; }
  .toolbar button { font: inherit; font-weight: 600; padding: 10px 18px; border-radius: 999px; border: 0; background: #111827; color: #fff; cursor: pointer; }
  .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 28px; text-align: center; page-break-inside: avoid; }
  .card.large { padding: 40px; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .logo { max-height: 56px; max-width: 220px; margin: 0 auto 18px; display: block; }
  .name { font-size: 22px; font-weight: 700; margin: 0 0 18px; color: #111827; }
  .qr { margin: 0 auto; width: 100%; }
  .qr svg { width: 100%; height: auto; display: block; max-width: 420px; margin: 0 auto; }
  .card.small .qr svg { max-width: 200px; }
  .card.small .logo { max-height: 36px; }
  .card.small .name { font-size: 16px; }
  .sentence { font-size: 24px; font-weight: 700; color: var(--accent); margin: 20px 0 8px; line-height: 1.25; }
  .card.small .sentence { font-size: 16px; margin-top: 14px; }
  .url { font-size: 12px; color: #4b5563; margin: 0; word-break: break-all; }
  .url span { font-family: ui-monospace, Menlo, monospace; }
  .card.small .url { font-size: 10px; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { padding: 0; gap: 16px; max-width: none; }
    .card { border-color: #d1d5db; border-radius: 8px; }
    @page { margin: 12mm; }
  }
  @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="page">
  <div class="toolbar">
    <span>${escapeHtml(name)}</span>
    <button type="button" onclick="window.print()">${escapeHtml(printLabel)}</button>
  </div>
  ${large}
  <div class="row">${smallPage}${smallContact}</div>
</div>
</body>
</html>`;
}
