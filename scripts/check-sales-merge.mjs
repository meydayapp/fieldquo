// scripts/check-sales-merge.mjs
//
//   npm run check:sales-merge
//
// Merging flagged-duplicate prospects without losing anything
// (lib/sales/discovery/mergeProspects.js, mergedReads.js, duplicateGroup.js).
//
// ══ What is executed, not read ════════════════════════════════════════════
//
//   1. planFills — fills ONLY empty fields; takes them in a deterministic
//      order (phone match, then domain, then name, then oldest); grouped
//      fields (website + domain + hasWebsite) come from ONE row; a street
//      line never crosses towns; the other row's name becomes a trading name.
//   2. planMerge — refuses a self-merge, an already-retired row, and two
//      live claims by two reps (naming both); a lapsed claim is not a claim;
//      the live claim moves; the survivor's own flag at a retired row clears;
//      the funnel deltas come from reviewFolder's table.
//   3. applyMerge against an in-memory client — fills written, others
//      retired, numbers moved except the one the survivor already had, leads
//      / claims / attempts moved, audit row, mergedFrom appended, nothing
//      deleted; a rep claiming between preview and press turns the write
//      into a refusal that leaves the store untouched.
//   4. unmerge — restores exactly: filled fields cleared, a field a human
//      changed since is kept and named, rows reactivated, children moved
//      back, counters reversed, autofill entries kept.
//   5. The shared where-builders exclude retired rows — executed against a
//      matcher, not read.
//   6. Ingest — a retired row's source record resolves to its survivor as a
//      fill-only update; a phone match plans an autofill AND still flags; a
//      name match plans none.
//   7. mergedReads.unionAnalysis — own row per code wins, evidence appended,
//      borrowed rows tagged.
//   8. Wiring — the routes exist and gate on superadmin, the panel is mounted
//      on both pages, both read routes union, nine languages carry the rep
//      line, the audit actions are registered, the schema has the columns.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Each guarantee was broken on disk, the break confirmed, this script
// confirmed to FAIL, and the file restored from a `cp` backup.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  MERGE_FIELDS,
  planFills,
  planMerge,
  applyMerge,
  applyFills,
  unmerge,
  matchVia,
  orderOthers,
  mergedFromIds,
  survivorFillCounters,
} from "../lib/sales/discovery/mergeProspects.js";
import { unionAnalysis } from "../lib/sales/discovery/mergedReads.js";
import { buildGroup, previewMerge, GROUP_COLUMNS } from "../lib/sales/discovery/duplicateGroup.js";
import { buildDedupeIndex, matchExisting, AUTOFILL_VIAS } from "../lib/sales/discovery/dedupe.js";
import { planIngest } from "../lib/sales/discovery/ingest.js";
import { mergeRetireEffects, fillEffects, untouchableGuardWhere, untouchableGuardSql, reviewWhereSql } from "../lib/sales/discovery/reviewFolder.js";
import { claimCandidateWhere, queueWhere, mergedRows, prospectFacts } from "../lib/sales/prospectView.js";
import { funnelProblems } from "../lib/sales/discovery/funnel.js";
import { AUDIT_ACTIONS } from "../lib/platform/auditActions.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

const NOW = new Date("2026-09-14T15:00:00Z");
const LATER = new Date(NOW.getTime() + 3600 * 1000);
const EARLIER = new Date(NOW.getTime() - 3600 * 1000);

const row = (over = {}) => ({
  id: "x",
  businessName: "Acme Painting",
  tradingNames: [],
  sourceProvider: "rbq",
  sourceRecordId: null,
  licenceNumber: null,
  campaignId: "c1",
  status: "discovered",
  classification: "contractor",
  possibleDuplicateOfId: null,
  mergedIntoId: null,
  mergedFrom: null,
  assignedRepId: null,
  assignedAt: null,
  claimExpiresAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  ...Object.fromEntries(MERGE_FIELDS.map((f) => [f, null])),
  ...over,
});

/* ═══════════════════════════════════════════════════════════════════════════
   1. planFills
   ═══════════════════════════════════════════════════════════════════════════ */

section("1. planFills — only empty fields, deterministic order, grouped");
{
  const survivor = row({ id: "s", phoneE164: "+15145550100", city: "Laval", tradeKey: null, websiteUrl: null, sourceProvider: "rbq", licenceNumber: "1234-5678-01" });
  const byPhone = row({ id: "p", sourceProvider: "overture", phoneE164: "+15145550100", websiteUrl: "https://acme.ca", domain: "acme.ca", hasWebsite: true, tradeKey: "painting", city: "Laval", addressLine: "1 Rue X", postalCode: "H7A 1A1", createdAt: new Date("2026-02-01") });
  const byName = row({ id: "n", sourceProvider: "us_ca_cslb", businessName: "Acme Painting Inc", city: "Laval", websiteUrl: "https://other.example", domain: "other.example", hasWebsite: true, email: "hi@acme.ca", emailSource: "site", createdAt: new Date("2026-01-15") });

  const { fills, tradingNames } = planFills(survivor, [byName, byPhone]);
  const by = Object.fromEntries(fills.map((f) => [f.field, f]));
  ok("the survivor's phone (set) is not touched", !by.phoneE164);
  ok("website comes from the PHONE match, not the earlier-created name match", by.websiteUrl?.from === "p" && by.websiteUrl.value === "https://acme.ca");
  ok("...and domain and hasWebsite come from the SAME row", by.domain?.from === "p" && by.hasWebsite?.from === "p");
  ok("the trade comes from the phone match", by.tradeKey?.value === "painting" && by.tradeKey.source === "overture");
  ok("email comes from the only row that has one", by.email?.from === "n" && by.emailSource?.from === "n");
  ok("every fill names the row and its source", fills.every((f) => f.from && "source" in f && f.via));
  ok("the other rows' names become trading names", Array.isArray(tradingNames) && tradingNames.includes("Acme Painting Inc") && !tradingNames.includes("Acme Painting"));
  ok("orderOthers is phone, then name (domain differs), then by createdAt", orderOthers(survivor, [byName, byPhone]).map((o) => o.row.id).join(",") === "p,n");
  ok("matchVia: phone / name / none", matchVia(survivor, byPhone) === "phone" && matchVia(survivor, byName) === "name" && matchVia(survivor, row({ id: "z", businessName: "Zed", city: "Hull" })) === "none");

  // A street line never crosses towns.
  const inGatineau = row({ id: "g", city: "Gatineau", addressLine: "9 Rue Y", postalCode: "J8T 1A1", phoneE164: "+15145550100" });
  const f2 = planFills(survivor, [inGatineau]);
  const b2 = Object.fromEntries(f2.fills.map((f) => [f.field, f]));
  ok("a street line from another town is NOT taken", !b2.addressLine && !b2.postalCode);
  const noCity = row({ id: "s2", city: null });
  const f3 = planFills(noCity, [inGatineau]);
  ok("...but a survivor with no town takes the street AND the town", f3.fills.some((f) => f.field === "addressLine") && f3.fills.some((f) => f.field === "city" && f.value === "Gatineau"));

  // The survivor has a website but no domain: the gap stays.
  const halfSite = row({ id: "h", websiteUrl: "https://mine.ca", domain: null });
  ok("a member of a group is not filled under the survivor's own lead", !planFills(halfSite, [byPhone]).fills.some((f) => f.field === "domain"));

  // Do-not-contact travels.
  const dnc = row({ id: "d", phoneE164: "+15145550100", doNotContactAt: NOW, doNotContactReason: "They said stop." });
  const f4 = planFills(survivor, [dnc]);
  ok("do-not-contact on the other row is carried to the survivor, with its reason", f4.fills.some((f) => f.field === "doNotContactAt") && f4.fills.some((f) => f.field === "doNotContactReason"));

  ok("nothing to fill → no fills, no trading names", planFills(byPhone, [row({ id: "e", businessName: "Acme Painting" })]).fills.length === 0 && planFills(byPhone, [row({ id: "e", businessName: "Acme Painting" })]).tradingNames === null);
  ok("empty strings count as empty", planFills(row({ id: "q", email: "  " }), [row({ id: "r", email: "a@b.c" })]).fills.some((f) => f.field === "email"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. planMerge
   ═══════════════════════════════════════════════════════════════════════════ */

section("2. planMerge — refusals, the claim, the flag, the funnel");
{
  const s = row({ id: "s", phoneE164: "+15145550100", classification: "contractor", tradeKey: null, status: "discovered" });
  const o = row({ id: "o", phoneE164: "+15145550100", tradeKey: "painting", possibleDuplicateOfId: "s", createdAt: new Date("2026-03-01") });
  ok("self-merge refused", planMerge({ survivor: s, others: [s], now: NOW }).ok === false);
  ok("no others refused", planMerge({ survivor: s, others: [], now: NOW }).ok === false);
  ok("a retired survivor refused", planMerge({ survivor: { ...s, mergedIntoId: "z" }, others: [o], now: NOW }).ok === false);
  ok("an already-retired other refused", planMerge({ survivor: s, others: [{ ...o, mergedIntoId: "z" }], now: NOW }).ok === false);
  ok("the same row twice refused", planMerge({ survivor: s, others: [o, { ...o }], now: NOW }).ok === false);

  const heldA = { ...s, assignedRepId: "repA", claimExpiresAt: LATER };
  const heldB = { ...o, assignedRepId: "repB", claimExpiresAt: LATER };
  const two = planMerge({ survivor: heldA, others: [heldB], now: NOW, repNames: { repA: "Ana", repB: "Ben" } });
  ok("two live claims by two reps: REFUSED", two.ok === false);
  ok("...and the refusal names both reps", /Ana/.test(two.error) && /Ben/.test(two.error), two.error);
  ok("a LAPSED claim is not a claim", planMerge({ survivor: heldA, others: [{ ...heldB, claimExpiresAt: EARLIER }], now: NOW }).ok === true);
  ok("the same rep on both: fine, nothing moves", (() => { const r = planMerge({ survivor: heldA, others: [{ ...heldB, assignedRepId: "repA" }], now: NOW }); return r.ok && r.plan.claimMove === null; })());
  const move = planMerge({ survivor: s, others: [heldB], now: NOW });
  ok("only the other row held: the claim moves to the survivor", move.ok && move.plan.claimMove?.repId === "repB" && move.plan.claimMove.from === "o");
  ok("a worked claim (no expiry) on the other row moves too", planMerge({ survivor: s, others: [{ ...heldB, claimExpiresAt: null }], now: NOW }).plan.claimMove?.repId === "repB");

  const flagged = planMerge({ survivor: { ...s, possibleDuplicateOfId: "o" }, others: [o], now: NOW });
  ok("the survivor's flag AT a retired row is cleared", flagged.plan.clearFlag === "o");
  ok("a flag at a third row stays", planMerge({ survivor: { ...s, possibleDuplicateOfId: "third" }, others: [o], now: NOW }).plan.clearFlag === null);

  const p = planMerge({ survivor: s, others: [o], now: NOW }).plan;
  ok("the plan records each retired row with its match reason", p.retired.length === 1 && p.retired[0].id === "o" && p.retired[0].via === "phone");
  ok("the retired row's funnel delta: leaves accepted, enters duplicates", JSON.stringify(p.counters[0].counters) === JSON.stringify({ acceptedCount: -1, noWebsiteCount: -1, duplicateCount: 1 }), p.counters[0].counters);
  ok("the survivor gains a trade: banked → accepted on ITS campaign", p.survivorCounters && p.survivorCounters.campaignId === "c1" && p.survivorCounters.counters.unmappedCount === -1 && p.survivorCounters.counters.bankedCount === -1 && p.survivorCounters.counters.acceptedCount === 1, p.survivorCounters);
  ok("mergeRetireEffects on a rejected row moves nothing", Object.keys(mergeRetireEffects(row({ status: "rejected" })).counters).length === 0);
  ok("fillEffects: accepted row gaining a phone enters readyCount only", JSON.stringify(fillEffects(row({ tradeKey: "x", addressLine: "1 A" }), row({ tradeKey: "x", addressLine: "1 A", phoneE164: "+15145550100" }))) === JSON.stringify({ readyCount: 1 }));
  ok("survivorFillCounters null with no campaign", survivorFillCounters(row({ campaignId: null }), [{ field: "tradeKey", value: "x" }]) === null);

  // The funnel keeps adding up through a retire.
  const campaign = { foundCount: 10, unmappedCount: 3, bankedCount: 3, duplicateCount: 0, rejectedCount: 1, needsReviewCount: 2, acceptedCount: 4, readyCount: 2, noWebsiteCount: 1 };
  const after = { ...campaign };
  for (const [k, v] of Object.entries(p.counters[0].counters)) after[k] += v;
  for (const [k, v] of Object.entries(p.survivorCounters.counters)) after[k] += v;
  ok("funnelProblems() stays empty after retire + survivor fill", funnelProblems(after).length === 0, after);
}

/* ═══════════════════════════════════════════════════════════════════════════
   An in-memory client
   ═══════════════════════════════════════════════════════════════════════════ */

function matches(rowv, where = {}) {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "OR") return cond.some((c) => matches(rowv, c));
    if (field === "AND") return cond.every((c) => matches(rowv, c));
    if (cond === null) return rowv[field] == null;
    if (cond instanceof Date) return rowv[field]?.getTime?.() === cond.getTime();
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      for (const [op, value] of Object.entries(cond)) {
        if (op === "not") { if (value === null ? rowv[field] == null : rowv[field] === value) return false; continue; }
        if (op === "in") { if (!value.includes(rowv[field])) return false; continue; }
        if (op === "notIn") { if (value.includes(rowv[field])) return false; continue; }
        if (op === "lt") { if (!(rowv[field] != null && new Date(rowv[field]) < new Date(value))) return false; continue; }
        if (op === "gt") { if (!(rowv[field] != null && new Date(rowv[field]) > new Date(value))) return false; continue; }
        throw new Error(`matches: operator "${op}" not implemented — the proof would be vacuous`);
      }
      return true;
    }
    return rowv[field] === cond;
  });
}

function table(rows) {
  const store = rows.map((r) => ({ ...r }));
  return {
    store,
    async findMany({ where = {} } = {}) { return store.filter((r) => matches(r, where)).map((r) => ({ ...r })); },
    async findUnique({ where }) { const f = store.find((r) => r.id === where.id); return f ? { ...f } : null; },
    async update({ where, data }) {
      const f = store.find((r) => r.id === where.id);
      if (!f) throw new Error(`no row ${where.id}`);
      applyData(f, data);
      return { ...f };
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const r of store) { if (!matches(r, where)) continue; applyData(r, data); count++; }
      return { count };
    },
    async create({ data }) { const r = { id: `n${store.length + 1}`, ...data }; store.push(r); return { ...r }; },
    async count({ where = {} } = {}) { return store.filter((r) => matches(r, where)).length; },
  };
}
function applyData(r, data) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && "increment" in v) r[k] = (r[k] || 0) + v.increment;
    else if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && "decrement" in v) r[k] = (r[k] || 0) - v.decrement;
    else if (v && typeof v === "object" && v.constructor?.name === "DbNull") r[k] = null;
    else if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && Object.keys(v).length === 0 && v.constructor !== Object) r[k] = null; // Prisma.DbNull
    else r[k] = v;
  }
}

function makeClient({ prospects = [], campaigns = [], numbers = [], leads = [], claims = [], attempts = [] } = {}) {
  const t = {
    prospect: table(prospects),
    prospectCampaign: table(campaigns),
    salesContactNumber: table(numbers),
    salesLead: table(leads),
    salesQueueClaim: table(claims),
    salesCallAttempt: table(attempts),
    platformAuditLog: table([]),
  };
  const db = {
    ...t,
    // The jsonb append. The fake reads the Prisma.sql fragment's values —
    // [json, id] — and appends to the row's array.
    async $executeRaw(sql) {
      const text = sql.strings.join("?");
      if (!/"mergedFrom"/.test(text)) throw new Error(`unexpected raw SQL: ${text}`);
      const [json, id] = sql.values;
      const r = t.prospect.store.find((x) => x.id === id);
      if (!r) return 0;
      r.mergedFrom = [...(Array.isArray(r.mergedFrom) ? r.mergedFrom : []), ...JSON.parse(json)];
      return 1;
    },
    async $transaction(fn) {
      const snap = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.store.map((r) => ({ ...r }))]));
      try {
        return await fn(db);
      } catch (err) {
        for (const [k, v] of Object.entries(t)) v.store.splice(0, v.store.length, ...snap[k]);
        throw err;
      }
    },
  };
  return { db, t };
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. applyMerge
   ═══════════════════════════════════════════════════════════════════════════ */

const fixture = () => ({
  prospects: [
    row({ id: "s", phoneE164: "+15145550100", classification: "contractor", tradeKey: null, addressLine: "1 Rue X", city: "Laval", possibleDuplicateOfId: null, sourceProvider: "rbq" }),
    row({ id: "o", phoneE164: "+15145550100", tradeKey: "painting", websiteUrl: "https://acme.ca", domain: "acme.ca", hasWebsite: true, city: "Laval", possibleDuplicateOfId: "s", assignedRepId: "repB", assignedAt: EARLIER, claimExpiresAt: LATER, createdAt: new Date("2026-03-01"), sourceProvider: "overture" }),
    row({ id: "third", businessName: "Acme Painting Co", city: "Laval", possibleDuplicateOfId: "o", createdAt: new Date("2026-04-01") }),
    row({ id: "unrelated", businessName: "Zed Roofing", city: "Hull" }),
  ],
  campaigns: [{ id: "c1", foundCount: 10, unmappedCount: 3, bankedCount: 3, duplicateCount: 0, rejectedCount: 1, needsReviewCount: 2, acceptedCount: 4, readyCount: 2, noWebsiteCount: 1 }],
  numbers: [
    { id: "num1", prospectId: "s", e164: "+15145550100", createdAt: EARLIER },
    { id: "num2", prospectId: "o", e164: "+15145550100", createdAt: EARLIER },
    { id: "num3", prospectId: "o", e164: "+15145550199", createdAt: EARLIER },
  ],
  leads: [{ id: "lead1", prospectId: "o", salesRepId: "repB" }],
  claims: [{ id: "cl1", prospectId: "o", salesRepId: "repB" }],
  attempts: [{ id: "att1", prospectId: "o", salesRepId: "repB" }, { id: "att2", prospectId: "s", salesRepId: "repA" }],
});

section("3. applyMerge — against an in-memory client");
let mergedPlan = null;
let clientAfterMerge = null;
{
  const { db, t } = makeClient(fixture());
  const before = { prospects: t.prospect.store.length, numbers: t.salesContactNumber.store.length, leads: t.salesLead.store.length, claims: t.salesQueueClaim.store.length, attempts: t.salesCallAttempt.store.length };
  const rows = await db.prospect.findMany({ where: { id: { in: ["s", "o"] } } });
  const plan = previewMerge({ survivorId: "s", otherIds: ["o"], rows, reps: [{ id: "repB", name: "Ben" }], now: NOW });
  ok("previewMerge plans from the group's rows", plan.ok === true, plan.error);
  const result = await applyMerge({ db, plan: plan.plan, adminId: "admin1", now: NOW });
  ok("applied", result.ok === true, result.error);
  const s = t.prospect.store.find((r) => r.id === "s");
  const o = t.prospect.store.find((r) => r.id === "o");
  const third = t.prospect.store.find((r) => r.id === "third");
  ok("the survivor's empty fields are filled", s.tradeKey === "painting" && s.websiteUrl === "https://acme.ca" && s.domain === "acme.ca" && s.hasWebsite === true);
  ok("...and its set fields untouched", s.phoneE164 === "+15145550100" && s.addressLine === "1 Rue X" && s.sourceProvider === "rbq");
  ok("the other row is retired, not deleted, status kept", o.mergedIntoId === "s" && o.mergedAt?.getTime() === NOW.getTime() && o.status === "discovered" && o.tradeKey === "painting");
  ok("nothing deleted anywhere", t.prospect.store.length === before.prospects && t.salesContactNumber.store.length === before.numbers && t.salesLead.store.length === before.leads && t.salesQueueClaim.store.length === before.claims && t.salesCallAttempt.store.length === before.attempts);
  const nums = Object.fromEntries(t.salesContactNumber.store.map((n) => [n.id, n.prospectId]));
  ok("the number the survivor already had stays on the retired row; the new one moves", nums.num1 === "s" && nums.num2 === "o" && nums.num3 === "s");
  ok("lead, claim and attempt moved to the survivor; the survivor's own attempt untouched", t.salesLead.store[0].prospectId === "s" && t.salesQueueClaim.store[0].prospectId === "s" && t.salesCallAttempt.store.find((a) => a.id === "att1").prospectId === "s" && t.salesCallAttempt.store.find((a) => a.id === "att2").prospectId === "s");
  ok("the live claim moved onto the survivor", s.assignedRepId === "repB" && s.claimExpiresAt?.getTime() === LATER.getTime());
  ok("the third row's flag is repointed at the survivor", third.possibleDuplicateOfId === "s");
  ok("the survivor's mergedFrom carries the plan: retired ids, fills, moved ids", Array.isArray(s.mergedFrom) && s.mergedFrom.length === 1 && s.mergedFrom[0].kind === "merge" && s.mergedFrom[0].retired[0].id === "o" && s.mergedFrom[0].fills.some((f) => f.field === "tradeKey" && f.from === "o" && f.source === "overture") && s.mergedFrom[0].moved.contactNumbers.length === 1 && s.mergedFrom[0].moved.repointed[0].id === "third");
  ok("mergedFromIds reads it back", JSON.stringify(mergedFromIds(s)) === JSON.stringify(["o"]));
  ok("the audit row", t.platformAuditLog.store.length === 1 && t.platformAuditLog.store[0].action === "sales_prospects_merged" && t.platformAuditLog.store[0].details.retiredIds[0] === "o");
  const c = t.prospectCampaign.store[0];
  ok("the campaign funnel still adds up", funnelProblems(c).length === 0, c);
  ok("...with the retired row in duplicates and the survivor accepted", c.duplicateCount === 1 && c.acceptedCount === 4 && c.bankedCount === 2 && c.unmappedCount === 2, c);
  ok("the other row's identical name adds no trading name", Array.isArray(s.tradingNames) && s.tradingNames.length === 0 && mergedPlan === null);
  mergedPlan = result.plan;
  clientAfterMerge = { db, t };

  // Refusal between preview and press.
  const fresh = makeClient(fixture());
  fresh.t.prospect.store.find((r) => r.id === "s").assignedRepId = "repA";
  fresh.t.prospect.store.find((r) => r.id === "s").claimExpiresAt = LATER;
  const snapshot = JSON.stringify(Object.values(fresh.t).map((x) => x.store));
  const refused = await applyMerge({ db: fresh.db, plan: plan.plan, adminId: "admin1", now: NOW });
  ok("a rep claiming the survivor after the preview: refused at the write", refused.ok === false && refused.status === 409, refused.error);
  ok("...and NOTHING was written", JSON.stringify(Object.values(fresh.t).map((x) => x.store)) === snapshot);
  const gone = makeClient(fixture());
  gone.t.prospect.store.splice(gone.t.prospect.store.findIndex((r) => r.id === "o"), 1);
  ok("a row that vanished: 404, nothing written", (await applyMerge({ db: gone.db, plan: plan.plan, adminId: "a", now: NOW })).status === 404);
  ok("a plan without retired rows is refused", (await applyMerge({ db: gone.db, plan: { survivorId: "s", retired: [] }, adminId: "a" })).status === 400);

  // applyFills on its own: a fill whose field was set between the plan and
  // the write is SKIPPED, never overwritten, and the record says so.
  const stale = makeClient({ prospects: [row({ id: "s", email: "set@since.ca", campaignId: null })] });
  const r = await stale.db.$transaction((tx) => applyFills(tx, { survivorId: "s", fills: [{ field: "email", value: "old@plan.ca", from: "o", source: "x" }, { field: "phoneE164", value: "+15145550100", from: "o", source: "x" }], entry: { kind: "autofill", at: NOW.toISOString(), from: "o" } }));
  const sRow = stale.t.prospect.store[0];
  ok("applyFills never overwrites a value set since the plan", sRow.email === "set@since.ca" && sRow.phoneE164 === "+15145550100" && r.skipped.length === 1 && r.written.length === 1);
  ok("...and the mergedFrom entry records the skip", sRow.mergedFrom[0].skippedFills?.[0]?.field === "email" && sRow.mergedFrom[0].fills.length === 1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. unmerge
   ═══════════════════════════════════════════════════════════════════════════ */

section("4. unmerge — restores exactly");
{
  const { db, t } = clientAfterMerge;
  // A human changes one filled field before the unmerge; it must be KEPT.
  t.prospect.store.find((r) => r.id === "s").websiteUrl = "https://acme-painting.ca";
  // An autofill entry sits beside the merge; it must survive.
  t.prospect.store.find((r) => r.id === "s").mergedFrom.push({ kind: "autofill", at: NOW.toISOString(), from: "k", fills: [] });
  const result = await unmerge({ db, survivorId: "s", adminId: "admin1", now: NOW });
  ok("unmerged", result.ok === true, result.error);
  const s = t.prospect.store.find((r) => r.id === "s");
  const o = t.prospect.store.find((r) => r.id === "o");
  const third = t.prospect.store.find((r) => r.id === "third");
  ok("the retired row is back", o.mergedIntoId === null && o.mergedAt === null && result.reactivated.includes("o"));
  ok("the filled fields are cleared", s.tradeKey === null && s.domain === null && s.hasWebsite === null && result.cleared.includes("tradeKey"));
  ok("the field a human changed since is KEPT and named", s.websiteUrl === "https://acme-painting.ca" && result.kept.includes("websiteUrl"));
  ok("the survivor's own fields are still there", s.phoneE164 === "+15145550100" && s.addressLine === "1 Rue X");
  const nums = Object.fromEntries(t.salesContactNumber.store.map((n) => [n.id, n.prospectId]));
  ok("the moved number went back; the others never moved", nums.num3 === "o" && nums.num1 === "s" && nums.num2 === "o");
  ok("lead, claim, attempt back on the other row", t.salesLead.store[0].prospectId === "o" && t.salesQueueClaim.store[0].prospectId === "o" && t.salesCallAttempt.store.find((a) => a.id === "att1").prospectId === "o");
  ok("the moved claim is released from the survivor", s.assignedRepId === null && s.claimExpiresAt === null);
  ok("the third row's flag points back at the other row", third.possibleDuplicateOfId === "o");
  ok("the autofill entry survives; the merge entry is gone", Array.isArray(s.mergedFrom) && s.mergedFrom.length === 1 && s.mergedFrom[0].kind === "autofill");
  const c = t.prospectCampaign.store[0];
  ok("the funnel is back where it started and still adds up", funnelProblems(c).length === 0 && c.duplicateCount === 0 && c.acceptedCount === 4 && c.bankedCount === 3 && c.unmappedCount === 3, c);
  ok("the audit row", t.platformAuditLog.store.some((a) => a.action === "sales_prospects_unmerged"));
  ok("a second unmerge: nothing to do", (await unmerge({ db, survivorId: "s", adminId: "a" })).status === 400);
  ok("unknown row: 404", (await unmerge({ db, survivorId: "nope", adminId: "a" })).status === 404);
  ok("no id: 400", (await unmerge({ db, survivorId: "", adminId: "a" })).status === 400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Retired rows are out of every shared WHERE
   ═══════════════════════════════════════════════════════════════════════════ */

section("5. Where-builders — executed against a retired row");
{
  const live = row({ id: "l", tradeKey: "painting", status: "discovered" });
  const retired = { ...live, id: "r", mergedIntoId: "l" };
  const held = { ...live, id: "h", assignedRepId: "rep1", claimExpiresAt: LATER };
  const heldRetired = { ...held, id: "hr", mergedIntoId: "l" };
  ok("claimCandidateWhere admits the live row and refuses the retired one", matches(live, claimCandidateWhere({ tradeKey: "painting", now: NOW })) && !matches(retired, claimCandidateWhere({ tradeKey: "painting", now: NOW })));
  ok("queueWhere admits the held row and refuses a held-but-retired one", matches(held, queueWhere("rep1", { now: NOW })) && !matches(heldRetired, queueWhere("rep1", { now: NOW })));
  ok("untouchableGuardWhere refuses the retired row", matches(live, untouchableGuardWhere(NOW)) && !matches(retired, untouchableGuardWhere(NOW)));
  const sqlText = (sql) => sql.strings.join("?");
  ok("untouchableGuardSql carries the same clause", sqlText(untouchableGuardSql(NOW)).includes('"mergedIntoId" IS NULL'));
  ok("...so the folder's WHERE does", sqlText(reviewWhereSql({}, { now: NOW })).includes('"mergedIntoId" IS NULL'));
  // Per-site lists that do not go through a builder.
  for (const [file, needle] of [
    ["app/api/platform/sales/prospects/route.js", "const where = { mergedIntoId: null }"],
    ["app/api/platform/sales/campaigns/[id]/route.js", 'status: "needs_review", mergedIntoId: null'],
    ["app/api/platform/sales/campaigns/[id]/route.js", "possibleDuplicateOfId: { not: null }, mergedIntoId: null"],
    ["lib/sales/pipeline/handlers/discoverBusinesses.js", "mergedIntoId: null"],
    ["lib/sales/pipeline/research.js", 'p."mergedIntoId" IS NULL'],
    ["app/api/platform/sales/retry-pool/route.js", "mergedIntoId: null"],
    ["lib/sales/discovery/reclassifyRegisters.js", "possibleDuplicateOfId: null, mergedIntoId: null"],
  ]) {
    ok(`${file} excludes retired rows`, read(file).includes(needle));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Ingest
   ═══════════════════════════════════════════════════════════════════════════ */

section("6. Ingest — a retired record resolves to its survivor; strong flags fill");
{
  const survivor = row({ id: "s", sourceProvider: "rbq", sourceRecordId: "1234", phoneE164: "+15145550100", websiteUrl: null, city: "Laval" });
  const retired = row({ id: "r", sourceProvider: "overture", sourceRecordId: "ov-1", phoneE164: "+15145550177", mergedIntoId: "s", city: "Laval" });
  const index = buildDedupeIndex([survivor, retired]);
  const again = { sourceProvider: "overture", sourceRecordId: "ov-1", phoneE164: "+15145550177", websiteUrl: "https://acme.ca", domain: "acme.ca", businessName: "Acme", city: "Laval" };
  const m = matchExisting(again, index);
  ok("re-seeing the retired row's source record → UPDATE of the SURVIVOR, fill-only", m.action === "update" && m.matchedId === "s" && m.fillOnly === true && m.throughRetiredId === "r" && m.matched?.id === "s");
  const byRetiredPhone = matchExisting({ sourceProvider: "overture", sourceRecordId: "ov-9", phoneE164: "+15145550177", businessName: "Acme", city: "Laval" }, index);
  ok("a phone only the RETIRED row had still resolves to the survivor", byRetiredPhone.action === "flag" && byRetiredPhone.matchedId === "s" && byRetiredPhone.via === "phone");
  ok("a live match is unchanged: update in place, not fill-only", (() => { const x = matchExisting({ sourceProvider: "rbq", sourceRecordId: "1234" }, index); return x.action === "update" && x.matchedId === "s" && x.fillOnly === false; })());
  ok("no index → insert, with the new shape", matchExisting(again, null).action === "insert" && matchExisting(again, null).fillOnly === false);
  ok("AUTOFILL_VIAS is phone and domain only", JSON.stringify(AUTOFILL_VIAS) === JSON.stringify(["phone", "domain"]));

  // planIngest: the fill plan, the autofill, and the name match that does neither.
  const business = (over) => ({
    sourceRecordId: "ov-2",
    name: "Acme Painting",
    categories: { primary: "painting", alternate: [] },
    taxonomyHierarchy: ["services_and_business", "home_service", "painting"],
    phones: ["+1 514 555 0100"],
    websites: ["https://acme.ca"],
    emails: [],
    address: { line: "2 Rue Y", city: "Laval", province: "QC", postalCode: "H7A 1A1", country: "CA" },
    latitude: 45.6,
    longitude: -73.7,
    operatingStatus: null,
    sourceConfidence: 0.5,
    sourceDataset: "meta",
    sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  });
  const ctx = { provider: "overture", release: "2026-09", tradeKey: null, campaignId: "c1", territoryId: null, licenceRegister: null };
  const idx2 = buildDedupeIndex([survivor, retired]);
  const { plans } = planIngest(
    [
      business({}),
      business({ sourceRecordId: "ov-1", phones: ["+1 514 555 0177"] }),
      business({ sourceRecordId: "ov-3", phones: [], websites: [], address: { line: null, city: "Laval", province: "QC", postalCode: null, country: "CA" } }),
    ],
    ctx,
    idx2,
  );
  const flagged = plans.find((p) => p.action === "insert" && p.row.sourceRecordId === "ov-2");
  ok("same phone: written AND flagged, exactly as before", flagged && flagged.row.possibleDuplicateOfId === "s" && flagged.duplicateVia === "phone");
  ok("...and it plans an AUTOFILL of the survivor's website from the new record", flagged?.autofill && flagged.autofill.targetId === "s" && flagged.autofill.fills.some((f) => f.field === "websiteUrl" && f.value === "https://acme.ca" && f.from === flagged.id), flagged?.autofill);
  ok("...that fills nothing the survivor has", !flagged.autofill.fills.some((f) => f.field === "phoneE164"));
  const fill = plans.find((p) => p.action === "fill");
  ok("the retired record's re-ingest is a FILL plan on the survivor, never an update of the retired row", fill && fill.id === "s" && fill.throughRetiredId === "r" && !plans.some((p) => p.action === "update" && p.id === "r"));
  const byName = plans.find((p) => p.action === "insert" && p.row.sourceRecordId === "ov-3");
  ok("same name, same town: flagged and NOT filled", byName && byName.row.possibleDuplicateOfId && byName.duplicateVia === "name_locality" && byName.autofill === null);
  ok("ingest.js applies both in the same transaction as the insert", /for \(const plan of inserts\) \{\s*if \(!plan\.autofill\) continue;\s*await applyFills\(tx/.test(read("lib/sales/discovery/ingest.js")) && /for \(const plan of fillPlans\) \{\s*await applyFills\(tx/.test(read("lib/sales/discovery/ingest.js")));
  ok("loadDedupeCandidates brings a retired candidate's survivor along", /survivorIds/.test(read("lib/sales/discovery/ingest.js")) && read("lib/sales/discovery/ingest.js").includes("select: MERGE_SELECT"));
  ok("dedupe.js's header says steps 2 and 3 fill and step 4 does not", read("lib/sales/discovery/dedupe.js").includes("Steps 2 and 3 also FILL") && read("lib/sales/discovery/dedupe.js").includes("Step 4, the name-in-locality match, stays a\n// question"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The read-path union
   ═══════════════════════════════════════════════════════════════════════════ */

section("7. unionAnalysis — own wins, evidence appended, borrowed tagged");
{
  const own = {
    evidence: [{ id: "e1", prospectId: "s" }],
    capabilities: [{ id: "c1", prospectId: "s", code: "ONLINE_BOOKING", value: false }],
    technologies: [],
    inferences: [{ id: "i1", prospectId: "s", kind: "company_scale", value: "SOLO_LIKELY" }],
  };
  const borrowed = {
    evidence: [{ id: "e2", prospectId: "r" }],
    capabilities: [{ id: "c2", prospectId: "r", code: "ONLINE_BOOKING", value: true }, { id: "c3", prospectId: "r", code: "LIVE_CHAT", value: true }],
    technologies: [{ id: "t1", prospectId: "r", technologyCode: "jobber" }],
    inferences: [{ id: "i2", prospectId: "r", kind: "company_scale", value: "SMALL_BUSINESS" }, { id: "i3", prospectId: "r", kind: "decision_maker", value: "OWNER" }],
  };
  const u = unionAnalysis(own, borrowed);
  ok("evidence: all of both", u.evidence.length === 2 && u.evidence[1].fromProspectId === "r");
  ok("capabilities: the survivor's ONLINE_BOOKING verdict wins; LIVE_CHAT fills", u.capabilities.length === 2 && u.capabilities.find((c) => c.code === "ONLINE_BOOKING").value === false && u.capabilities.find((c) => c.code === "LIVE_CHAT").fromProspectId === "r");
  ok("inferences: the survivor's company_scale wins; decision_maker fills", u.inferences.length === 2 && u.inferences.find((i) => i.kind === "company_scale").value === "SOLO_LIKELY");
  ok("technologies: borrowed when the survivor has none", u.technologies.length === 1 && u.technologies[0].fromProspectId === "r");
  ok("borrowedFrom names the retired row", JSON.stringify(u.borrowedFrom) === JSON.stringify(["r"]));
  ok("empty own, empty borrowed → empty", unionAnalysis({}, {}).evidence.length === 0);
  // Both human-facing reads go through it.
  ok("the superadmin detail route unions", read("app/api/platform/sales/prospects/[id]/route.js").includes("loadMergedAnalysis(db, prospect)") && read("app/api/platform/sales/prospects/[id]/route.js").includes("evidence: analysis.evidence"));
  ok("the rep's queue route unions before anything reads `full`", /const analysis = await loadMergedAnalysis\(db, full\);\s*Object\.assign\(full, \{/.test(read("app/api/sales/queue/route.js")));
  // The rep's line.
  const facts = prospectFacts(row({ sourceProvider: "rbq", mergedFrom: [{ kind: "merge", retired: [{ id: "a" }, { id: "b" }] }, { kind: "autofill", from: "z" }] }));
  const line = facts.find((f) => f.key === "merged");
  ok("prospectFacts carries 'Merged from · 2 other records' — merges only, not autofills", line && line.params.value === 2 && line.textKey === "app.salesIntel.fact.merged.value" && line.text === "2 other records");
  ok("...and no such line on an ordinary row", mergedRows(row({})).length === 0 && !prospectFacts(row({ sourceProvider: "rbq" })).some((f) => f.key === "merged"));
  for (const lang of ["en", "fr", "es", "uk", "pa", "tl", "de", "zh", "it"]) {
    const m = APP_MESSAGES[lang];
    ok(`${lang} carries the label and a plural-aware value`, typeof m["app.salesIntel.fact.merged.label"] === "string" && typeof m["app.salesIntel.fact.merged.value"] === "function" && /2/.test(m["app.salesIntel.fact.merged.value"]({ value: 2 })));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The group, and the wiring
   ═══════════════════════════════════════════════════════════════════════════ */

section("8. buildGroup, the routes, the panel");
{
  const focus = row({ id: "s", phoneE164: "+15145550100", possibleDuplicateOfId: null, mergedFrom: [{ kind: "merge", retired: [{ id: "old" }] }] });
  const rows = [
    row({ id: "o", phoneE164: "+15145550100", possibleDuplicateOfId: "s", websiteUrl: "https://acme.ca", createdAt: new Date("2026-03-01"), assignedRepId: "rep1", claimExpiresAt: LATER }),
    row({ id: "old", mergedIntoId: "s", createdAt: new Date("2026-02-01") }),
    row({ id: "elsewhere", mergedIntoId: "zzz", possibleDuplicateOfId: "s" }),
  ];
  const g = buildGroup({ focus, rows, reps: [{ id: "rep1", name: "Ana" }], now: NOW });
  ok("live rows: the focus and the flagged one; retired rows kept apart", g.rows.map((r) => r.id).join(",") === "s,o" && g.merged.map((r) => r.id).join(",") === "old");
  ok("a row retired into ANOTHER survivor is not shown", !g.rows.some((r) => r.id === "elsewhere") && !g.merged.some((r) => r.id === "elsewhere"));
  ok("gaps: website (one has it) yes; phone (both) no", g.gaps.websiteUrl === true && !g.gaps.phoneE164);
  ok("claimed by is a name, not an id", g.rows.find((r) => r.id === "o").claimedBy === "Ana");
  ok("the match reason rides on each other row", g.rows.find((r) => r.id === "o").via === "phone" && g.rows.find((r) => r.id === "s").isFocus);
  ok("canMerge needs two live rows", g.canMerge === true && buildGroup({ focus, rows: [], now: NOW }).canMerge === false);
  ok("GROUP_COLUMNS shows website, phone, email, address, trade, source, claimed by", ["websiteUrl", "phoneE164", "email", "addressLine", "tradeKey", "sourceProvider", "claimedBy"].every((f) => GROUP_COLUMNS.some((c) => c.field === f)));
  ok("previewMerge refuses an id outside the group", previewMerge({ survivorId: "s", otherIds: ["nope"], rows: [focus], now: NOW }).ok === false);

  for (const file of ["app/api/platform/sales/prospects/duplicates/route.js", "app/api/platform/sales/prospects/merge/route.js", "app/api/platform/sales/prospects/unmerge/route.js"]) {
    const src = read(file);
    ok(`${file} gates on superadminOrRefusal`, src.includes("superadminOrRefusal(request)") && src.includes("if (refusal) return"));
  }
  const merge = read("app/api/platform/sales/prospects/merge/route.js");
  ok("merge route previews without confirm and applies with confirm: true", merge.includes("body?.confirm !== true") && merge.includes("applyMerge({ db, plan: preview.plan"));
  const panel = read("app/components/platform/DuplicateGroup.js");
  ok("the panel: radio keep, preview button, confirm, unmerge, gaps lit", panel.includes('type="radio"') && panel.includes("data-merge-preview") && panel.includes("data-merge-confirm") && panel.includes("data-unmerge") && panel.includes('data-gap={gap ? "1" : undefined}'));
  ok("the panel calls the three routes", panel.includes("/api/platform/sales/prospects/duplicates?id=") && panel.includes('"/api/platform/sales/prospects/merge"') && panel.includes('"/api/platform/sales/prospects/unmerge"'));
  ok("the panel draws the writes for a superadmin only", panel.includes("isSuperadmin ?") && panel.includes("usePlatformAdmin()"));
  ok("mounted on the review page, focused flagged row only", read("app/platform/sales/review/page.js").includes("{p.duplicateOf && active ? <DuplicateGroup prospectId={p.id} onChanged={load} /> : null}"));
  ok("mounted on the prospect detail", read("app/platform/sales/prospects/page.js").includes("<DuplicateGroup prospectId={p.id} onSelect={onSelect} onChanged={onChanged} />"));
  ok("the detail says when a row is retired, and how many it carries", read("app/platform/sales/prospects/page.js").includes("p.mergedIntoId ?") && read("app/platform/sales/prospects/page.js").includes("p.mergedFromIds?.length"));
  ok("audit actions registered", AUDIT_ACTIONS.sales_prospects_merged && AUDIT_ACTIONS.sales_prospects_unmerged);
  const schema = read("prisma/schema.prisma");
  ok("schema: mergedIntoId, mergedAt, mergedFrom Json?, indexed", schema.includes("mergedIntoId String?") && schema.includes("mergedAt     DateTime?") && schema.includes("mergedFrom   Json?") && schema.includes("@@index([mergedIntoId])"));
  const pkg = JSON.parse(read("package.json"));
  ok("wired: npm run check:sales-merge, in check:all", typeof pkg.scripts["check:sales-merge"] === "string" && pkg.scripts["check:all"].includes("check:sales-merge"));
  ok("the funnel's duplicates line says a merge lands here", read("lib/sales/discovery/funnel.js").includes("merged into another"));
  ok("the docs and the roadmap name it", read("docs/sales-intel/SOURCE-WEB-DISCOVERY.md").includes("mergeProspects.js") && read("docs/ROADMAP.md").includes("mergeProspects.js"));
}

console.log(`\n${checks} checks, ${failures} failures`);
process.exit(failures ? 1 : 0);
