// scripts/check-appointment-family.mjs
//
//   npm run check:appointment-family
//
// One job, one family of linked records. An appointment booked against a
// quote, a job or an invoice is filled with the other two links from that
// record's own (lib/schedule/appointmentFamily.js) — NULLs only, the same
// company only, never a guess between two — and each record page lists the
// whole family's appointments. Runs the pure rules against hostile input,
// the loader against a scripted database (another tenant's ids), and holds
// the routes and pages to the wiring. Judged by exit code.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  familyOf,
  familyFill,
  isQuoteMeasure,
  aboutKindOf,
  legacyAboutKind,
  resolveFamily,
  familyIds,
  familyAppointmentWhere,
} from "@/lib/schedule/appointmentFamily";
import { aboutLabel } from "@/lib/schedule/appointmentAbout";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}

// The real case (TrueFinish): the invoice has quoteId and NO jobId; the job
// hangs off the quote. Plus another tenant whose ids must never cross.
const CO = "co_tf";
const OTHER = "co_x";
const rows = {
  quotes: [
    { id: "q22", companyId: CO },
    { id: "q_other", companyId: OTHER },
  ],
  jobs: [
    { id: "j22", companyId: CO, quoteId: "q22" },
    { id: "j_other", companyId: OTHER, quoteId: "q22" }, // another tenant claiming the same quote id
  ],
  invoices: [
    { id: "inv22", companyId: CO, quoteId: "q22", jobId: null, parentInvoiceId: null },
    { id: "inv_other", companyId: OTHER, quoteId: "q22", jobId: "j22", parentInvoiceId: null },
  ],
};

console.log("\nThe family of one record\n");
{
  const f = familyOf({ kind: "invoice", id: "inv22", companyId: CO, rows });
  ok("Maureen's appointment (invoice only) → the quote and the job, via the invoice's quote", f.invoiceId === "inv22" && f.quoteId === "q22" && f.jobId === "j22", f);
  const j = familyOf({ kind: "job", id: "j22", companyId: CO, rows });
  ok("from the job → its quote and the one invoice", j.quoteId === "q22" && j.invoiceId === "inv22", j);
  const q = familyOf({ kind: "quote", id: "q22", companyId: CO, rows });
  ok("from the quote → its job and its invoice", q.jobId === "j22" && q.invoiceId === "inv22", q);
  const cross = familyOf({ kind: "invoice", id: "inv_other", companyId: CO, rows });
  ok("another tenant's invoice id → nothing at all", cross.quoteId === null && cross.jobId === null && cross.invoiceId === null, cross);
  const crossJob = familyOf({ kind: "job", id: "j_other", companyId: CO, rows });
  ok("another tenant's job id → nothing", Object.values(crossJob).every((v) => v === null), crossJob);
  const theirs = familyOf({ kind: "quote", id: "q22", companyId: OTHER, rows });
  ok("the other tenant asking about q22 → q22 isn't theirs → nothing", Object.values(theirs).every((v) => v === null), theirs);

  const two = { ...rows, invoices: [...rows.invoices, { id: "inv23", companyId: CO, quoteId: null, jobId: "j22", parentInvoiceId: null }] };
  const amb = familyOf({ kind: "job", id: "j22", companyId: CO, rows: two });
  ok("two invoice families on one job → invoiceId left empty, not guessed", amb.invoiceId === null && amb.quoteId === "q22", amb);
  const versions = { ...rows, invoices: [...rows.invoices, { id: "inv22v2", companyId: CO, quoteId: "q22", jobId: null, parentInvoiceId: "inv22" }] };
  const v = familyOf({ kind: "job", id: "j22", companyId: CO, rows: versions });
  ok("v1 + v2 of one invoice count once, by the root", v.invoiceId === "inv22", v);
  const twoJobs = { ...rows, jobs: [...rows.jobs, { id: "j22b", companyId: CO, quoteId: "q22" }] };
  ok("two jobs on one quote → jobId left empty", familyOf({ kind: "quote", id: "q22", companyId: CO, rows: twoJobs }).jobId === null);
  ok("hostile input → nothing, no throw", [
    familyOf(),
    familyOf({ kind: "boat", id: "x", companyId: CO, rows }),
    familyOf({ kind: "job", id: { in: ["j22"] }, companyId: CO, rows }),
    familyOf({ kind: "job", id: "j22", companyId: "", rows }),
    familyOf({ kind: "job", id: "j22", companyId: CO, rows: { jobs: "x", quotes: null, invoices: [null, 5] } }),
  ].every((r) => r.quoteId === null && r.jobId === null && r.invoiceId === null));
}

console.log("\nThe fill: NULLs only, never clientId\n");
{
  const fam = { quoteId: "q22", jobId: "j22", invoiceId: "inv22" };
  const f = familyFill({ quoteId: null, jobId: null, invoiceId: "inv22", aboutKind: null, clientId: "husband" }, fam, "invoice");
  ok("fills quoteId and jobId, records aboutKind invoice", f.quoteId === "q22" && f.jobId === "j22" && !("invoiceId" in f) && f.aboutKind === "invoice", f);
  ok("never writes clientId", !("clientId" in f));
  const keep = familyFill({ quoteId: "q_typed_by_office", jobId: null, invoiceId: "inv22", aboutKind: "job" }, fam, "invoice");
  ok("a set link is never overwritten, nor a set aboutKind", !("quoteId" in keep) && keep.jobId === "j22" && !("aboutKind" in keep), keep);
  ok("an empty family writes nothing", Object.keys(familyFill({ quoteId: null, jobId: null, invoiceId: null }, {}, null)).length === 0);
  ok("'' counts as null, junk aboutKind is replaced", familyFill({ quoteId: "", aboutKind: "boat" }, fam, "job").quoteId === "q22" && familyFill({ aboutKind: "boat" }, fam, "job").aboutKind === "job");
}

console.log("\nWhat it is about stays what it was booked about\n");
{
  const filled = { quoteId: "q22", jobId: "j22", invoiceId: "inv22", aboutKind: "job", quote: { id: "q22", quoteNumber: "Q-22" }, job: { id: "j22", title: "Kitchen" }, invoice: { id: "inv22", invoiceNumber: "INV-22" } };
  ok("a job appointment with the family filled is labelled as the JOB", aboutLabel(filled)?.kind === "job", aboutLabel(filled));
  ok("…and is not the estimator's measure", isQuoteMeasure(filled) === false);
  ok("a measure booked on the quote, family filled → still the measure, labelled the quote", isQuoteMeasure({ ...filled, aboutKind: "quote" }) && aboutLabel({ ...filled, aboutKind: "quote" })?.kind === "quote");
  ok("a legacy row with only quoteId is a measure", isQuoteMeasure({ quoteId: "q22" }) && !isQuoteMeasure({ quoteId: "q22", jobId: "j22" }));
  ok("a legacy row's label is unchanged (invoice, else job, else quote)", aboutLabel({ job: { id: "j", title: "t" }, invoice: { id: "i", invoiceNumber: "n" } })?.kind === "invoice" && legacyAboutKind({ jobId: "j", quoteId: "q" }) === "job");
  ok("aboutKind naming a link that is gone falls back to the legacy reading", aboutKindOf({ aboutKind: "invoice", invoiceId: null, jobId: "j" }) === "job");
  ok("a redacted invoice (no object) falls back, never names what it can't show", aboutLabel({ ...filled, aboutKind: "invoice", invoice: null })?.kind === "job");
}

// ── The loader against a scripted database ─────────────────────────────────
function matches(row, where) {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (k === "OR") return cond.some((w) => matches(row, w));
    const v = row[k];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      if ("in" in cond) return cond.in.includes(v);
      return false;
    }
    if (cond === null) return v == null;
    return v === cond;
  });
}
const table = { quote: rows.quotes, job: rows.jobs, invoice: rows.invoices };
const db = new Proxy({}, {
  get: (_, name) => ({
    findFirst: async ({ where }) => (table[name] || []).find((r) => matches(r, where)) || null,
    findMany: async ({ where }) => (table[name] || []).filter((r) => matches(r, where)),
  }),
});
console.log("\nThe loader, company-scoped\n");
{
  const f = await resolveFamily(db, CO, { kind: "invoice", id: "inv22" });
  ok("resolveFamily(invoice) on the real shape → quote + job", f.quoteId === "q22" && f.jobId === "j22" && f.invoiceId === "inv22", f);
  const x = await resolveFamily(db, CO, { kind: "invoice", id: "inv_other" });
  ok("resolveFamily with another tenant's invoice id → nothing", Object.values(x).every((v) => v === null), x);
  const y = await resolveFamily(db, OTHER, { kind: "quote", id: "q22" });
  ok("resolveFamily from the other tenant on our quote id → nothing", Object.values(y).every((v) => v === null), y);
  const ids = await familyIds(db, CO, { jobIds: ["j22"] });
  ok("familyIds from the job page → its quote and its invoice, none of the other tenant's", ids.quoteIds.includes("q22") && ids.invoiceIds.includes("inv22") && !ids.invoiceIds.includes("inv_other") && !ids.jobIds.includes("j_other"), ids);
  const w = familyAppointmentWhere(CO, ids);
  ok("the family where is company-scoped", w.companyId === CO && Array.isArray(w.OR) && w.OR.length === 3, w);
  ok("an empty family → no query at all", familyAppointmentWhere(CO, {}) === null);
}

console.log("\nThe wiring\n");
{
  const post = decomment(read("app/api/appointments/route.js"));
  ok("POST fills the family from the picked record, and records aboutKind", /resolveFamily\(db, member\.companyId, about\)/.test(post) && /aboutKind: about\.kind/.test(post));
  const patch = decomment(read("app/api/appointments/[id]/route.js"));
  ok("PATCH fills the family on a relink and on any edit, NULLs only", /resolveFamily\(db, member\.companyId/.test(patch) && /familyFill\(/.test(patch));
  ok("PATCH logs a measure only for a quote measure, not any row with a quoteId", /isQuoteMeasure\(existing\)/.test(patch));
  for (const [file, label] of [
    ["app/api/jobs/[id]/route.js", "job"],
    ["app/api/quotes/[id]/route.js", "quote"],
    ["app/api/invoices/[id]/route.js", "invoice"],
  ]) {
    ok(`${label} GET loads the family's appointments`, /loadFamilyAppointments\(\s*db,\s*member\.companyId,/.test(decomment(read(file))));
  }
  ok("job page lists the family", /familyAppointments/.test(read("app/app/jobs/[id]/JobDetail.js")));
  ok("quote page lists the family", /familyAppointments/.test(read("app/app/quotes/[id]/page.js")));
  ok("invoice page lists the family", /familyAppointments/.test(read("app/app/invoices/[id]/page.js")));
  ok("each row links to the others (SiteVisitRows familyLinks)", /familyLinks/.test(read("app/components/quotes/SiteVisitPanel.js")));
  ok("the calendar's detail links to the job, quote and invoice", /familyLabels\(appt\)/.test(read("app/app/appointments/page.js")));
  ok("the backfill only fills NULLs (COALESCE) and is read-only without --apply", /coalesce\("quoteId", \$2\)/.test(read("scripts/backfill-appointment-family.mjs")) && /BEGIN TRANSACTION READ ONLY/.test(read("scripts/backfill-appointment-family.mjs")));
  for (const [code, dict] of Object.entries(APP_MESSAGES)) {
    ok(`app.appts.family* strings in ${code}`, ["app.appts.familyHeading", "app.appts.openAbout"].every((k) => k in dict));
  }
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
