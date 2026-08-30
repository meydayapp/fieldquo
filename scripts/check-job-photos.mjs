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

console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}`);
process.exit(fail ? 1 : 0);
