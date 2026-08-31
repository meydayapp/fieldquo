// scripts/check-job-photo-report.mjs
//
//   npm run check:photo-report
//
// The internal photo timeline and the photo report PDF — see AGENTS.md's "the
// rule that matters most". lib/gallery/albums.js already knew how to group and
// order a job's photos; until now the ONLY consumer was the public marketing
// gallery, so a contractor could never see their own job's photos as a
// record. This is that gap closed, checked four ways:
//
//   1. stageTimeline (the new, unfiltered grouping) puts a job's own photos in
//      date order, grouped by stage, and — the whole point — does NOT drop
//      "issue" shots the way every public-facing function in the same file
//      must.
//   2. Every PUBLIC view in the same file still drops "issue" photos and
//      unfeatured ones. Same file, opposite rule, so this is the regression
//      that actually matters: a copy-paste of the wrong filter (or its
//      absence) between the two would leak an office record onto a client's
//      website.
//   3. The report PDF renders with zero photos without throwing — a contractor
//      who downloads a report before any photo has landed must get a document
//      that says so, not a 500.
//   4. Every photo in the report is resized before being embedded, never
//      passed through at full resolution — see lib/cloudinary.js#resizedUrl
//      and the cost note in lib/jobs/photoReport.js.
//
// Bundled with esbuild before it runs, for the same reason
// scripts/check-tax-send-gate.mjs is: it imports the REAL renderer, and
// @react-pdf/renderer pulls in code that plain node's resolver and CJS/ESM
// interop can't run unbundled (see the comment on format: cjs below).
import { readFileSync } from "node:fs";
import { stageTimeline, albums, beforeAfterPairs, galleryStrip, hasGallery } from "@/lib/gallery/albums";
import { buildPhotoReportData, REPORT_PHOTO_WIDTH } from "@/lib/jobs/photoReport";
import { renderJobPhotoReportPdfBuffer } from "@/app/admin/lib/pdf/renderJobPhotoReportPdf";
import { DOCUMENT_LABELS } from "@/lib/i18n/documentLabels";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// esbuild's cjs output format doesn't support top-level await, and
// renderJobPhotoReportPdfBuffer (section 5 below) is async — see the same
// wrapping in scripts/check-tax-send-gate.mjs's neighbours that call real
// async renderers.
async function main() {

// ── Fixture: one job's photos, deliberately out of chronological order and
// mixing featured/unfeatured/issue, the way a real JobPhoto.findMany result
// would arrive (ordered by stage, not by anything a human would recognise as
// "the order this job happened in"). ──────────────────────────────────────
const PHOTO_A_START = { id: "a", jobId: "job1", url: "https://res.cloudinary.com/demo/image/upload/v1/a.jpg", stage: "start", featured: true, caption: "arrived", createdAt: "2026-01-01T09:00:00Z" };
const PHOTO_B_PROGRESS = { id: "b", jobId: "job1", url: "https://res.cloudinary.com/demo/image/upload/v1/b.jpg", stage: "progress", featured: false, caption: "mid-strip", createdAt: "2026-01-02T09:00:00Z" };
const PHOTO_C_ISSUE = { id: "c", jobId: "job1", url: "https://res.cloudinary.com/demo/image/upload/v1/c.jpg", stage: "issue", featured: false, caption: "water damage behind cabinet", createdAt: "2026-01-02T14:00:00Z" };
const PHOTO_D_FINISH_LATE = { id: "d", jobId: "job1", url: "https://res.cloudinary.com/demo/image/upload/v1/d.jpg", stage: "finish", featured: true, caption: "done", createdAt: "2026-01-10T09:00:00Z" };
const PHOTO_E_FINISH_EARLY = { id: "e", jobId: "job1", url: "https://res.cloudinary.com/demo/image/upload/v1/e.jpg", stage: "finish", featured: false, caption: "almost done", createdAt: "2026-01-08T09:00:00Z" };
// A FEATURED issue photo. The PATCH route (app/api/jobs/[id]/photos/route.js)
// refuses to set featured=true on an issue-staged row today, but a row from
// before that guard existed, or a future bug in that one gate, would produce
// exactly this shape — and the exclusion in `publishable()` below is the
// second, independent line of defence for it, the same "enforced twice on
// purpose" pattern AGENTS.md calls out for impersonation. Without this
// fixture, breaking the `stage !== "issue"` clause specifically (as opposed to
// the `featured` clause) would pass every assertion in section 2 undetected —
// caught by mutation testing this file.
const PHOTO_F_FEATURED_ISSUE = { id: "f", jobId: "job1", url: "https://res.cloudinary.com/demo/image/upload/v1/f.jpg", stage: "issue", featured: true, caption: "starred by mistake", createdAt: "2026-01-03T09:00:00Z" };
// Fed in reverse-ish, unsorted order — the point is stageTimeline does the
// ordering, not whoever calls it.
const JOB_PHOTOS = [PHOTO_D_FINISH_LATE, PHOTO_A_START, PHOTO_C_ISSUE, PHOTO_E_FINISH_EARLY, PHOTO_B_PROGRESS, PHOTO_F_FEATURED_ISSUE];

section("1. stageTimeline — a job's OWN record: dated, grouped, unfiltered");

const timeline = stageTimeline(JOB_PHOTOS);

ok(timeline.map((g) => g.stage).join(",") === "start,progress,finish,issue",
  "groups appear in stage order (start → progress → finish → issue), not arrival order", timeline.map((g) => g.stage));

const issueGroup = timeline.find((g) => g.stage === "issue");
ok(!!issueGroup && issueGroup.photos.map((p) => p.id).join(",") === "c,f",
  "…and BOTH issue photos are in the timeline, unfeatured and featured alike — this is the office record, not the public gallery",
  issueGroup?.photos.map((p) => p.id));

const finishGroup = timeline.find((g) => g.stage === "finish");
ok(finishGroup.photos.map((p) => p.id).join(",") === "e,d",
  "…each group's photos are oldest-first (the 8th before the 10th)", finishGroup.photos.map((p) => p.id));

const progressGroup = timeline.find((g) => g.stage === "progress");
ok(!!progressGroup && progressGroup.photos[0].id === "b",
  "…and an UNFEATURED photo still shows up — this is not the featured-only gallery view");

ok(stageTimeline([]).length === 0, "no photos → no groups, not an error");
ok(stageTimeline([{ url: "https://x/y.jpg", stage: "nonsense", createdAt: "2026-01-01" }])
     .find((g) => g.stage === "progress")?.photos.length === 1,
  "an unrecognised stage buckets into 'progress' rather than being dropped from the record entirely");
ok(stageTimeline([{ stage: "start" }]).length === 0,
  "a row with no URL is dropped rather than rendered as a broken image");

section("2. The PUBLIC views in the same file still exclude issue and unfeatured photos");

// This is the regression that actually matters: stageTimeline and albums()
// live in the same file and must disagree about this on purpose.
const publicAlbums = albums(JOB_PHOTOS);
const allPublicPhotoIds = publicAlbums.flatMap((a) => a.photos.map((p) => p.id));
ok(!allPublicPhotoIds.includes("c"), "albums() never returns the unfeatured issue photo");
ok(!allPublicPhotoIds.includes("f"),
  "…and never the FEATURED issue photo either — the stage exclusion holds independently of the featured flag");
ok(!allPublicPhotoIds.includes("b"), "albums() never returns the unfeatured progress photo");
ok(allPublicPhotoIds.includes("a") && allPublicPhotoIds.includes("d"),
  "…but DOES return featured, non-issue photos — the filter is selective, not broken");

const pairs = beforeAfterPairs(JOB_PHOTOS);
ok(pairs.length === 1 && pairs[0].before.id === "a" && pairs[0].after.id === "d",
  "beforeAfterPairs pairs the featured start with the featured finish, skipping the issue and unfeatured shots entirely");

const stripResult = galleryStrip(JOB_PHOTOS, 24);
ok(!stripResult.some((p) => p.id === "c"), "galleryStrip never returns the unfeatured issue photo");
ok(!stripResult.some((p) => p.id === "f"), "…or the featured one — same independent stage check");
ok(hasGallery(JOB_PHOTOS.filter((p) => p.stage === "issue")) === false,
  "a job with ONLY issue photos (featured or not) has no public gallery at all");

section("3. buildPhotoReportData — the pure shape behind the PDF");

const reportData = buildPhotoReportData({
  job: { title: "Kitchen repaint" },
  client: { name: "Jane Homeowner" },
  photos: JOB_PHOTOS,
});
ok(reportData.hasPhotos === true, "hasPhotos is true when there are photos");
ok(reportData.photoCount === 6, "photoCount counts every photo, both issue photos included", reportData.photoCount);
ok(reportData.groups.find((g) => g.stage === "issue")?.photos.length === 2,
  "the REPORT (unlike the public views above) includes BOTH issue photos — it's the office's own evidence");

const zeroData = buildPhotoReportData({ job: { title: "Empty job" }, client: null, photos: [] });
ok(zeroData.hasPhotos === false, "hasPhotos is false with no photos");
ok(zeroData.groups.length === 0, "no groups with no photos");
ok(zeroData.jobTitle === "Empty job", "the job's title carries through even with no photos");

section("4. Every embedded photo is resized, never full resolution");

const allReportUrls = reportData.groups.flatMap((g) => g.photos.map((p) => p.url));
ok(allReportUrls.length === 6, "sanity: six photo urls made it into the report data");
ok(allReportUrls.every((u) => u.includes(`w_${REPORT_PHOTO_WIDTH}`)),
  "…and EVERY one carries the Cloudinary resize transform, not the original /upload/ URL",
  allReportUrls);
ok(allReportUrls.every((u) => !/\/upload\/v\d+\//.test(u)),
  "…none of them is the untransformed original (which would insert straight after /upload/ with no w_ segment)");

section("5. The report renders — including the zero-photo case, without throwing");

const emptyBuf = await renderJobPhotoReportPdfBuffer({
  job: { title: "No photos yet" },
  client: { name: "Test Client" },
  company: { name: "Test Co", brandColor: "#06356b" },
  photos: [],
  language: "en",
});
ok(Buffer.isBuffer(emptyBuf) && emptyBuf.length > 0, "zero-photo report resolves to a real, non-empty buffer");
ok(emptyBuf.slice(0, 4).toString() === "%PDF", "…and it's actually a PDF, not an empty or truncated stream");

section("6. Source-level: the route is company-scoped and permission-gated the way the sibling GET route is");

const ROUTE_PATH = "app/api/jobs/[id]/photo-report/pdf/route.js";
const ROUTE = strip(readFileSync(ROUTE_PATH, "utf8"));

ok(/export async function POST\(/.test(ROUTE), "the route is a POST, matching the quote/invoice PDF convention");

// Scoped to the jobPhoto.findMany CALL ITSELF, not the whole file — the job
// lookup a few lines above it also contains "companyId: member.companyId",
// and a version of this check that read the whole file would keep passing
// even if the PHOTO query's own scoping were deleted, because the OTHER
// occurrence still matches. Caught by mutation testing this file: removing
// scoping from just the photo query left the unscoped assertion green.
const PHOTO_QUERY_AT = ROUTE.indexOf("db.jobPhoto.findMany");
const PHOTO_QUERY_END = ROUTE.indexOf("});", PHOTO_QUERY_AT);
const photoQuery = ROUTE.slice(PHOTO_QUERY_AT, PHOTO_QUERY_END === -1 ? undefined : PHOTO_QUERY_END);
ok(PHOTO_QUERY_AT !== -1, "sanity: the photo query is where this check expects it");
ok(/companyId: member\.companyId/.test(photoQuery),
  "the photo query itself is scoped to the caller's own company", photoQuery);
ok(!/companyId:\s*(body|_?params)/.test(ROUTE), "…and never to a company id taken from the request");
ok(/assignedJobWhere\(full\)/.test(ROUTE), "the job lookup is scoped by the caller's job assignment, same as the GET route");
ok(/"view_only"/.test(ROUTE), "the gate is view-level — downloading the report needs no more than seeing the job");
// `levelOrRefusal(` — the CALL, not the import line a few lines up, which also
// contains the bare word "levelOrRefusal" and would make this pass even if
// the call itself moved after the photo read. Caught by mutation testing this
// file: the unscoped version of this check stayed green when a decoy photo
// read was inserted above the real gate call, because the import satisfied
// indexOf("levelOrRefusal") regardless of where the actual gate ran.
ok(ROUTE.indexOf("levelOrRefusal(") < ROUTE.indexOf("jobPhoto.findMany"),
  "the permission gate CALL runs BEFORE any photo is read");
ok(ROUTE.indexOf("db.job.findFirst") < ROUTE.indexOf("jobPhoto.findMany"),
  "…and the job is proven to exist and belong to this company/caller before its photos are read");
ok(!/requireMoney/.test(ROUTE),
  "no money gate — unlike the quote/invoice PDF routes, this document carries no prices to protect");

section("7. Source-level: the timeline is actually mounted on the job page");

const DETAIL = readFileSync("app/app/jobs/[id]/JobDetail.js", "utf8");
const TIMELINE = readFileSync("app/components/jobs/JobPhotoTimeline.js", "utf8");

ok(/<JobPhotoTimeline\b/.test(DETAIL), "JobPhotoTimeline is rendered on the job detail page");
ok(/from "@\/app\/components\/jobs\/JobPhotoTimeline"/.test(DETAIL), "…imported from the real component, not a stray duplicate");
ok(/stageTimeline\(/.test(TIMELINE), "the timeline component uses the shared stageTimeline grouping rather than re-deriving its own");
ok(/\/api\/jobs\/\$\{jobId\}\/photo-report\/pdf/.test(TIMELINE), "…and its download button points at the real report route");

section("8. Translation parity: the new document labels exist in every language this product ships in");

const languages = Object.keys(DOCUMENT_LABELS);
ok(languages.length >= 6, "sanity: still six-plus languages in the label catalogue", languages);
for (const lang of languages) {
  ok(typeof DOCUMENT_LABELS[lang].photoReport === "string" && DOCUMENT_LABELS[lang].photoReport.length > 0,
    `photoReport is translated for "${lang}"`);
  ok(typeof DOCUMENT_LABELS[lang].noPhotosNote === "string" && DOCUMENT_LABELS[lang].noPhotosNote.length > 0,
    `noPhotosNote is translated for "${lang}"`);
}

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);

}

main();
