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
// Note this is NOT only about the new client-upload path: the app already stores
// its own generated quote and invoice PDFs on Cloudinary and hands out
// `quote.pdfUrl` (app/api/quotes/[id]/pdf/route.js). If this check fails, that
// link is already broken too.

import { v2 as cloudinary } from "cloudinary";

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

  const res = await fetch(uploaded.secure_url);
  const contentType = res.headers.get("content-type") || "(none)";
  const cldError = res.headers.get("x-cld-error");

  if (res.ok && /pdf/i.test(contentType)) {
    console.log(`Delivered OK → HTTP ${res.status}, content-type ${contentType}`);
    console.log("\nPASS — a client's PDF plan uploads AND opens.\n");
  } else if (res.status === 401) {
    failed = true;
    console.log(`Delivery BLOCKED → HTTP 401  x-cld-error: ${cldError || "(none)"}`);
    console.log(
      "\nFAIL — the upload succeeds and the file is unopenable. This is the\n" +
        "documented PDF/ZIP delivery restriction on new and free Cloudinary\n" +
        "accounts, not a bug in the file or the code.\n\n" +
        "  Fix (account owner, one time):\n" +
        "    Cloudinary console → Settings → Security → PDF and ZIP files delivery\n" +
        "    → enable “Allow delivery of PDF and ZIP files”, and accept the terms.\n\n" +
        "  Until then, quote/invoice PDF links are broken too — this is not\n" +
        "  specific to client uploads.\n",
    );
  } else {
    failed = true;
    console.log(
      `Delivery UNEXPECTED → HTTP ${res.status}, content-type ${contentType}` +
        `${cldError ? `, x-cld-error: ${cldError}` : ""}`,
    );
    console.log(
      "\nFAIL — not the known 401 restriction. Check the URL by hand before\n" +
        "assuming either outcome.\n",
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
