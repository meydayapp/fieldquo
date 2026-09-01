// Executes lib/gallery/stages.js + albums.js — stage inference and public selection.
// Also executes lib/gallery/tags.js — company-defined job-photo tags — and
// proves the tag axis can't reach the stage-driven privacy/pairing logic
// above it, including the sharpest case: a contractor naming a custom tag
// "issue".
import { readFileSync } from "node:fs";
import { inferStage, STAGE_KEYS, normaliseStage, stageLabel } from "@/lib/gallery/stages";
import { beforeAfterPairs, albums, galleryStrip, hasGallery, stageTimeline } from "@/lib/gallery/albums";
import {
  TAG_NAME_MAX,
  normaliseTagName,
  isValidTagName,
  tagKey,
  isDuplicateTagName,
  missingStarterTags,
  sortTags,
  filterByTag,
  STARTER_TAGS,
} from "@/lib/gallery/tags";

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

// ════════════════════════════════════════════════════════════════════════
// lib/gallery/tags.js — company-defined tags, hostile inputs
// ════════════════════════════════════════════════════════════════════════

console.log("\nnormaliseTagName / isValidTagName — hostile input");
ok("empty name -> invalid", isValidTagName("") === false);
ok("whitespace-only name -> invalid", isValidTagName("   ") === false);
ok("null -> invalid, no crash", isValidTagName(null) === false);
ok("undefined -> invalid, no crash", isValidTagName(undefined) === false);
const longName = "x".repeat(500);
ok(`500-char name capped at ${TAG_NAME_MAX}`, normaliseTagName(longName).length === TAG_NAME_MAX);
ok("500-char name is still valid (non-empty after cap)", isValidTagName(longName) === true);
ok("internal whitespace collapsed", normaliseTagName("  Top   coat  ") === "Top coat");

console.log('\nA contractor CAN name a tag "issue" — nothing special-cases the word');
ok('"issue" is a valid tag name', isValidTagName("issue") === true);
ok('"Issue" is a valid tag name', isValidTagName("Issue") === true);
ok('"ISSUE" normalises like any other word (case preserved)', normaliseTagName("ISSUE") === "ISSUE");
ok('tagKey("issue") === tagKey("Issue") — same case-insensitive rule as any other name',
  tagKey("issue") === tagKey("Issue"));

console.log("\nisDuplicateTagName — case-insensitive, self excluded");
const siblings = [{ id: "t1", name: "Sanding" }, { id: "t2", name: "Top coat" }];
ok("exact match is a duplicate", isDuplicateTagName("Sanding", siblings) === true);
ok("case-insensitive match is a duplicate", isDuplicateTagName("sanding", siblings) === true);
ok("padded whitespace still matches", isDuplicateTagName("  Sanding  ", siblings) === true);
ok("different name is not a duplicate", isDuplicateTagName("Priming", siblings) === false);
ok("renaming a tag to the name it already has isn't a false collision",
  isDuplicateTagName("Sanding", siblings, "t1") === false);
ok("empty name is never reported as a duplicate (isValidTagName catches it separately)",
  isDuplicateTagName("", siblings) === false);

console.log("\nmissingStarterTags — offered, idempotent");
ok("nothing owned -> every starter tag missing", missingStarterTags([]).length === STARTER_TAGS.length);
ok("a starter tag already owned (same case) is not offered again",
  missingStarterTags([{ name: "Sanding" }]).some((s) => s.name === "Sanding") === false);
ok("a starter tag already owned under different CASE is still not re-offered",
  missingStarterTags([{ name: "sanding" }]).some((s) => tagKey(s.name) === tagKey("Sanding")) === false);
ok("a company that renamed/doesn't have a starter tag is offered it",
  missingStarterTags([{ name: "Something else entirely" }]).length === STARTER_TAGS.length);
ok('starter set has no "before"/"after"/"issue" — those are stage\'s job, not a tag\'s',
  STARTER_TAGS.every((s) => !["before", "after", "issue"].includes(tagKey(s.name))));

console.log("\nsortTags — active before retired, then order, then name");
const unsorted = [
  { id: "b", name: "Zeta", active: true, sortOrder: 1 },
  { id: "a", name: "Alpha", active: true, sortOrder: 1 },
  { id: "r", name: "Retired one", active: false, sortOrder: 0 },
  { id: "c", name: "Beta", active: true, sortOrder: 0 },
];
const sorted = sortTags(unsorted);
ok("active tags come before retired ones regardless of sortOrder",
  sorted.findIndex((x) => x.id === "r") === sorted.length - 1);
ok("within active, lower sortOrder first", sorted[0].id === "c");
ok("equal sortOrder breaks alphabetically", sorted[1].id === "a" && sorted[2].id === "b");
ok("sortTags never mutates its input", unsorted[0].id === "b");

console.log("\nfilterByTag — finds a photo even if its tag was later retired");
const taggedPhotos = [
  { id: "p1", url: "http://x/1", tags: [{ id: "tag-sand", name: "Sanding", active: true }] },
  { id: "p2", url: "http://x/2", tags: [{ id: "tag-old", name: "Old process", active: false }] },
  { id: "p3", url: "http://x/3", tags: [] },
];
ok("finds the photo with an active tag", filterByTag(taggedPhotos, "tag-sand").map((p) => p.id).join() === "p1");
ok("STILL finds the photo whose tag was retired — retiring hides the picker, not the photo",
  filterByTag(taggedPhotos, "tag-old").map((p) => p.id).join() === "p2");
ok("unknown tag id -> no matches, no crash", filterByTag(taggedPhotos, "nope").length === 0);
ok("no tagId -> everything, unfiltered", filterByTag(taggedPhotos, "").length === 3);
ok("null photos -> [], no crash", filterByTag(null, "tag-sand").length === 0);

// ════════════════════════════════════════════════════════════════════════
// The privacy boundary and before/after pairing survive tags being present
// ════════════════════════════════════════════════════════════════════════
//
// Every gallery function above (publishable/beforeAfterPairs/albums/
// galleryStrip/hasGallery) reads `photo.stage` and `photo.featured` only.
// None of them touch `photo.tags`. These cases prove that's still true with
// tags actually attached — including the one a company could genuinely
// create: a custom tag literally spelled "issue".

console.log("\nA featured, custom-tagged photo is public exactly like an untagged one");
const withCustomTag = [
  P({ jobId: "k1", jobTitle: "Kitchen", stage: "finish", createdAt: t(5),
      tags: [{ id: "tag-sand", name: "Sanding", color: "#a16207", active: true }] }),
];
ok("still appears in galleryStrip", galleryStrip(withCustomTag).length === 1);
ok("still appears in albums", albums(withCustomTag)[0].photos.length === 1);
ok("still counts for hasGallery", hasGallery(withCustomTag) === true);

console.log('\nAn "issue"-STAGE photo stays private even carrying a tag named "issue"');
const issueStageWithIssueTag = [
  P({ jobId: "k2", stage: "issue", createdAt: t(1),
      tags: [{ id: "tag-issue-literal", name: "Issue", active: true }] }),
];
ok("excluded from galleryStrip", galleryStrip(issueStageWithIssueTag).length === 0);
ok("excluded from albums", albums(issueStageWithIssueTag).every((a) => a.photos.length === 0));
ok("does not make hasGallery true", hasGallery(issueStageWithIssueTag) === false);

console.log('\nA tag literally NAMED "issue" on a NON-issue-stage photo does NOT make it private');
const finishStageWithIssueNamedTag = [
  P({ jobId: "k3", jobTitle: "Deck", stage: "finish", createdAt: t(2),
      tags: [{ id: "tag-issue-literal", name: "issue", active: true }] }),
];
ok('a "finish"-stage photo tagged "issue" IS still public — only `stage` gates privacy, never a tag\'s name',
  galleryStrip(finishStageWithIssueNamedTag).length === 1);
ok('...and it can still be the "after" of a before/after pair',
  beforeAfterPairs([
    P({ jobId: "k3", stage: "start", createdAt: t(1) }),
    ...finishStageWithIssueNamedTag,
  ]).length === 1);

console.log("\nA duplicate tag NAME on two different photos changes nothing about pairing");
const duplicateTagNameAcrossPhotos = [
  P({ jobId: "k4", stage: "start", createdAt: t(1), tags: [{ id: "tA", name: "Prep", active: true }] }),
  P({ jobId: "k4", stage: "finish", createdAt: t(2), tags: [{ id: "tB", name: "Prep", active: true }] }),
];
ok("two DIFFERENT tag rows sharing a name still pair start+finish normally",
  beforeAfterPairs(duplicateTagNameAcrossPhotos).length === 1);

console.log("\nstageTimeline (the OFFICE'S own unfiltered record) still shows everything, tags or not");
const officeRecord = [
  P({ jobId: "k5", stage: "issue", createdAt: t(1), featured: false,
      tags: [{ id: "t-x", name: "Water damage", active: true }] }),
  P({ jobId: "k5", stage: "start", createdAt: t(2), featured: false, tags: [] }),
  P({ jobId: "k5", stage: "finish", createdAt: t(3),
      tags: [{ id: "t-y", name: "Retired tag", active: false }] }),
];
const timeline = stageTimeline(officeRecord);
ok("issue photo is present in the office record despite carrying a tag",
  timeline.find((g) => g.stage === "issue")?.photos.length === 1);
ok("a photo whose only tag is retired still appears in the record",
  timeline.find((g) => g.stage === "finish")?.photos.length === 1);
ok("stageTimeline groups by stage count unaffected by tags",
  timeline.length === 3);

// ════════════════════════════════════════════════════════════════════════
// Source-scan: the read path that hits the database can't have drifted
// ════════════════════════════════════════════════════════════════════════
//
// featuredUrls() in lib/site/jobPhotos.js is DB-backed, so it can't be
// exercised with fixtures the way the functions above were. What CAN be
// executed is a check that its query still filters on `stage`, not on any
// tag — the same structural guarantee proven above, pinned against the
// actual file so a future edit that tries to "helpfully" also exclude by tag
// name (which would be the same class of bug in reverse: a tag deciding
// privacy) fails this script.
console.log("\nfeaturedUrls() query source — still stage-gated, never tag-gated");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const jobPhotosSrc = stripComments(readFileSync(new URL("../lib/site/jobPhotos.js", import.meta.url), "utf8"));
const featuredUrlsStart = jobPhotosSrc.indexOf("async function featuredUrls");
const featuredUrlsBody = jobPhotosSrc.slice(featuredUrlsStart, jobPhotosSrc.indexOf("\n}\n", featuredUrlsStart));
ok("featuredUrls found in source", featuredUrlsStart !== -1);
ok('still filters featured: true, stage: { not: "issue" }',
  /featured:\s*true/.test(featuredUrlsBody) && /stage:\s*\{\s*not:\s*["']issue["']\s*\}/.test(featuredUrlsBody));
// A plain /tag/i would false-positive on "stage" (s-TAG-e) — this looks for
// actual tag identifiers (jobPhotoTag, tagId, a `.tags` property access)
// rather than the bare substring.
ok("does not reference a tag table or field — tags can't participate in this gate",
  !/jobPhotoTag|tagId|\.tags\b/i.test(featuredUrlsBody));

console.log("\nAPI route source — tagIds sync never touches `stage`");
const photosRouteSrc = stripComments(
  readFileSync(new URL("../app/api/jobs/[id]/photos/route.js", import.meta.url), "utf8"),
);
const tagSyncStart = photosRouteSrc.indexOf("if (wantsTagChange)");
const tagSyncBody = photosRouteSrc.slice(tagSyncStart, photosRouteSrc.indexOf("\n  }\n\n  const updated", tagSyncStart));
ok("tag-sync block found", tagSyncStart !== -1);
ok("the tag-sync block never assigns `stage`", !/\bstage\s*[:=]/.test(tagSyncBody));
ok("the tag-sync block only ever writes jobPhotoTagOnPhoto rows",
  /db\.jobPhotoTagOnPhoto\.(deleteMany|createMany)/.test(tagSyncBody) && !/db\.jobPhoto\.update/.test(tagSyncBody));
ok('the "issue" privacy refusal still keys off `data.featured`/`stage`, not tagIds',
  /data\.featured === true/.test(photosRouteSrc) && /stage === "issue"/.test(photosRouteSrc));

const toAddLine = tagSyncBody.slice(tagSyncBody.indexOf("const toAdd"), tagSyncBody.indexOf("const toRemove"));
const toRemoveLine = tagSyncBody.slice(tagSyncBody.indexOf("const toRemove"));
ok("a NEWLY requested tag must be active to be attached (retired tags aren't offered)",
  /tag\.active/.test(toAddLine));
ok("removal is decided ONLY by absence from the request, never by a tag's active flag — "
    + "so retiring a tag can't silently strip it off photos that already carry it",
  !/\.active/.test(toRemoveLine));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
