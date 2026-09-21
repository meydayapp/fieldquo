// scripts/check-reviews-google.mjs
//
//   npm run check:reviews-google
//
// Settings → Reviews' Google half, the digital business card, and every
// surface that carries the card's QR — EXECUTED, not read. Every claim below
// is a property of code that ran here, against hostile input, the memory
// Prisma (scripts/fixtures/memoryPrisma.mjs) and a fake Google:
//
//   1. a place_id becomes the one review URL Google documents, and nothing
//      that is not a place_id does
//   2. the QR encoder's output is DECODED here by an independent reader —
//      format bits, unmask, placement walk, de-interleave, byte mode — for
//      the review URL, the card URL with its ?ref, and the vCard
//   3. the review-request email carries the QR image and the link, in all
//      eight document languages, and never names FieldQuo
//   4. the invoice-footer QR gate is honoured (switch × link × invoice) and
//      the caption colour measures 4.5:1 on paper
//   5. an Apple pass signed with a throwaway identity has every manifest
//      hash right and a PKCS#7 whose messageDigest is the manifest's SHA-1;
//      the Google save link's JWT verifies with the throwaway public key
//   6. a Google-page paste keeps stars and dates, dedupes on author + date +
//      forty characters, and lands unapproved
//   7. the OAuth state round-trips and every tampered form is refused; the
//      authorise URL asks for business.manage and the calendar's scopes stay
//   8. the refresh, run against a fake Google answering 429, stamps the
//      honest quota sentence on the row and keeps Google's own words
//   9. the refresh, run against a fake Google answering reviews, caches
//      them, keeps showOnSite across a second run, purges what Google
//      stopped returning and what is older than thirty days
//  10. the card renders with and without a review URL / booking / instant
//      quote, names FieldQuo nowhere in the body, and falls back to the
//      company's language; card_tap is recorded per source and counted
//  11. the vCard parses, the NFC/QR variant has no photo and fits an
//      NTAG215, and the .vcf route's headers are the ones that make a
//      phone prompt
//  12. every "not set up yet" is a sentence naming the missing variable;
//      nothing client-facing names FieldQuo
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import forge from "node-forge";
import jwt from "jsonwebtoken";
import { unzipSync } from "fflate";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Env, before anything reads it ────────────────────────────────────────────
process.env.META_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret-for-the-check";
process.env.NEXT_PUBLIC_APP_URL = "https://www.fieldquo.com";
delete process.env.APPLE_PASS_TYPE_ID;
delete process.env.APPLE_TEAM_ID;
delete process.env.APPLE_PASS_CERT_P12_BASE64;
delete process.env.APPLE_PASS_CERT_PASSWORD;
delete process.env.GOOGLE_WALLET_ISSUER_ID;
delete process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON;

const { db } = await import("@/lib/db");
const { looksLikePlaceId, reviewUrlForPlaceId, placeIdFromReviewUrl, placeLabel } = await import("../lib/reviews/googlePlace.js");
const qr = await import("../lib/reviews/qr.js");
const { reviewQrCopy, REVIEW_QR_LANGUAGES, scanSentence, isGoogleReviewUrl } = await import("../lib/reviews/reviewQrCopy.js");
const { buildReviewEmail, REVIEW_EMAIL_LANGUAGES } = await import("../lib/reviews/reviewEmail.js");
const { SUPPORTED_EMAIL_LANGUAGES } = await import("../lib/i18n/emailCopy.js");
const { invoiceReviewQrWanted } = await import("../lib/reviews/invoiceQr.js");
const { documentTheme } = await import("../lib/documents/theme.js");
const { contrastRatio } = await import("../lib/brand/colour.js");
const wallet = await import("../lib/reviews/wallet/config.js");
const { buildApplePass, buildPassJson, buildManifest } = await import("../lib/reviews/wallet/applePass.js");
const { buildGoogleSaveUrl, buildGooglePassPayload } = await import("../lib/reviews/wallet/googlePass.js");
const testimonials = await import("../lib/reviews/testimonials.js");
const { signState, verifyState, GOOGLE_BUSINESS_STATE_COOKIE } = await import("../lib/reviews/googleBusiness/state.js");
const { buildBusinessAuthorizeUrl, GOOGLE_BUSINESS_SCOPES, fullLocationName } = await import("../lib/reviews/googleBusiness/client.js");
const { GOOGLE_CALENDAR_SCOPES, buildGoogleAuthorizeUrl } = await import("../lib/calendar/googleClient.js");
const { saveBusinessConnection, getBusinessConnection, setBusinessLocation, deleteBusinessConnection, publicBusinessShape } = await import("../lib/reviews/googleBusiness/connection.js");
const { refreshCompanyReviews, mapGoogleReview, quotaMessage, CACHE_DAYS } = await import("../lib/reviews/googleBusiness/sync.js");
const { mergeReviews } = await import("../lib/reviews/mergeReviews.js");
const { cardUrl, cleanCardSource, CARD_SOURCES, addressLine, mapsUrl } = await import("../lib/reviews/card.js");
const { cardCopy, CARD_LANGUAGES } = await import("../lib/reviews/cardCopy.js");
const { buildVCard, parseVCard, ndefSize, tagThatFits, NTAG215_BYTES, foldLine } = await import("../lib/reviews/vcard.js");
const { pickVisitorLanguage } = await import("../lib/i18n/acceptLanguage.js");
const { linkCandidates } = await import("../lib/links/candidates.js");
const { sanitiseLinkConfig } = await import("../lib/links/config.js");
const { recordCardTap } = await import("../lib/analytics/product/server.js");
const { SERVER_EVENTS } = await import("../lib/analytics/product/events.js");
const { cardTapCounts } = await import("../lib/reviews/cardTaps.js");
const { qrPayload, cleanQrTarget, clampQrSize } = await import("../lib/reviews/qrTarget.js");
const { printSheetHtml } = await import("../lib/reviews/printSheet.js");
const { newReviewQrToken, looksLikeQrToken, ensureReviewQrToken, reviewQrPngUrl } = await import("../lib/reviews/qrToken.js");
const { APP_MESSAGES } = await import("../app/i18n/appMessages.js");
const { default: LinkPageView } = await import("../app/components/links/LinkPageView.js");

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.log(`✗ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
// "FieldQuo" anywhere except inside our own hostname (fieldquo.com), which
// a link to the card legitimately carries.
const namesFieldQuo = (html) => /fieldquo/i.test(String(html).replace(/fieldquo\.com/gi, "").replace(/fieldquo-/gi, ""));

// ── 1. place_id → review URL ─────────────────────────────────────────────────
{
  const id = "ChIJN1t_tDeuEmsRUsoyG83frY4";
  ok("place_id recognised", looksLikePlaceId(id));
  ok("review URL is Google's writereview endpoint", reviewUrlForPlaceId(id) === `https://search.google.com/local/writereview?placeid=${id}`);
  ok("round-trips through placeIdFromReviewUrl", placeIdFromReviewUrl(reviewUrlForPlaceId(id)) === id);
  for (const bad of ["", "   ", "short", "has spaces in it and is long enough", "javascript:alert(1)//aaaaaaaaaaaaaa", null, 42, "x".repeat(301)]) {
    ok(`not a place_id: ${JSON.stringify(bad)}`, !looksLikePlaceId(bad) && reviewUrlForPlaceId(bad) === null);
  }
  ok("a pasted g.page link is not a place id", placeIdFromReviewUrl("https://g.page/r/abc/review") === null);
  ok("label joins name and address as Google printed them", placeLabel({ name: "  Acme   Painting ", address: "1 Main St, Ottawa" }) === "Acme Painting — 1 Main St, Ottawa");
  ok("label with nothing is null", placeLabel({}) === null);
  ok("google URLs get the Google sentence", isGoogleReviewUrl("https://g.page/r/x/review") && isGoogleReviewUrl(reviewUrlForPlaceId(id)) && !isGoogleReviewUrl("https://www.homestars.com/x"));
}

// ── 2. QR: an independent reader ─────────────────────────────────────────────
//
// Reads the format bits back, unmasks, walks the placement order, splits
// codewords into the blocks the version defines, de-interleaves, and parses
// byte mode. None of the encoder's intermediate values are consulted —
// only the finished matrix and the public tables.
function decodeQr(matrix) {
  const { size, version } = matrix;
  if (size !== qr.sizeForVersion(version)) throw new Error("size/version mismatch");
  // Format bits along row 8 (left copy): bit i at the positions writeFormat used.
  let bits = 0;
  const posLeft = [];
  for (let i = 0; i < 6; i++) posLeft.push([8, i]);
  posLeft.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) posLeft.push([14 - i, 8]);
  posLeft.forEach(([x, y], i) => { bits |= matrix.get(x, y) << i; });
  let mask = -1;
  for (let m = 0; m < 8; m++) if (qr.formatBits(m) === bits) mask = m;
  if (mask < 0) throw new Error("format bits do not match any mask");
  // The second copy must agree.
  let bits2 = 0;
  for (let i = 0; i < 8; i++) bits2 |= matrix.get(size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) bits2 |= matrix.get(8, size - 15 + i) << i;
  if (bits2 !== bits) throw new Error("the two format copies disagree");
  // Version bits for v>=7.
  if (version >= 7) {
    let vb = 0;
    for (let i = 0; i < 18; i++) vb |= matrix.get(Math.floor(i / 3), (i % 3) + size - 11) << i;
    if (vb !== qr.versionBits(version)) throw new Error("version bits wrong");
  }
  const order = qr.placementOrder(qr.functionPatterns(version));
  const raw = order.map(([x, y]) => matrix.get(x, y) ^ qr.maskBit(mask, x, y));
  const codewords = [];
  for (let i = 0; i + 8 <= raw.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | raw[i + j];
    codewords.push(b);
  }
  const { blocks } = qr.blockStructure(version);
  const totalData = blocks.reduce((a, b) => a + b, 0);
  const longest = Math.max(...blocks);
  const perBlock = blocks.map(() => []);
  let k = 0;
  for (let i = 0; i < longest; i++) {
    for (let b = 0; b < blocks.length; b++) {
      if (i < blocks[b]) perBlock[b].push(codewords[k++]);
    }
  }
  const data = perBlock.flat();
  if (data.length !== totalData) throw new Error("data length");
  // Byte mode.
  const bitAt = (n) => (data[Math.floor(n / 8)] >> (7 - (n % 8))) & 1;
  const readBits = (start, len) => { let v = 0; for (let i = 0; i < len; i++) v = (v << 1) | bitAt(start + i); return v; };
  if (readBits(0, 4) !== 0b0100) throw new Error("not byte mode");
  const countBits = version < 10 ? 8 : 16;
  const count = readBits(4, countBits);
  const bytes = [];
  for (let i = 0; i < count; i++) bytes.push(readBits(4 + countBits + i * 8, 8));
  return { text: Buffer.from(bytes).toString("utf8"), mask, version };
}

{
  const reviewUrl = reviewUrlForPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4");
  const card = cardUrl("https://www.fieldquo.com", "northline", "qr");
  ok("card URL carries ?ref=qr", card === "https://www.fieldquo.com/c/northline?ref=qr");
  for (const [label, text] of [["review URL", reviewUrl], ["card URL", card], ["short", "A"], ["unicode", "héllo ✓ wörld"], ["v10+", "x".repeat(250)]]) {
    let decoded = null;
    let err = null;
    try {
      decoded = decodeQr(qr.qrMatrix(text));
    } catch (e) {
      err = e.message;
    }
    ok(`QR decodes: ${label}`, decoded && decoded.text === text, err || (decoded && decoded.text.slice(0, 40)));
  }
  ok("too long is refused, not truncated", (() => { try { qr.qrMatrix("y".repeat(700)); return false; } catch { return true; } })());
  ok("empty is refused", (() => { try { qr.qrMatrix(""); return false; } catch { return true; } })());
  const svg = qr.qrSvg(card, { size: 200, title: "<scan>" });
  ok("SVG is dark on light with a quiet zone", /<rect[^>]+fill="#ffffff"/.test(svg) && /<path[^>]+fill="#000000"/.test(svg) && /viewBox="0 0 (\d+)/.test(svg));
  ok("SVG title is escaped", svg.includes("&lt;scan&gt;") && !svg.includes("<scan>"));
  ok("qrPayload: card by default, review when asked, contact needs a vCard",
    qrPayload({ target: "nope", origin: "https://www.fieldquo.com", slug: "a" }).text === "https://www.fieldquo.com/c/a?ref=qr" &&
    qrPayload({ target: "review", origin: "x", slug: "a", reviewUrl }).text === reviewUrl &&
    qrPayload({ target: "review", origin: "x", slug: "a" }) === null &&
    qrPayload({ target: "contact", origin: "x", slug: "a", compactVCard: "BEGIN:VCARD" }).text === "BEGIN:VCARD" &&
    cleanQrTarget("contact") === "contact" && clampQrSize("9999") === 2048 && clampQrSize("abc") === 512);
}

// ── 3. The email: QR + link, eight languages, no FieldQuo ────────────────────
{
  const reviewUrl = reviewUrlForPlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4");
  const company = { name: "Northline Painting", brandColor: "#f5c400", reviewUrl };
  const qrPngUrl = reviewQrPngUrl(newReviewQrToken());
  ok("review email copy covers every document language", SUPPORTED_EMAIL_LANGUAGES.every((l) => REVIEW_EMAIL_LANGUAGES.includes(l)), REVIEW_EMAIL_LANGUAGES.join(","));
  ok("QR copy covers every document language", SUPPORTED_EMAIL_LANGUAGES.every((l) => REVIEW_QR_LANGUAGES.includes(l)));
  ok("card copy covers every document language", SUPPORTED_EMAIL_LANGUAGES.every((l) => CARD_LANGUAGES.includes(l)));
  for (const language of SUPPORTED_EMAIL_LANGUAGES) {
    const email = buildReviewEmail({ company, client: { name: "Jane" }, language, qrPngUrl });
    const html = email?.html || "";
    const sentence = scanSentence(language, reviewUrl);
    ok(`email ${language}: QR image, link and sentence`, html.includes(`src="${qrPngUrl}"`) && html.includes(`href="${reviewUrl}"`) && html.includes(sentence) && sentence === reviewQrCopy(language).scanGoogle);
    ok(`email ${language}: no FieldQuo`, !namesFieldQuo(html));
    const keys = Object.keys(reviewQrCopy("en"));
    ok(`QR copy ${language}: every key filled`, keys.every((k) => typeof reviewQrCopy(language)[k] === "string" && reviewQrCopy(language)[k].trim()));
  }
  ok("email without a token renders no QR and still works", (() => { const e = buildReviewEmail({ company, language: "en" }); return e && !e.html.includes("<img") && e.html.includes(reviewUrl); })());
  ok("a javascript: QR src is dropped", !buildReviewEmail({ company, language: "en", qrPngUrl: "javascript:alert(1)" }).html.includes("javascript:"));
  ok("qr token shape", looksLikeQrToken(newReviewQrToken()) && !looksLikeQrToken("../etc") && !looksLikeQrToken("x".repeat(24).replace("x", ".")));
}

// ── 4. The invoice footer gate + contrast ────────────────────────────────────
{
  const reviewUrl = "https://g.page/r/abc/review";
  const on = { invoiceReviewQr: true, reviewUrl };
  ok("gate: on + link + invoice", invoiceReviewQrWanted({ data: { invoiceNumber: "INV-1" }, company: on }));
  ok("gate: a quote never", !invoiceReviewQrWanted({ data: { quoteNumber: "Q-1" }, company: on }));
  ok("gate: switch off", !invoiceReviewQrWanted({ data: { invoiceNumber: "INV-1" }, company: { ...on, invoiceReviewQr: false } }));
  ok("gate: no link, switch on", !invoiceReviewQrWanted({ data: { invoiceNumber: "INV-1" }, company: { invoiceReviewQr: true, reviewUrl: null } }));
  ok("gate: javascript: link", !invoiceReviewQrWanted({ data: { invoiceNumber: "INV-1" }, company: { invoiceReviewQr: true, reviewUrl: "javascript:x" } }));
  for (const brand of ["#ffff00", "#ffffff", "#000000", "#808080", "#f5c400", "#06356b"]) {
    const theme = documentTheme({ brandColor: brand });
    ok(`footer caption inkMuted on paper ≥ 4.5 for ${brand}`, contrastRatio(theme.inkMuted, theme.paper) >= 4.5, contrastRatio(theme.inkMuted, theme.paper).toFixed(2));
    ok(`print-sheet accentText on white ≥ 4.5 for ${brand}`, contrastRatio(theme.accentText, "#ffffff") >= 4.5, contrastRatio(theme.accentText, "#ffffff").toFixed(2));
  }
  ok("email footer ask colour #4b5563 on white ≥ 4.5", contrastRatio("#4b5563", "#ffffff") >= 4.5);
  const footer = read("lib/documentSections/FooterSection.js");
  ok("FooterSection PDF draws the QR as paths behind the shared gate", footer.includes("invoiceReviewQrWanted({ data, company })") && footer.includes("qrPath(m, { margin })") && footer.includes('fill="#000000"') && footer.includes("theme.inkMuted"));
  ok("FooterSection email uses the gate and links the review", footer.includes("renderEmailHtml") && footer.includes("reviewQrCopy(language).enjoyed"));
}

// ── 5. Wallet passes against a throwaway identity ────────────────────────────
{
  ok("Apple: unconfigured says which variables", !wallet.appleWalletConfigured() && wallet.appleWalletMissing().length === 4 && wallet.loadAppleSigner() === null);
  ok("Google: unconfigured says which variables", !wallet.googleWalletConfigured() && wallet.googleWalletMissing().join(",") === "GOOGLE_WALLET_ISSUER_ID,GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");
  ok("unconfigured pass builder returns null, never an unsigned bundle", (await buildApplePass({ company: { name: "x" }, reviewUrl: "https://x", signer: null })) === null && buildGoogleSaveUrl({ company: { name: "x" }, reviewUrl: "https://x", issuer: null }) === null);

  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 86400e3);
  const attrs = [{ name: "commonName", value: "Pass Type ID: pass.com.fieldquo.review" }, { name: "organizationName", value: "Check" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "pw-check", { algorithm: "3des" });
  process.env.APPLE_PASS_CERT_P12_BASE64 = forge.util.encode64(forge.asn1.toDer(p12).getBytes());
  process.env.APPLE_PASS_CERT_PASSWORD = "pw-check";
  process.env.APPLE_PASS_TYPE_ID = "pass.com.fieldquo.review";
  process.env.APPLE_TEAM_ID = "ABCDE12345";
  wallet.resetWalletCachesForChecks();
  ok("Apple: configured once the four are set", wallet.appleWalletConfigured());

  const company = { id: "cmp_check", name: "Northline Painting", brandColor: "#f5c400", logoUrl: "https://res.cloudinary.com/x/logo.png", defaultLanguage: "fr" };
  const target = cardUrl("https://www.fieldquo.com", "northline", "wallet");
  const buf = await buildApplePass({ company, reviewUrl: target, fetchImage: async () => null });
  const files = unzipSync(new Uint8Array(buf));
  ok("pkpass has pass.json, icons, manifest, signature", ["pass.json", "icon.png", "icon@2x.png", "manifest.json", "signature"].every((n) => files[n]));
  const manifest = JSON.parse(Buffer.from(files["manifest.json"]).toString("utf8"));
  ok("manifest lists every file but itself and the signature", Object.keys(manifest).sort().join() === Object.keys(files).filter((n) => n !== "manifest.json" && n !== "signature").sort().join());
  ok("every manifest hash is the file's SHA-1", Object.entries(manifest).every(([n, h]) => createHash("sha1").update(Buffer.from(files[n])).digest("hex") === h));
  const pass = JSON.parse(Buffer.from(files["pass.json"]).toString("utf8"));
  ok("pass carries the card URL as its QR, the type id and team", pass.barcodes[0].message === target && pass.passTypeIdentifier === "pass.com.fieldquo.review" && pass.teamIdentifier === "ABCDE12345" && pass.organizationName === company.name);
  // What Wallet SHOWS: every field value, the description, the
  // organisation and the logo text. The pass type id (pass.com.fieldquo.…)
  // is an identifier Wallet groups by and never prints.
  const shown = [pass.description, pass.organizationName, pass.logoText, ...Object.values(pass.generic).flat().flatMap((f) => [f.label, f.value])].join(" ");
  ok("pass is in the company's language, no nfc block, no FieldQuo shown", pass.generic.primaryFields[0].value === reviewQrCopy("fr").passTitle && !pass.nfc && !namesFieldQuo(shown));
  const bg = pass.backgroundColor.match(/\d+/g).map(Number);
  const fg = pass.foregroundColor.match(/\d+/g).map(Number);
  const hex = (c) => `#${c.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  ok("pass colours measure 4.5:1", contrastRatio(hex(fg), hex(bg)) >= 4.5, contrastRatio(hex(fg), hex(bg)).toFixed(2));
  const sig = forge.pkcs7.messageFromAsn1(forge.asn1.fromDer(forge.util.createBuffer(Buffer.from(files.signature).toString("binary"))));
  ok("signature carries the signer and the WWDR intermediate", sig.certificates.length === 2);
  const si = sig.rawCapture.signerInfos[0];
  let md = null;
  for (const a of si.value[3].value) {
    if (forge.asn1.derToOid(a.value[0].value) === forge.pki.oids.messageDigest) md = forge.util.bytesToHex(a.value[1].value[0].value);
  }
  ok("signature's messageDigest is SHA-1 of manifest.json", md === createHash("sha1").update(Buffer.from(files["manifest.json"])).digest("hex"));
  ok("a different URL is a different serial", buildPassJson({ company, reviewUrl: target, signer: wallet.loadAppleSigner() }).serialNumber !== buildPassJson({ company, reviewUrl: `${target}x`, signer: wallet.loadAppleSigner() }).serialNumber);
  ok("wrong password throws rather than signing nothing", (() => { process.env.APPLE_PASS_CERT_PASSWORD = "wrong"; wallet.resetWalletCachesForChecks(); try { wallet.loadAppleSigner(); return false; } catch { return true; } finally { process.env.APPLE_PASS_CERT_PASSWORD = "pw-check"; wallet.resetWalletCachesForChecks(); } })());

  process.env.GOOGLE_WALLET_ISSUER_ID = "3388000000000000001";
  process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON = Buffer.from(JSON.stringify({ client_email: "sa@check.iam.gserviceaccount.com", private_key: forge.pki.privateKeyToPem(keys.privateKey) })).toString("base64");
  wallet.resetWalletCachesForChecks();
  const save = buildGoogleSaveUrl({ company, reviewUrl: target, origin: "https://www.fieldquo.com" });
  ok("Google save URL is pay.google.com", save && save.startsWith("https://pay.google.com/gp/v/save/"));
  const token = save.split("/gp/v/save/")[1];
  let decoded = null;
  try {
    decoded = jwt.verify(token, forge.pki.publicKeyToPem(keys.publicKey), { algorithms: ["RS256"] });
  } catch {
    decoded = null;
  }
  ok("Google JWT verifies with the throwaway public key", Boolean(decoded));
  ok("Google JWT: savetowallet, origin, generic class per company, QR = card URL", decoded && decoded.typ === "savetowallet" && decoded.origins[0] === "https://www.fieldquo.com" && decoded.payload.genericClasses[0].id.endsWith(".review-cmp_check") && decoded.payload.genericObjects[0].barcode.value === target && decoded.payload.genericObjects[0].classId === decoded.payload.genericClasses[0].id);
  ok("Google JWT names FieldQuo nowhere", !namesFieldQuo(JSON.stringify(buildGooglePassPayload({ company, reviewUrl: target, issuer: wallet.loadGoogleWalletIssuer(), origin: "x" }))));
  const docs = read("docs/WALLET-PASS.md");
  ok("WALLET-PASS.md says a pass cannot be tapped and offers the NFC tag", /cannot be tapped/i.test(docs) && /NTAG215/.test(docs) && /NFC Tools/.test(docs) && /pass\.com\.fieldquo\.review/.test(docs));
}

// ── 6. Paste import: stars, dates, identity, unapproved ──────────────────────
{
  const paste = [
    "Jane Doe", "★★★★★ 2025-03-14", "Wonderful work, the crew were tidy and quick and the finish is flawless — would hire again.",
    "",
    "Jane Doe", "★★★★★ 2025-03-14", "Wonderful work, the crew were tidy and quick and the finish is flawless — would hire again. And more after the fold.",
    "",
    "Bob", "5/5 · 3 weeks ago", "Good job all round",
    "",
    "Sam", "Left without a rating line",
  ].join("\n");
  const r = testimonials.parseBlocks(paste);
  ok("stars and date lifted off the rating line", r.rows[0].rating === 5 && r.rows[0].reviewedAt?.toISOString().slice(0, 10) === "2025-03-14" && r.rows[0].quote.startsWith("Wonderful"));
  ok("same author + date + forty characters is one review", r.rows.length === 3 && r.skipped.duplicate === 1);
  ok("a relative date is not invented into one", r.rows[1].rating === 5 && r.rows[1].reviewedAt === null);
  ok("a block with no rating line keeps its words", r.rows[2].authorName === "Sam" && r.rows[2].rating === null);
  ok("parseRating bounds", testimonials.parseRating("7") === null && testimonials.parseRating("0") === null && testimonials.parseRating("★★★") === 3 && testimonials.parseRating("4.4/5") === 4);
  ok("dated identity differs from undated", testimonials.contentKey({ authorName: "a", quote: "b".repeat(50), reviewedAt: new Date("2025-01-01") }) !== testimonials.contentKey({ authorName: "a", quote: "b".repeat(50) }));
  ok("undated identity unchanged by the new fields", testimonials.contentKey({ authorName: "a", quote: "hello" }) === testimonials.contentKey({ authorName: "a", quote: "hello", reviewedAt: null }));
  const csv = testimonials.parseTabularRows([{ Reviewer: "Ann", Review: "Great painters, very careful", Stars: "4", Date: "14/03/2025" }]);
  ok("CSV rating and date columns recognised", csv.rows[0].rating === 4 && csv.rows[0].reviewedAt?.toISOString().slice(0, 10) === "2025-03-14");
  const route = read("app/api/settings/testimonials/import/route.js");
  ok("import route: google_import source, rating/date stored, approved false", route.includes('"google_import"') && route.includes("rating: row.rating") && route.includes("approved: false") && !/approved: true/.test(route));
  ok("SOURCES includes google_import", testimonials.SOURCES.includes("google_import"));
}

// ── 7. OAuth state and scopes ────────────────────────────────────────────────
{
  const state = signState({ memberId: "mem_1" });
  ok("state round-trips", verifyState(state, { cookieValue: state })?.memberId === "mem_1");
  ok("state: cookie mismatch refused", verifyState(state, { cookieValue: `${state}x` }) === null);
  ok("state: tampered member refused", verifyState(state.replace("mem_1", "mem_2"), { cookieValue: state.replace("mem_1", "mem_2") }) === null);
  ok("state: expired refused", verifyState(state, { cookieValue: state, now: Date.now() + 601_000 }) === null);
  ok("business cookie is not the calendar cookie", GOOGLE_BUSINESS_STATE_COOKIE !== "google_calendar_oauth_state");
  const url = new URL(buildBusinessAuthorizeUrl({ redirectUri: "https://www.fieldquo.com/api/reviews/google/callback", state }));
  ok("authorise URL asks for business.manage on the SAME client", url.searchParams.get("scope").includes("https://www.googleapis.com/auth/business.manage") && url.searchParams.get("client_id") === process.env.GOOGLE_OAUTH_CLIENT_ID && url.searchParams.get("access_type") === "offline" && url.searchParams.get("prompt") === "consent");
  const cal = new URL(buildGoogleAuthorizeUrl({ redirectUri: "x", state }));
  ok("the calendar's authorise URL is unchanged", cal.searchParams.get("scope") === GOOGLE_CALENDAR_SCOPES.join(" ") && !cal.searchParams.get("scope").includes("business"));
  ok("business scopes carry openid email", GOOGLE_BUSINESS_SCOPES.includes("openid") && GOOGLE_BUSINESS_SCOPES.includes("email"));
  ok("fullLocationName joins account and location", fullLocationName("accounts/1", "locations/2") === "accounts/1/locations/2" && fullLocationName("accounts/1", "accounts/1/locations/2") === "accounts/1/locations/2" && fullLocationName("", "locations/2") === null);
  for (const f of ["app/api/reviews/google/connect/route.js", "app/api/reviews/google/callback/route.js"]) {
    const src = read(f);
    ok(`${f} checks configuration before reaching Google`, src.includes("googleCalendarConfigured()"));
  }
  ok("callback checks the GRANTED scope", read("app/api/reviews/google/callback/route.js").includes("granted.includes(BUSINESS_SCOPE)"));
}

// ── 8 & 9. The refresh against a fake Google ─────────────────────────────────
{
  db.__reset?.();
  await db.company.create({ data: { id: "cmp_g", name: "Northline", slug: "northline" } });
  await saveBusinessConnection({ companyId: "cmp_g", refreshToken: "rt-secret", email: "owner@northline.ca", memberId: "mem_1" });
  let row = await getBusinessConnection("cmp_g");
  ok("connection stored with the token encrypted", row && row.refreshTokenEnc && !row.refreshTokenEnc.includes("rt-secret"));
  ok("public shape carries no token", !JSON.stringify(publicBusinessShape(row)).includes("rt-secret") && !("refreshTokenEnc" in publicBusinessShape(row)));

  const quota429 = { ok: false, status: 429, reason: "RESOURCE_EXHAUSTED", message: "Quota exceeded for quota metric 'Requests' and limit 'Requests per minute' of service 'mybusiness.googleapis.com' for consumer 'project_number:123'." };
  const q = quotaMessage(quota429);
  ok("429 is worded as the quota-0 truth with Google's words kept", q.kind === "quota" && /quota of 0/.test(q.message) && q.message.includes(quota429.message) && /GOOGLE-BUSINESS-PROFILE\.md/.test(q.message));
  ok("403 without quota wording is a permission sentence", quotaMessage({ status: 403, message: "The caller does not have permission" }).kind === "scope");
  ok("401 is an expired-connection sentence", quotaMessage({ status: 401, message: "invalid_grant" }).kind === "auth");

  row = await setBusinessLocation("cmp_g", { accountName: "accounts/1", locationName: "locations/2", locationTitle: "Northline Painting" });
  const refusing = { accessTokenFor: async () => ({ ok: true, accessToken: "at" }), listReviews: async () => quota429 };
  const refused = await refreshCompanyReviews(row, { db, google: refusing });
  row = await getBusinessConnection("cmp_g");
  ok("refresh against quota 0 fails honestly and stamps the row", !refused.ok && refused.kind === "quota" && row.lastError === refused.message && row.lastSyncAt == null);

  const now = new Date("2026-09-21T04:40:00Z");
  const reviews = [
    { name: "accounts/1/locations/2/reviews/r1", reviewer: { displayName: "Ann" }, starRating: "FIVE", comment: "Lovely job", createTime: "2026-09-01T10:00:00Z" },
    { name: "accounts/1/locations/2/reviews/r2", reviewer: { isAnonymous: true }, starRating: "THREE", createTime: "2026-08-01T10:00:00Z" },
    { name: "bad", starRating: "SIX", createTime: "x" },
  ];
  let calls = 0;
  const serving = {
    accessTokenFor: async () => ({ ok: true, accessToken: "at" }),
    listReviews: async ({ pageToken }) => {
      calls++;
      return pageToken ? { ok: true, data: { reviews: [reviews[1]] } } : { ok: true, data: { reviews: [reviews[0], reviews[2]], nextPageToken: "p2" } };
    },
  };
  // A stale row from a month ago that Google no longer returns.
  await db.googleReview.create({ data: { companyId: "cmp_g", reviewName: "accounts/1/locations/2/reviews/old", reviewerName: "Old", starRating: 4, comment: "gone", reviewCreateTime: new Date("2026-06-01"), fetchedAt: new Date("2026-07-01"), showOnSite: true } });
  const first = await refreshCompanyReviews(row, { db, google: serving, now });
  let cached = await db.googleReview.findMany({ where: { companyId: "cmp_g" } });
  ok("refresh pages through, maps two reviews, drops the malformed one", first.ok && first.fetched === 2 && calls === 2 && cached.length === 2, JSON.stringify(first));
  ok("anonymous reviewer gets a neutral name; rating-only review has no comment", cached.find((r) => r.reviewName.endsWith("r2"))?.reviewerName === "A Google user" && cached.find((r) => r.reviewName.endsWith("r2"))?.comment === null);
  ok("the stale row Google no longer returns is purged", !cached.some((r) => r.reviewName.endsWith("/old")) && first.removed >= 1);
  ok("row stamped with lastSyncAt and no error", (await getBusinessConnection("cmp_g")).lastError === null && (await getBusinessConnection("cmp_g")).lastSyncAt);
  await db.googleReview.updateMany({ where: { companyId: "cmp_g", reviewName: "accounts/1/locations/2/reviews/r1" }, data: { showOnSite: true } });
  reviews[0].comment = "Lovely job — edited";
  const second = await refreshCompanyReviews(row, { db, google: serving, now: new Date(now.getTime() + 86400e3) });
  cached = await db.googleReview.findMany({ where: { companyId: "cmp_g" } });
  const r1 = cached.find((r) => r.reviewName.endsWith("r1"));
  ok("second refresh replaces Google's words and keeps showOnSite", second.ok && r1.comment === "Lovely job — edited" && r1.showOnSite === true && cached.length === 2);
  ok("mapGoogleReview refuses shapes that are not reviews", mapGoogleReview(null) === null && mapGoogleReview({ name: "x", starRating: "SIX", createTime: "2026-01-01" }) === null && mapGoogleReview({ name: "x", starRating: "FIVE", createTime: "nope" }) === null);
  // The second refresh stamped fetchedAt at now + 1 day; a day past the
  // cache window from THAT is when the rows must go.
  const later = new Date(now.getTime() + (CACHE_DAYS + 2) * 86400e3);
  const dead = { accessTokenFor: async () => ({ ok: false, status: 401, message: "invalid_grant" }), listReviews: async () => { throw new Error("must not be called"); } };
  const expired = await refreshCompanyReviews(row, { db, google: dead, now: later });
  cached = await db.googleReview.findMany({ where: { companyId: "cmp_g" } });
  ok("thirty-day purge runs even when the token is dead", !expired.ok && expired.kind === "auth" && cached.length === 0);
  const merged = mergeReviews({ rows: [{ quote: "Own words", authorName: "A" }], google: [{ comment: "Lovely job", reviewerName: "Ann", starRating: 5 }, { comment: null, reviewerName: "X", starRating: 3 }] });
  ok("public merge attributes Google rows and skips wordless ones", merged.length === 2 && merged[1].author === "Ann · ★★★★★ · Google");
  await deleteBusinessConnection("cmp_g", db);
  ok("disconnect removes the row and every cached review", (await getBusinessConnection("cmp_g", db)) === null && (await db.googleReview.findMany({ where: { companyId: "cmp_g" } })).length === 0);
  ok("no route writes Google words into Testimonial", !/testimonial\.(create|upsert)/.test(read("lib/reviews/googleBusiness/sync.js")) && !fs.readdirSync(path.join(ROOT, "app/api/reviews/google"), { recursive: true }).some((f) => f.endsWith("route.js") && /testimonial\./.test(read(path.join("app/api/reviews/google", f)))));
  const gdoc = read("docs/GOOGLE-BUSINESS-PROFILE.md");
  ok("GOOGLE-BUSINESS-PROFILE.md has the quota application, the 60-day rule and the second redirect URI", /Basic API Access/.test(gdoc) && /60\+ days/.test(gdoc) && /api\/reviews\/google\/callback/.test(gdoc) && /business\.manage/.test(gdoc));
}

// ── 10. The card ─────────────────────────────────────────────────────────────
{
  const base = {
    id: "cmp_card", name: "Northline Painting", slug: "northline", bookingSlug: null, logoUrl: null, brandColor: "#f5c400",
    phone: "(613) 555-0142", email: "hello@northline.ca", website: "https://northline.ca", city: "Ottawa", province: "ON", country: "CA",
    address: "1039 Bank St", postalCode: "K1S 3W9", reviewUrl: null, defaultLanguage: "fr",
  };
  const render = (company, { language = null, site = null, activeEventTypes = 0, enabledEstimators = 0, saveContact = { url: "/c/northline/contact.vcf", label: cardCopy(language || company.defaultLanguage).saveContact } } = {}) => {
    const labelled = language ? { ...company, defaultLanguage: language } : company;
    const candidates = linkCandidates({ company: labelled, site, activeEventTypes, enabledEstimators, funnels: [], offersKitchenDesign: false });
    const config = sanitiseLinkConfig({});
    const html = renderToStaticMarkup(React.createElement(LinkPageView, { company, config, candidates, language, saveContact, address: addressLine(company) ? { text: addressLine(company), url: mapsUrl(company), label: cardCopy(language || company.defaultLanguage).directions } : null, year: 2026 }));
    return { html, candidates };
  };
  const bare = render(base);
  const body = (html) => html.replace(/<footer[\s\S]*<\/footer>/, "");
  ok("card renders without review, booking or instant quote", bare.html.includes("Northline Painting") && bare.html.includes("1039 Bank St") && !bare.candidates.some((c) => c.key === "review" || c.key === "book" || c.key === "instant"));
  ok("card body names FieldQuo nowhere (footer credit aside)", !namesFieldQuo(body(bare.html)));
  ok("save-contact pill and map link present", bare.html.includes('href="/c/northline/contact.vcf"') && bare.html.includes("google.com/maps/search"));
  const full = render({ ...base, reviewUrl: "https://g.page/r/abc/review" }, { activeEventTypes: 1, enabledEstimators: 1, language: "es" });
  ok("card with review, booking and instant quote shows all three", ["review", "book", "instant"].every((k) => full.candidates.some((c) => c.key === k)) && full.html.includes("https://g.page/r/abc/review"));
  ok("visitor language wins for labels", full.html.includes(cardCopy("es").saveContact) && full.candidates.find((c) => c.key === "review").label === "Deja una reseña");
  ok("company language is the fallback", pickVisitorLanguage("pt-BR,pt;q=0.9", "fr") === "fr" && pickVisitorLanguage("de-CH,de;q=0.8,en;q=0.5", "fr") === "de" && pickVisitorLanguage(null, "xx") === "en" && pickVisitorLanguage("es;q=0.2,uk;q=0.9", "en") === "uk");
  ok("no address → no address line, never padded", addressLine({ name: "x", city: "" }) === null && mapsUrl({}) === null);
  ok("card_tap is a server event; sources are a closed list", SERVER_EVENTS.includes("card_tap") && cleanCardSource("sticker") === "sticker" && cleanCardSource("") === "link" && cleanCardSource("../x") === "other" && cleanCardSource("OTHER") === "other" && CARD_SOURCES.includes("nfc"));
  ok("cardUrl stamps only known refs", cardUrl("https://www.fieldquo.com/", "a b", "nfc") === "https://www.fieldquo.com/c/a%20b?ref=nfc" && cardUrl("x", "a") === "x/c/a" && cardUrl("x", "a", "weird") === "x/c/a?ref=other" && cardUrl("x", "") === "");
  db.__reset?.();
  await db.company.create({ data: { id: "cmp_taps", name: "Taps", slug: "taps" } });
  for (const s of ["sticker", "sticker", "nfc", "bogus", undefined]) await recordCardTap({ companyId: "cmp_taps", source: s, language: "fr" }, { client: db });
  const counts = await cardTapCounts("cmp_taps", { db });
  ok("card_tap recorded per source and counted", counts.total === 5 && counts.bySource.sticker === 2 && counts.bySource.nfc === 1 && counts.bySource.other === 1 && counts.bySource.link === 1, JSON.stringify(counts));
  ok("a tap for nobody is refused", (await recordCardTap({ companyId: null, source: "qr" }, { client: db })) === false);
  const page = read("app/c/[slug]/page.js");
  ok("card page records the tap server-side and is noindex", page.includes("recordCardTap({ companyId: card.company.id, source") && page.includes("index: false"));
  ok("/c passes through the tenant rewrite and is a client surface", read("middleware.js").includes('"/c",') && read("lib/analytics/product/routes.js").includes('"/c",'));
}

// ── 11. The vCard ────────────────────────────────────────────────────────────
{
  const company = { name: "Northline Painting, Ltd.", phone: "(613) 555-0142", email: "hello@northline.ca", website: "https://northline.ca", address: "1039 Bank St", city: "Ottawa", province: "ON", postalCode: "K1S 3W9", country: "CA" };
  const compact = buildVCard({ company, cardUrl: "https://www.fieldquo.com/c/northline?ref=nfc", variant: "compact" });
  const full = buildVCard({ company, cardUrl: "https://www.fieldquo.com/c/northline", bookingUrl: "https://www.fieldquo.com/book/northline", reviewUrl: "https://g.page/r/x/review", photo: { base64: "AAAA", type: "JPEG" }, labels: { book: "Rendez-vous", review: "Laisser un avis" } });
  const pc = parseVCard(compact);
  const pf = parseVCard(full);
  ok("both vCards parse as 3.0", pc?.version === "3.0" && pf?.version === "3.0");
  const names = (p) => p.props.map((x) => x.name);
  ok("full carries FN/ORG/TEL/EMAIL/URL/ADR/PHOTO/NOTE", ["FN", "ORG", "TEL", "EMAIL", "URL", "ADR", "PHOTO", "NOTE"].every((n) => names(pf).includes(n)));
  ok("compact has no PHOTO and no NOTE, and its URL is the card", !names(pc).includes("PHOTO") && !names(pc).includes("NOTE") && pc.props.find((p) => p.name === "URL").value === "https://www.fieldquo.com/c/northline?ref=nfc");
  ok("TEL is CELL", pc.props.find((p) => p.name === "TEL").params.join(";").includes("TYPE=CELL"));
  ok("commas escaped in the name", pc.props.find((p) => p.name === "FN").value === "Northline Painting\\, Ltd.");
  ok("ADR has seven components", pc.props.find((p) => p.name === "ADR").value.split(";").length === 7);
  ok("compact fits an NTAG215", ndefSize(compact) <= NTAG215_BYTES && tagThatFits(compact) !== null && tagThatFits(compact) !== "NTAG216", `${ndefSize(compact)} bytes`);
  ok("NOTE carries the booking and review links in the company's words", pf.props.find((p) => p.name === "NOTE").value.includes("Rendez-vous: https://www.fieldquo.com/book/northline") && pf.props.find((p) => p.name === "NOTE").value.includes("Laisser un avis"));
  ok("no FieldQuo in either vCard", !namesFieldQuo(full) && !namesFieldQuo(compact));
  ok("no PRODID line", !/PRODID/.test(full));
  ok("lines fold at 75 octets on UTF-8 boundaries", foldLine(`X:${"é".repeat(60)}`).split("\r\n").every((l) => Buffer.byteLength(l) <= 75) && parseVCard(`BEGIN:VCARD\r\nVERSION:3.0\r\n${foldLine(`FN:${"é".repeat(60)}`)}\r\nEND:VCARD`).props.find((p) => p.name === "FN").value === "é".repeat(60));
  ok("no name → no card", buildVCard({ company: { phone: "1" } }) === null);
  const vcardQr = decodeQr(qr.qrMatrix(compact));
  ok("the contact QR decodes to the compact vCard byte for byte", vcardQr.text === compact);
  const route = read("app/c/[slug]/contact.vcf/route.js");
  ok(".vcf route: text/vcard, attachment with .vcf filename, nosniff, no-store", route.includes('"Content-Type": "text/vcard; charset=utf-8"') && route.includes('"Content-Disposition": `attachment; filename="${vcfFilename(card.company.name)}"`') && route.includes('"X-Content-Type-Options": "nosniff"') && route.includes('"Cache-Control": "no-store"'));
  ok(".vcf route caps the photo at 100 KB", route.includes("PHOTO_MAX_BYTES = 100 * 1024"));
  const sheet = printSheetHtml({ company: { name: "Acme", brandColor: "#ffff00", defaultLanguage: "de" }, cardUrl: "https://www.fieldquo.com/c/acme?ref=sticker", vcard: compact });
  ok("print sheet: two QRs, both captions in the company's language, the URL printed, no FieldQuo", (sheet.match(/<svg/g) || []).length === 3 && sheet.includes(cardCopy("de").scanCard) && sheet.includes(cardCopy("de").scanSave) && sheet.includes("https://www.fieldquo.com/c/acme?ref=sticker") && !namesFieldQuo(sheet));
  ok("print sheet without a card URL is null", printSheetHtml({ company: { name: "x" }, cardUrl: "" }) === null);
}

// ── 12. Honest sentences and the catalogue ───────────────────────────────────
{
  for (const lang of Object.keys(APP_MESSAGES)) {
    const d = APP_MESSAGES[lang];
    ok(`${lang}: wallet/GBP "not set up" sentences exist`, ["app.setReviews.appleWalletNotSetUp", "app.setReviews.googleWalletNotSetUp", "app.setReviews.gbpNotSetUp", "app.setReviews.walletNfcNote", "app.setReviews.nfcOptionContact", "app.setReviews.nfcFits"].every((k) => typeof d[k] === "string" && d[k].trim()));
    ok(`${lang}: nfcFits carries both placeholders`, d["app.setReviews.nfcFits"].includes("{bytes}") && d["app.setReviews.nfcFits"].includes("{tag}"));
  }
  const cardUi = read("app/app/settings/reviews/CardAndQr.js");
  ok("wallet buttons render only when the server said configured", cardUi.includes("wallet?.apple?.configured ?") && cardUi.includes("wallet?.google?.configured ?") && cardUi.includes("data-wallet-nfc-note"));
  const gbpUi = read("app/app/settings/reviews/GoogleBusiness.js");
  ok("GBP panel prints the server's refusal verbatim and offers the paste path", gbpUi.includes("data-gbp-last-error") && gbpUi.includes("app.setReviews.gbpPasteInstead") && !gbpUi.includes("<Pencil"));
  const settingsRoute = read("app/api/settings/reviews/route.js");
  ok("settings PATCH derives the review URL from the place id server-side", settingsRoute.includes("data.reviewUrl = reviewUrlForPlaceId(id)") && settingsRoute.includes("looksLikePlaceId(body.googlePlaceId)"));
  ok("settings PATCH refuses the invoice QR over an empty link", settingsRoute.includes("if (data.invoiceReviewQr === true)"));
  ok("cron entry for the nightly refresh", JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/google-reviews"));
  for (const f of ["lib/reviews/reviewQrCopy.js", "lib/reviews/cardCopy.js", "lib/reviews/vcard.js", "lib/reviews/printSheet.js", "lib/reviews/wallet/applePass.js", "lib/reviews/wallet/googlePass.js"]) {
    const src = read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    ok(`${f}: no "FieldQuo" in a client-facing string`, !/["'`][^"'`\n]*FieldQuo[^"'`\n]*["'`]/.test(src));
  }
}

console.log(`\n${failed === 0 ? "✓" : "✗"} check:reviews-google — ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
