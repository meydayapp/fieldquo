// Executes lib/gallery/stages.js + albums.js — stage inference and public selection.
import { inferStage, STAGE_KEYS, normaliseStage, stageLabel } from "@/lib/gallery/stages";
import { beforeAfterPairs, albums, galleryStrip, hasGallery } from "@/lib/gallery/albums";

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

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
