// scripts/check-cost-revision.mjs
//
//   npm run check:cost-revision
//
// The close-out's threshold-gated "update your costing?", held end to end:
//
//   * the threshold decision as a pure function — exactly AT the threshold
//     asks, under does not, an already-decided job does not, a null variance
//     does not, and a job UNDER its estimate never does;
//   * the labour calibration — siding's flat crew-hours rate suggests a value
//     that tradeLabourHours() then reproduces, pending hours refuse, two
//     trades refuse, an itemised trade says "not adjustable";
//   * the two routes, CALLED: the settings PUT is gated on the same cost-basis
//     resource as the recipe PUT and refuses 150 and "abc"; the revision POST
//     carries the review endpoint's three gates and writes the decision once;
//   * the modal: Update / Leave as is render only under the open question,
//     Leave as is writes through the gated route, a used quantity goes through
//     the materials PATCH and nowhere else, the suggestions render only under
//     Update, and completing while the question is open says so and sends it;
//   * every new string in all nine catalogues, none typing its own currency.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra)?.slice(0, 300));
  }
}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

/* ══ The scriptable world, the way check-cost-basis.mjs builds it ═════════ */

globalThis.__FQ_ENFORCEABLE = null;
globalThis.__FQ_MEMBER = async () => null;
const writes = [];
const JOB = { id: "j1", title: "Kitchen", status: "completed", costRevisionDecision: null, costRevisionDecidedAt: null };
let jobRow = { ...JOB };
function makeDb() {
  const explicit = {
    member: { async findUnique() { return globalThis.__FQ_ENFORCEABLE; } },
    job: {
      async findFirst(args) { writes.push({ model: "job", action: "findFirst", args }); return jobRow; },
      async update(args) { writes.push({ model: "job", action: "update", args }); jobRow = { ...jobRow, ...args.data }; return { ...jobRow }; },
    },
    company: {
      async findFirst(args) { writes.push({ model: "company", action: "findFirst", args }); return { costRevisionThresholdPct: 15 }; },
      async update(args) { writes.push({ model: "company", action: "update", args }); return { costRevisionThresholdPct: args.data.costRevisionThresholdPct }; },
    },
  };
  const byName = (prop) => {
    if (/^(findMany|groupBy)$/.test(prop)) return async () => [];
    if (/^count$/.test(prop)) return async () => 0;
    return async () => null;
  };
  return new Proxy(explicit, {
    get(target, model) {
      if (model in target) return new Proxy(target[model], { get: (t, prop) => (prop in t ? t[prop] : byName(prop)) });
      return new Proxy({}, { get: (_t, prop) => byName(prop) });
    },
  });
}
globalThis.__FQ_DB = makeDb();
const HOOKS = `
const STUBS = { "@/lib/db": "fq-stub:db", "@/lib/currentMember": "fq-stub:member", "next/server": "fq-stub:next" };
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") return { format: "module", shortCircuit: true, source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  if (url === "fq-stub:member") return { format: "module", shortCircuit: true, source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  if (url === "fq-stub:next") return { format: "module", shortCircuit: true, source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { PERMISSION_PRESETS, PRESET_TO_ROLE } = await import("@/lib/permissions");
const { canWriteCostBasis } = await import("@/lib/permissions/costBasis");
const {
  shouldAskRevision,
  normaliseThresholdPct,
  normaliseRevisionDecision,
  REVISION_DECISIONS,
  DEFAULT_REVISION_THRESHOLD_PCT,
} = await import("@/lib/costing/costRevision");
const { labourBasisFor, labourCalibration, LABOUR_REASONS } = await import("@/lib/costing/labourCalibration");
const { tradeLabourHours } = await import("@/lib/pricing/tradeScope");
const { PRICE_BOOK_FIELDS, getPriceBook } = await import("@/app/data/tradePriceBooks");

const memberFor = (name, role, permissions) => ({
  name,
  member: { id: `m-${name}`, userId: `u-${name}`, companyId: "co", role, permissions },
});
const become = ({ member }) => {
  globalThis.__FQ_ENFORCEABLE = member;
  globalThis.__FQ_MEMBER = async () => ({ id: member.id, userId: member.userId, companyId: member.companyId, role: member.role, impersonation: false });
};
const req = (url, body, method = "POST") => ({
  url,
  method,
  headers: new Map(),
  async json() { if (body === undefined) throw new Error("no body"); return body; },
});
const OWNER = memberFor("owner", "owner", {});
// Built from the presets the way check-cost-basis.mjs builds them: the grid
// is `preset.values`, and the role is the one the preset maps to.
const MANAGER = memberFor("manager", PRESET_TO_ROLE.manager, { ...PERMISSION_PRESETS.manager.values });
const DISPATCHER = memberFor("dispatcher", PRESET_TO_ROLE.dispatcher, { ...PERMISSION_PRESETS.dispatcher.values });
ok("the Dispatcher fixture really has jobCosting off", DISPATCHER.member.permissions.jobCosting === false);
ok("the Manager fixture really has jobCosting on", MANAGER.member.permissions.jobCosting === true);

/* ══ 1. The threshold decision ═══════════════════════════════════════════ */

console.log("\nshouldAskRevision: over, once, at the line");

ok("the shipped default is the owner's 15", DEFAULT_REVISION_THRESHOLD_PCT === 15);
ok("exactly AT the threshold asks (15% over, threshold 15)", shouldAskRevision({ variancePct: 15, thresholdPct: 15, decision: null }) === true);
ok("above asks (22.4% over, threshold 15)", shouldAskRevision({ variancePct: 22.4, thresholdPct: 15, decision: null }) === true);
ok("under the threshold does not (14.9% over)", shouldAskRevision({ variancePct: 14.9, thresholdPct: 15, decision: null }) === false);
ok("a job UNDER its estimate never asks, however far (-40%)", shouldAskRevision({ variancePct: -40, thresholdPct: 15, decision: null }) === false);
ok("...nor at zero threshold when it came in under", shouldAskRevision({ variancePct: -1, thresholdPct: 0, decision: null }) === false);
ok("threshold 0 asks on any overrun (0.1%)", shouldAskRevision({ variancePct: 0.1, thresholdPct: 0, decision: null }) === true);
ok("...but not on exactly on-budget (0%)", shouldAskRevision({ variancePct: 0, thresholdPct: 0, decision: null }) === false);
ok("already decided 'updated' does not ask again", shouldAskRevision({ variancePct: 50, thresholdPct: 15, decision: "updated" }) === false);
ok("already decided 'left_as_is' does not ask again", shouldAskRevision({ variancePct: 50, thresholdPct: 15, decision: "left_as_is" }) === false);
ok("a null variance (no estimate) does not ask", shouldAskRevision({ variancePct: null, thresholdPct: 15, decision: null }) === false);
ok("an undefined variance does not ask", shouldAskRevision({ thresholdPct: 15 }) === false);
ok("a NaN variance does not ask", shouldAskRevision({ variancePct: "abc", thresholdPct: 15 }) === false);
ok("a threshold the setting could not hold (null) never asks", shouldAskRevision({ variancePct: 50, thresholdPct: null }) === false);
ok("a threshold of 100 asks at 100% over", shouldAskRevision({ variancePct: 100, thresholdPct: 100 }) === true);

ok("normaliseThresholdPct keeps 0, 15 and 100", normaliseThresholdPct(0) === 0 && normaliseThresholdPct(15) === 15 && normaliseThresholdPct("100") === 100);
ok("...refuses 150 (not clamped)", normaliseThresholdPct(150) === null);
ok("...refuses -1", normaliseThresholdPct(-1) === null);
ok("...refuses 14.5 (whole numbers only)", normaliseThresholdPct(14.5) === null);
ok("...refuses 'abc', '', null, Infinity", ["abc", "", null, Infinity, undefined].every((v) => normaliseThresholdPct(v) === null));
ok("normaliseRevisionDecision accepts the two values only", normaliseRevisionDecision("updated") === REVISION_DECISIONS.UPDATED && normaliseRevisionDecision("left_as_is") === REVISION_DECISIONS.LEFT_AS_IS);
ok("...and nothing else — '' is not 'left as is'", ["", null, undefined, "yes", "UPDATED", 1].every((v) => normaliseRevisionDecision(v) === null));

/* ══ 2. The labour calibration ═══════════════════════════════════════════ */

console.log("\nlabourCalibration: one rate where there is one, refusals elsewhere");

const sidingTakeoff = { sqft: 500, materialKey: "vinyl", storeys: "one" };
const sidingBasis = labourBasisFor({ categoryKey: "siding", takeoff: sidingTakeoff, rateOverrides: null });
ok("siding: the flat crew-hours rate is a saved path on the rate card", sidingBasis?.path === "labourHoursPerSqft" && sidingBasis.store === "book" && sidingBasis.units === 500, sidingBasis);
ok("...the rate card declares it (so sanitiseRates keeps it)", PRICE_BOOK_FIELDS.siding.some((f) => f.path === "labourHoursPerSqft"));
ok("...and the basis rate is the book's own", sidingBasis.rate === getPriceBook("siding").labourHoursPerSqft && sidingBasis.rate > 0);
const sidingHours = tradeLabourHours("siding", sidingTakeoff, null);
ok("tradeLabourHours predicts sqft × rate × factor for vinyl", Math.abs(sidingHours - 500 * sidingBasis.rate * sidingBasis.factor) < 0.01, { sidingHours, basis: sidingBasis });

const one = labourCalibration({
  estimatedHours: sidingHours,
  approvedHours: 21,
  pendingHours: 0,
  groups: [{ categoryKey: "siding", label: "House", labourHours: sidingHours, basis: sidingBasis }],
});
ok("siding 16h estimated / 21h approved → a suggestion the company can apply", one?.canApply === true && one.suggestedRate > sidingBasis.rate, one);
ok("...per unit both ways", one.estimatedPerUnit === Math.round((sidingHours / 500) * 1e4) / 1e4 && one.actualPerUnit === 0.042, one);
ok("...and re-running tradeLabourHours with the suggested rate REPRODUCES the 21 hours", Math.abs(tradeLabourHours("siding", sidingTakeoff, { labourHoursPerSqft: one.suggestedRate }) - 21) < 0.05, tradeLabourHours("siding", sidingTakeoff, { labourHoursPerSqft: one.suggestedRate }));
ok("...with a delta against today's rate and the hours delta", one.suggestedDeltaPct > 0 && one.deltaHours === Math.round((21 - sidingHours) * 100) / 100, one);

const cedar = { ...sidingTakeoff, materialKey: "cedar" };
const cedarBasis = labourBasisFor({ categoryKey: "siding", takeoff: cedar });
const cedarLine = labourCalibration({ estimatedHours: 30, approvedHours: 36, groups: [{ categoryKey: "siding", labourHours: 30, basis: cedarBasis }] });
ok("cedar's labour factor is divided OUT of the suggestion (the saved rate is the vinyl rate)", cedarBasis.factor > 1 && cedarLine.canApply && Math.abs(cedarLine.suggestedRate - 36 / 500 / cedarBasis.factor) < 1e-4, { cedarBasis, cedarLine });

ok("no estimated hours → no line at all", labourCalibration({ estimatedHours: null, approvedHours: 10, groups: [] }) === null && labourCalibration({ estimatedHours: 0, approvedHours: 10, groups: [] }) === null);
ok("no approved hours → no_actual", labourCalibration({ estimatedHours: 16, approvedHours: 0, groups: [] }).reason === LABOUR_REASONS.NO_ACTUAL);
ok("pending hours → hours_pending, no suggestion (a short actual would teach a fast rate)",
  (() => { const l = labourCalibration({ estimatedHours: sidingHours, approvedHours: 21, pendingHours: 3, groups: [{ categoryKey: "siding", labourHours: sidingHours, basis: sidingBasis }] }); return l.reason === LABOUR_REASONS.HOURS_PENDING && !l.canApply && l.suggestedRate === null; })());
ok("two trades on one job → multi_group (hours are per job, not per trade)",
  labourCalibration({ estimatedHours: 40, approvedHours: 50, groups: [{ categoryKey: "siding", labourHours: 16, basis: sidingBasis }, { categoryKey: "roofing_service", labourHours: 24, basis: { units: 20, unitLabel: "sqft", path: null, store: null } }] }).reason === LABOUR_REASONS.MULTI_GROUP);
ok("hours the estimator added by hand → hand_added_hours, comparison still shown",
  (() => { const l = labourCalibration({ estimatedHours: sidingHours + 4, approvedHours: 21, groups: [{ categoryKey: "siding", labourHours: sidingHours, basis: sidingBasis }] }); return l.reason === LABOUR_REASONS.HAND_ADDED_HOURS && !l.canApply && l.actualPerUnit === 0.042; })());
ok("approved exactly the estimate → matches",
  labourCalibration({ estimatedHours: sidingHours, approvedHours: sidingHours, groups: [{ categoryKey: "siding", labourHours: sidingHours, basis: sidingBasis }] }).reason === LABOUR_REASONS.MATCHES);

const cabinetBasis = labourBasisFor({ categoryKey: "cabinet_refinishing", intake: { doorCount: 20, drawerCount: 8 } });
ok("cabinets: doors + drawers is the denominator and there is NO path (eleven steps, one total)", cabinetBasis?.units === 28 && cabinetBasis.unitLabel === "doorsDrawers" && cabinetBasis.path === null);
const cabinetLine = labourCalibration({ estimatedHours: 40, approvedHours: 48, groups: [{ categoryKey: "cabinet_refinishing", labourHours: 40, basis: cabinetBasis }] });
ok("...so the line compares per door+drawer and says not_overridable — never a button", cabinetLine.reason === LABOUR_REASONS.NOT_OVERRIDABLE && !cabinetLine.canApply && cabinetLine.actualPerUnit === Math.round((48 / 28) * 1e4) / 1e4, cabinetLine);
const extBasis = labourBasisFor({ categoryKey: "exterior_painting", intake: { wallSquareFootage: 2000 } });
ok("exterior painting by intake: wall sqft, no path (walls + prep + trim + doors)", extBasis?.units === 2000 && extBasis.unitLabel === "sqftWalls" && extBasis.path === null);
ok("roofing (itemised): sqft, no path", (() => { const b = labourBasisFor({ categoryKey: "roofing_service", takeoff: { sqft: 2000, squares: 20 } }); return b?.path === null && b.units === 2000; })());
ok("a trade with no takeoff and no intake → null basis", labourBasisFor({ categoryKey: "plumbing" }) === null);

/* ══ 3. The settings route, called ═══════════════════════════════════════ */

console.log("\nPUT /api/settings/cost-revision: the recipe PUT's gate, refusals out loud");

const settings = await import("@/app/api/settings/cost-revision/route");
for (const who of [OWNER, MANAGER, DISPATCHER]) {
  become(who);
  writes.length = 0;
  const res = await settings.PUT(req("http://x/api/settings/cost-revision", { thresholdPct: 20 }, "PUT"));
  const allowed = canWriteCostBasis(who.member, "materialRecipes");
  if (allowed) {
    ok(`${who.name} may set the threshold (same gate as the recipe PUT)`, res.status === 200 && res.body.thresholdPct === 20, res);
    ok(`...and the write is tenant-scoped to the caller's own company`, writes.some((w) => w.model === "company" && w.action === "update" && w.args.where.id === "co" && w.args.data.costRevisionThresholdPct === 20), writes);
  } else {
    ok(`${who.name} is refused (403) with a sentence`, res.status === 403 && String(res.body?.error || "").length > 20, res);
    ok(`...and nothing was written`, !writes.some((w) => w.action === "update"));
  }
  const get = await settings.GET(req("http://x/api/settings/cost-revision", undefined, "GET"));
  ok(`${who.name}: GET ${allowed ? "answers the threshold" : "is refused too (write ⇒ read)"}`, allowed ? get.status === 200 && get.body.thresholdPct === 15 : get.status === 403, get);
}
become(OWNER);
for (const bad of [150, -1, 14.5, "abc", "", null]) {
  writes.length = 0;
  const res = await settings.PUT(req("http://x/api/settings/cost-revision", { thresholdPct: bad }, "PUT"));
  ok(`PUT ${JSON.stringify(bad)} is refused (400), never clamped`, res.status === 400 && !writes.some((w) => w.action === "update"), res);
}
ok("PUT with an unparsable body is a 400, not a 500", (await settings.PUT(req("http://x/api/settings/cost-revision", undefined, "PUT"))).status === 400);
const settingsSrc = code("app/api/settings/cost-revision/route.js");
ok("the route's gate IS requireCostBasisWrite on materialRecipes", /requireCostBasisWrite\(full, "materialRecipes"\)/.test(settingsSrc) && /requireCostBasisRead\(full, "materialRecipes"\)/.test(settingsSrc));
ok("...and PUT never consults impersonation (the carve-out is read-only)", !/PUT[\s\S]*member\.impersonation/.test(settingsSrc.slice(settingsSrc.indexOf("export async function PUT"))));

/* ══ 4. The revision route, called ═══════════════════════════════════════ */

console.log("\nPOST /api/jobs/[id]/costing/revision: the review endpoint's gates, one decision");

const revision = await import("@/app/api/jobs/[id]/costing/revision/route");
const params = { params: Promise.resolve({ id: "j1" }) };
become(DISPATCHER);
jobRow = { ...JOB };
writes.length = 0;
let res = await revision.POST(req("http://x", { decision: "left_as_is" }), params);
ok("a Dispatcher (jobCosting:false) is refused", res.status === 403 && !writes.some((w) => w.action === "update"), res);

become(OWNER);
jobRow = { ...JOB };
writes.length = 0;
res = await revision.POST(req("http://x", { decision: "nope" }), params);
ok("an unrecognised decision is a 400", res.status === 400 && !writes.some((w) => w.action === "update"), res);
res = await revision.POST(req("http://x", undefined), params);
ok("no body is a 400, not a 500", res.status === 400);

jobRow = { ...JOB, status: "in_progress" };
res = await revision.POST(req("http://x", { decision: "left_as_is" }), params);
ok("a job that is not completed is refused (409)", res.status === 409, res);

jobRow = { ...JOB };
writes.length = 0;
res = await revision.POST(req("http://x", { decision: "left_as_is" }), params);
ok("owner: Leave as is is recorded", res.status === 200 && res.body.decision === "left_as_is" && res.body.alreadyDecided === false && res.body.decidedAt instanceof Date, res);
const upd = writes.find((w) => w.model === "job" && w.action === "update");
ok("...written on the caller's own company's job, decision + timestamp and nothing else", upd && upd.args.where.id === "j1" && upd.args.where.companyId === "co" && Object.keys(upd.args.data).sort().join() === "costRevisionDecidedAt,costRevisionDecision", upd);
const lookup = writes.find((w) => w.model === "job" && w.action === "findFirst");
ok("...the lookup proved the tenant", lookup?.args?.where?.companyId === "co");
writes.length = 0;
res = await revision.POST(req("http://x", { decision: "updated" }), params);
ok("a second answer reports the first and writes nothing (asked once)", res.status === 200 && res.body.decision === "left_as_is" && res.body.alreadyDecided === true && !writes.some((w) => w.action === "update"), res);

const revisionSrc = code("app/api/jobs/[id]/costing/revision/route.js");
const reviewSrc = code("app/api/jobs/[id]/costing/review/route.js");
const calibSrc = code("app/api/jobs/[id]/costing/calibration/route.js");
for (const gate of [/hasToggle\(full, "jobCosting"\)/, /requireLevel\(full, "jobs", "view_create_edit", "edit jobs"\)/, /companyId: member\.companyId, \.\.\.assignedJobWhere\(full\)/, /levelOrRefusal\(member, "jobs", "view_only"/]) {
  ok(`revision, review and calibration share gate ${gate}`, gate.test(revisionSrc) && gate.test(reviewSrc) && gate.test(calibSrc));
}
ok("the review route accepts revisionDecision through the same normaliser", /normaliseRevisionDecision\(body\.revisionDecision\)/.test(reviewSrc));
ok("...and writes it ONLY when the job has not decided already", /const decides = Boolean\(revisionDecision\) && !job\.costRevisionDecision;/.test(reviewSrc) && /\.\.\.\(decides && \{ costRevisionDecision: revisionDecision, costRevisionDecidedAt: new Date\(\) \}\)/.test(reviewSrc));
ok("the calibration route returns a labour line built by labourCalibration", /labourCalibration\(\{/.test(calibSrc) && /labour,\s*\}\);/.test(calibSrc) && /LABOUR_REASONS\.PERMISSION/.test(calibSrc));
ok("...from the SAME hour arithmetic as the panel (actualJobCost)", /actualJobCost\(\[\], job\.timeEntries\)\.labour/.test(calibSrc));
ok("...and still never writes", !/db\.\w+\.(update|create|upsert|delete)/.test(calibSrc));

const costing = code("app/api/jobs/[id]/costing/route.js");
ok("the costing GET reads the company's threshold and the job's decision", /costRevisionThresholdPct: true/.test(costing) && /costRevisionDecision: true/.test(costing) && /costRevisionDecidedAt: true/.test(costing));
ok("...decides `ask` with shouldAskRevision on the SAME variancePct the panel shows", /ask: shouldAskRevision\(\{\s*variancePct: comparison\.variancePct,\s*thresholdPct,\s*decision: job\.costRevisionDecision,/.test(costing));
ok("...and returns estimatedHours from the same source as the estimated cost", /estimatedHours = quotedCost \? \(quotedCost\.labourHours \?\? null\) : null/.test(costing) && /estimatedHours,\s*revision,/.test(costing));
const qce = code("lib/costing/quoteCostEstimate.js");
ok("quotedCostFor carries labourHours from the saved row and from the derivation", /labourHours: hoursOrNull\(quote\.costing\.labourHours\)/.test(qce) && /labourHours: hoursOrNull\(derived\.labourHours\)/.test(qce));

const schema = read("prisma/schema.prisma");
ok("Company.costRevisionThresholdPct defaults to 15", /costRevisionThresholdPct Int @default\(15\)/.test(schema));
ok("Job carries costRevisionDecision and costRevisionDecidedAt", /costRevisionDecision\s+String\?/.test(schema) && /costRevisionDecidedAt DateTime\?/.test(schema));

/* ══ 5. The modal ════════════════════════════════════════════════════════ */

console.log("\nCostReview.js: two buttons under the question only, one write path each");

const modal = code("app/components/jobs/CostReview.js");
const updateBtn = modal.match(/app\.jobCosting\.revisionUpdate"/g) || [];
ok("the Update button renders exactly once, inside `asking && !revealing && (`", updateBtn.length === 1 && /asking && !revealing && \([\s\S]{0,1200}app\.jobCosting\.revisionUpdate"/.test(modal));
ok("Leave as is renders under the question and under the open suggestions, nowhere else", (modal.match(/app\.jobCosting\.revisionLeave"/g) || []).length === 2 && /asking && !revealing && \([\s\S]{0,1800}app\.jobCosting\.revisionLeave"/.test(modal) && /\{!decision && \([\s\S]{0,400}app\.jobCosting\.revisionLeave"/.test(modal));
ok("`asking` is the route's decision AND no local answer", /const asking = Boolean\(revision\.ask\) && !decision;/.test(modal));
ok("Leave as is / Done / the first apply all record through ONE route", /fetch\(`\/api\/jobs\/\$\{jobId\}\/costing\/revision`/.test(modal) && (modal.match(/recordDecision\(REVISION_DECISIONS\.(LEFT_AS_IS|UPDATED)\)/g) || []).length >= 4);
ok("...never swallowing a failed decision", /await reportResponseError\(res, t\("app\.jobCosting\.revisionDecisionFailed"/.test(modal));
ok("the suggestions (materials + labour) render only inside `revealing && (`", /\{revealing && \([\s\S]*?app\.jobCosting\.calibTitle"/.test(modal) && !/calibLines\.length > 0 && calib\.hasActuals/.test(modal));
ok("...with the labour apply button drawn only under labourLine.canApply", /labourLine\.canApply \? \(\s*<button[\s\S]{0,600}app\.jobCosting\.labourCalibApply"/.test(modal) && (modal.match(/app\.jobCosting\.labourCalibApply"/g) || []).length === 1);
ok("a used quantity goes through the materials PATCH with actualQty — no second write path",
  /fetch\(`\/api\/jobs\/\$\{jobId\}\/materials`, \{\s*method: "PATCH"/.test(modal) && /materialId: m\.id,\s*actualQty: qty,/.test(modal) && (modal.match(/actualQty:/g) || []).length === 1);
ok("...ticking an unbought line as bought with the save, and saying so", /\.\.\.\(m\.purchasedAt \? \{\} : \{ purchased: true \}\)/.test(modal) && /app\.jobCosting\.usedSaveMarksBought"/.test(modal));
ok("...prefilled from the recorded actual, else the estimate", /return String\(m\.actualQty \?\? m\.qty \?\? ""\);/.test(modal));
ok("the materials come from the SAME GET the materials panel reads", /fetch\(`\/api\/jobs\/\$\{jobId\}\/materials`\)/.test(modal));
ok("the labour section links pending hours to payroll", /href="\/app\/payroll"/.test(modal));
ok("completing while the question is open sends left_as_is explicitly…", /\.\.\.\(asking && \{ revisionDecision: REVISION_DECISIONS\.LEFT_AS_IS \}\)/.test(modal));
ok("…and says so under the button", /\{asking && \(\s*<p[\s\S]{0,200}app\.jobCosting\.completeLeavesAsIs"/.test(modal));
ok("the verdict is one line with the percentage as a number param", /app\.jobCosting\.verdictOver"[\s\S]{0,300}pct: fmtNum\(pct\)/.test(modal) && /app\.jobCosting\.revisionPrompt"[^\n]*\{ pct: fmtNum\(pct\) \}/.test(modal));
ok("the decision line shows once decided", /app\.jobCosting\.revisionUpdated"/.test(modal) && /app\.jobCosting\.revisionLeft"/.test(modal));
ok("sections run labour → materials → verdict, top to bottom",
  (() => { const a = modal.indexOf('t("app.jobCosting.labourTitle"'); const b = modal.indexOf('id="cost-review-materials"'); const c = modal.indexOf("{verdict}"); return a > 0 && b > a && c > b; })());

const panel = code("app/components/jobs/JobCosting.js");
ok("the panel's review card says which way the job decided", /data\.revision\?\.decision === "updated"/.test(panel) && /data\.revision\?\.decision === "left_as_is"/.test(panel) && /app\.jobCosting\.revisionUpdated"/.test(panel) && /app\.jobCosting\.revisionLeft"/.test(panel));

const page = code("app/app/settings/material-costs/page.js");
ok("Settings → Material Costs reads and writes the threshold through the gated route", /fetch\("\/api\/settings\/cost-revision"\)/.test(page) && /fetch\("\/api\/settings\/cost-revision", \{\s*method: "PUT"/.test(page));
ok("...refuses a bad value before the request, with the same rule", /!Number\.isInteger\(n\) \|\| n < 0 \|\| n > 100/.test(page) && /app\.setMaterialCosts\.revisionInvalid"/.test(page));
ok("...and says when it could not load rather than hiding the card", /app\.setMaterialCosts\.revisionLoadFailed"/.test(page) && /await reportResponseError\(res, setLoadError\)/.test(page));

const materialsRoute = code("app/api/jobs/[id]/materials/route.js");
ok("the materials PATCH refuses a used quantity on an unbought line out loud (it used to drop it)", /if \(actualQty !== undefined && !purchased\) \{[\s\S]{0,300}status: 400/.test(materialsRoute));

/* ══ 6. Nine catalogues ══════════════════════════════════════════════════ */

console.log("\nEvery new string in all nine catalogues");

const catalogue = read("app/i18n/appMessages.js");
const literalKeys = [...new Set([
  ...[...modal.matchAll(/t\(\s*"(app\.jobCosting\.[a-zA-Z_]+)"/g)].map((m) => m[1]),
  // The panel's OLDER keys have known gaps (see check-job-cost-review.mjs);
  // only the two this slice added are swept here.
  ...[...panel.matchAll(/t\(\s*"(app\.jobCosting\.revision[a-zA-Z_]+)"/g)].map((m) => m[1]),
  ...[...page.matchAll(/t\(\s*"(app\.setMaterialCosts\.revision[a-zA-Z_]+)"/g)].map((m) => m[1]),
])];
const dynamicKeys = [
  ...Object.values(LABOUR_REASONS).map((r) => `app.jobCosting.labourReason_${r}`),
  "app.jobCosting.calibUnit_sqft",
  "app.jobCosting.calibUnit_sqftWalls",
  "app.jobCosting.calibUnit_doorsDrawers",
  "app.jobCosting.calibRate_hoursPerSqft",
];
for (const k of [...new Set([...literalKeys, ...dynamicKeys])]) {
  const n = (catalogue.match(new RegExp(`"${k.replace(/\./g, "\\.")}": `, "g")) || []).length;
  ok(`${k} exists in all nine catalogues`, n === 9, n);
}
ok("no new string types its own currency symbol", !/"app\.jobCosting\.(verdict|revision|labour|materials|used|col|est|noPrice)[A-Za-z_]*": "[^"]*\$/.test(catalogue) && !/"app\.setMaterialCosts\.revision[A-Za-z_]*": "[^"]*\$/.test(catalogue));
ok("the percentage strings take the number as a param, never bake one in", /"app\.jobCosting\.revisionPrompt": "[^"]*\{pct\}%/.test(catalogue) && !/"app\.jobCosting\.revisionPrompt": "[^"]*\b15%/.test(catalogue));

console.log(`\ncheck-cost-revision: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
