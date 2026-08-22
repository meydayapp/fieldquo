// scripts/check-job-deletion.mjs
//
// Two things the owner found by looking for a button that wasn't there.
//
// 1. DELETE /api/jobs/[id] existed with NOTHING calling it — a job could not
//    be removed from the UI at all. Worse, adding a button naively would have
//    shipped a 500: Task and TimeEntry reference Job with Prisma's default
//    referential action, which is Restrict, so the delete throws a
//    foreign-key error on any job with logged hours or an auto-created task —
//    i.e. most real ones.
//
// 2. The "Schedule the job for X" task only closed when a VISIT was created.
//    A job that was cancelled, or completed without a visit, left the task
//    open still asserting there was work to book. The owner cancelled two QA
//    jobs and the task stayed.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-job-deletion.mjs

import { readFileSync } from "node:fs";

let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (!ok) fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};
const read = (r) => readFileSync(new URL(r, import.meta.url), "utf8");

const ROUTE = read("../app/api/jobs/[id]/route.js");
const PAGE = read("../app/app/jobs/[id]/JobDetail.js");
const SCHEMA = read("../prisma/schema.prisma");
const MODAL = read("../app/components/admin/DeleteConfirmModal.js");

console.log("\nThe restrict relations that make a naive delete throw");
// If either of these gains an explicit onDelete later, this guard should be
// revisited rather than silently passing.
const jobRefs = SCHEMA.match(/job\s+Job\?\s+@relation\(fields: \[jobId\][^)]*\)/g) || [];
t("Job is referenced by other models at all", jobRefs.length > 0);
t("the route counts tasks before deleting", /db\.task\.count\(\{ where: \{ jobId: id \} \}\)/.test(ROUTE));
t("the route counts time entries before deleting",
  /db\.timeEntry\.count\(\{ where: \{ jobId: id \} \}\)/.test(ROUTE));
t("it refuses with 409, not a 500", /status: 409/.test(ROUTE));
t("the refusal names what is attached", /reasons\.join/.test(ROUTE));
t("...and offers the alternative", /Cancelled instead/.test(ROUTE));
t("the count runs BEFORE the delete",
  ROUTE.indexOf("db.timeEntry.count") < ROUTE.indexOf("db.job.delete"));

console.log("\nDeleting is gated on the grid, not on a role");
// An owner who doesn't want Managers deleting jobs lowers their Jobs
// permission — which is now editable per person. A hardcoded role check here
// would contradict the grid.
t("the route requires the delete LEVEL",
  /requireLevel\(full, "jobs", "view_create_edit_delete"/.test(ROUTE));
t("the page asks the same question", /hasLevel\(caller, "jobs", "view_create_edit_delete"\)/.test(PAGE));
t("no hardcoded role check on the button", !/yourRole === "owner"|role === "admin"/.test(PAGE));

console.log("\nThe button exists and confirms");
t("a delete control is rendered", /setConfirmDelete\(true\)/.test(PAGE));
t("it opens a confirmation", /<DeleteConfirmModal/.test(PAGE));
t("the confirmation names the job", /itemName=\{job\.title\}/.test(PAGE));
t("a server refusal is surfaced verbatim", /d\?\.error \|\|/.test(PAGE));

console.log("\nThe modal no longer closes before it knows the outcome");
// It used to call onConfirm() and onClose() together, so a refusal arrived
// with the dialog already gone and nothing tying the message to the attempt.
t("onConfirm is not paired with onClose", !/onConfirm\(\);\s*\n\s*onClose\(\);/.test(MODAL));
t("it supports a busy state", /busy = false/.test(MODAL));
t("both buttons disable while busy",
  (MODAL.match(/disabled=\{busy\}/g) || []).length >= 2);

console.log("\nThe stale task closes on more than just scheduling");
t("cancelling closes it", /status === "cancelled"/.test(ROUTE));
t("completing closes it", /status === "completed"/.test(ROUTE));
t("only on an actual change", /existing\.status !== status/.test(ROUTE));
t("keyed off the quote, which is what the task was keyed off",
  /quote_accepted:\$\{existing\.quoteId\}/.test(ROUTE));
t("deleting the job closes it too",
  (ROUTE.match(/resolveTaskBySource/g) || []).length >= 2);
t("the deletion is recorded", /action: "job\.deleted"/.test(ROUTE));

console.log("\nA quote that became an invoice explains itself");
const QUOTE = read("../app/api/quotes/[id]/route.js");
t("it refuses with 409", /status: 409/.test(QUOTE));
t("...naming the invoice", /existing\.invoices\[0\]\.invoiceNumber/.test(QUOTE));
t("...and saying what to do instead", /void the invoice/.test(QUOTE));

console.log(fail ? `\n${fail} FAILED\n` : "\nALL PASS — jobs can be deleted, or told why not\n");
process.exit(fail ? 1 : 0);
