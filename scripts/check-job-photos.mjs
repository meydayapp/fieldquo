// scripts/check-job-photos.mjs
//
// Getting a photo onto a job, which until now could only happen by text.
//
// ══ Why the panel looked missing ═══════════════════════════════════════════
//
// JobPhoto rows had exactly ONE writer in the whole codebase —
// lib/crew/inbox.js, when a crew member texts a picture to the crew line. A
// contractor who does not use crew SMS could not put a photo on a job at all.
//
// And the curator rendered `null` when a job had no photos ("nothing filed yet
// — no empty box"), which was a defensible call while there was nothing to put
// in the box, and the wrong one the moment it meant a whole feature was
// invisible rather than empty. Absent and empty are different statements. This
// codebase already has a check named check:empty-vs-error about that exact
// confusion on other screens.
//
// ══ Two routes, not one ════════════════════════════════════════════════════
//
// The browser uploads to /api/upload — signed, authenticated, foldered per
// company, and shared by quotes, invoices, leads and the site builder — then
// files the resulting URL against the job. Giving job photos their own
// Cloudinary path is how signing rules drift apart between surfaces.
import { readFileSync } from "node:fs";
import { sanitiseAnnotationJson, displayPhotoUrl, isAnnotated } from "@/lib/jobs/photoAnnotation";
import { buildArrowPath, arrowTipPoint } from "@/lib/photoAnnotator/arrowGeometry";
import { haloColorFor, haloContrast } from "@/lib/photoAnnotator/contrast";
import { ANNOTATION_COLORS } from "@/lib/photoAnnotator/constants";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROUTE = strip(readFileSync("app/api/jobs/[id]/photos/route.js", "utf8"));
const CURATOR = strip(readFileSync("app/components/jobs/JobPhotoCurator.js", "utf8"));
const DETAIL = readFileSync("app/app/jobs/[id]/JobDetail.js", "utf8");

section("1. There is now a way in that is not a text message");

ok(/export async function POST\(/.test(ROUTE), "the photos route accepts a POST at all");
ok(/db\.jobPhoto\.createMany/.test(ROUTE), "…and files rows against the job");
ok(/<MediaUploader/.test(CURATOR), "the job page renders an upload control");
ok(/uploadUrl="\/api\/upload"/.test(CURATOR), "…pointed at the one shared, signed upload path");
ok(/JobPhotoCurator/.test(DETAIL), "…and the curator is actually mounted on the job page");

section("2. The panel no longer disappears when it is empty");

// The literal line that made a whole feature invisible.
ok(
  !/if \(!photos\.length\) return null/.test(CURATOR),
  "the curator no longer returns null on an empty job",
);
ok(/photos\.length > 0 \?/.test(CURATOR), "…it branches to an empty state instead");
ok(/Nothing filed yet/.test(CURATOR), "…which says so in words");
ok(
  /text them to your crew line/.test(CURATOR),
  "…and names the OTHER way in, so the crew-SMS path is discoverable rather than folklore",
);

section("3. A tenant cannot file a photo onto somebody else's job");

ok(/companyId: member\.companyId/.test(ROUTE), "companyId comes from the session");
ok(
  !/companyId: body|companyId: it\?|body\?\.companyId/.test(ROUTE),
  "…and never from the request body — the cross-tenant write the reference CSV importer got wrong",
);
ok(/assignedJobWhere\(full\)/.test(ROUTE), "the job itself is scoped by the caller's assignment");
// Sliced to the POST handler ALONE. Taking everything from POST onward ran
// straight into the PATCH handler below it, which uses the same
// "view_create_edit" string — so downgrading POST's gate to view_only passed
// cleanly, because the assertion was reading PATCH's. Mutation testing caught
// it; the fix is to end the slice at the next export.
const POST_AT = ROUTE.indexOf("export async function POST");
const NEXT_EXPORT = ROUTE.indexOf("export async function", POST_AT + 10);
const postBody = ROUTE.slice(POST_AT, NEXT_EXPORT === -1 ? undefined : NEXT_EXPORT);
ok(
  postBody.indexOf("levelOrRefusal") < postBody.indexOf("createMany"),
  "the permission gate runs BEFORE anything is written",
);
ok(
  /"view_create_edit"/.test(postBody),
  "…at the same level as editing the job, because filing a photo is an edit to its record",
);
ok(
  postBody.indexOf("db.job.findFirst") < postBody.indexOf("createMany"),
  "…and the job is proven to exist and be theirs first",
);

section("4. A row can never point at nothing");

ok(/\/\^https:\\\/\\\/\//.test(postBody) || /https:\\\/\\\//.test(postBody),
  "only https URLs are filed — a data: or blob: URL would file a row pointing at nothing");
ok(/reason: "no_photos"/.test(postBody), "a request with no usable photo is a 400 with a reason, not a 500");
ok(/status: 400/.test(postBody), "…and says so with a status");
ok(/STAGES\[it\?\.stage\] \? it\.stage : "progress"/.test(postBody),
  "an unrecognised stage falls back rather than being stored and later read as nothing");

section("5. The screen believes the server, not itself");

// A list rebuilt from the request would disagree with the next page load —
// the server decides the id and the stage.
// Scoped to the upload handler. `await load()` also appears in patch(), so the
// unscoped version passed even with the re-read deleted from the upload path.
const UPLOAD_HANDLER = CURATOR.slice(CURATOR.indexOf("<MediaUploader"), CURATOR.indexOf("</section>"));
ok(
  /await load\(\)/.test(UPLOAD_HANDLER),
  "after filing, the curator re-reads from the server",
  UPLOAD_HANDLER.length,
);
ok(
  !/setData\(\{ photos: \[\.\.\./.test(CURATOR),
  "…rather than splicing what it just sent into local state",
);
ok(/reportResponseError/.test(CURATOR), "a failed file is reported, not swallowed");

/* ═══════════════════════════════════════════════════════════════════════════
   6. sanitiseAnnotationJson — the boundary between what a browser sent and
      what gets stored (and later replayed through canvas.loadFromJSON)
   ═══════════════════════════════════════════════════════════════════════════

   Executed, not read — the same "run the pure function against hostile
   input" approach as lib/designer/utils.js's transformText in
   scripts/check-designer.mjs. This is the ONE function standing between an
   arbitrary PATCH body and the database column that gets fed back into a
   live fabric canvas the next time someone opens the editor. */

section("6. sanitiseAnnotationJson — hostile input never becomes a stored row");

ok(sanitiseAnnotationJson(null).ok && sanitiseAnnotationJson(null).json === null,
  "null (no markup) is accepted as an explicit clear, not an error");
ok(sanitiseAnnotationJson("").ok && sanitiseAnnotationJson("").json === null,
  "an empty string is treated the same as null");
ok(!sanitiseAnnotationJson(42).ok, "a non-string is refused rather than coerced");
ok(!sanitiseAnnotationJson({ objects: [] }).ok,
  "an actual OBJECT (not its JSON.stringify'd form) is refused — this route expects a STRING");
ok(!sanitiseAnnotationJson("{not valid json").ok, "malformed JSON is refused, not stored broken");
ok(!sanitiseAnnotationJson(JSON.stringify({ notObjects: [] })).ok,
  "JSON missing the {objects:[...]} shape entirely is refused");
ok(sanitiseAnnotationJson(JSON.stringify({ objects: [] })).ok, "an empty objects array is a valid (if pointless) layer");
ok(
  sanitiseAnnotationJson(JSON.stringify({ objects: [{ type: "path", path: [] }] })).ok,
  "a real annotator object type (path) is accepted",
);
ok(
  !sanitiseAnnotationJson(JSON.stringify({ objects: [{ type: "image", src: "https://evil.example/x.png" }] })).ok,
  "\"image\" is refused — nothing in the annotator's own tools ever adds one, so a payload claiming one didn't come from this editor",
);
{
  // A nested group is the halo+ink pairing every real stroke/shape/arrow
  // produces — must be walked recursively, not just checked one level deep.
  const nested = sanitiseAnnotationJson(
    JSON.stringify({ objects: [{ type: "group", objects: [{ type: "path" }, { type: "rect" }] }] }),
  );
  ok(nested.ok, "a group nesting only allowed types is accepted");
  const nestedBad = sanitiseAnnotationJson(
    JSON.stringify({ objects: [{ type: "group", objects: [{ type: "image" }] }] }),
  );
  ok(!nestedBad.ok, "…but a disallowed type ONE LEVEL DEEP inside a group is still caught, not just the top level");
}
{
  const tooMany = sanitiseAnnotationJson(JSON.stringify({ objects: Array.from({ length: 401 }, () => ({ type: "path" })) }));
  ok(!tooMany.ok, "over MAX_ANNOTATION_OBJECTS is refused rather than accepted unbounded");
}
ok(!sanitiseAnnotationJson("x".repeat(300_001)).ok, "over MAX_ANNOTATION_JSON_BYTES is refused before it's even parsed");
{
  const stripped = sanitiseAnnotationJson(JSON.stringify({ objects: [], somethingElse: "haxx", __proto__: { polluted: true } }));
  ok(stripped.ok, "an object with an unexpected extra top-level key is still accepted…");
  ok(
    !stripped.json.includes("somethingElse") && !stripped.json.includes("polluted"),
    "…but the extra key is DROPPED — the stored JSON is re-serialised from the parsed {objects} shape, never the caller's raw string",
    stripped.json,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. displayPhotoUrl / isAnnotated — the one place a READER decides which
      asset to show
   ═══════════════════════════════════════════════════════════════════════════ */

section("7. displayPhotoUrl — flattened wins when present, the untouched original otherwise");

ok(displayPhotoUrl({ url: "https://x/orig.jpg", flattenedUrl: "https://x/flat.png" }) === "https://x/flat.png",
  "a flattened asset is preferred over the original");
ok(displayPhotoUrl({ url: "https://x/orig.jpg", flattenedUrl: null }) === "https://x/orig.jpg",
  "no flattened asset falls back to the original");
ok(displayPhotoUrl({ url: "https://x/orig.jpg" }) === "https://x/orig.jpg",
  "a row that has never even SEEN the annotation columns still resolves to the original — additive migration, no crash on an old shape");
ok(displayPhotoUrl({ url: "https://x/orig.jpg", flattenedUrl: "" }) === "https://x/orig.jpg",
  "an empty-string flattenedUrl (never a real Cloudinary URL) is treated as absent, not returned literally");
ok(displayPhotoUrl(null) === "", "a null photo doesn't throw — returns an empty string, not undefined stitched into an <img src>");
ok(isAnnotated({ annotationJson: '{"objects":[]}' }) === true, "a non-empty annotationJson string reads as annotated");
ok(isAnnotated({ annotationJson: null }) === false, "null annotationJson reads as not annotated");
ok(isAnnotated({}) === false, "a missing field entirely reads as not annotated, not a crash");

/* ═══════════════════════════════════════════════════════════════════════════
   8. haloColorFor — "a fixed red is invisible on a red brick wall" (the
      task brief, verbatim) — measured, not eyeballed, the same way
      scripts/check-designer-contrast.mjs measures the kitchen designer's
      palette instead of trusting the naive dark/light rule
   ═══════════════════════════════════════════════════════════════════════════ */

section("8. haloColorFor — every annotation ink colour clears 4.5:1 against its own halo");

for (const hex of ANNOTATION_COLORS) {
  const ratio = haloContrast(hex);
  ok(ratio >= 4.5, `${hex} -> ${haloColorFor(hex)} clears 4.5:1`, ratio);
}
// Garbage in must not produce NaN out — the same guard
// check-designer-contrast.mjs applies to designerTheme().
for (const junk of [null, undefined, "", "not a colour", "#12", "#GGGGGG", 42, {}]) {
  const ratio = haloContrast(junk);
  ok(Number.isFinite(ratio) && ratio >= 4.5, `junk ink ${JSON.stringify(junk)} still resolves to a real, legible halo`, ratio);
}
ok(haloColorFor("#ffcc00") === haloColorFor("#ffffff"),
  "two light inks (yellow, white) both get the SAME dark halo — the naive 'pick white unless already white' rule would give white a halo that doesn't exist");
ok(haloColorFor("#111111") !== haloColorFor("#ffcc00"),
  "a dark ink and a light ink get genuinely different halos, not the same constant regardless of input");

/* ═══════════════════════════════════════════════════════════════════════════
   9. buildArrowPath — the arrow tool's geometry, executed against
      degenerate input (this fabric build has no built-in arrow shape — see
      arrowGeometry.js's own header for why it's hand-built)
   ═══════════════════════════════════════════════════════════════════════════ */

section("9. buildArrowPath — degenerate input never produces NaN or a self-intersecting path");

{
  const d = buildArrowPath({ length: 150, headLength: 36, headWidth: 28, thickness: 9 });
  ok(typeof d === "string" && d.startsWith("M ") && d.trim().endsWith("Z"), "a normal call returns a closed SVG path", d);
  ok(!/NaN/.test(d), "…with no NaN coordinates");
  ok(arrowTipPoint({ length: 150, headLength: 36, headWidth: 28, thickness: 9 }).x === 150,
    "the tip sits exactly at the requested length");
}
{
  // Zero/negative everything — a hostile or simply uninitialised call.
  const d = buildArrowPath({ length: 0, headLength: 0, headWidth: 0, thickness: 0 });
  ok(!/NaN/.test(d) && !/-Infinity|Infinity/.test(d), "zero/negative dimensions are clamped, not left to produce NaN or Infinity", d);
  ok(!/undefined/.test(d), "…and never leak an undefined into the path string");
}
{
  const d = buildArrowPath({ length: -50, headLength: -10, headWidth: -20, thickness: -5 });
  ok(!/NaN/.test(d) && !/-Infinity|Infinity/.test(d), "negative dimensions are clamped to a small positive arrow, not a NaN path", d);
}
{
  // A head "longer" than the requested shaft — the shaft would go negative
  // without the minLength clamp in arrowGeometry.js.
  const d = buildArrowPath({ length: 10, headLength: 500, headWidth: 28, thickness: 9 });
  ok(!/NaN/.test(d), "a head longer than the requested overall length still produces a valid path", d);
}
ok(
  buildArrowPath({ length: 150, headLength: 36, headWidth: 28, thickness: 9 })
    !== buildArrowPath({ length: 150, headLength: 36, headWidth: 28, thickness: 9 + 5 + 5 }),
  "padding thickness (the halo's own construction — see PhotoAnnotatorEditor.js#addShape) actually changes the path, not a no-op",
);

/* ═══════════════════════════════════════════════════════════════════════════
   10. The PATCH route: save re-validates server-side, clear actually clears,
       and the permission/scope gates that protect featured/stage/caption
       protect the annotation fields too
   ═══════════════════════════════════════════════════════════════════════════ */

section("10. PATCH /api/jobs/[id]/photos — the annotation save/clear path, source-level");

// Scoped to the PATCH handler alone, not the whole ROUTE text — PATCH is the
// last export in the file, so this is everything from its declaration to
// EOF. Matters for at least one assertion below: POST has its OWN
// `/^https:\/\//` check on the original photo url, so a version of that
// assertion that read the whole file would keep passing even if PATCH's own
// https check for flattenedUrl were deleted — the exact "assertion reads the
// wrong handler" bug this file's section 3 comment already names once.
const PATCH_AT = ROUTE.indexOf("export async function PATCH");
const patchBody = ROUTE.slice(PATCH_AT);

ok(/sanitiseAnnotationJson\(/.test(patchBody), "the route re-validates annotationJson server-side — never trusts the browser's own JSON.stringify");
ok(/body\.clearAnnotation === true/.test(patchBody), "a real, checked clearAnnotation flag — not just \"any truthy body.clearAnnotation\"");
ok(
  /data\.annotationJson = null/.test(patchBody) && /data\.flattenedUrl = null/.test(patchBody),
  "clearing actually nulls BOTH the vector layer and the flattened asset reference — not just one of the two",
);
ok(
  /\^https:\\\/\\\//.test(patchBody),
  "the flattenedUrl a save carries is https-checked, same rule the original photo URL gets in POST — checked against PATCH alone, since POST has its own copy of this same pattern",
);
ok(
  /Number\.isFinite\(width\)/.test(patchBody) && /width <= 0/.test(patchBody),
  "a zero/negative/non-numeric annotationWidth or annotationHeight is refused rather than stored and later divided by",
);
ok(/deleteAsset\(oldFlattenedPublicId/.test(patchBody), "the SUPERSEDED flattened asset is deleted from Cloudinary, not left orphaned forever");
{
  const deleteAt = patchBody.indexOf("deleteAsset(oldFlattenedPublicId");
  const updateAt = patchBody.indexOf("db.jobPhoto.update(");
  ok(
    updateAt !== -1 && deleteAt !== -1 && updateAt < deleteAt,
    "…and the DB row is updated BEFORE the old Cloudinary asset is touched — a delete that failed must never take the save down with it",
  );
}
ok(
  /catch \(err\)/.test(patchBody.slice(patchBody.indexOf("deleteAsset(oldFlattenedPublicId") - 200, patchBody.indexOf("deleteAsset(oldFlattenedPublicId") + 200)),
  "…and that delete is wrapped so a Cloudinary hiccup can't 500 an otherwise-successful save",
);
// The SAME scope check that protects featured/stage/caption (the `photo`
// lookup, matched on id + companyId + jobId + assignedJobWhere) runs before
// ANY of this — no separate, differently-scoped code path for annotations.
ok(
  patchBody.indexOf("db.jobPhoto.findFirst") < patchBody.indexOf("sanitiseAnnotationJson"),
  "the tenant/job scope check runs BEFORE the annotation body is even validated, let alone written",
);

/* ═══════════════════════════════════════════════════════════════════════════
   11. JobPhotoCurator: a real Annotate control, a real quick-remove, and the
       thumbnail shows what a client/report would actually show
   ═══════════════════════════════════════════════════════════════════════════ */

section("11. JobPhotoCurator — markup is reachable and visible, not just plumbed");

ok(/<PhotoAnnotatorLoader\b/.test(CURATOR), "opens the real annotator component, not a stub panel");
ok(/onCancel=\{/.test(CURATOR) && /onDone=\{/.test(CURATOR), "wired to both a cancel and a done callback — not fire-and-forget");
ok(/clearAnnotation: true/.test(CURATOR), "the quick \"Remove markup\" action sends the real clear flag the route expects");
ok(
  /displayPhotoUrl\(photo\)/.test(CURATOR),
  "the thumbnail renders displayPhotoUrl(photo) — the same flattened-or-original choice the public gallery and PDF report make",
);
ok(!/<img src=\{photo\.url\}/.test(CURATOR), "…and the thumbnail is NOT still reading the raw, un-annotated url directly");
ok(/isAnnotated\(photo\)/.test(CURATOR), "the \"Marked up\" quick action only renders for a photo that actually has a markup layer");

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
