// Executes lib/media/validate.js against hostile input — the upload boundary.
import {
  classifyMedia, normaliseMediaEntry, normaliseMediaList,
  uploadPublicId, safeFilename, countMediaKinds,
  PHOTO_MAX_BYTES, VIDEO_MAX_BYTES, DOCUMENT_MAX_BYTES,
  CLIENT_MEDIA_ACCEPT,
  UPLOAD_REQUEST_MAX_BYTES, megabytes, overRequestLimit,
} from "@/lib/media/validate";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };
const MB = 1024 * 1024;

console.log("\nPhotos");
ok("jpeg photo ok, resourceType image", (() => { const r = classifyMedia({ type: "image/jpeg", size: 2 * MB }); return r.ok && r.kind === "photo" && r.resourceType === "image"; })());
ok("heic (iPhone) accepted", classifyMedia({ type: "image/heic", size: 4 * MB }).ok);
ok("mixed-case mime accepted", classifyMedia({ type: "IMAGE/JPEG", size: 1 * MB }).ok);
ok("photo over 15MB rejected", !classifyMedia({ type: "image/jpeg", size: PHOTO_MAX_BYTES + 1 }).ok);
ok("photo exactly at cap ok", classifyMedia({ type: "image/jpeg", size: PHOTO_MAX_BYTES }).ok);

console.log("\nVideos");
ok("mp4 ok, resourceType video", (() => { const r = classifyMedia({ type: "video/mp4", size: 20 * MB }); return r.ok && r.kind === "video" && r.resourceType === "video"; })());
ok("mov (iPhone) accepted", classifyMedia({ type: "video/quicktime", size: 30 * MB }).ok);
ok("video gets the bigger cap (40MB fine)", classifyMedia({ type: "video/mp4", size: 40 * MB }).ok);
ok("video over 100MB rejected", !classifyMedia({ type: "video/mp4", size: VIDEO_MAX_BYTES + 1 }).ok);

console.log("\nSVG: logo only, never client media");
ok("svg rejected by default", !classifyMedia({ type: "image/svg+xml", size: 1000 }).ok);
ok("svg allowed when allowLogo", classifyMedia({ type: "image/svg+xml", size: 1000 }, { allowLogo: true }).ok);

console.log("\nHostile input");
ok("null file -> not ok, no throw", !classifyMedia(null).ok);
ok("undefined -> not ok", !classifyMedia(undefined).ok);
ok("no type -> rejected", !classifyMedia({ size: 100 }).ok);
ok("executable disguised (zip) rejected", !classifyMedia({ type: "application/zip", size: 100 }).ok);
ok("zero bytes rejected", !classifyMedia({ type: "image/jpeg", size: 0 }).ok);
ok("missing size rejected (Number(undefined)=NaN)", !classifyMedia({ type: "image/jpeg" }).ok);
ok("empty-string size rejected (Number('')=0)", !classifyMedia({ type: "image/jpeg", size: "" }).ok);
ok("negative size rejected", !classifyMedia({ type: "image/jpeg", size: -5 }).ok);
ok("every reject carries a message", ["application/zip", "", "image/svg+xml"].every((type) => { const r = classifyMedia({ type, size: 100 }); return r.ok || typeof r.error === "string"; }));

console.log("\nDocuments (the IKEA plan PDF)");
ok("pdf ok, kind document, resourceType raw", (() => {
  const r = classifyMedia({ type: "application/pdf", size: 3 * MB });
  return r.ok && r.kind === "document" && r.resourceType === "raw";
})());
ok("mixed-case pdf mime accepted", classifyMedia({ type: "APPLICATION/PDF", size: MB }).ok);
ok("pdf exactly at the 25MB cap ok", classifyMedia({ type: "application/pdf", size: DOCUMENT_MAX_BYTES }).ok);
ok("oversized pdf rejected", !classifyMedia({ type: "application/pdf", size: DOCUMENT_MAX_BYTES + 1 }).ok);
ok("oversized pdf error says PDF, not 'document'", /PDF is larger than 25 MB/.test(
  classifyMedia({ type: "application/pdf", size: DOCUMENT_MAX_BYTES + 1 }).error));
ok("zero-byte pdf rejected", !classifyMedia({ type: "application/pdf", size: 0 }).ok);
ok("pdf with missing size rejected", !classifyMedia({ type: "application/pdf" }).ok);
ok("pdf does NOT get the video cap", !classifyMedia({ type: "application/pdf", size: 60 * MB }).ok);
// The allowlist is by mime, so a renamed file is judged on what the browser
// says it IS, not on its extension. Both directions matter.
ok("pdf renamed .jpg (mime image/jpeg) classifies as photo, not document", (() => {
  const r = classifyMedia({ type: "image/jpeg", size: 2 * MB, name: "plan.pdf" });
  return r.ok && r.kind === "photo";
})());
ok("jpg renamed .pdf (mime application/pdf) classifies as document", (() => {
  const r = classifyMedia({ type: "application/pdf", size: 2 * MB, name: "photo.jpg" });
  return r.ok && r.kind === "document";
})());
ok("mime lying about extension never widens the allowlist (application/x-pdf rejected)",
  !classifyMedia({ type: "application/x-pdf", size: MB }).ok);
ok("zip still rejected now that documents exist", !classifyMedia({ type: "application/zip", size: MB }).ok);
ok("docx still rejected", !classifyMedia({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: MB }).ok);
ok("reject message names photo, video AND pdf", (() => {
  const e = classifyMedia({ type: "application/zip", size: 100 }).error;
  return /photo/i.test(e) && /video/i.test(e) && /PDF/.test(e);
})());

console.log("\nUpload public_id (Cloudinary raw needs the .pdf extension)");
ok("document gets a .pdf public_id", /^fixed\.pdf$/.test(uploadPublicId("document", { randomId: () => "fixed" })));
ok("photo gets none (Cloudinary picks)", uploadPublicId("photo") === undefined);
ok("video gets none", uploadPublicId("video") === undefined);
ok("real call produces a unique .pdf id", (() => {
  const a = uploadPublicId("document"), b = uploadPublicId("document");
  return a !== b && a.endsWith(".pdf") && b.endsWith(".pdf");
})());

console.log("\nFilename sanitising (display text from a stranger's file picker)");
ok("plain name kept", safeFilename("kitchen-plan.pdf") === "kitchen-plan.pdf");
ok("path stripped (posix)", safeFilename("../../etc/passwd") === "passwd");
ok("path stripped (windows)", safeFilename("C:\\Users\\bob\\plan.pdf") === "plan.pdf");
ok("newline stripped", !safeFilename("plan\n.pdf").includes("\n"));
ok("clamped to 120 chars", safeFilename("z".repeat(500)).length === 120);
ok("non-string -> empty", safeFilename(null) === "" && safeFilename(undefined) === "" && safeFilename(42) === "");

console.log("\nPicker/server agreement");
ok("accept attribute offers pdf", CLIENT_MEDIA_ACCEPT.includes("application/pdf"));
ok("accept attribute does not offer zip", !CLIENT_MEDIA_ACCEPT.includes("zip"));

console.log("\nStored-entry normalisation (what a quote keeps + a PDF reads)");
ok("valid https entry kept", (() => { const n = normaliseMediaEntry({ url: "https://res.cloudinary.com/x/a.jpg", kind: "photo", publicId: "x/a" }); return n && n.url && n.kind === "photo"; })());
ok("cloudinary secure_url/public_id shape accepted", (() => { const n = normaliseMediaEntry({ secure_url: "https://res.cloudinary.com/x/a.mp4", kind: "video", public_id: "x/a" }); return n && n.publicId === "x/a"; })());
ok("http (not https) rejected", normaliseMediaEntry({ url: "http://x/a.jpg" }) === null);
ok("javascript: url rejected", normaliseMediaEntry({ url: "javascript:alert(1)" }) === null);
ok("non-object rejected", normaliseMediaEntry("nope") === null && normaliseMediaEntry(null) === null);
ok("caption clamped to 300 chars", normaliseMediaEntry({ url: "https://x/a.jpg", caption: "z".repeat(500) }).caption.length === 300);
ok("kind defaults to photo", normaliseMediaEntry({ url: "https://x/a.jpg" }).kind === "photo");
ok("document kind survives normalisation", normaliseMediaEntry({ url: "https://x/a.pdf", kind: "document" }).kind === "document");
// The bug this guards: the old two-way ternary relabelled anything non-video as
// a photo, which is how a PDF ends up as the src of an <img>.
ok("unknown kind falls back to photo, not through", normaliseMediaEntry({ url: "https://x/a.jpg", kind: "wat" }).kind === "photo");
ok("filename carried through and sanitised", normaliseMediaEntry({ url: "https://x/a.pdf", kind: "document", filename: "../plan.pdf" }).filename === "plan.pdf");
ok("missing filename -> empty string, never undefined", normaliseMediaEntry({ url: "https://x/a.jpg" }).filename === "");

console.log("\nCounting by kind (lead score, lead badges, quote review all read this)");
const C = countMediaKinds;
ok("empty / non-array -> all zero", (() => {
  const a = C([]), b = C(null), c = C("nope");
  return [a,b,c].every((r) => r.photos===0 && r.videos===0 && r.documents===0 && r.visual===0);
})());
ok("photos, videos and documents counted apart", (() => {
  const r = C([
    { url: "https://x/a.jpg", kind: "photo" },
    { url: "https://x/b.mp4", kind: "video" },
    { url: "https://x/c.pdf", kind: "document" },
  ]);
  return r.photos===1 && r.videos===1 && r.documents===1 && r.visual===2;
})());
ok("visual excludes documents", C([{ url: "https://x/c.pdf", kind: "document" }]).visual === 0);
// The bug this exists to prevent: `entry?.kind !== "document"` counts a null as
// a photo, so two junk rows scored as two attached photos.
ok("nulls/undefined are not photos", (() => {
  const r = C([null, undefined, { url: "https://x/c.pdf", kind: "document" }]);
  return r.photos===0 && r.visual===0 && r.documents===1;
})());
ok("entries with no url are not counted", C([{ kind: "photo" }, { kind: "document" }]).visual === 0);
ok("junk types ignored", C([42, true, [], {}]).visual === 0);
ok("legacy bare string counts as a photo", C(["https://x/a.jpg"]).photos === 1);
ok("empty string is not a photo", C([""]).photos === 0);
ok("unknown kind counts as a photo, never a document", (() => {
  const r = C([{ url: "https://x/a.jpg", kind: "wat" }]);
  return r.photos===1 && r.documents===0;
})());

console.log("\nList normalisation");
ok("drops malformed, keeps valid", normaliseMediaList([{ url: "https://x/a.jpg" }, "junk", { url: "http://bad" }, null]).length === 1);
ok("caps the count (anti-flood)", normaliseMediaList(Array.from({ length: 50 }, () => ({ url: "https://x/a.jpg" })), { max: 20 }).length === 20);
ok("non-array -> []", Array.isArray(normaliseMediaList("nope")) && normaliseMediaList("nope").length === 0);

// ── The ceiling that actually binds, and the sentence about it ────────────
//
// Every cap above is enforced inside /api/upload. On Vercel that route never
// runs for a body over ~4.5 MB — the platform answers 413 at the edge with no
// JSON — so the uploader got `data === null` and printed "That file couldn't
// be uploaded." with no reason, for what is simply a phone photo. The server
// limits are unchanged; what is new is that the browser can now say the true
// thing, before the upload and after a refusal.
console.log("\nThe request ceiling, and the reason a person reads");
ok("the cap is Vercel's request body limit, stated once", UPLOAD_REQUEST_MAX_BYTES === Math.floor(4.5 * MB));
ok("a typical phone photo is over it, and a small one is not", overRequestLimit(9 * MB) && !overRequestLimit(1.2 * MB) && !overRequestLimit(UPLOAD_REQUEST_MAX_BYTES));
ok("…and one byte over is over", overRequestLimit(UPLOAD_REQUEST_MAX_BYTES + 1));
ok("junk sizes are not over the limit", !overRequestLimit(undefined) && !overRequestLimit(null) && !overRequestLimit("nonsense") && !overRequestLimit(-5));
ok("megabytes never prints a bare 0 for a real file", megabytes(9 * MB) === "9 MB" && megabytes(1.25 * MB) === "1.3 MB" && megabytes(UPLOAD_REQUEST_MAX_BYTES) === "4.5 MB", [megabytes(9 * MB), megabytes(1.25 * MB), megabytes(UPLOAD_REQUEST_MAX_BYTES)]);

const uploader = readFileSync(new URL("../app/components/MediaUploader.js", import.meta.url), "utf8");
ok("the uploader refuses an over-size file BEFORE spending the connection on it", /if \(overRequestLimit\(file\.size\)\)/.test(uploader));
ok("…and a 413 with no body still names the size and the limit", /res\.status === 413/.test(uploader) && /tooLargeLabel\(megabytes\(file\.size\), megabytes\(UPLOAD_REQUEST_MAX_BYTES\)\)/.test(uploader));
ok("the server's own reason still wins over every fallback", /data\?\.error \|\|/.test(uploader));
ok("an expired session reads as one, not as a bad file", /res\.status === 401 \|\| res\.status === 403/.test(uploader) && /signedOutLabel/.test(uploader));

const route = readFileSync(new URL("../app/api/upload/route.js", import.meta.url), "utf8");
ok("/api/upload still answers with a specific error for every refusal it can see", /Image uploads aren't configured/.test(route) && /error: verdict\.error/.test(route) && /explainCloudinaryError\(err\)/.test(route));

const copy = readFileSync(new URL("../lib/i18n/clientDocCopy.js", import.meta.url), "utf8");
const tooLarge = (copy.match(/uploadTooLarge:/g) || []).length;
const rejected = (copy.match(/uploadRejected:/g) || []).length;
ok("the client-facing sentence exists in every language the rejection does", tooLarge === rejected && tooLarge >= 8, { tooLarge, rejected });
for (const flow of ["../app/quote/[companySlug]/SelfQuoteFlow.js", "../app/instant-quote/[companySlug]/InstantQuoteFlow.js"]) {
  const src = readFileSync(new URL(flow, import.meta.url), "utf8");
  ok(`${flow.split("/").pop()} hands it to the uploader, so a homeowner reads it in their own language`, /tooLargeLabel=\{[a-zA-Z]+\.uploadTooLarge\}/.test(src));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
