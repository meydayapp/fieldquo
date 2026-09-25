// scripts/check-direct-upload.mjs
//
// Executes the direct-to-Cloudinary upload rules against hostile input:
// the signed parameters (lib/media/directUpload.js planUpload), the signature
// maths (cross-checked against the Cloudinary SDK itself), the server-side
// verification of what a browser relays back (forged public_id, another
// cloud, another company's or purpose's folder, oversized, wrong format), and
// the browser helper end to end against a fake server built from the SAME
// rule functions the real routes call.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-direct-upload.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import {
  uploadScope, planUpload, effectiveCap, ourCap, cloudinarySignature, sameSignature,
  isOwnPublicId, readClaim, responseSignatureValid, judgeUploadedAsset, deliveryUrl,
  MEMBER_PURPOSES, PHOTO_FORMATS, VIDEO_FORMATS, LOGO_FORMATS,
} from "@/lib/media/directUpload";
import { PHOTO_TYPES, VIDEO_TYPES, LOGO_EXTRA_TYPES, PHOTO_MAX_BYTES, DOCUMENT_MAX_BYTES } from "@/lib/media/validate";
import { uploadFile, declaredType, explainCloudinaryRefusal } from "@/lib/media/uploadClient";
import { getUploadsSnapshot } from "@/lib/media/uploadProgress";

const require = createRequire(import.meta.url);
const { v2: sdk } = require("cloudinary");

let pass = 0, fail = 0;
const ok = (n, c, got) => {
  if (c) { pass++; console.log(`  ✓ ${n}`); }
  else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); }
};
const MB = 1024 * 1024;
const CO = "cmp_abc123";
const OTHER = "cmp_zzz999";
const CLOUD = "democloud";
const SECRET = "s3cr3t-not-real";
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const FREE_PLAN = { image_max_size_bytes: 10 * MB, video_max_size_bytes: 100 * MB, raw_max_size_bytes: 10 * MB };
const fixedId = () => UUID;

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n1. Scopes — the folder is the route's to decide, never the body's");
const member = (purpose) => uploadScope("member", { companyId: CO, purpose });
ok("a staff purpose picks its sub-folder", member("jobs").folder === `fieldquo/companies/${CO}/jobs`);
ok("an unknown purpose lands in uploads, not a folder named by the request", member("../../other").folder === `fieldquo/companies/${CO}/uploads`);
ok("a member cannot file into the portal folder ownUploads() trusts", member("portal").folder === `fieldquo/companies/${CO}/uploads` && member("leads").folder.endsWith("/uploads"));
ok("prototype keys are not purposes", member("__proto__").folder.endsWith("/uploads") && member("constructor").folder.endsWith("/uploads"));
ok("only messaging widens the document set", member("messaging").allowMessagingDocuments && !member("documents").allowMessagingDocuments);
ok("staff keep SVG (as /api/upload always had it); public scopes never get it", member("jobs").allowLogo && !uploadScope("portal", { companyId: CO }).allowLogo && !uploadScope("leads", { companyId: CO }).allowLogo);
ok("the portal folder is exactly the one lib/clientTickets/rules.js accepts", uploadScope("portal", { companyId: CO }).folder === `fieldquo/companies/${CO}/portal`);
ok("the self-quote folder is the leads folder it always was", uploadScope("leads", { companyId: CO }).folder === `fieldquo/companies/${CO}/leads`);
ok("a company id with a slash or dots is refused", !uploadScope("member", { companyId: "a/../b" }).ok && !uploadScope("member", { companyId: "" }).ok && !uploadScope("member", { companyId: null }).ok);
ok("an unknown scope kind is refused", !uploadScope("platform", { companyId: CO }).ok);
ok("every member purpose maps to a folder-safe segment", Object.values(MEMBER_PURPOSES).every((s) => /^[a-z-]+$/.test(s)));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n2. The signed parameters");
const photo = planUpload({ type: "image/jpeg", size: 6 * MB }, member("jobs"), { randomId: fixedId, now: 1_700_000_000_000 });
ok("a 6 MB phone photo — the owner's failing case — is signed", photo.ok, photo);
ok("…under this company and purpose, with a server-minted id", photo.publicId === `fieldquo/companies/${CO}/jobs/${UUID}`);
ok("…overwrite=false is signed (a replayed signature cannot swap the file)", photo.params.overwrite === "false");
ok("…allowed_formats is signed, and carries HEIC", /(^|,)heic(,|$)/.test(photo.params.allowed_formats) && /(^|,)jpg(,|$)/.test(photo.params.allowed_formats));
ok("…timestamp is seconds", photo.params.timestamp === "1700000000");
ok("…every signed value is a string (the browser posts them verbatim)", Object.values(photo.params).every((v) => typeof v === "string"));
ok("…the signed set is exactly these four keys", Object.keys(photo.params).sort().join() === "allowed_formats,overwrite,public_id,timestamp", Object.keys(photo.params));
ok("the browser's filename never reaches the public_id", planUpload({ type: "image/jpeg", size: MB, name: "../../x" }, member("jobs"), { randomId: fixedId }).publicId.endsWith(`/jobs/${UUID}`));

const pdf = planUpload({ type: "application/pdf", size: 3 * MB }, member("documents"), { randomId: fixedId });
ok("a PDF goes up raw with a .pdf id and no allowed_formats", pdf.ok && pdf.resourceType === "raw" && pdf.publicId.endsWith(`${UUID}.pdf`) && !("allowed_formats" in pdf.params));
const docx = planUpload({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: MB }, member("messaging"), { randomId: fixedId });
ok("a messaging .docx gets a .docx id", docx.ok && docx.publicId.endsWith(".docx"));
ok("…and outside messaging it is refused", !planUpload({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: MB }, member("documents")).ok);
const svg = planUpload({ type: "image/svg+xml", size: 20_000 }, member("branding"), { randomId: fixedId });
ok("a staff logo SVG is signed with svg in allowed_formats", svg.ok && svg.params.allowed_formats.split(",").includes("svg"));
ok("a public SVG is refused before any signature", !planUpload({ type: "image/svg+xml", size: 20_000 }, uploadScope("leads", { companyId: CO })).ok);
ok("a public photo's allowed_formats has no svg", !planUpload({ type: "image/png", size: MB }, uploadScope("portal", { companyId: CO })).params.allowed_formats.split(",").includes("svg"));
ok("a video's allowed_formats is the video list", planUpload({ type: "video/quicktime", size: 40 * MB }, member("jobs")).params.allowed_formats === VIDEO_FORMATS.join(","));
ok("no type → refused", !planUpload({ size: MB }, member("jobs")).ok);
ok("zip → refused", !planUpload({ type: "application/zip", size: MB }, member("jobs")).ok);
ok("0 bytes → refused", !planUpload({ type: "image/jpeg", size: 0 }, member("jobs")).ok);
ok("a bad scope → refused", !planUpload({ type: "image/jpeg", size: MB }, { ok: false }).ok);

console.log("\n   Size — ours, or the plan's if lower");
ok("our photo cap stands when the plan is unknown (12 MB ok)", planUpload({ type: "image/jpeg", size: 12 * MB }, member("jobs")).ok);
const plan12 = planUpload({ type: "image/jpeg", size: 12 * MB }, member("jobs"), { planLimits: FREE_PLAN });
ok("on the Free plan a 12 MB photo is refused BEFORE upload, naming 10 MB", !plan12.ok && plan12.code === "too_large" && /10 MB/.test(plan12.error) && plan12.maxBytes === 10 * MB, plan12);
ok("16 MB photo refused on our own cap", !planUpload({ type: "image/jpeg", size: 16 * MB }, member("jobs")).ok);
ok("26 MB PDF refused", !planUpload({ type: "application/pdf", size: 26 * MB }, member("documents")).ok);
ok("101 MB video refused", !planUpload({ type: "video/mp4", size: 101 * MB }, member("jobs")).ok);
ok("effectiveCap takes the lower of the two", effectiveCap("photo", "image", { planLimits: FREE_PLAN }) === 10 * MB && effectiveCap("document", "raw", { planLimits: { raw_max_size_bytes: 40 * MB } }) === DOCUMENT_MAX_BYTES);
ok("junk plan limits are ignored, not trusted", effectiveCap("photo", "image", { planLimits: { image_max_size_bytes: "lots" } }) === PHOTO_MAX_BYTES && effectiveCap("photo", "image", { planLimits: { image_max_size_bytes: -1 } }) === PHOTO_MAX_BYTES);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n3. Signatures — our maths is Cloudinary's maths");
sdk.config({ cloud_name: CLOUD, api_key: "123", api_secret: SECRET });
ok("request signature matches the SDK's api_sign_request", cloudinarySignature(photo.params, SECRET) === sdk.utils.api_sign_request(photo.params, SECRET));
ok("…for a raw document's params too", cloudinarySignature(pdf.params, SECRET) === sdk.utils.api_sign_request(pdf.params, SECRET));
const claimOk = { publicId: photo.publicId, version: "1726000000", signature: sdk.utils.api_sign_request({ public_id: photo.publicId, version: "1726000000" }, SECRET, null, 1) };
ok("a response signature the SDK would accept is accepted", responseSignatureValid(claimOk, SECRET) && sdk.utils.verify_api_response_signature(claimOk.publicId, claimOk.version, claimOk.signature));
ok("a forged public_id with the real signature is refused", !responseSignatureValid({ ...claimOk, publicId: `fieldquo/companies/${OTHER}/jobs/${UUID}` }, SECRET));
ok("a changed version is refused", !responseSignatureValid({ ...claimOk, version: "1726000001" }, SECRET));
ok("a signature made with another secret is refused", !responseSignatureValid({ ...claimOk, signature: cloudinarySignature({ public_id: claimOk.publicId, version: claimOk.version }, "attacker", { version: 1 }) }, SECRET));
ok("no secret configured → nothing verifies", !responseSignatureValid(claimOk, ""));
ok("sameSignature is length-safe and type-safe", !sameSignature("ab", "abc") && !sameSignature(null, "a") && sameSignature("ab", "ab"));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n4. The public_id a browser relays back");
const jobs = member("jobs");
ok("our own photo id is ours", isOwnPublicId(`fieldquo/companies/${CO}/jobs/${UUID}`, jobs, "image"));
ok("another company's folder is not", !isOwnPublicId(`fieldquo/companies/${OTHER}/jobs/${UUID}`, jobs, "image"));
ok("another purpose's folder is not", !isOwnPublicId(`fieldquo/companies/${CO}/branding/${UUID}`, jobs, "image"));
ok("the portal folder is not a member's", !isOwnPublicId(`fieldquo/companies/${CO}/portal/${UUID}`, jobs, "image"));
ok("a nested path is not", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/x/${UUID}`, jobs, "image"));
ok("dot-dot is not", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/../../${OTHER}/jobs/${UUID}`, jobs, "image"));
ok("a name we did not mint is not", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/my-photo`, jobs, "image"));
ok("an image id with an extension is not", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/${UUID}.jpg`, jobs, "image"));
ok("upper-case uuid is not (we mint lower)", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/${UUID.toUpperCase()}`, jobs, "image"));
ok("a trailing newline is not", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/${UUID}\n`, jobs, "image"));
ok("a raw id needs its extension", !isOwnPublicId(`fieldquo/companies/${CO}/documents/${UUID}`, member("documents"), "raw") && isOwnPublicId(`fieldquo/companies/${CO}/documents/${UUID}.pdf`, member("documents"), "raw"));
ok("a .docx raw id outside messaging is not", !isOwnPublicId(`fieldquo/companies/${CO}/documents/${UUID}.docx`, member("documents"), "raw"));
ok("…inside messaging it is", isOwnPublicId(`fieldquo/companies/${CO}/messaging/${UUID}.docx`, member("messaging"), "raw"));
ok("an .html raw id never is", !isOwnPublicId(`fieldquo/companies/${CO}/messaging/${UUID}.html`, member("messaging"), "raw"));
ok("an unknown resource type is not", !isOwnPublicId(`fieldquo/companies/${CO}/jobs/${UUID}`, jobs, "private"));

console.log("\n   readClaim");
ok("a complete claim reads", readClaim({ ...claimOk, resourceType: "image" }).ok);
ok("missing signature → refused", !readClaim({ publicId: "x", version: 1, resourceType: "image" }).ok);
ok("non-numeric version → refused", !readClaim({ publicId: "x", version: "1; drop", signature: "a".repeat(40), resourceType: "image" }).ok);
ok("non-hex signature → refused", !readClaim({ publicId: "x", version: 1, signature: "z".repeat(40), resourceType: "image" }).ok);
ok("resource type outside image/video/raw → refused", !readClaim({ publicId: "x", version: 1, signature: "a".repeat(40), resourceType: "authenticated" }).ok);
ok("junk body → refused, no throw", !readClaim(null).ok && !readClaim("x").ok);

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n5. The Admin API record — the decision");
const claim = { ...claimOk, resourceType: "image" };
const asset = (over = {}) => ({
  public_id: claim.publicId, version: 1726000000, resource_type: "image", type: "upload", format: "jpg",
  bytes: 6 * MB, width: 4032, height: 3024,
  secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1726000000/${claim.publicId}.jpg`, ...over,
});
const judge = (a, c = claim, scope = jobs) => judgeUploadedAsset({ claim: c, asset: a, scope, cloudName: CLOUD, filename: "IMG_4471.JPG" });
const good = judge(asset());
ok("a real 6 MB photo passes, carrying the Admin API's URL and bytes", good.ok && good.entry.url === asset().secure_url && good.entry.bytes === 6 * MB && good.entry.kind === "photo" && good.entry.filename === "IMG_4471.JPG", good);
ok("oversized (16 MB) → refused", judge(asset({ bytes: 16 * MB })).code === "too_large");
ok("exactly at our cap → accepted", judge(asset({ bytes: PHOTO_MAX_BYTES })).ok);
ok("0 bytes / missing bytes → refused", judge(asset({ bytes: 0 })).code === "empty" && judge(asset({ bytes: undefined })).code === "empty");
ok("another cloud's URL → refused", judge(asset({ secure_url: `https://res.cloudinary.com/evilcloud/image/upload/v1/${claim.publicId}.jpg` })).code === "not_ours");
ok("an http URL → refused", judge(asset({ secure_url: `http://res.cloudinary.com/${CLOUD}/image/upload/v1/${claim.publicId}.jpg` })).code === "not_ours");
ok("a look-alike host → refused", judge(asset({ secure_url: `https://res.cloudinary.com.evil.net/${CLOUD}/image/upload/v1/${claim.publicId}.jpg` })).code === "not_ours");
ok("a URL for a different asset → refused", judge(asset({ secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/fieldquo/companies/${OTHER}/jobs/${UUID}.jpg` })).code === "not_ours");
ok("the record names a different public_id → refused", judge(asset({ public_id: `fieldquo/companies/${CO}/jobs/11111111-1111-4111-8111-111111111111` })).code === "not_ours");
ok("claim for another company's folder → refused before the record matters", judge(asset(), { ...claim, publicId: `fieldquo/companies/${OTHER}/jobs/${UUID}` }).code === "not_ours");
ok("resource type mismatch → refused", judge(asset({ resource_type: "raw" })).code === "wrong_type");
ok("a private or authenticated delivery type → refused", judge(asset({ type: "private" })).code === "wrong_type" && judge(asset({ type: "authenticated" })).code === "wrong_type");
ok("a version that isn't the signed one → refused", judge(asset({ version: 1726000999 })).code === "stale");
ok("a PDF stored as an image → refused as a format", judge(asset({ format: "pdf" })).code === "wrong_format");
ok("an SVG in a public scope → refused", judge(asset({ format: "svg" }), { ...claim, publicId: `fieldquo/companies/${CO}/portal/${UUID}` }, uploadScope("portal", { companyId: CO })).code === "wrong_format" || judge(asset({ format: "svg", public_id: `fieldquo/companies/${CO}/portal/${UUID}`, secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/fieldquo/companies/${CO}/portal/${UUID}.svg` }), { ...claim, publicId: `fieldquo/companies/${CO}/portal/${UUID}` }, uploadScope("portal", { companyId: CO })).code === "wrong_format");
ok("…and a staff logo SVG is accepted", judge(asset({ format: "svg", secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/${claim.publicId}.svg` })).ok);
const vidClaim = { ...claim, resourceType: "video" };
ok("a video over 100 MB → refused", judge(asset({ resource_type: "video", format: "mp4", bytes: 101 * MB, secure_url: `https://res.cloudinary.com/${CLOUD}/video/upload/v1/${claim.publicId}.mp4` }), vidClaim).code === "too_large");
ok("a video in a format we don't take → refused", judge(asset({ resource_type: "video", format: "avi", secure_url: `https://res.cloudinary.com/${CLOUD}/video/upload/v1/${claim.publicId}.avi` }), vidClaim).code === "wrong_format");
const docScope = member("documents");
const docId = `fieldquo/companies/${CO}/documents/${UUID}.pdf`;
const docClaim = { ...claim, publicId: docId, resourceType: "raw" };
const docAsset = (over = {}) => asset({ public_id: docId, resource_type: "raw", format: undefined, bytes: 20 * MB, secure_url: `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/${docId}`, ...over });
ok("a 20 MB PDF passes as a document", judge(docAsset(), docClaim, docScope).ok && judge(docAsset(), docClaim, docScope).entry.kind === "document");
ok("a 26 MB PDF → refused", judge(docAsset({ bytes: 26 * MB }), docClaim, docScope).code === "too_large");
ok("junk inputs → refused, no throw", !judgeUploadedAsset({}).ok && !judgeUploadedAsset({ claim, asset: null, scope: jobs }).ok);

console.log("\n   HEIC is shown as JPEG everywhere");
const heic = judge(asset({ format: "heic", secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/${claim.publicId}.heic` }));
ok("a HEIC photo is accepted and its URL asks Cloudinary for .jpg", heic.ok && heic.entry.url.endsWith(`${UUID}.jpg`) && heic.entry.format === "heic", heic);
ok("deliveryUrl leaves every other format alone", deliveryUrl({ resource_type: "image", format: "png", secure_url: "https://x/a.png" }) === "https://x/a.png" && deliveryUrl({ resource_type: "raw", format: "heic", secure_url: "https://x/a.heic" }) === "https://x/a.heic");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n6. Format lists in step with validate.js's MIME sets");
const mimeToFormat = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/ogg": "ogv", "video/3gpp": "3gp", "image/svg+xml": "svg" };
ok("every accepted photo MIME has its format signed", [...PHOTO_TYPES].every((m) => PHOTO_FORMATS.includes(mimeToFormat[m])), [...PHOTO_TYPES].filter((m) => !PHOTO_FORMATS.includes(mimeToFormat[m])));
ok("every accepted video MIME has its format signed", [...VIDEO_TYPES].every((m) => VIDEO_FORMATS.includes(mimeToFormat[m])));
ok("the logo MIME has its format signed", [...LOGO_EXTRA_TYPES].every((m) => LOGO_FORMATS.includes(mimeToFormat[m])));
ok("no signed photo format is a vector or a document", !PHOTO_FORMATS.some((f) => ["svg", "pdf", "ai", "eps"].includes(f)));

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n7. The browser helper, end to end, against the real rules");
const fakeAdmin = new Map();
function fakeServer(scope, { tamper } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push(url);
    if (url.endsWith("/sign")) {
      const body = JSON.parse(init.body);
      const plan = planUpload({ type: body.type, size: body.size }, scope, { planLimits: FREE_PLAN });
      if (!plan.ok) return { status: plan.code === "too_large" ? 413 : 400, json: async () => ({ error: plan.error, code: plan.code, maxBytes: plan.maxBytes }) };
      return { status: 200, json: async () => ({ uploadUrl: `https://api.cloudinary.com/v1_1/${CLOUD}/${plan.resourceType}/upload`, fields: { ...plan.params, api_key: "123", signature: cloudinarySignature(plan.params, SECRET) }, kind: plan.kind, resourceType: plan.resourceType }) };
    }
    if (url.startsWith("https://api.cloudinary.com/")) {
      const form = init.body;
      const params = {};
      for (const [k, v] of form.entries()) if (!["file", "api_key", "signature"].includes(k)) params[k] = v;
      // Cloudinary's own check: the fields must be exactly what was signed.
      if (cloudinarySignature(params, SECRET) !== form.get("signature")) return { status: 401, json: async () => ({ error: { message: "Invalid Signature" } }) };
      const file = form.get("file");
      const resourceType = url.split("/").slice(-2)[0];
      if (resourceType === "image" && file.size > FREE_PLAN.image_max_size_bytes) return { status: 400, json: async () => ({ error: { message: `File size too large. Got ${file.size}. Maximum is ${FREE_PLAN.image_max_size_bytes}.` } }) };
      const version = 1726000000;
      const format = resourceType === "raw" ? undefined : "jpg";
      fakeAdmin.set(params.public_id, { public_id: params.public_id, version, resource_type: resourceType, type: "upload", format, bytes: file.size, secure_url: `https://res.cloudinary.com/${CLOUD}/${resourceType}/upload/v${version}/${params.public_id}${format ? `.${format}` : ""}` });
      let answer = { public_id: params.public_id, version, resource_type: resourceType, signature: cloudinarySignature({ public_id: params.public_id, version }, SECRET, { version: 1 }) };
      if (tamper) answer = tamper(answer);
      return { status: 200, json: async () => answer };
    }
    if (url.endsWith("/verify")) {
      const body = JSON.parse(init.body);
      const read = readClaim(body);
      if (!read.ok) return { status: 400, json: async () => ({ error: read.error }) };
      if (!isOwnPublicId(read.claim.publicId, scope, read.claim.resourceType) || !responseSignatureValid(read.claim, SECRET)) return { status: 403, json: async () => ({ error: "That upload could not be confirmed. Upload the file again.", code: "not_ours" }) };
      const rec = fakeAdmin.get(read.claim.publicId);
      if (!rec || rec.resource_type !== read.claim.resourceType) return { status: 404, json: async () => ({ error: "That upload could not be confirmed. Upload the file again.", code: "not_found" }) };
      const v = judgeUploadedAsset({ claim: read.claim, asset: rec, scope, cloudName: CLOUD, filename: body.filename });
      return v.ok ? { status: 200, json: async () => v.entry } : { status: v.code === "too_large" ? 413 : 403, json: async () => ({ error: v.error, code: v.code }) };
    }
    throw new Error("unexpected " + url);
  };
  return { fetchImpl, calls };
}
const blob = (size, type = "image/jpeg") => new File([new Uint8Array(size)], "IMG_0001.JPG", { type });

{
  const { fetchImpl, calls } = fakeServer(jobs);
  const progress = [];
  const entry = await uploadFile(blob(6 * MB), { purpose: "jobs", fetchImpl, onProgress: (l, t) => progress.push([l, t]) });
  ok("a 6 MB photo goes up: sign → Cloudinary → verify", entry.url.includes(`/fieldquo/companies/${CO}/jobs/`) && entry.kind === "photo" && entry.bytes === 6 * MB && calls.length === 3 && calls[0] === "/api/upload/sign" && calls[2] === "/api/upload/verify", { entry, calls });
  ok("…and nothing is left in the progress store afterwards", getUploadsSnapshot().length === 0);
}
{
  const { fetchImpl, calls } = fakeServer(jobs);
  const err = await uploadFile(blob(12 * MB), { purpose: "jobs", fetchImpl }).catch((e) => e);
  ok("a 12 MB photo on the Free plan is refused at sign, naming the limit, before any bytes move", err?.code === "too_large" && /10 MB/.test(err.message) && calls.length === 1, { code: err?.code, message: err?.message, calls });
}
{
  const { fetchImpl } = fakeServer(uploadScope("portal", { companyId: CO }));
  const entry = await uploadFile(blob(2 * MB), { endpoint: `/api/portal/tok/upload`, fetchImpl });
  ok("the portal scope lands in the portal folder", entry.url.includes(`/fieldquo/companies/${CO}/portal/`));
}
{
  const { fetchImpl } = fakeServer(jobs, { tamper: (a) => ({ ...a, public_id: `fieldquo/companies/${OTHER}/jobs/${UUID}` }) });
  const err = await uploadFile(blob(MB), { purpose: "jobs", fetchImpl }).catch((e) => e);
  ok("a browser relaying ANOTHER company's public_id is refused at verify", err?.code === "unconfirmed" && err?.status === 403, { code: err?.code, status: err?.status });
}
{
  const { fetchImpl } = fakeServer(jobs, { tamper: (a) => ({ ...a, version: a.version + 1 }) });
  const err = await uploadFile(blob(MB), { purpose: "jobs", fetchImpl }).catch((e) => e);
  ok("a relayed answer with a doctored version is refused (signature)", err?.code === "unconfirmed");
}
{
  const { fetchImpl } = fakeServer(jobs, { tamper: (a) => ({ ...a, resource_type: "raw" }) });
  const err = await uploadFile(blob(MB), { purpose: "jobs", fetchImpl }).catch((e) => e);
  ok("a relayed answer claiming a different resource type is refused", err instanceof Error && err.code !== undefined && err.status >= 400);
}
{
  // The browser changes a signed field before posting to Cloudinary.
  const { fetchImpl: base } = fakeServer(jobs);
  const fetchImpl = async (url, init) => {
    if (url.startsWith("https://api.cloudinary.com/")) init.body.set("public_id", `fieldquo/companies/${OTHER}/jobs/${UUID}`);
    return base(url, init);
  };
  const err = await uploadFile(blob(MB), { purpose: "jobs", fetchImpl }).catch((e) => e);
  ok("editing a signed field breaks the signature and Cloudinary refuses", err?.code === "rejected" && err?.status === 401, { code: err?.code, status: err?.status });
}
{
  const fetchImpl = async () => { throw new TypeError("Failed to fetch"); };
  const err = await uploadFile(blob(MB), { fetchImpl }).catch((e) => e);
  ok("no signal → code network (the offline queue keeps the item)", err?.code === "network");
}
{
  const fetchImpl = async () => ({ status: 401, json: async () => ({ error: "Unauthorized" }) });
  const err = await uploadFile(blob(MB), { fetchImpl }).catch((e) => e);
  ok("a signed-out sign → code signed_out", err?.code === "signed_out");
}

console.log("\n   Small pieces");
ok("a .heic with no browser type is declared image/heic", declaredType({ type: "", name: "IMG_1.HEIC" }) === "image/heic" && declaredType({ type: "", name: "a.heif" }) === "image/heif");
ok("…nothing else is inferred from a name", declaredType({ type: "", name: "evil.svg" }) === "" && declaredType({ type: "", name: "a.pdf" }) === "");
ok("…a real browser type always wins", declaredType({ type: "image/jpeg", name: "a.heic" }) === "image/jpeg");
const big = explainCloudinaryRefusal("File size too large. Got 12582912. Maximum is 10485760.", 0);
ok("Cloudinary's size refusal becomes both numbers", big.code === "too_large" && /12 MB/.test(big.message) && /10 MB/.test(big.message) && big.maxBytes === 10 * MB, big);
ok("Cloudinary's format refusal names what is accepted", explainCloudinaryRefusal("Image file format pdf not allowed").code === "rejected" && /JPEG/.test(explainCloudinaryRefusal("Image file format pdf not allowed").message));
ok("anything else is the plain refusal, never undefined", typeof explainCloudinaryRefusal(undefined).message === "string");

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n8. Every caller moved");
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const files = [...walk("app"), ...walk("lib")];
const multipart = files.filter((f) => {
  const src = readFileSync(f, "utf8");
  return /fetch(Json)?\(\s*["'`]\/api\/upload["'`]/.test(src) || /fetch\(\s*`\/api\/(portal\/\$\{[^}]+\}|self-quote\/\$\{[^}]+\})\/upload`/.test(src);
});
ok("no browser code posts a file to /api/upload (or the portal/self-quote multipart routes) any more", multipart.length === 0, multipart);
const helperUsers = files.filter((f) => /from "@\/lib\/media\/uploadClient"/.test(readFileSync(f, "utf8")));
ok("the helper has its callers (MediaUploader, the direct uploaders, the offline queue, the portal)", helperUsers.length >= 20 && helperUsers.some((f) => f.endsWith("MediaUploader.js")) && helperUsers.some((f) => f.endsWith("queue.js")) && helperUsers.some((f) => f.includes("TicketsAndRequests")), helperUsers.length);
const callsWithoutImport = files.filter((f) => {
  const src = readFileSync(f, "utf8");
  return /\buploadFile\(/.test(src) && !/from "@\/lib\/media\/uploadClient"/.test(src) && !f.endsWith("uploadClient.js");
});
ok("every file that calls uploadFile imports it", callsWithoutImport.length === 0, callsWithoutImport);
ok("no call site constructs its own XHR to Cloudinary", files.filter((f) => /api\.cloudinary\.com/.test(readFileSync(f, "utf8"))).every((f) => /directUploadServer\.js$|uploadClient\.js$/.test(f)));
for (const r of ["app/api/upload/sign/route.js", "app/api/upload/verify/route.js"]) {
  const src = readFileSync(r, "utf8");
  ok(`${r} is behind memberOrRefusal and takes the company from the session`, /memberOrRefusal\(request\)/.test(src) && /companyId: member\.companyId/.test(src));
}
for (const r of ["app/api/portal/[token]/upload/sign/route.js", "app/api/portal/[token]/upload/verify/route.js", "app/api/self-quote/[companySlug]/upload/sign/route.js", "app/api/self-quote/[companySlug]/upload/verify/route.js"]) {
  const src = readFileSync(r, "utf8");
  ok(`${r} awaits params and resolves the company server-side`, /= await params/.test(src) && /uploadScope\("(portal|leads)", \{ companyId: (client\.companyId|company\.id) \}\)/.test(src));
}
ok("both public sign routes are rate-limited", /rateLimit\(request, "portal-upload"/.test(readFileSync("app/api/portal/[token]/upload/sign/route.js", "utf8")) && /rateLimit\(request, "self-quote-upload"/.test(readFileSync("app/api/self-quote/[companySlug]/upload/sign/route.js", "utf8")));
const server = readFileSync("lib/media/directUploadServer.js", "utf8");
ok("verify refuses by folder and signature BEFORE the Admin API call", server.indexOf("isOwnPublicId(") < server.indexOf("api.resource(") && server.indexOf("responseSignatureValid(") < server.indexOf("api.resource("));
ok("verify fails closed when the Admin API can't be reached", /lookup_failed/.test(server) && /status: 503/.test(server));
ok("nothing deletes a refused upload (no data deletion)", !/destroy|delete_resources|deleteAsset/.test(server));
ok("the progress UI is mounted in the /app shell", /<UploadProgress \/>/.test(readFileSync("app/app/layout.js", "utf8")));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
