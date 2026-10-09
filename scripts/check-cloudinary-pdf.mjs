// Answers one question against the REAL Cloudinary account: when a homeowner
// attaches a PDF plan, can anyone actually open it afterwards?
//
//   npm run check:cloudinary-pdf
//
// ── Why this script exists ──────────────────────────────────────────────────
//
// Cloudinary restricts PDF and ZIP DELIVERY on newer and free accounts. The
// restriction is invisible at upload time: the API returns 200, the asset shows
// up in the Media Library, `secure_url` looks perfectly normal — and then the
// delivery URL returns HTTP 401 forever. That is the exact shape of failure this
// codebase refuses to ship: a control that appears to work and doesn't. A
// homeowner would see "uploaded ✓" and the contractor would get a dead link.
//
// It cannot be settled by reading code, and it cannot be settled from a machine
// whose .env points at the wrong cloud. So it is settled here, by uploading a
// throwaway PDF and fetching it back.
//
// The fix, if this fails, is a SETTINGS change no script should make on
// someone's behalf: Cloudinary console → Settings → Security → "PDF and ZIP
// files delivery" → enable "Allow delivery of PDF and ZIP files". Cloudinary
// asks you to accept responsibility for the files you deliver, which is a
// decision for the account owner, not for a deploy step.
//
// ── What changed on 2026-10-04, and what this check now asks ────────────────
//
// This account DOES block plain PDF delivery (run 2026-10-09: 401, x-cld-error
// "deny or ACL failure"), and the owner has not flipped the setting. The app
// stopped depending on it: since lib/media/signedFile.js + fileOpen.js
// (3fe7ee1c), every stored file a screen, email or server read opens is
// fetched through a signed DOWNLOAD link (utils.private_download_url →
// api.cloudinary.com/…/download), which that restriction does not cover.
// `quote.pdfUrl` / `invoice.pdfUrl` are written and read by nothing, so the
// old line "quote/invoice PDF links are broken too" no longer holds.
//
// So the verdict is now the mechanism the app actually uses: the probe is
// opened through signedOpenLink — the same function, the same arguments the
// routes use — and that must answer 200 with the PDF's bytes. The plain URL
// is still fetched and reported: while it 401s, ANY <a href> holding a stored
// Cloudinary PDF URL is a dead link, which is what check:file-open's wiring
// section exists to catch (the sub price-reply panel shipped one on Oct 7).
// The account setting stays the owner's to decide; it is no longer needed for
// anything the app links.

import { v2 as cloudinary } from "cloudinary";
import { parseCloudinaryFileUrl, signedOpenLink, signedLinkBase } from "../lib/media/signedFile.js";

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.log(
    "\nSKIPPED — no Cloudinary credentials in the environment.\n" +
      "  Run with a .env that has CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and\n" +
      "  CLOUDINARY_API_SECRET from the SAME product environment, e.g.\n" +
      "    node --env-file=.env scripts/check-cloudinary-pdf.mjs\n" +
      "  Reminder: the cloud name is the environment id in the console (often\n" +
      "  something like dq3x9k2mv), NOT the label you gave an API key.\n",
  );
  process.exit(0);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

// A minimal, valid, one-page PDF. Inline so the check has no fixture to lose.
const PDF = Buffer.from(
  [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
    "",
  ].join("\n"),
  "utf8",
);

// Matches the production path exactly: resource_type "raw", and a public_id
// carrying the .pdf extension so Cloudinary serves application/pdf rather than
// octet-stream. Testing a different shape than the app uses would prove nothing.
const publicId = `pdf-delivery-probe-${Date.now()}.pdf`;

function upload() {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "fieldquo/_diagnostics", public_id: publicId, resource_type: "raw" },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(PDF);
  });
}

let uploaded = null;
let failed = false;

try {
  uploaded = await upload();
  console.log(`\nUploaded OK → ${uploaded.secure_url}`);

  // 1. The plain delivery URL — informational, see the header.
  const res = await fetch(uploaded.secure_url);
  const contentType = res.headers.get("content-type") || "(none)";
  const cldError = res.headers.get("x-cld-error");
  const plainOk = res.ok && /pdf/i.test(contentType);
  try {
    await res.body?.cancel?.();
  } catch {}
  if (plainOk) {
    console.log(`Plain URL delivers → HTTP ${res.status}, content-type ${contentType}`);
  } else {
    console.log(
      `Plain URL BLOCKED → HTTP ${res.status}${cldError ? `  x-cld-error: ${cldError}` : ""}\n` +
        "  The account's PDF/ZIP delivery restriction (Settings → Security → PDF and\n" +
        "  ZIP files delivery). Not used by the app since 2026-10-04 — but any link\n" +
        "  that puts a stored PDF URL straight into an href is dead (check:file-open).",
    );
  }

  // 2. The signed download link — what every route opens a stored file with.
  const at = parseCloudinaryFileUrl(uploaded.secure_url, { cloudName: CLOUDINARY_CLOUD_NAME });
  if (!at) throw new Error(`lib/media/signedFile.js could not parse the URL Cloudinary returned: ${uploaded.secure_url}`);
  const { url: link } = signedOpenLink(at, { sign: (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options) });
  if (!link.startsWith(signedLinkBase(CLOUDINARY_CLOUD_NAME))) throw new Error(`the signer returned a link off the API host: ${link.slice(0, 80)}…`);
  const signed = await fetch(link, { redirect: "follow" });
  const bytes = signed.ok ? Buffer.from(await signed.arrayBuffer()) : null;
  const signedOk = Boolean(bytes && bytes.subarray(0, 5).toString("latin1") === "%PDF-");
  if (signedOk) {
    console.log(`Signed download opens → HTTP ${signed.status}, ${bytes.length} bytes, starts %PDF-`);
    console.log(
      "\nPASS — a stored PDF opens through the signed link every route uses" +
        (plainOk ? ", and the plain URL delivers too.\n" : ".\n  (Plain delivery is blocked — see above.)\n"),
    );
  } else {
    failed = true;
    const err = signed.headers.get("x-cld-error");
    try {
      await signed.body?.cancel?.();
    } catch {}
    console.log(`Signed download FAILED → HTTP ${signed.status}${err ? `  x-cld-error: ${err}` : ""}`);
    console.log(
      "\nFAIL — the upload succeeds and the file is unopenable even through the\n" +
        "signed download link (lib/media/fileOpen.js). Every stored PDF in the app\n" +
        "— plans, waivers, a sub's price reply, inbox attachments — is unopenable.\n" +
        "Check the API key's permissions and the account's access-control settings\n" +
        "before anything else.\n",
    );
  }
} catch (err) {
  failed = true;
  const message = err?.message || String(err);
  console.log(`\nFAIL — could not complete the check: ${message}\n`);
  // The upload never happened, so this says nothing either way about PDF
  // delivery — worth stating, because "the PDF check failed" reads like a
  // verdict on PDFs when it is really a verdict on the credentials.
  if (/invalid cloud_name|cloud_name mismatch/i.test(message)) {
    console.log(
      `  CLOUDINARY_CLOUD_NAME is "${CLOUDINARY_CLOUD_NAME}", which this account\n` +
        "  does not recognise as a product environment. The cloud name is the id\n" +
        "  shown top-left in the Cloudinary console (often auto-generated, like\n" +
        "  dq3x9k2mv) — NOT the label you gave an API key. Take all three values\n" +
        "  from the same environment's CLOUDINARY_URL\n" +
        "  (cloudinary://key:secret@CLOUD_NAME) and run this again.\n\n" +
        "  PDF delivery is still UNVERIFIED — this failed before uploading.\n",
    );
  }
} finally {
  // Removes only the probe asset this run created, seconds after creating it.
  // Nothing else in the account is touched.
  if (uploaded?.public_id) {
    await cloudinary.uploader
      .destroy(uploaded.public_id, { resource_type: "raw" })
      .then(() => console.log("(probe asset removed)"))
      .catch((e) =>
        console.log(
          `(could not remove probe asset ${uploaded.public_id}: ${e?.message}) — delete it by hand`,
        ),
      );
  }
}

process.exit(failed ? 1 : 0);
