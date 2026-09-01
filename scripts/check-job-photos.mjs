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

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
