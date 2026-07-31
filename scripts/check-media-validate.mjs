// Executes lib/media/validate.js against hostile input — the upload boundary.
import {
  classifyMedia, normaliseMediaEntry, normaliseMediaList,
  PHOTO_MAX_BYTES, VIDEO_MAX_BYTES,
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
ok("unknown type (pdf) rejected", !classifyMedia({ type: "application/pdf", size: 100 }).ok);
ok("executable disguised (zip) rejected", !classifyMedia({ type: "application/zip", size: 100 }).ok);
ok("zero bytes rejected", !classifyMedia({ type: "image/jpeg", size: 0 }).ok);
ok("missing size rejected (Number(undefined)=NaN)", !classifyMedia({ type: "image/jpeg" }).ok);
ok("empty-string size rejected (Number('')=0)", !classifyMedia({ type: "image/jpeg", size: "" }).ok);
ok("negative size rejected", !classifyMedia({ type: "image/jpeg", size: -5 }).ok);
ok("every reject carries a message", ["application/pdf", "", "image/svg+xml"].every((type) => { const r = classifyMedia({ type, size: 100 }); return r.ok || typeof r.error === "string"; }));

console.log("\nStored-entry normalisation (what a quote keeps + a PDF reads)");
ok("valid https entry kept", (() => { const n = normaliseMediaEntry({ url: "https://res.cloudinary.com/x/a.jpg", kind: "photo", publicId: "x/a" }); return n && n.url && n.kind === "photo"; })());
ok("cloudinary secure_url/public_id shape accepted", (() => { const n = normaliseMediaEntry({ secure_url: "https://res.cloudinary.com/x/a.mp4", kind: "video", public_id: "x/a" }); return n && n.publicId === "x/a"; })());
ok("http (not https) rejected", normaliseMediaEntry({ url: "http://x/a.jpg" }) === null);
ok("javascript: url rejected", normaliseMediaEntry({ url: "javascript:alert(1)" }) === null);
ok("non-object rejected", normaliseMediaEntry("nope") === null && normaliseMediaEntry(null) === null);
ok("caption clamped to 300 chars", normaliseMediaEntry({ url: "https://x/a.jpg", caption: "z".repeat(500) }).caption.length === 300);
ok("kind defaults to photo", normaliseMediaEntry({ url: "https://x/a.jpg" }).kind === "photo");

console.log("\nList normalisation");
ok("drops malformed, keeps valid", normaliseMediaList([{ url: "https://x/a.jpg" }, "junk", { url: "http://bad" }, null]).length === 1);
ok("caps the count (anti-flood)", normaliseMediaList(Array.from({ length: 50 }, () => ({ url: "https://x/a.jpg" })), { max: 20 }).length === 20);
ok("non-array -> []", Array.isArray(normaliseMediaList("nope")) && normaliseMediaList("nope").length === 0);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
