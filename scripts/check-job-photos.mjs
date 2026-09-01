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
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  memberCanSeeJob,
  mentionableMembersForJob,
  resolveMentions,
} from "@/lib/photoComments/mentionable";
import { notifyMentions } from "@/lib/photoComments/notify";
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
// straight into the PATCH handler below it, which uses the same permission
// string — so downgrading one gate without the other passed cleanly, because
// the assertion was reading the wrong handler's. Mutation testing caught it;
// the fix is to end the slice at the next export.
const POST_AT = ROUTE.indexOf("export async function POST");
const NEXT_EXPORT = ROUTE.indexOf("export async function", POST_AT + 10);
const postBody = ROUTE.slice(POST_AT, NEXT_EXPORT === -1 ? undefined : NEXT_EXPORT);
const PATCH_AT = ROUTE.indexOf("export async function PATCH");
const patchBody = ROUTE.slice(PATCH_AT);

ok(
  postBody.indexOf("levelOrRefusal") < postBody.indexOf("createMany"),
  "the permission gate runs BEFORE anything is written",
);
// ── Was "view_create_edit" ─────────────────────────────────────────────────
//
// That level matched PATCH exactly and was the actual bug: it required MORE
// of the web upload control than lib/crew/inbox.js has ever required of the
// same act by SMS (no `jobs` permission check there at all — only a Worker
// roster match), and it sat above every level the Crew preset has ever held.
// scripts/check-crew-access.mjs already proves Crew stays at jobs:view_only;
// this proves the upload route now actually admits that tier, which is the
// whole reason the change was made — see the comment above levelOrRefusal in
// the route.
ok(
  /"view_only"/.test(postBody),
  "uploading is gated at view_only — the same level GET uses, so Crew (jobs:view_only) can reach the button the panel already shows them",
);
ok(
  !/"view_create_edit"/.test(postBody),
  "…and NOT at view_create_edit, which Crew has never held — that was the dead-button gap",
);
ok(
  postBody.indexOf("db.job.findFirst") < postBody.indexOf("createMany"),
  "…and the job is proven to exist and be theirs first",
);
// ── The assertion the level check quietly needed ──────────────────────────
//
// Lowering this gate to view_only was correct — Crew never held
// view_create_edit, so the upload button the panel already rendered for them
// 403'd for every one of them. But it moved load onto the OTHER half of the
// rule: assignedJobWhere() is now the only thing stopping a crew member
// restricted to their own jobs from filing a photo against any job in the
// company.
//
// Nothing asserted that. Deleting assignedJobWhere(full) from this handler
// passed both this script and check-tenant-scope cleanly — verified by
// mutation before writing this. A permission check that proves the LEVEL and
// not the SCOPE is only half a check, and the half it skipped is the half
// that got harder.
ok(
  /assignedJobWhere\(full\)/.test(postBody),
  "…and narrowed to jobs this member is actually on — view_only alone would otherwise let a crew member file a photo against any job in the company",
);
ok(
  postBody.indexOf("assignedJobWhere") < postBody.indexOf("createMany"),
  "…with that narrowing applied BEFORE anything is written",
);

section("3b. Curating a photo (feature it, re-stage it) stays a higher bar");

ok(
  /"view_create_edit"/.test(patchBody),
  "PATCH — feature/stage/caption — still requires view_create_edit: lowering POST's bar was deliberately scoped to uploading only",
);
ok(
  patchBody.indexOf("levelOrRefusal") < patchBody.indexOf("db.jobPhoto.update"),
  "…and that gate also runs before anything is written",
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

section("6. Curation controls disappear for someone who can't use them — not just disabled");

ok(
  /useHasLevel\("jobs", "view_create_edit"\)/.test(CURATOR),
  "the curator asks the same grid the server enforces, client-side, before offering a curation control",
);
ok(
  /\{canCurate && \(/.test(CURATOR),
  "the star button is conditionally RENDERED for a non-curator, not merely disabled — a disabled star still tells Crew a decision exists that isn't theirs",
);
ok(
  /\{canCurate \? \(/.test(CURATOR),
  "…and the stage editor falls back to read-only text instead of a <select> a non-curator could open and submit",
);
ok(/<MessageCircle/.test(CURATOR), "the comment button is on every photo card");
ok(/onComment=\{\(\) => setCommentingOn\(p\)\}/.test(CURATOR), "…and opens the thread for THAT photo, not a shared one");

section("7. The comment route: internal, scoped, and mentions are re-validated at write time");

const COMMENTS_ROUTE = strip(
  readFileSync("app/api/jobs/[id]/photos/[photoId]/comments/route.js", "utf8"),
);
const MENTIONABLE_ROUTE = strip(readFileSync("app/api/jobs/[id]/mentionable/route.js", "utf8"));

ok(/export async function GET\(/.test(COMMENTS_ROUTE), "comments can be read");
ok(/export async function POST\(/.test(COMMENTS_ROUTE), "…and written");
ok(
  (COMMENTS_ROUTE.match(/memberOrRefusal\(request\)/g) || []).length === 2,
  "both handlers require a real company member — a homeowner has no Member row, so this alone keeps a client-facing surface out",
);
ok(
  (COMMENTS_ROUTE.match(/"jobs",\s*\n?\s*"view_only"/g) || []).length >= 2 ||
    (COMMENTS_ROUTE.match(/"view_only"/g) || []).length >= 2,
  "both handlers gate at jobs:view_only, the same bar as seeing the photo at all — Crew can comment on their own jobs",
);
ok(
  /jobId, companyId, \.\.\.assignedJobWhere\(full\)/.test(COMMENTS_ROUTE),
  "the job is scoped by the caller's assignment before anything about the photo is even looked up",
);
ok(
  /db\.jobPhoto\.findFirst\(\{\s*\n\s*where: \{ id: photoId, jobId, companyId \}/.test(COMMENTS_ROUTE),
  "…and the photo has to belong to BOTH this job and this company — a photo id from another job, or a deleted one, is a 404",
);
ok(
  /resolveMentions\(db, \{/.test(COMMENTS_ROUTE),
  "mention ids are re-resolved against the LIVE grid at write time, not trusted from whatever the picker showed at page-load",
);
ok(
  /requestedMemberIds: body\?\.mentionMemberIds/.test(COMMENTS_ROUTE),
  "…reading the caller-supplied ids from the body rather than assuming shape",
);
ok(
  /notifyMentions\(\{/.test(COMMENTS_ROUTE) && !/await notifyMentions\(/.test(COMMENTS_ROUTE),
  "notification is fired WITHOUT awaiting it — a Twilio/Resend outage must not turn a saved comment into a failed request",
);
ok(
  /notifyMentions\(\{[\s\S]{0,400}\}\)\.catch\(/.test(COMMENTS_ROUTE),
  "…and its own failure is caught rather than left to become an unhandled rejection",
);
ok(
  /if \(mentionMemberIds\.length\) \{\s*\n\s*notifyMentions\(\{/.test(COMMENTS_ROUTE),
  "…and it's only fired at all when there's something to notify — guarded immediately, not just somewhere earlier in the file",
);
ok(
  /text\.trim\(\)\.slice\(0, MAX_BODY_CHARS\)|slice\(0, MAX_BODY_CHARS\)/.test(COMMENTS_ROUTE),
  "an empty or absurdly long body can't be posted",
);
ok(/status: 400/.test(COMMENTS_ROUTE), "…refused as a 400, not saved empty");

ok(/export async function GET\(/.test(MENTIONABLE_ROUTE), "the mention picker's own endpoint exists");
ok(
  /m\.memberId !== member\.id/.test(MENTIONABLE_ROUTE),
  "the picker never offers the caller their own name — mentioning yourself notifies nobody",
);

section("8. Who can be @mentioned — executed against hostile input, not just read");

// ── memberCanSeeJob: pure ────────────────────────────────────────────────
ok(memberCanSeeJob(null, new Set()) === false, "a null member sees nothing");
ok(
  memberCanSeeJob({ role: "owner", permissions: null }, new Set()) === true,
  "an unscoped member (owner, admin, Dispatcher, Manager, Estimator) always sees the job, regardless of assignment",
);
const CREW_ROW = { role: "employee", permissions: { jobs: "view_only", clientsProperties: "name_address_only" }, userId: "u-crew" };
ok(
  memberCanSeeJob(CREW_ROW, new Set(["u-crew"])) === true,
  "a scoped Crew member sees a job they're assigned to",
);
ok(
  memberCanSeeJob(CREW_ROW, new Set(["someone-else"])) === false,
  "…and NOT one they aren't — this is the exact hole named: don't offer to mention someone who can't see the job",
);
ok(
  memberCanSeeJob({ ...CREW_ROW, userId: null }, new Set(["u-crew"])) === false,
  "a scoped member with no userId matches nothing, rather than falling open",
);

// ── resolveMentions: executed against a stub db, hostile input ──────────
function stubDb({ visits = [], members = [] } = {}) {
  return {
    job: {
      findFirst: async ({ where }) =>
        where.id === "job-1" && where.companyId === "co-1" ? { visits } : null,
    },
    member: {
      findMany: async () => members,
    },
  };
}

const MANAGER = (id, extra = {}) => ({
  id,
  userId: `u-${id}`,
  role: "supervisor",
  permissions: { jobs: "view_create_edit" }, // unscoped: sees every job
  user: { id: `u-${id}`, name: id },
  ...extra,
});
const CREW = (id, assignedUserId) => ({
  id,
  userId: `u-${id}`,
  role: "employee",
  permissions: { jobs: "view_only", clientsProperties: "name_address_only" },
  user: { id: `u-${id}`, name: id },
});

{
  const db = stubDb({
    visits: [{ assignedToId: "u-crewA" }],
    members: [MANAGER("mgr"), CREW("crewA"), CREW("crewB")],
  });
  const eligible = await mentionableMembersForJob(db, { companyId: "co-1", jobId: "job-1" });
  const ids = eligible.map((m) => m.memberId).sort();
  ok(
    ids.join(",") === "crewA,mgr",
    "mentionable = unscoped members + only the scoped ones actually on this job",
    ids,
  );

  ok(
    (await mentionableMembersForJob(db, { companyId: "co-1", jobId: "no-such-job" })).length === 0,
    "a job that doesn't exist (or isn't this company's) offers nobody — not found, not an open list",
  );

  const authoredByMgr = await resolveMentions(db, {
    companyId: "co-1",
    jobId: "job-1",
    authorMemberId: "mgr",
    requestedMemberIds: ["mgr", "crewA", "crewB", "not-a-real-id", "crewA"],
  });
  ok(
    authoredByMgr.sort().join(",") === "crewA",
    "self-mention dropped (mgr mentioning mgr), scoped-off member dropped (crewB, not on this job), unknown id dropped, duplicate collapsed",
    authoredByMgr,
  );

  const otherTenant = await resolveMentions(db, {
    companyId: "co-2", // a different company than the job/members belong to
    jobId: "job-1",
    authorMemberId: "mgr",
    requestedMemberIds: ["crewA"],
  });
  ok(
    otherTenant.length === 0,
    "a mention resolved against the WRONG company (the job lookup itself is companyId-scoped) offers nobody",
  );

  const manyMembers = Array.from({ length: 30 }, (_, i) => MANAGER(`m${i}`));
  const bigDb = stubDb({ visits: [], members: manyMembers });
  const capped = await resolveMentions(bigDb, {
    companyId: "co-1",
    jobId: "job-1",
    authorMemberId: "m0",
    requestedMemberIds: manyMembers.map((m) => m.id),
  });
  ok(capped.length <= 20, "five people at once works fine; an unbounded fan-out is capped", capped.length);
}

section("9. Reaching a mentioned crew member — executed with fake channels, not real Twilio/Resend");

function notifyDb({ mention = {}, crewLine = null, updates = [] } = {}) {
  return {
    jobPhoto: { findFirst: async () => ({ id: "photo-1" }) },
    company: { findUnique: async () => ({ name: "Acme Painting" }) },
    job: { findUnique: async () => ({ title: "Kitchen repaint", client: { name: "J. Rivera" } }) },
    member: {
      findUnique: async () => ({ user: { name: "Sam" } }),
      findMany: async () => [mention],
    },
    crewInboxNumber: { findUnique: async () => crewLine },
    jobPhotoMention: {
      updateMany: async (args) => {
        updates.push(args);
        return { count: 1 };
      },
    },
  };
}

async function runNotify({ mention, crewLine, sendSms, maySms, canReply = true, sendOk = true, resendOk = true }) {
  const updates = [];
  const db = notifyDb({ mention, crewLine, updates });
  await notifyMentions(
    {
      commentId: "c1",
      photoId: "photo-1",
      jobId: "job-1",
      companyId: "co-1",
      authorMemberId: "author-1",
      mentionMemberIds: ["mem-1"],
    },
    {
      db,
      sendSms: sendSms || (async () => ({ success: sendOk, sid: "SM123" })),
      maySms: maySms || (async () => true),
      crewSpendFor: async () => ({ canReply }),
      chargeOutboundCrewReply: async () => ({}),
      resend: { emails: { send: async () => { if (!resendOk) throw new Error("resend down"); } } },
    },
  );
  return updates[0]?.data;
}

const CONNECTED_LINE = { e164: "+15145551234", connectedAt: new Date() };

ok(
  (await runNotify({ mention: { id: "mem-1", user: { email: "a@x.com", workerProfile: { phone: "5145550000" } } }, crewLine: CONNECTED_LINE }))
    .notifiedVia === "sms",
  "a crew member with a phone and a connected crew line gets texted, not emailed",
);
ok(
  (await runNotify({ mention: { id: "mem-1", user: { email: "a@x.com", workerProfile: { phone: "5145550000" } } }, crewLine: null }))
    .notifiedVia === "email",
  "no crew line set up → falls back to email rather than texting from a number with no established relationship to that phone",
);
ok(
  (await runNotify({ mention: { id: "mem-1", user: { email: null, workerProfile: { phone: "5145550000" } } }, crewLine: null }))
    .skipReason === "crew_line_not_set_up",
  "…and if there's no email to fall back to either, the reason is recorded rather than the mention silently vanishing",
);
ok(
  (await runNotify({
    mention: { id: "mem-1", user: { email: "a@x.com", workerProfile: { phone: "5145550000" } } },
    crewLine: CONNECTED_LINE,
    maySms: async () => false,
  })).notifiedVia === "email",
  "opted out of SMS (STOP) → never texted, falls back to email instead of being silently dropped",
);
ok(
  (await runNotify({
    mention: { id: "mem-1", user: { email: null, workerProfile: { phone: "5145550000" } } },
    crewLine: CONNECTED_LINE,
    maySms: async () => false,
  })).skipReason === "opted_out",
  "…and with no email to fall back to, the STOP is the recorded reason — never sent anyway",
);
ok(
  (await runNotify({ mention: { id: "mem-1", user: { email: "a@x.com" } }, crewLine: CONNECTED_LINE }))
    .notifiedVia === "email",
  "a member with no Worker phone at all (most non-crew tiers) goes straight to email",
);
ok(
  (await runNotify({ mention: { id: "mem-1", user: { email: null } }, crewLine: null })).skipReason ===
    "no_channel",
  "no phone and no email → recorded as unreachable, not silently skipped",
);

{
  // The photo was deleted between the comment landing and this running.
  const updates = [];
  const db = notifyDb({ updates });
  db.jobPhoto.findFirst = async () => null;
  await notifyMentions(
    { commentId: "c1", photoId: "gone", jobId: "job-1", companyId: "co-1", authorMemberId: "a1", mentionMemberIds: ["mem-1"] },
    { db },
  );
  ok(updates.length === 0, "a comment on a photo that's gone by send-time updates nothing and throws nothing");
}

{
  // notifyMentions itself never re-adds the author — resolveMentions already
  // dropped them before this ever runs — but it must not crash on an empty list.
  const updates = [];
  const db = notifyDb({ updates });
  await notifyMentions(
    { commentId: "c1", photoId: "photo-1", jobId: "job-1", companyId: "co-1", authorMemberId: "a1", mentionMemberIds: [] },
    { db },
  );
  ok(updates.length === 0, "no mentions on this comment → no notification work at all");
}

section("10. Comments stay off every client-facing surface");

const SCHEMA = readFileSync("prisma/schema.prisma", "utf8");
ok(/model JobPhotoComment/.test(SCHEMA), "the comment model exists");
ok(/model JobPhotoMention/.test(SCHEMA), "…and the mention/delivery model exists");
ok(
  /jobPhotoId String\s*\n\s*jobPhoto\s+JobPhoto @relation\(fields: \[jobPhotoId\], references: \[id\], onDelete: Cascade\)/.test(SCHEMA),
  "a comment is deleted along with its photo — nothing survives to point at a photo that no longer exists",
);

const SITE_GALLERY = readFileSync("lib/site/jobPhotos.js", "utf8");
ok(
  !/comment/i.test(SITE_GALLERY),
  "the public gallery's own file never mentions comments — it hand-picks { url } and nothing else",
);
const PHOTO_REPORT = readFileSync("lib/jobs/photoReport.js", "utf8");
ok(
  !/comment/i.test(PHOTO_REPORT),
  "the photo-report PDF's data builder never mentions comments either",
);
const PHOTO_REPORT_ROUTE = strip(
  readFileSync("app/api/jobs/[id]/photo-report/pdf/route.js", "utf8"),
);
ok(
  !/comment/i.test(PHOTO_REPORT_ROUTE),
  "…nor does the route that feeds it — its own `select` is a fixed, explicit field list",
);

// Every reference to the new Prisma delegates, anywhere under app/, has to be
// one of the two routes this feature added. A generic-include somewhere else
// (a client portal endpoint, a self-quote route) would show up here as an
// extra file.
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (entry.endsWith(".js")) out.push(full);
  }
  return out;
}
const APP_FILES = walk("app");
const TOUCHES_COMMENT_MODEL = APP_FILES.filter((f) => {
  const text = readFileSync(f, "utf8");
  return /db\.jobPhotoComment|db\.jobPhotoMention/.test(text);
});
const EXPECTED = new Set([
  join("app", "api", "jobs", "[id]", "photos", "[photoId]", "comments", "route.js"),
]);
const unexpected = TOUCHES_COMMENT_MODEL.filter((f) => !EXPECTED.has(f));
ok(
  unexpected.length === 0,
  "no file under app/ touches the comment/mention tables except the one route that owns them",
  unexpected,
);
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
// PATCH_AT/patchBody are already derived once near the top of this file, for
// the permission assertions — reusing them rather than shadowing, which is
// what the merge of two parallel worktrees produced here.
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
