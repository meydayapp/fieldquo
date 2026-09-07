// scripts/check-job-cost-review.mjs
//
//   npm run check:job-cost-review
//
// The close-out review, held end to end: completing a job raises the task,
// the review endpoint is gated like the job's own edit AND like the costing
// screen, it refuses a job that is not completed, it settles the task, the
// panel shows a prompt or a review date on every completed job (never
// neither), the page opens the review once after THIS screen completed the
// job, and every string the modal shows exists in all nine catalogues.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { jobCostReviewKey } from "../lib/tasks/autoCreate.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)?.slice(0, 200));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

ok("the task key is the job's own", jobCostReviewKey("j1") === "job_cost_review:j1");

const jobRoute = code("app/api/jobs/[id]/route.js");
ok("completing a job raises the cost-review task beside the review-request one",
  /if \(completing\) await taskForCompletedJob\(id\);[\s\S]{0,400}if \(completing\) await taskForJobCostReview\(id\);/.test(jobRoute));

const review = code("app/api/jobs/[id]/costing/review/route.js");
ok("the review endpoint proves the tenant and the assigned-jobs scope", /companyId: member\.companyId, \.\.\.assignedJobWhere\(full\)/.test(review));
ok("...is gated on the jobCosting toggle like the costing screen", /hasToggle\(full, "jobCosting"\)/.test(review));
ok("...and on the job's own EDIT level", /requireLevel\(full, "jobs", "view_create_edit", "edit jobs"\)/.test(review));
ok("...refuses a job that is not completed", /job\.status !== "completed"/.test(review) && /status: 409/.test(review));
ok("...stamps costReviewedAt and keeps the note", /costReviewedAt: new Date\(\), costReviewNote: note/.test(review));
ok("...and settles the task by its key", /resolveTaskBySource\(jobCostReviewKey\(job\.id\)\)/.test(review));
ok("...guarding request.json()", /catch \{\s*body = \{\};/.test(review));

const panel = code("app/components/jobs/JobCosting.js");
ok("the panel knows the job's status and review date", /export default function JobCosting\(\{ jobId, jobStatus, costReviewedAt, autoOpenReview = false, onReviewed \}\)/.test(panel));
ok("a completed job shows a review date OR a prompt — never neither", /jobStatus === "completed" && \(\s*costReviewedAt \? \(/.test(panel));
ok("a completed job with nothing recorded still renders (that is the job that needs asking)", /!hasUnattributed && !needsReview\)/.test(panel));
ok("the modal reloads the panel after adding an expense", /onChanged=\{\(\) => setReloadKey\(\(k\) => k \+ 1\)\}/.test(panel) && /\}, \[jobId, reloadKey\]\);/.test(panel));

const modal = code("app/components/jobs/CostReview.js");
ok("the modal adds expenses through the one expense API, tagged to the job", /fetch\("\/api\/expenses"/.test(modal) && /projectId: jobId/.test(modal));
ok("...links pending hours to where they are approved", /href="\/app\/payroll"/.test(modal));
ok("...and signs off through the review endpoint", /\/api\/jobs\/\$\{jobId\}\/costing\/review/.test(modal));
ok("...never swallows a failed request", /await reportResponseError\(res/.test(modal) && !/res\.ok\) \{[^}]*\}\s*$/.test(modal));

const page = code("app/app/jobs/[id]/JobDetail.js");
ok("the page opens the review once after it completed the job", /if \(status === "completed"\) setReviewPrompt\(true\);/.test(page));
ok("...and hands the panel the job's status and review date", /jobStatus=\{job\.status\}[\s\S]{0,80}costReviewedAt=\{job\.costReviewedAt\}[\s\S]{0,80}autoOpenReview=\{reviewPrompt\}/.test(page));

const schema = read("prisma/schema.prisma");
ok("Job carries costReviewedAt and costReviewNote", /costReviewedAt\s+DateTime\?/.test(schema) && /costReviewNote\s+String\?/.test(schema));

// Every key the modal and the close-out card use, in all nine catalogues.
// The panel's OLDER keys are deliberately not swept here: ten of them
// (contractValue, noQuoteNote, unattributedNote, unattributedFix, …) predate
// this and exist in two to six languages — a gap named in docs/ROADMAP.md,
// not one this check can honestly pin on the close-out.
const catalogue = read("app/i18n/appMessages.js");
const CARD_KEYS = ["reviewCardTitle", "reviewCardBody", "reviewButton", "reviewedOn", "reviewAgain"].map((k) => `app.jobCosting.${k}`);
const keys = [...new Set([...modal.matchAll(/t\(\s*"(app\.jobCosting\.[a-zA-Z_]+)"/g)].map((m) => m[1]).concat(CARD_KEYS))];
const catKeys = ["materials", "subcontractor", "equipment", "other"].map((c) => `app.jobCosting.cat_${c}`);
for (const k of [...keys, ...catKeys]) {
  const n = (catalogue.match(new RegExp(`"${k.replace(/\./g, "\\.")}": `, "g")) || []).length;
  ok(`${k} exists in all nine catalogues`, n === 9, n);
}

console.log(`\ncheck-job-cost-review: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
