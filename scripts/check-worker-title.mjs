// scripts/check-worker-title.mjs
//
// A person's JOB TITLE (Receptionist, Foreman) is a different word from their
// SEAT (Owner / Administrator / Manager / Worker). The owner asked for the two
// to stop being one: "add a title that is more honorific … so some are only
// used for the seat and not for the crew, so that there is no confusion."
//
// What this guards, in order:
//   1. The field exists and is written by EVERY route that creates or edits a
//      Worker — a column one form saves and another form silently drops is
//      failure class 1 in AGENTS.md (written and never read, or the reverse).
//   2. The value is validated server-side through ONE normaliser, so the
//      60-character limit cannot drift between routes.
//   3. There is one helper for printing it, with NO invented fallback — no
//      "Staff" for a person without a title — and the person lists use it.
//   4. The seat vocabulary is still where the seat is the subject: the access
//      editor and the invite screen keep ROLE_LABELS. The title is not a
//      replacement for the tier; it is the answer to a different question.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-worker-title.mjs

import { readFileSync } from "node:fs";
import {
  TITLE_MAX,
  TITLE_SUGGESTION_KEYS,
  personTitle,
  personOptionLabel,
  normaliseTitle,
} from "@/lib/team/personLabel";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let fail = 0;
let pass = 0;
const t = (name, cond, detail) => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? "  ok  " : "  FAIL"} ${name}${cond || detail === undefined ? "" : `  — ${detail}`}`);
};
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
// Assertions about code must not be satisfied by a comment that names the
// thing — every file here explains itself in prose first. A block comment
// has to OPEN like one (`/*` then whitespace or `*`): the New User form's
// `accept="image/*"` is not a comment, and a naive stripper swallowed the
// page from there to the next `*/`.
const code = (rel) =>
  read(rel)
    .replace(/\/\*(?=[\s*])[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

console.log("\n1. The column, and the model it lives on");
const schema = read("prisma/schema.prisma");
const workerModel = schema.slice(schema.indexOf("model Worker {"), schema.indexOf("model TimeEntry {"));
t("Worker.title is a nullable String", /^\s*title\s+String\?\s*$/m.test(workerModel));
t("the schema comment says why it is free text, not an enum", /Free text rather than an enum/.test(workerModel));
t("the schema comment says why it is on Worker, not Member", /On Worker rather than Member/.test(workerModel));
const memberModel = schema.slice(schema.indexOf("model Member {"), schema.indexOf("model PendingTeamProfile {"));
t("Member carries no title of its own (one home for the word)", !/^\s*title\s+String/m.test(memberModel));
const pendingModel = schema.slice(schema.indexOf("model PendingTeamProfile {"), schema.indexOf("model Session {"));
t("PendingTeamProfile.title carries it from the invite to the accept", /^\s*title\s+String\?\s*$/m.test(pendingModel));

console.log("\n2. Every Worker write reads it, through the one normaliser");
const writes = [
  ["POST /api/workers", "app/api/workers/route.js", /title:\s*title\.value/],
  ["PATCH /api/workers/[id]", "app/api/workers/[id]/route.js", /title\?\.ok\s*&&\s*\{\s*title:\s*title\.value\s*\}/],
  ["POST /api/team/quick-add", "app/api/team/quick-add/route.js", /title:\s*jobTitle\.value/],
  ["POST /api/settings/members (pending profile)", "app/api/settings/members/route.js", /title:\s*jobTitle\.value/],
];
for (const [name, rel, write] of writes) {
  const src = code(rel);
  t(`${name} imports normaliseTitle from lib/team/personLabel`, /normaliseTitle[^\n]*from "@\/lib\/team\/personLabel"/.test(src));
  t(`${name} refuses a bad title with a 400 rather than dropping it`, /normaliseTitle\([\s\S]{0,400}status:\s*400/.test(src));
  t(`${name} writes the normalised value`, write.test(src));
}
const ensure = code("lib/team/ensureWorker.js");
t("resolveQuickAddWorker writes title on reactivate AND create",
  (ensure.match(/^\s*title,\s*$/gm) || []).length >= 2);
t("ensureWorkerForMember accepts the pending title", /ensureWorkerForMember\(\{\s*companyId,\s*userId,\s*title/.test(ensure));
t("…and never overwrites a title an admin already set", /!byEmail\.title\s*\?\s*\{\s*title:\s*pendingTitle\s*\}/.test(ensure));
const accept = code("app/api/invitations/[id]/accept/route.js");
t("the accept route reads the pending title before reconcile deletes the row", /select:\s*\{\s*role:\s*true,\s*title:\s*true\s*\}/.test(accept));
t("…and hands it to ensureWorkerForMember", /title:\s*pending\?\.title/.test(accept));

console.log("\n3. The normaliser, against hostile input");
t(`TITLE_MAX is 60`, TITLE_MAX === 60);
t("undefined → null (not sent)", normaliseTitle(undefined).ok && normaliseTitle(undefined).value === null);
t("null → null", normaliseTitle(null).value === null);
t('"" → null (cleared, not an empty string)', normaliseTitle("").value === null);
t('"   " → null', normaliseTitle("   ").value === null);
t("trims", normaliseTitle("  Foreman  ").value === "Foreman");
t("collapses inner whitespace", normaliseTitle("Lead \t  installer").value === "Lead installer");
t("keeps what was typed, case and all", normaliseTitle("lead installer").value === "lead installer");
t("accepts exactly 60", normaliseTitle("x".repeat(60)).ok === true);
t("refuses 61", normaliseTitle("x".repeat(61)).ok === false);
t("refuses 61 even when whitespace would pad it past", normaliseTitle(" " + "x".repeat(61) + " ").ok === false);
t("refuses a non-string", normaliseTitle(42).ok === false && normaliseTitle({}).ok === false);
t("accepts accents and apostrophes", normaliseTitle("Contremaître d'équipe").value === "Contremaître d'équipe");

console.log("\n4. One helper, no invented fallback");
t("personTitle: no title → null", personTitle({ name: "A" }) === null && personTitle(null) === null);
t('personTitle: "" → null', personTitle({ title: "" }) === null);
t("personTitle: whitespace → null", personTitle({ title: "  " }) === null);
t("personTitle: a title is returned as-is", personTitle({ title: "Receptionist" }) === "Receptionist");
t("personOptionLabel: name only when no title", personOptionLabel({ name: "Ana" }) === "Ana");
t("personOptionLabel: name — title", personOptionLabel({ name: "Ana", title: "Foreman" }) === "Ana — Foreman");
t("personOptionLabel: an explicit name wins over person.name", personOptionLabel({ name: "x", title: "Clerk" }, "Ana") === "Ana — Clerk");
const helperSrc = code("lib/team/personLabel.js");
t('the helper never says "Staff"', !/["'`]Staff["'`]/.test(helperSrc));
t("the helper does not import the role map (a title is not a tier)", !/roleManagement/.test(helperSrc));

console.log("\n5. The person lists use it; the seat editor still uses ROLE_LABELS");
const readers = [
  ["Manage Team roster", "app/app/settings/team/page.js", /personTitle\(m\)/],
  ["Manage Team no-login section", "app/app/settings/team/page.js", /personTitle\(w\)/],
  ["Workers list", "app/app/settings/team/workers/page.js", /personTitle\(worker\)/],
  ["Team schedule", "app/app/schedule/page.js", /personTitle\(m\)\s*\|\|\s*ROLE_LABEL\[m\.role\]/],
  ["Staff chat directory / Members bar", "app/components/company/CompanyChat.js", /personTitle\(p\)\s*\|\|\s*t\(LABEL_KEYS/],
  ["Timesheets worker picker", "app/app/settings/team/timesheets/page.js", /personOptionLabel\(w\)/],
  ["Appointments assignee picker", "app/app/appointments/page.js", /personOptionLabel\(m,\s*m\.user\.name\)/],
  ["Tasks assignee picker", "app/app/tasks/page.js", /personOptionLabel\(m,/],
  ["Visit assignee picker", "app/app/jobs/[id]/visits/new/page.js", /personOptionLabel\(m,/],
  ["Invoice job panel assignee picker", "app/app/invoices/[id]/JobPanel.js", /personOptionLabel\(m,/],
  ["Time off requests", "app/app/time-off/page.js", /personTitle\(request\.worker\)/],
];
for (const [name, rel, re] of readers) {
  const src = code(rel);
  t(`${name} imports from lib/team/personLabel`, /from "@\/lib\/team\/personLabel"/.test(src));
  t(`${name} prints the title through the helper`, re.test(src));
}
// The APIs those lists read from must actually carry the word.
const members = code("app/api/settings/members/route.js");
t("GET /api/settings/members decorates BOTH payload shapes with title",
  (members.match(/withWorkerTitles\(/g) || []).length >= 2);
t("GET /api/team/schedules carries title", /title:\s*titles\.get\(m\.userId\)/.test(code("app/api/team/schedules/route.js")));
const store = code("lib/company/chat/store.js");
t("the chat directory and Members bar carry title", (store.match(/title:\s*titles\.get\(/g) || []).length >= 2);
t("the leave API selects worker.title", /worker:\s*\{\s*select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*title:\s*true\s*\}/.test(code("app/api/leave/route.js")));
const titles = code("lib/team/workerTitles.js");
t("the server lookup is scoped to the company, never by userId alone", /where:\s*\{\s*companyId,\s*userId:\s*\{\s*in:\s*ids\s*\}/.test(titles));

// Where the SEAT is the subject, the seat word stays.
t("the access editor still uses ROLE_LABELS", /ROLE_LABELS\[PRESET_TO_ROLE\[/.test(code("app/components/team/AccessEditor.js")));
t("the quick-add popup still names the tier it creates", /ROLE_LABELS\[PRESET_TO_ROLE\[/.test(code("app/components/team/AddEmployeeModal.js")));
t("Manage Team's Role column is still the access badge/dropdown, not the title",
  /accessBadge\(m\)\.label/.test(code("app/app/settings/team/page.js")));
t("the seat-count breakdown was not touched", /countAdministrators/.test(read("app/app/settings/team/page.js")));

console.log("\n6. One input, shared by the three forms");
const input = code("app/components/team/JobTitleInput.js");
t("the input is a text field with a datalist, not a select", /<datalist/.test(input) && !/<select/.test(input));
t("the input caps at TITLE_MAX", /maxLength=\{TITLE_MAX\}/.test(input));
t("the suggestions come from TITLE_SUGGESTION_KEYS", /TITLE_SUGGESTION_KEYS\.map/.test(input));
for (const [name, rel] of [
  ["Workers editor", "app/app/settings/team/workers/page.js"],
  ["New User form", "app/app/settings/team/new/page.js"],
  ["quick-add popup", "app/components/team/AddEmployeeModal.js"],
]) {
  const src = code(rel);
  t(`${name} renders JobTitleInput`, /<JobTitleInput/.test(src));
  t(`${name} sends title in its request body`, /title:\s*(form|personal)\.title/.test(src));
}

console.log("\n7. Every string is in the catalogue, in English, French and Spanish");
const keys = ["app.jobTitle.label", "app.jobTitle.placeholder", "app.jobTitle.hint", ...TITLE_SUGGESTION_KEYS];
for (const lang of ["en", "fr", "es"]) {
  const missing = keys.filter((k) => !APP_MESSAGES[lang]?.[k]);
  t(`${lang}: all ${keys.length} keys present`, missing.length === 0, missing.join(", "));
}
t("the ten suggestions are distinct in English",
  new Set(TITLE_SUGGESTION_KEYS.map((k) => APP_MESSAGES.en[k])).size === TITLE_SUGGESTION_KEYS.length);
t("the owner's examples are among them (receptionist, clerk, supervisor, estimator)",
  ["Receptionist", "Clerk", "Supervisor", "Estimator"].every((w) => TITLE_SUGGESTION_KEYS.some((k) => APP_MESSAGES.en[k] === w)));

console.log("\n8. The help centre explains the difference, in all three languages");
for (const lang of ["en", "fr", "es"]) {
  const src = read(`content/help/${lang}/team-and-access-1.js`);
  t(`${lang}: manage-team has a job-title-vs-level section`, /id:\s*"job-title-vs-level"/.test(src));
}

console.log(fail ? `\n${pass} passed, ${fail} FAILED\n` : `\n${pass} passed, 0 failed — a title is what the company calls you; a seat is what you may do\n`);
process.exit(fail ? 1 : 0);
