// Executes lib/gallery/stages.js + albums.js — stage inference and public selection.
import { readFileSync } from "node:fs";
import { inferStage, STAGE_KEYS, normaliseStage, stageLabel } from "@/lib/gallery/stages";
import { beforeAfterPairs, albums, galleryStrip, hasGallery } from "@/lib/gallery/albums";
import { displayPhotoUrl } from "@/lib/jobs/photoAnnotation";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

console.log("\ninferStage — reads what the crew said");
ok('"all done" -> finish', inferStage("all done here, looks great") === "finish");
ok('"before we start" -> start', inferStage("before we start, here's the room") === "start");
ok('"just arrived" -> start', inferStage("just arrived on site") === "start");
ok('"found a leak" -> issue', inferStage("heads up, found a leak behind the vanity") === "issue");
ok('"finished but there is a problem" -> issue wins', inferStage("finished but there's a problem with the trim") === "issue");
ok("bare photo mid-job -> progress", inferStage("") === "progress");
ok("ambiguous -> progress, not a guess", inferStage("here you go") === "progress");
ok('"restart" does not fire "start"', inferStage("had to restart the compressor") === "progress", inferStage("had to restart the compressor"));
ok('"aftermath" does not fire "after"/finish', inferStage("cleaning up the aftermath") !== "finish", inferStage("cleaning up the aftermath"));
ok("null text -> progress, no crash", inferStage(null) === "progress");

console.log("\nnormaliseStage / labels");
ok("unknown stage -> progress", normaliseStage("banana") === "progress");
ok("known stage kept", normaliseStage("finish") === "finish");
ok("every stage has a label", STAGE_KEYS.every((k) => typeof stageLabel(k) === "string"));

// Photo fixtures: {jobId, jobTitle, stage, featured, url, createdAt}
const P = (o) => ({ url: "http://x/" + Math.random().toString(36).slice(2), featured: true, ...o });
const t = (d) => `2026-08-${String(d).padStart(2, "0")}T12:00:00Z`;

console.log("\nbeforeAfterPairs — only when BOTH sides are featured");
const bothSides = [
  P({ jobId: "oak", jobTitle: "Oak St repaint", stage: "start", createdAt: t(1) }),
  P({ jobId: "oak", jobTitle: "Oak St repaint", stage: "finish", createdAt: t(9) }),
];
const pairs = beforeAfterPairs(bothSides);
ok("a job with start+finish yields one pair", pairs.length === 1);
ok("before is the start", pairs[0].before.stage === "start");
ok("after is the finish", pairs[0].after.stage === "finish");
ok("carries the job title", pairs[0].jobTitle === "Oak St repaint");

ok("finish-only job yields NO pair (no broken before/after)",
  beforeAfterPairs([P({ jobId: "j", stage: "finish", createdAt: t(2) })]).length === 0);
ok("start-only job yields no pair",
  beforeAfterPairs([P({ jobId: "j", stage: "start", createdAt: t(2) })]).length === 0);

console.log("\nWidest honest contrast: earliest start, latest finish");
const many = [
  P({ jobId: "j", stage: "start", createdAt: t(1) }),
  P({ jobId: "j", stage: "start", createdAt: t(3) }),
  P({ jobId: "j", stage: "finish", createdAt: t(7) }),
  P({ jobId: "j", stage: "finish", createdAt: t(9) }),
];
const pair = beforeAfterPairs(many)[0];
ok("before = earliest start", pair.before.createdAt === t(1));
ok("after = latest finish", pair.after.createdAt === t(9));

console.log("\nNothing unfeatured or 'issue' is ever public");
const mixed = [
  P({ jobId: "a", stage: "start", createdAt: t(1) }),
  P({ jobId: "a", stage: "finish", createdAt: t(2) }),
  P({ jobId: "a", stage: "finish", createdAt: t(3), featured: false }), // not featured
  P({ jobId: "a", stage: "issue", createdAt: t(4) }),                    // issue
];
const strip = galleryStrip(mixed);
ok("unfeatured excluded", !strip.some((p) => p.featured === false));
ok("issue excluded from the strip", !strip.some((p) => p.stage === "issue"));
ok("issue excluded from albums", !albums(mixed).some((a) => a.photos.some((p) => p.stage === "issue")));
ok("issue can't form a before/after 'after'", beforeAfterPairs([
  P({ jobId: "z", stage: "start", createdAt: t(1) }),
  P({ jobId: "z", stage: "issue", createdAt: t(2) }),
]).length === 0);

console.log("\nalbums — grouped by job, stage-ordered, newest job first");
const twoJobs = [
  P({ jobId: "old", jobTitle: "Old", stage: "finish", createdAt: t(2) }),
  P({ jobId: "new", jobTitle: "New", stage: "start", createdAt: t(8) }),
  P({ jobId: "new", jobTitle: "New", stage: "finish", createdAt: t(9) }),
];
const al = albums(twoJobs);
ok("one album per job", al.length === 2);
ok("newest job first", al[0].jobId === "new");
ok("within a job, start before finish", al[0].photos[0].stage === "start" && al[0].photos[1].stage === "finish");

console.log("\nhasGallery — hide an empty one");
ok("all unfeatured -> no gallery", hasGallery([P({ stage: "finish", featured: false })]) === false);
ok("one featured -> has gallery", hasGallery([P({ stage: "finish" })]) === true);
ok("only issues -> no gallery", hasGallery([P({ stage: "issue" })]) === false);
ok("empty -> no gallery, no crash", hasGallery([]) === false);
ok("null -> no crash", hasGallery(null) === false);

console.log("\ngalleryStrip — capped, newest first");
const lots = Array.from({ length: 50 }, (_, i) => P({ jobId: "j", stage: "finish", createdAt: t((i % 28) + 1) }));
ok("respects the cap", galleryStrip(lots, 12).length === 12);
ok("default cap 24", galleryStrip(lots).length === 24);

// ── displayPhotoUrl() itself — executed, pure ────────────────────────────
//
// The function every public-facing reader in this file goes through below.
// Already exercised more thoroughly in scripts/check-job-photos.mjs; this is
// just the sanity check that the specific two calls this survives are what
// they claim.
console.log("\ndisplayPhotoUrl — the annotated preview wins when present");
ok("flattened wins", displayPhotoUrl({ url: "https://x/a.jpg", flattenedUrl: "https://x/flat.png" }) === "https://x/flat.png");
ok("falls back to the original", displayPhotoUrl({ url: "https://x/a.jpg", flattenedUrl: null }) === "https://x/a.jpg");

// ── lib/site/jobPhotos.js — source-level: the two DB-touching public paths
//    still exclude "issue"/unfeatured, AND now read through displayPhotoUrl
// ═══════════════════════════════════════════════════════════════════════
//
// featuredUrls() and jobPhotoPairs() call db.jobPhoto directly, so — unlike
// everything above — they can't be executed here without a real or stubbed
// Prisma client (scripts/check-designer-reach.mjs's fake-db technique is the
// precedent for doing that, at real cost in setup). Read instead, the same
// way scripts/check-job-photo-report.mjs section 6 verifies a real route's
// scoping: this is the ONE place in the codebase these two functions are
// defined, so a regression here is a regression everywhere they're called
// (the site's gallery block and its before/after slider).
console.log("\nlib/site/jobPhotos.js — source-level: issue/unfeatured excluded, displayPhotoUrl used");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const JOB_PHOTOS_SRC = stripComments(readFileSync("lib/site/jobPhotos.js", "utf8"));

const featuredUrlsAt = JOB_PHOTOS_SRC.indexOf("async function featuredUrls");
const featuredUrlsEnd = JOB_PHOTOS_SRC.indexOf("\n}", featuredUrlsAt);
const featuredUrlsBody = JOB_PHOTOS_SRC.slice(featuredUrlsAt, featuredUrlsEnd === -1 ? undefined : featuredUrlsEnd);
ok(
  "featuredUrls() still filters stage !== issue",
  /stage:\s*\{\s*not:\s*["']issue["']\s*\}/.test(featuredUrlsBody),
  featuredUrlsBody,
);
ok("featuredUrls() selects flattenedUrl", /flattenedUrl:\s*true/.test(featuredUrlsBody));
ok(
  "featuredUrls() reads through displayPhotoUrl(), not raw r.url",
  /displayPhotoUrl\(/.test(featuredUrlsBody) && !/\.map\(\(r\)\s*=>\s*r\.url\)/.test(featuredUrlsBody),
);

const pairsAt = JOB_PHOTOS_SRC.indexOf("export async function jobPhotoPairs");
const pairsBody = JOB_PHOTOS_SRC.slice(pairsAt);
ok("jobPhotoPairs() selects flattenedUrl on the featured query", /flattenedUrl:\s*true/.test(pairsBody));
ok(
  "jobPhotoPairs() builds before/after through displayPhotoUrl(p.before)/(p.after), not p.before.url/p.after.url",
  /displayPhotoUrl\(p\.before\)/.test(pairsBody) && /displayPhotoUrl\(p\.after\)/.test(pairsBody),
);
ok(
  "…and the raw .before.url/.after.url shape is gone, not just supplemented",
  !/before:\s*p\.before\.url/.test(pairsBody) && !/after:\s*p\.after\.url/.test(pairsBody),
);
// Defence in depth, unchanged by this feature: jobPhotoPairs() still hands
// EVERY featured photo (issue included) to beforeAfterPairs(), which is what
// actually excludes "issue" — via albums.js#publishable(), independently of
// featuredUrls()'s own stage filter above. A photo annotated while staged
// "issue" still can't reach this path BECAUSE of that, not because of
// anything added here — confirmed already, executed, in section 2 of
// scripts/check-job-photo-report.mjs ("albums() never returns the unfeatured
// issue photo… or the FEATURED one either").
ok(
  "jobPhotoPairs() still hands beforeAfterPairs() the UNFILTERED featured set (the issue exclusion is that function's job, not a stage filter here)",
  /where:\s*\{\s*companyId,\s*featured:\s*true\s*\}/.test(pairsBody.slice(0, pairsBody.indexOf("beforeAfterPairs"))),
);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
