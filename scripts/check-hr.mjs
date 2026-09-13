// scripts/check-hr.mjs
//
// The HR file, executed: the default onboarding template is pure and
// country-aware; a policy's signed version is never rewritten; an
// acknowledgement needs a name AND the current version; certifications ride
// the shared expiry window and each reminder mark fires once; a run ticks
// itself from evidence and completes on the required items; and — the one
// that matters most — every loader in lib/hr and lib/onboarding, run against
// a database holding two companies, returns nothing from the other one.
//
//   npm run check:hr
//
// Pure functions are called directly. The database-backed helpers run
// against scripts/hrFakeDb.mjs, which throws on any query shape it does not
// model, so a new `where` this check never saw is a failure, not a pass.

import { defaultTemplateFor, TAX_FORM_ITEMS_BY_COUNTRY } from "@/lib/onboarding/defaultTemplate";
import { normaliseTemplateItems, normaliseTemplateName, ITEM_KINDS } from "@/lib/onboarding/template";
import { openItems, reconcile, setTaskDone, progress, overdueItems, runPatch, describeRun } from "@/lib/onboarding/run";
import { ensureTemplates, startRun, reconcileRunsForWorker } from "@/lib/onboarding/service";
import { policyHash, parsePolicyBody, nextVersionFor, mayRewriteVersion, policyAppliesTo, pendingPolicies, parseAcknowledgement } from "@/lib/hr/policies";
import { pendingPolicyCount, pendingNoteCount } from "@/lib/hr/pending";
import { createPolicy, updatePolicy, acknowledgementReport, policiesForWorker } from "@/lib/hr/policyService";
import { parseWorkerDocumentBody, parseWorkerDocumentPatch, WORKER_DOCUMENT_KINDS, WORKER_SELF_KINDS, EXPIRING_KINDS } from "@/lib/hr/documents";
import { documentExpiry, expiringDocuments, reminderDue, stampForReminder } from "@/lib/hr/documentExpiry";
import { EXPIRY_STATES, expiryState } from "@/lib/expiry/window";
import { parseNoteBody, pendingNotes, serialiseForWorker } from "@/lib/hr/notes";
import { parseLogBody, parseLogFilter, LOG_TAGS } from "@/lib/hr/log";
import { parseTaxFormBody, td1TotalClaim, taxFormKindsForCountry, TAX_FORM_FIELDS } from "@/lib/hr/taxForms";
import { complianceRows, loadCompliance } from "@/lib/hr/compliance";
import { canManageHr, myWorker, ownWorker } from "@/lib/hr/access";
import { policyTemplates, POLICY_TEMPLATE_KEYS } from "@/lib/hr/policyTemplates";
import { HR_MORE_LINKS } from "@/lib/me/moreLinks";
import { NOTIFICATION_TYPES, typeProblems } from "@/lib/notifications/catalog";
import { hrefFor, noteKeysFor } from "@/lib/notifications/render";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { fakeDb } from "./hrFakeDb.mjs";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
};
const section = (t) => console.log(`\n${t}\n`);
const NOW = new Date("2026-09-13T12:00:00Z");
const DAY = 86400000;
const at = (n) => new Date(NOW.getTime() + n * DAY);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The default template is pure and follows the country");
// ═══════════════════════════════════════════════════════════════════════════
{
  const ca = defaultTemplateFor({ country: "CA" });
  const us = defaultTemplateFor({ country: "US" });
  const none = defaultTemplateFor({});
  ok("CA gets the federal and provincial TD1", ca.items.filter((i) => i.kind === "form").map((i) => i.formKind).join(",") === "td1_federal,td1_provincial");
  ok("US gets the W-4 only", us.items.filter((i) => i.kind === "form").map((i) => i.formKind).join(",") === "w4");
  ok("unknown country gets no tax-form item at all (never the wrong one)", none.items.every((i) => i.kind !== "form"));
  ok("the same input gives the same output (pure)", JSON.stringify(defaultTemplateFor({ country: "CA" })) === JSON.stringify(ca));
  ok("every default item passes the template validator", !normaliseTemplateItems(ca.items).error && !normaliseTemplateItems(us.items).error);
  ok("item keys are unique", new Set(ca.items.map((i) => i.key)).size === ca.items.length);
  ok("a province-only company resolves to CA", defaultTemplateFor({ province: "QC" }).items.some((i) => i.formKind === "td1_federal"));
  ok("TAX_FORM_ITEMS_BY_COUNTRY covers exactly CA and US", Object.keys(TAX_FORM_ITEMS_BY_COUNTRY).sort().join() === "CA,US");

  const bad = normaliseTemplateItems([{ label: "x", kind: "policy", policyId: "someone-elses" }], { policyIds: new Set(["mine"]) });
  ok("a policy item pointing outside the company is refused", !!bad.error);
  ok("a policy item pointing inside is accepted", !normaliseTemplateItems([{ label: "x", kind: "policy", policyId: "mine" }], { policyIds: new Set(["mine"]) }).error);
  ok("an unknown kind is refused", !!normaliseTemplateItems([{ label: "x", kind: "wizardry" }]).error);
  ok("a blank label is refused", !!normaliseTemplateItems([{ label: "  ", kind: "task" }]).error);
  ok("a negative due day is refused", !!normaliseTemplateItems([{ label: "x", kind: "task", dueDays: -1 }]).error);
  ok("a document item needs a document kind", !!normaliseTemplateItems([{ label: "x", kind: "document" }]).error);
  ok("duplicate keys are made unique", (() => { const r = normaliseTemplateItems([{ key: "a", label: "1" }, { key: "a", label: "2" }]); return r.items[0].key !== r.items[1].key; })());
  ok("a hostile key is slugged", normaliseTemplateItems([{ key: "<script>", label: "x" }]).items[0].key === "script");
  ok("a blank name falls back", normaliseTemplateName("   ") === "New hire checklist");
  ok("ITEM_KINDS is the four documented", ITEM_KINDS.join() === "task,document,policy,form");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. A run ticks itself from evidence and completes on required items");
// ═══════════════════════════════════════════════════════════════════════════
{
  const items = openItems([
    { key: "t", label: "Task", kind: "task", required: true, dueDays: 1 },
    { key: "d", label: "ID", kind: "document", documentKind: "id", required: true, dueDays: 3 },
    { key: "p", label: "Policy", kind: "policy", policyId: "pol1", required: true, dueDays: null },
    { key: "f", label: "TD1", kind: "form", formKind: "td1_federal", required: true, dueDays: 3 },
    { key: "o", label: "Tickets", kind: "document", documentKind: "certification", required: false, dueDays: 14 },
  ]);
  ok("openItems opens every item", items.every((i) => i.status === "open"));

  const r1 = reconcile(items, { documents: [], acknowledgements: [], policies: [{ id: "pol1", version: 2 }], taxForms: [] });
  ok("no evidence changes nothing", r1.changed === false);

  const ev = {
    documents: [{ id: "doc1", kind: "id", archivedAt: null, createdAt: at(-1) }],
    acknowledgements: [{ id: "ack1", policyId: "pol1", policyVersion: 1, acknowledgedAt: at(-1) }],
    policies: [{ id: "pol1", version: 2 }],
    taxForms: [{ id: "tf1", formKind: "td1_federal", submittedAt: at(0) }],
  };
  const r2 = reconcile(items, ev);
  const by = (k) => r2.items.find((i) => i.key === k);
  ok("the ID upload ticks the document item, with the document id on it", by("d").status === "done" && by("d").documentId === "doc1");
  ok("a signature on an OLD version does not tick the policy item", by("p").status === "open");
  ok("the tax form ticks the form item", by("f").status === "done" && by("f").taxFormId === "tf1");
  ok("the optional certification stays open", by("o").status === "open");

  const evCurrent = { ...ev, acknowledgements: [{ id: "ack2", policyId: "pol1", policyVersion: 2, acknowledgedAt: at(0) }] };
  const r3 = reconcile(r2.items, evCurrent);
  ok("a signature on the current version ticks it", r3.items.find((i) => i.key === "p").status === "done");

  const refused = setTaskDone(r3.items, "d", { byUserId: "u1", byName: "Dana" });
  ok("ticking an evidence item by hand is refused", !!refused.error);
  ok("an unknown key is refused", !!setTaskDone(r3.items, "nope").error);
  const ticked = setTaskDone(r3.items, "t", { byUserId: "u1", byName: "Dana", at: at(0) });
  ok("a task ticks by hand with the name on it", ticked.items.find((i) => i.key === "t").doneByName === "Dana");

  const p = progress(ticked.items);
  ok("progress counts done/total and required", p.done === 4 && p.total === 5 && p.requiredDone === 4 && p.requiredTotal === 4);
  ok("complete on required items alone — the optional one is still open", p.complete === true);

  const patch = runPatch({ completedAt: null }, ticked.items, NOW);
  ok("runPatch stamps completedAt the first time", patch.justCompleted && patch.data.completedAt === NOW);
  const archived = reconcile(ticked.items, { ...evCurrent, documents: [{ id: "doc1", kind: "id", archivedAt: at(0), createdAt: at(-1) }] });
  const unpatch = runPatch({ completedAt: NOW }, archived.items, at(1));
  ok("archiving the only ID re-opens the item and un-completes the run", archived.items.find((i) => i.key === "d").status === "open" && unpatch.data.completedAt === null);

  const overdue = overdueItems(items, at(-5), NOW);
  ok("overdue: the 1-day and 3-day items are overdue five days in; the no-deadline one is not", overdue.map((i) => i.key).sort().join() === "d,f,t");
  const desc = describeRun({ id: "r", items, startedAt: at(-5), completedAt: null }, NOW);
  ok("describeRun carries dueAt and overdue per item", desc.items.find((i) => i.key === "t").overdue === true && desc.items.find((i) => i.key === "p").dueAt === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. A signed policy version is never rewritten");
// ═══════════════════════════════════════════════════════════════════════════
{
  const policy = { id: "p1", version: 1, title: "Vehicle use", body: "Seat belts on." };
  const unsigned = nextVersionFor(policy, { body: "Seat belts on. Phone down." }, { signedVersions: new Set() });
  ok("a body edit before any signature corrects in place", unsigned.newVersion === false && unsigned.version === 1);
  const signed = nextVersionFor(policy, { body: "Seat belts on. Phone down." }, { signedVersions: new Set([1]) });
  ok("a body edit after a signature makes version 2", signed.newVersion === true && signed.version === 2);
  const titleOnly = nextVersionFor(policy, { title: "Vehicles" }, { signedVersions: new Set([1]) });
  ok("a title edit after a signature is also a new version (it is on the signed text)", titleOnly.newVersion === true);
  const scope = nextVersionFor(policy, { audienceTitles: ["Foreman"] }, { signedVersions: new Set([1]) });
  ok("a scope change never bumps the version", scope.newVersion === false && scope.version === 1);
  ok("mayRewriteVersion refuses a signed version", mayRewriteVersion(1, new Set([1])) === false && mayRewriteVersion(2, new Set([1])) === true);
  ok("the hash is over title and body", policyHash("a", "b") !== policyHash("a", "c") && policyHash("a", "b") === policyHash("a", "b"));

  ok("parsePolicyBody refuses a blank title on create", !!parsePolicyBody({ title: " ", body: "x" }, { creating: true }).error);
  ok("parsePolicyBody refuses a blank body on create", !!parsePolicyBody({ title: "x", body: "" }, { creating: true }).error);
  ok("parsePolicyBody dedupes and trims audience titles", parsePolicyBody({ audienceTitles: [" Foreman ", "Foreman", 3] }).data.audienceTitles.join() === "Foreman");
  ok("policyAppliesTo: empty audience is everyone", policyAppliesTo({ audienceTitles: [] }, { title: null }));
  ok("policyAppliesTo: titled audience matches case-insensitively", policyAppliesTo({ audienceTitles: ["Foreman"] }, { title: "foreman" }));
  ok("policyAppliesTo: a worker with no title is out of a titled scope", !policyAppliesTo({ audienceTitles: ["Foreman"] }, { title: null }));
  const pend = pendingPolicies(
    [
      { id: "a", version: 2, requiresAcknowledgement: true, audienceTitles: [] },
      { id: "b", version: 1, requiresAcknowledgement: false, audienceTitles: [] },
      { id: "c", version: 1, requiresAcknowledgement: true, audienceTitles: ["Foreman"] },
      { id: "d", version: 1, requiresAcknowledgement: true, audienceTitles: [], archivedAt: NOW },
    ],
    { title: "Painter" },
    [{ policyId: "a", policyVersion: 1 }],
  );
  ok("pendingPolicies: old signature, no-signature, other title and archived are all excluded correctly", pend.map((p) => p.id).join() === "a");

  // ── Executed against the fake db ────────────────────────────────────────
  const db = fakeDb({ worker: [{ id: "w1", companyId: "A", name: "Dana", title: "Foreman", active: true, userId: "u1" }] });
  const created = await createPolicy(db, { companyId: "A", data: { title: "PPE", body: "Boots.", requiresAcknowledgement: true, audienceTitles: [] }, actorUserId: "u0" });
  ok("createPolicy freezes version 1", db.tables.companyPolicyVersion.length === 1 && db.tables.companyPolicyVersion[0].version === 1);
  const frozenHash = db.tables.companyPolicyVersion[0].bodyHash;
  await db.policyAcknowledgement.create({ data: { companyId: "A", policyId: created.id, policyVersion: 1, workerId: "w1", signatureName: "Dana", bodyHash: frozenHash } });
  const edited = await updatePolicy(db, { companyId: "A", policy: created, patch: { body: "Boots and glasses." } });
  ok("updatePolicy after a signature writes version 2", edited.newVersion && edited.policy.version === 2 && db.tables.companyPolicyVersion.length === 2);
  const v1 = db.tables.companyPolicyVersion.find((v) => v.version === 1);
  ok("the signed version 1 row is byte-for-byte untouched", v1.body === "Boots." && v1.bodyHash === frozenHash);
  const report = await acknowledgementReport(db, { companyId: "A", policy: edited.policy });
  ok("the report shows Dana signed the older version and is pending on v2", report.rows[0].acknowledged === false && report.rows[0].olderVersion === 1 && report.counts.pending === 1);
  const draft = await createPolicy(db, { companyId: "A", data: { title: "Draft", body: "typo", requiresAcknowledgement: true, audienceTitles: [] } });
  await updatePolicy(db, { companyId: "A", policy: draft, patch: { body: "fixed" } });
  ok("an unsigned draft is corrected in place — still version 1, frozen text updated", db.tables.companyPolicyVersion.filter((v) => v.policyId === draft.id).length === 1 && db.tables.companyPolicyVersion.find((v) => v.policyId === draft.id).body === "fixed");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. An acknowledgement needs a name and the CURRENT version");
// ═══════════════════════════════════════════════════════════════════════════
{
  const policy = { id: "p", version: 2, title: "T", body: "B" };
  ok("no name → refused", !!parseAcknowledgement({ version: 2 }, policy).error);
  ok("blank name → refused", !!parseAcknowledgement({ signatureName: "   ", version: 2 }, policy).error);
  ok("stale version → refused", !!parseAcknowledgement({ signatureName: "Dana", version: 1 }, policy).error);
  ok("no version → refused", !!parseAcknowledgement({ signatureName: "Dana" }, policy).error);
  ok("wrong hash → refused (the tab showed other text)", !!parseAcknowledgement({ signatureName: "Dana", version: 2, bodyHash: "nope" }, policy).error);
  const good = parseAcknowledgement({ signatureName: " Dana Roy ", version: 2 }, policy);
  ok("name + current version → accepted, with the hash of what is in force", good.data?.signatureName === "Dana Roy" && good.data.bodyHash === policyHash("T", "B"));
  ok("a hash that matches is accepted", !parseAcknowledgement({ signatureName: "Dana", version: 2, bodyHash: policyHash("T", "B") }, policy).error);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Certifications ride the shared expiry window; each mark fires once");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("no date → unknown, never expired", documentExpiry({ expiresAt: null }).state === EXPIRY_STATES.UNKNOWN);
  ok("a corrupt date → unknown", documentExpiry({ expiresAt: "not a date" }).state === EXPIRY_STATES.UNKNOWN);
  ok("the state agrees with lib/expiry/window.js exactly", documentExpiry({ expiresAt: at(10) }, { asOf: NOW }).state === expiryState(at(10), { asOf: NOW }).state);
  ok("yesterday → expired", documentExpiry({ expiresAt: at(-1) }, { asOf: NOW }).state === EXPIRY_STATES.EXPIRED);
  ok("in 45 days → ok", documentExpiry({ expiresAt: at(45) }, { asOf: NOW }).state === EXPIRY_STATES.OK);
  const list = expiringDocuments(
    [
      { id: "a", expiresAt: at(-2), archivedAt: null },
      { id: "b", expiresAt: at(5), archivedAt: null },
      { id: "c", expiresAt: at(90), archivedAt: null },
      { id: "d", expiresAt: null, archivedAt: null },
      { id: "e", expiresAt: at(1), archivedAt: at(-1) },
    ],
    { asOf: NOW },
  );
  ok("expiringDocuments: expired first, due-soon next, ok/unknown/archived absent", list.map((d) => d.id).join() === "a,b");

  // Walk one certification through its last five weeks, one morning at a time.
  const doc = { kind: "certification", expiresAt: at(35), archivedAt: null, reminded30At: null, reminded7At: null };
  const fired = [];
  for (let day = 0; day <= 36; day++) {
    const due = reminderDue(doc, { asOf: at(day) });
    if (due.worker || due.manager) {
      fired.push({ day, ...due });
      Object.assign(doc, stampForReminder(due, at(day)));
    }
  }
  ok("the worker is told exactly twice (30 and 7 days) and the manager once (7)", JSON.stringify(fired.map((f) => [f.worker, f.manager])) === JSON.stringify([[30, null], [7, 7]]), fired);
  ok("the 30-day mark fires on the first morning inside the window", fired[0].day === 5);
  ok("the 7-day mark fires on the first morning inside its window", fired[1].day === 28);
  ok("an ID card (not an expiring kind) never fires", reminderDue({ kind: "id", expiresAt: at(3), archivedAt: null }, { asOf: NOW }).worker === null);
  ok("an archived document never fires", reminderDue({ kind: "licence", expiresAt: at(3), archivedAt: NOW }, { asOf: NOW }).worker === null);
  ok("an expired document does not fire a 'you have N days' reminder", reminderDue({ kind: "licence", expiresAt: at(-1), archivedAt: null }, { asOf: NOW }).worker === null);
  ok("filed at 20 days out: the first mark fires on the next run (with the real count) and the 7-day mark later — two messages, never three", (() => { const d = { kind: "licence", expiresAt: at(20), archivedAt: null, reminded30At: null, reminded7At: null }; const marks = []; for (let day = 0; day <= 21; day++) { const due = reminderDue(d, { asOf: at(day) }); if (due.worker) { marks.push([day, due.worker]); Object.assign(d, stampForReminder(due, at(day))); } } return JSON.stringify(marks) === JSON.stringify([[0, 30], [13, 7]]); })());
  ok("EXPIRING_KINDS is certification and licence", [...EXPIRING_KINDS].sort().join() === "certification,licence");

  // Body parsing — the door.
  const cloud = { cloudName: "demo" };
  ok("a foreign host is refused", !!parseWorkerDocumentBody({ kind: "licence", fileUrl: "https://evil.example/x.pdf" }, cloud).error);
  ok("a Cloudinary URL under another cloud is refused", !!parseWorkerDocumentBody({ kind: "licence", fileUrl: "https://res.cloudinary.com/other/x.pdf" }, cloud).error);
  const goodDoc = parseWorkerDocumentBody({ kind: "licence", title: "Class 5", fileUrl: "https://res.cloudinary.com/demo/x.pdf", expiresAt: "2027-01-01", issuedAt: "2022-01-01", number: " AB 123 " }, cloud);
  ok("a good body parses with dates and a trimmed number", !goodDoc.error && goodDoc.data.number === "AB 123" && goodDoc.data.expiresAt instanceof Date);
  ok("expiry before issue is refused", !!parseWorkerDocumentBody({ kind: "licence", fileUrl: "https://res.cloudinary.com/demo/x.pdf", expiresAt: "2020-01-01", issuedAt: "2022-01-01" }, cloud).error);
  ok("a worker may not file a contract about themselves", !!parseWorkerDocumentBody({ kind: "contract", fileUrl: "https://res.cloudinary.com/demo/x.pdf" }, { ...cloud, by: "worker" }).error);
  ok("a worker's upload is stamped uploadedByKind=worker and carries no note", (() => { const r = parseWorkerDocumentBody({ kind: "licence", fileUrl: "https://res.cloudinary.com/demo/x.pdf", note: "secret" }, { ...cloud, by: "worker" }); return r.data.uploadedByKind === "worker" && r.data.note === null; })());
  ok("WORKER_SELF_KINDS is a subset of WORKER_DOCUMENT_KINDS", WORKER_SELF_KINDS.every((k) => WORKER_DOCUMENT_KINDS.includes(k)));
  ok("an empty patch is refused", !!parseWorkerDocumentPatch({}).error);
  ok("a patch may clear the expiry", parseWorkerDocumentPatch({ expiresAt: "" }).data.expiresAt === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Notes, the log book and the tax form validate at the door");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("a write-up defaults to visible + requires acknowledgement", (() => { const r = parseNoteBody({ kind: "write_up", body: "Late three times." }); return r.data.visibleToWorker && r.data.requiresAcknowledgement; })());
  ok("a plain note defaults to private", parseNoteBody({ body: "x" }).data.visibleToWorker === false);
  ok("acknowledgement on a private note is refused", !!parseNoteBody({ kind: "note", body: "x", visibleToWorker: false, requiresAcknowledgement: true }).error);
  ok("a future-dated note is refused", !!parseNoteBody({ body: "x", occurredAt: at(5).toISOString() }, { now: NOW }).error);
  ok("pendingNotes counts only visible, required, unacknowledged", pendingNotes([{ visibleToWorker: true, requiresAcknowledgement: true, acknowledgedAt: null }, { visibleToWorker: false, requiresAcknowledgement: true, acknowledgedAt: null }, { visibleToWorker: true, requiresAcknowledgement: true, acknowledgedAt: NOW }]).length === 1);
  ok("the worker-facing shape carries no author member id or visibility flag", (() => { const s = serialiseForWorker({ id: "n", kind: "warning", body: "b", occurredAt: NOW, requiresAcknowledgement: true, acknowledgedAt: null, authorName: "Sam", createdAt: NOW, authorMemberId: "m9", visibleToWorker: true }); return !("authorMemberId" in s) && !("visibleToWorker" in s); })());

  ok("a log entry needs a real day", !!parseLogBody({ body: "x", date: "yesterday" }, { creating: true }).error);
  ok("a log entry refuses an unknown tag", !!parseLogBody({ body: "x", date: "2026-09-13", tags: ["gossip"] }, { creating: true }).error);
  ok("a log entry accepts the six tags", !parseLogBody({ body: "x", date: "2026-09-13", tags: LOG_TAGS }, { creating: true }).error);
  ok("the list filter refuses a bad tag", !!parseLogFilter(new URLSearchParams("tag=x")).error);
  ok("the list filter narrows by day and tag", (() => { const f = parseLogFilter(new URLSearchParams("day=2026-09-13&tag=weather")); return f.where.date instanceof Date && f.where.tags.has === "weather"; })());

  const w4 = parseTaxFormBody({ formKind: "w4", fields: { firstName: "A", lastName: "B", address: "1 St", cityStateZip: "X, NY 10001", filingStatus: "single", dependentsAmount: "2,000" }, signatureName: "A B" }, { now: NOW });
  ok("a W-4 parses, money with a comma grouped", !w4.error && w4.data.fields.dependentsAmount === 2000 && w4.data.taxYear === 2026);
  ok("a TD1 without the basic personal amount is refused, naming the field", parseTaxFormBody({ formKind: "td1_federal", fields: { firstName: "A", lastName: "B", dateOfBirth: "1990-01-01", address: "x", postalCode: "H0H0H0" }, signatureName: "A" }).field === "basicPersonalAmount");
  ok("no signature → refused", parseTaxFormBody({ formKind: "w4", fields: { firstName: "A", lastName: "B", address: "x", cityStateZip: "y", filingStatus: "single" } }).field === "signatureName");
  ok("an unknown form kind is refused", !!parseTaxFormBody({ formKind: "1040" }).error);
  ok("no field list ever asks for a SIN or SSN", Object.values(TAX_FORM_FIELDS).flat().every((f) => !/sin|ssn|social/i.test(f.key)));
  ok("td1TotalClaim adds what was typed", td1TotalClaim({ basicPersonalAmount: 16129, additionalClaims: 100.5 }) === 16229.5 && td1TotalClaim({}) === null);
  ok("CA offers the two TD1s, US the W-4, unknown nothing", taxFormKindsForCountry("CA").join() === "td1_federal,td1_provincial" && taxFormKindsForCountry("US").join() === "w4" && taxFormKindsForCountry(null).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Two companies in one database: nothing crosses");
// ═══════════════════════════════════════════════════════════════════════════
{
  const seed = {
    company: [{ id: "A", country: "CA", name: "A Co" }, { id: "B", country: "US", name: "B Co" }],
    // The worker-facing notification types sit on the floor of the schedule
    // ladder (lib/notifications/catalog.js), which fails CLOSED for a member
    // with no grid — so the seed gives each their preset's grid, as the
    // invite flow does.
    member: [
      { id: "ma_", companyId: "A", userId: "ua", role: "employee", active: true, permissions: { schedule: "view_own" } },
      { id: "mb_", companyId: "B", userId: "ub", role: "employee", active: true, permissions: { schedule: "view_own" } },
    ],
    worker: [
      { id: "wa", companyId: "A", name: "Ana", title: "Foreman", active: true, userId: "ua" },
      { id: "wb", companyId: "B", name: "Bob", title: "Foreman", active: true, userId: "ub" },
    ],
    workerDocument: [
      { id: "da", companyId: "A", workerId: "wa", kind: "licence", expiresAt: at(3), archivedAt: null, uploadedByKind: "manager", verifiedAt: null, createdAt: NOW },
      { id: "db", companyId: "B", workerId: "wb", kind: "licence", expiresAt: at(-3), archivedAt: null, uploadedByKind: "worker", verifiedAt: null, createdAt: NOW },
    ],
    companyPolicy: [
      { id: "pa", companyId: "A", title: "A", body: "a", version: 1, requiresAcknowledgement: true, audienceTitles: [], archivedAt: null, effectiveFrom: NOW },
      { id: "pb", companyId: "B", title: "B", body: "b", version: 1, requiresAcknowledgement: true, audienceTitles: [], archivedAt: null, effectiveFrom: NOW },
    ],
    policyAcknowledgement: [],
    workerNote: [{ id: "nb", companyId: "B", workerId: "wb", visibleToWorker: true, requiresAcknowledgement: true, acknowledgedAt: null, kind: "warning", body: "x", occurredAt: NOW }],
    onboardingRun: [],
  };
  const db = fakeDb(seed);
  const memberA = { companyId: "A", userId: "ua", role: "employee" };
  const managerA = { companyId: "A", userId: "ma", role: "supervisor" };

  ok("myWorker finds the caller's own row by companyId + userId", (await myWorker(db, memberA))?.id === "wa");
  ok("myWorker for a user of company B asked through company A finds nothing", (await myWorker(db, { companyId: "A", userId: "ub" })) === null);
  ok("ownWorker refuses company B's worker id from company A", (await ownWorker(db, managerA, "wb")) === null);
  ok("ownWorker returns company A's own", (await ownWorker(db, managerA, "wa"))?.id === "wa");
  ok("canManageHr: supervisor yes, employee no", canManageHr(managerA) && !canManageHr(memberA));

  const rowsA = await loadCompliance(db, "A");
  ok("loadCompliance for A lists only Ana", rowsA.map((r) => r.name).join() === "Ana");
  ok("Ana's licence is due soon, and her policy pending", rowsA[0].documents.dueSoon === 1 && rowsA[0].policies.pending === 1 && rowsA[0].notes.pending === 0);
  const rowsB = await loadCompliance(db, "B");
  ok("loadCompliance for B lists only Bob, expired + unverified + a write-up pending", rowsB.length === 1 && rowsB[0].documents.expired === 1 && rowsB[0].documents.unverified === 1 && rowsB[0].notes.pending === 1);
  ok("the pure aggregator never mixes rows across companies either", complianceRows({ workers: seed.worker.filter((w) => w.companyId === "A"), documents: seed.workerDocument, runs: [], policies: seed.companyPolicy, acknowledgements: [], notes: seed.workerNote, asOf: NOW }).every((r) => r.workerId === "wa"));

  const polA = await policiesForWorker(db, { companyId: "A", worker: seed.worker[0] });
  ok("policiesForWorker returns company A's policy only", polA.map((p) => p.id).join() === "pa");
  ok("pendingPolicyCount(Ana) is 1, pendingPolicyCount(Bob) is 1, and they are different policies", (await pendingPolicyCount("wa", { db })) === 1 && (await pendingPolicyCount("wb", { db })) === 1);
  ok("pendingNoteCount(Ana) is 0, pendingNoteCount(Bob) is 1", (await pendingNoteCount("wa", { db })) === 0 && (await pendingNoteCount("wb", { db })) === 1);
  ok("pendingPolicyCount of an unknown worker is 0, not a throw", (await pendingPolicyCount("nope", { db })) === 0);

  const tA = await ensureTemplates(db, "A");
  const tB = await ensureTemplates(db, "B");
  ok("ensureTemplates seeds one default per company, lazily, per country", tA.length === 1 && tB.length === 1 && tA[0].items.some((i) => i.formKind === "td1_federal") && tB[0].items.some((i) => i.formKind === "w4"));
  ok("a second call does not seed a second default", (await ensureTemplates(db, "A")).length === 1);

  const run = await startRun(db, { companyId: "A", worker: seed.worker[0], actorUserId: "ma" });
  ok("startRun creates a run for Ana on A's template", run.created && run.run.templateId === tA[0].id);
  ok("the licence already on file ticked nothing (the default asks for an ID, not a licence)", run.run.items.every((i) => i.kind !== "document" || i.status === "open"));
  const again = await startRun(db, { companyId: "A", worker: seed.worker[0] });
  ok("a second start is idempotent", again.created === false && again.run.id === run.run.id);
  ok("startRun told Ana (a delivery row exists for her only)", db.tables.notificationDelivery.length >= 1 && db.tables.notificationDelivery.every((d) => d.companyId === "A"));

  await db.workerDocument.create({ data: { companyId: "A", workerId: "wa", kind: "id", archivedAt: null, uploadedByKind: "worker" } });
  const rec = await reconcileRunsForWorker(db, { companyId: "A", workerId: "wa" });
  ok("filing the ID ticks the run's ID item", rec[0].items.find((i) => i.documentKind === "id").status === "done");
  ok("reconciling Bob's runs in company A touches nothing", (await reconcileRunsForWorker(db, { companyId: "A", workerId: "wb" })).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The seams other code reads: notifications, More links, starters, catalogue");
// ═══════════════════════════════════════════════════════════════════════════
{
  const hrTypes = Object.keys(NOTIFICATION_TYPES).filter((t) => t.startsWith("hr."));
  ok("seven HR notification types are declared", hrTypes.length === 7, hrTypes);
  for (const t of hrTypes) {
    ok(`${t} is sound`, typeProblems(t).length === 0, typeProblems(t));
    ok(`${t} resolves to a destination`, hrefFor({ entityType: NOTIFICATION_TYPES[t].entityType, entityId: "x" }) !== null);
    ok(`${t} has a sentence in all nine languages`, Object.values(APP_MESSAGES).every((d) => typeof d[`app.notif.type.${t}`] === "string"));
  }
  ok("a manager's row opens the person's file", hrefFor({ entityType: "hr_worker", entityId: "w1" }) === "/app/settings/team/people/w1");
  ok("noteKind renders through the secondary line", noteKeysFor({ params: { noteKind: "write_up" } }).includes("app.notif.noteKind.write_up") && noteKeysFor({ params: { noteKind: "note" } }).length === 0);

  ok("HR_MORE_LINKS is three rows with hrefs the pages exist for", HR_MORE_LINKS.length === 3 && HR_MORE_LINKS.every((l) => l.href.startsWith("/app/me/") && typeof l.labelKey === "string" && typeof l.icon === "string"));
  ok("every More-link label key exists in English", HR_MORE_LINKS.every((l) => typeof APP_MESSAGES.en[l.labelKey] === "string"));

  ok("four starter policies in three languages, same keys", POLICY_TEMPLATE_KEYS.length === 4 && ["en", "fr", "es"].every((l) => policyTemplates(l).map((p) => p.key).join() === POLICY_TEMPLATE_KEYS.join()));
  ok("starters are plain: every body has a heading and a bullet, none longer than 2000 chars", ["en", "fr", "es"].every((l) => policyTemplates(l).every((p) => /^## /m.test(p.body) && /^- /m.test(p.body) && p.body.length < 2000)));
  ok("an unknown language falls back to English", policyTemplates("xx")[0].title === policyTemplates("en")[0].title);

  const hrKeys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.hr."));
  ok("the app.hr.* catalogue is present in all nine languages", Object.entries(APP_MESSAGES).every(([, d]) => hrKeys.every((k) => typeof d[k] === "string")), Object.entries(APP_MESSAGES).map(([l, d]) => [l, hrKeys.filter((k) => typeof d[k] !== "string").length]));
  ok("every placeholder in English appears in every language", Object.values(APP_MESSAGES).every((d) => hrKeys.every((k) => { const a = (APP_MESSAGES.en[k].match(/\{[a-zA-Z]+\}/g) || []).sort().join(); const b = (d[k].match(/\{[a-zA-Z]+\}/g) || []).sort().join(); return a === b; })));
}

console.log(`\n${pass} ok, ${fails.length} failed`);
for (const f of fails) console.log(`  - ${f}`);
process.exit(fails.length ? 1 : 0);
