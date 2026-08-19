// Executes lib/media/validate.js against hostile input — the upload boundary.
import {
  classifyMedia, normaliseMediaEntry, normaliseMediaList,
  uploadPublicId, safeFilename, countMediaKinds,
  PHOTO_MAX_BYTES, VIDEO_MAX_BYTES, DOCUMENT_MAX_BYTES,
  CLIENT_MEDIA_ACCEPT,
} from "@/lib/media/validate";

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

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
