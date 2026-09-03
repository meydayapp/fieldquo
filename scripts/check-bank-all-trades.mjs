// scripts/check-bank-all-trades.mjs
//
// A campaign may bank EVERY trade. A rep's queue is still single-trade.
//
//   npm run check:bank-all-trades
//
// ══ The distinction this file exists to hold apart ═════════════════════════
//
// The owner's ask is about the BANK: "extract leads of all the contractors.
// doesn't matter painter, roofer, hvac, plumber, electricians, paving,
// asphalt, flooring, drywall, insulation — all of them."
//
// The rule it looks like it contradicts is about the QUEUE: a single-trade
// queue is the whole point of a campaign, and one roofer in a painting queue
// is what makes a rep stop trusting it. Both are true at once, and the only
// reason they can be is that a queue is claimed by EXACT TRADE KEY and knows
// nothing about which campaign wrote a row. So:
//
//   banking     widened. An all-trades campaign writes the roofer, the plumber
//               and the painter from one page, each under its own trade.
//   queueing    untouched. claimCandidateWhere() filters `tradeKey: "painting"`,
//               so the roofer is unreachable from a painting queue by
//               CONSTRUCTION, not by anybody remembering to filter.
//
// Reading the code cannot tell those apart — the second is a property of a
// query object, and a query object that is subtly wrong looks exactly like one
// that is right. So every claim here is EXECUTED: the shipped ingest writes
// rows into a store, and the shipped claim query is then run against the rows
// it actually wrote.
//
// ══ The other half: banking everything must not RESEARCH everything ════════
//
// Banking a row costs a row. Researching one is ~7 pipeline tasks against a
// platform ceiling of ~3,600 a day (docs/sales-intel/STATUS.md), so about 514
// fully-researched prospects a day for every tenant put together. Quebec's RBQ
// register alone is 54,264 rows: promoting a bank that size is 105 days of the
// whole platform's pipeline, queued by one Start button.
//
// `promoteToResearch` used to promote every row a campaign had at `discovered`,
// with no bound but the page size — so a bank-everything campaign WOULD have
// queued 54,264 enrichments, each of which routes onward to a crawl. That is
// now bounded by `targetCount`, and the bound is proved here by running the
// shipped handler over more rows than the target and counting the tasks.
//
// ══ Three traps that produced false passes in this session ═════════════════
//
//   1. Reading a file raw rather than comment-stripped. A comment FORBIDDING a
//      behaviour matches as the behaviour.
//   2. `ok(label, condition)` — label first. Reversed, every assertion passes.
//   3. `Number(null) === 0`. An absent target must not read as "no bound".
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DISCOVERY_TRADES,
  campaignTradeLabel,
  campaignTradeScope,
  discoveryTradeKeys,
} from "@/lib/sales/discovery/trades";
import { ingestPage, planIngest } from "@/lib/sales/discovery/ingest";
import { campaignProgress, discoveryStopReason, funnelProblems, funnelRows } from "@/lib/sales/discovery/funnel";
import { buildDedupeIndex } from "@/lib/sales/discovery/dedupe";
import { claimCandidateWhere } from "@/lib/sales/prospectView";
import {
  PROMOTE_LIMIT,
  promoteToResearch,
  researchBudget,
  runDiscoverBusinesses,
} from "@/lib/sales/pipeline/handlers/discoverBusinesses";
import { registerDiscoveryProvider, __resetDiscoveryProvidersForTests } from "@/lib/sales/discovery/provider";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
/** Label FIRST. The reversed form passes everything, in this repo twice. */
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== "" ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers, proved before anything is trusted to them
   ═══════════════════════════════════════════════════════════════════════════ */

/** Comments blanked, string bodies kept — for rules about literals. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

/**
 * A Prisma-shaped `where`, applied to a plain row.
 *
 * Written here rather than reused from a stub, because THIS is the thing the
 * queue-safety proof rests on: if the matcher quietly ignores a clause it does
 * not understand, "the roofer is not in the painting queue" passes for a row
 * that would in fact be claimed. So it fails loudly on an operator it does not
 * implement, and it is proved against controls immediately below.
 */
function matchesWhere(row, where = {}) {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "OR") return cond.some((clause) => matchesWhere(row, clause));
    if (field === "AND") return cond.every((clause) => matchesWhere(row, clause));
    if (cond === null) return row[field] == null;
    if (cond instanceof Date) return row[field]?.getTime?.() === cond.getTime();
    if (cond && typeof cond === "object") {
      for (const [op, value] of Object.entries(cond)) {
        if (op === "not") { if (row[field] === value) return false; continue; }
        if (op === "in") { if (!value.includes(row[field])) return false; continue; }
        if (op === "lt") { if (!(row[field] != null && new Date(row[field]) < new Date(value))) return false; continue; }
        if (op === "gt") { if (!(row[field] != null && new Date(row[field]) > new Date(value))) return false; continue; }
        throw new Error(`matchesWhere does not implement the operator "${op}" — the proof below would be vacuous`);
      }
      return true;
    }
    return row[field] === cond;
  });
}

section("0. The matcher itself, before it is used to prove anything");
{
  const now = new Date("2026-09-03T12:00:00Z");
  const painter = { tradeKey: "painting", status: "discovered", doNotContactAt: null, assignedRepId: null, claimExpiresAt: null };
  ok("an exact key matches", matchesWhere(painter, { tradeKey: "painting" }));
  ok("…and a different one does not", !matchesWhere(painter, { tradeKey: "roofing" }));
  ok("null means IS NULL, and undefined counts as null the way a missing column does", matchesWhere({ a: null }, { a: null }) && matchesWhere({}, { a: null }));
  ok("…and a value is not null", !matchesWhere({ a: "x" }, { a: null }));
  ok("{ not: null } excludes the null rows", !matchesWhere({ a: null }, { a: { not: null } }) && matchesWhere({ a: "x" }, { a: { not: null } }));
  ok("an OR is a disjunction, not an intersection", matchesWhere(painter, { OR: [{ tradeKey: "roofing" }, { status: "discovered" }] }));
  ok("…and fails when no branch holds", !matchesWhere(painter, { OR: [{ tradeKey: "roofing" }, { status: "researching" }] }));
  ok("lt compares dates rather than strings", matchesWhere({ claimExpiresAt: new Date("2026-01-01") }, { claimExpiresAt: { lt: now } }));
  ok("…and a null date does not satisfy lt, which would hand out a live claim", !matchesWhere({ claimExpiresAt: null }, { claimExpiresAt: { lt: now } }));
  let threw = false;
  try { matchesWhere(painter, { tradeKey: { contains: "paint" } }); } catch { threw = true; }
  ok("an operator it does not implement THROWS rather than passing vacuously", threw);
}

/* ═══════════════════════════════════════════════════════════════════════════
   A store: only the queries ingestPage and runDiscoverBusinesses actually make
   ═══════════════════════════════════════════════════════════════════════════ */

function makeStore(campaign) {
  const campaigns = [{ ...campaign }];
  const prospects = [];
  const evidence = [];
  const tasks = [];
  let seq = 0;

  const applyIncrements = (row, data) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && "increment" in value) row[key] = (row[key] || 0) + value.increment;
      else row[key] = value;
    }
  };

  const order = (rows, orderBy) => {
    if (!orderBy?.createdAt) return rows;
    const dir = orderBy.createdAt === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) * dir);
  };

  const db = {
    prospectCampaign: {
      async findUnique({ where }) {
        const found = campaigns.find((c) => c.id === where.id);
        return found ? { ...found } : null;
      },
      async update({ where, data }) {
        const found = campaigns.find((c) => c.id === where.id);
        if (!found) throw new Error("no such campaign");
        applyIncrements(found, data);
        return { ...found };
      },
    },
    prospect: {
      async findMany({ where = {}, take, orderBy } = {}) {
        const out = order(prospects.filter((p) => matchesWhere(p, where)), orderBy);
        return (take ? out.slice(0, take) : out).map((p) => ({ ...p }));
      },
      async createMany({ data }) {
        for (const row of data) {
          if (prospects.some((p) => p.sourceProvider === row.sourceProvider && p.sourceRecordId === row.sourceRecordId)) {
            const err = new Error("Unique constraint failed");
            err.code = "P2002";
            throw err;
          }
          prospects.push({ createdAt: new Date(2026, 0, 1, 0, 0, ++seq), doNotContactAt: null, assignedRepId: null, claimExpiresAt: null, ...row });
        }
        return { count: data.length };
      },
      async update({ where, data }) {
        const found = prospects.find((p) => p.id === where.id);
        if (found) Object.assign(found, data);
        return found ? { ...found } : null;
      },
    },
    prospectEvidence: {
      async createMany({ data }) {
        evidence.push(...data);
        return { count: data.length };
      },
    },
    salesPipelineTask: {
      async findMany({ where = {} }) {
        return tasks
          .filter((t) => (where.kind ? t.kind === where.kind : true))
          .filter((t) => (where.campaignId ? t.campaignId === where.campaignId : true))
          .filter((t) => (where.prospectId?.in ? where.prospectId.in.includes(t.prospectId) : true))
          .map((t) => ({ ...t }));
      },
      async findUnique({ where }) {
        const found = tasks.find((t) => t.idempotencyKey && t.idempotencyKey === where.idempotencyKey);
        return found ? { ...found } : null;
      },
      async count({ where = {} } = {}) {
        return tasks.filter(
          (t) =>
            (where.kind ? t.kind === where.kind : true) &&
            (where.campaignId ? t.campaignId === where.campaignId : true),
        ).length;
      },
      async create({ data }) {
        if (data.idempotencyKey && tasks.some((t) => t.idempotencyKey === data.idempotencyKey)) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        const row = { id: `task${++seq}`, status: "queued", prospectId: null, campaignId: null, ...data };
        tasks.push(row);
        return { ...row };
      },
    },
    async $transaction(fn) {
      return fn(db);
    },
  };

  return { db, prospects, evidence, tasks, campaign: () => campaigns[0] };
}

/** A DiscoveredBusiness a provider could have emitted. */
function business(id, over = {}) {
  return {
    sourceRecordId: id,
    name: "Rivard Painting Ltd",
    categories: { primary: "painting", alternate: [] },
    taxonomyHierarchy: [],
    phones: ["(613) 795-6277"],
    websites: ["https://rivard.example"],
    emails: [],
    address: { line: "12 rue Principale", city: "Ottawa", province: "ON", postalCode: "K1A0B1", country: "CA" },
    latitude: 45.4,
    longitude: -75.7,
    operatingStatus: null,
    sourceConfidence: null,
    sourceDataset: "fixture",
    sourceUpdatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

// `home_service` in the taxonomy is what the classifier reads as "this does
// work", and it holds for 100% of rows inside the nine core trade categories
// (classify.js's own measurement). Without it these fixtures land in
// needs_review, and a section about banking would be measuring the classifier.
const trade = (id, name, primary, phone) =>
  business(id, {
    name,
    categories: { primary, alternate: [] },
    taxonomyHierarchy: ["home_service", primary],
    phones: [phone],
    websites: [`https://${id}.example`],
  });

/** One page of a real city: several trades, one row nothing maps, one shop. */
const PAGE = [
  trade("ov:1", "Rivard Painting Ltd", "painting", "613 555 0001"),
  trade("ov:2", "Toitures Tremblay inc.", "roofing", "613 555 0002"),
  trade("ov:3", "Beaudry Plomberie", "plumbing", "613 555 0003"),
  trade("ov:4", "Climatisation Nord HVAC", "hvac_services", "613 555 0004"),
  trade("ov:5", "Pavage Boulet", "paving_contractor", "613 555 0005"),
  // Nothing maps this: a licence register's authorisation codes, namespaced.
  // A contractor by its name, with no trade anybody can name — the register's
  // whole population, and the reason the bank exists.
  business("rbq:1104-8618-06", {
    name: "Bertrand Construction inc.",
    categories: { primary: null, alternate: ["rbq:1.3", "rbq:4.1"] },
    phones: ["613 555 0006"],
    websites: [],
  }),
  // A shop. Rejected by the classifier in either mode, and included so that
  // "all trades" cannot be read as "everything, including the paint store".
  business("ov:7", {
    name: "Benjamin Moore Paints",
    categories: { primary: "painting", alternate: ["paint_store"] },
    phones: ["613 555 0007"],
    websites: ["https://bm.example"],
  }),
];

const NOW = new Date("2026-09-03T12:00:00Z");

const campaignRow = (over = {}) => ({
  id: "camp1",
  name: "Ottawa, everything",
  status: "running",
  tradeKey: null,
  allTrades: true,
  territoryId: null,
  territory: null,
  targetCount: 500,
  foundCount: 0,
  unmappedCount: 0,
  duplicateCount: 0,
  rejectedCount: 0,
  needsReviewCount: 0,
  acceptedCount: 0,
  readyCount: 0,
  noWebsiteCount: 0,
  bankedCount: 0,
  discoverySources: [],
  sourceConfigs: null,
  sourceState: null,
  discoveryProvider: null,
  providerConfig: null,
  discoveryCursor: null,
  ...over,
});

/* ═══════════════════════════════════════════════════════════════════════════
   1. Which mode a campaign is in, decided in ONE place
   ═══════════════════════════════════════════════════════════════════════════ */
section("1. One trade, every trade, or a campaign that cannot run");

{
  ok("a campaign naming a trade is single-trade", campaignTradeScope({ tradeKey: "painting" }).tradeKey === "painting");
  ok("…and is not quietly all-trades", campaignTradeScope({ tradeKey: "painting" }).allTrades === false);
  ok("allTrades gives NO trade key to filter on", campaignTradeScope({ allTrades: true }).tradeKey === null);
  ok("…and says so", campaignTradeScope({ allTrades: true }).allTrades === true);
  ok(
    "a row carrying BOTH resolves to all-trades rather than silently dropping the rows it was told to keep",
    campaignTradeScope({ allTrades: true, tradeKey: "painting" }).allTrades === true &&
      campaignTradeScope({ allTrades: true, tradeKey: "painting" }).tradeKey === null,
  );
  // The state the whole boolean exists for: absence is not a statement.
  ok("a campaign with NEITHER is its own state", campaignTradeScope({}).stated === false);
  ok("…and is NOT read as all-trades, which would bank a province by accident", campaignTradeScope({}).allTrades === false);
  ok("…nor as a trade", campaignTradeScope({}).tradeKey === null);
  ok("a whitespace trade key is not a trade", campaignTradeScope({ tradeKey: "   " }).stated === false);
  ok('a STRING "true" is not the boolean, so a form posting text cannot widen a campaign', campaignTradeScope({ allTrades: "true" }).allTrades === false);
  ok("…nor is 1", campaignTradeScope({ allTrades: 1 }).allTrades === false);
  ok("null and undefined campaigns do not throw", campaignTradeScope(null).stated === false && campaignTradeScope(undefined).allTrades === false);

  ok("the screen calls it All trades", campaignTradeLabel({ allTrades: true }) === "All trades");
  ok("…and names the trade otherwise", campaignTradeLabel({ tradeKey: "roofing" }) === DISCOVERY_TRADES.roofing.label);
  ok(
    "…and a campaign with no choice reads as unfinished rather than as a blank or as all trades",
    campaignTradeLabel({}) === "No trade chosen",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. One page, every trade banked
   ═══════════════════════════════════════════════════════════════════════════ */
section("2. An all-trades campaign banks the roofer, the plumber and the painter");

const allStore = makeStore(campaignRow());
{
  const result = await ingestPage(
    { campaign: allStore.campaign(), businesses: PAGE, provider: "fixture", release: "r1", now: NOW },
    { deps: { db: allStore.db } },
  );

  const by = (name) => allStore.prospects.find((p) => p.businessName?.includes(name));
  ok("the painter is written", Boolean(by("Rivard")), String(allStore.prospects.length));
  ok("the roofer is written TOO — this is the whole ask", Boolean(by("Tremblay")));
  ok("…under its OWN trade, not the campaign's and not a guess", by("Tremblay")?.tradeKey === "roofing");
  ok("the plumber is written", by("Beaudry")?.tradeKey === "plumbing");
  ok("the HVAC company is written", by("Climatisation")?.tradeKey === "hvac");
  ok("the paving contractor is written", by("Boulet")?.tradeKey === "paving");
  ok("five distinct trades came out of ONE page", new Set(allStore.prospects.map((p) => p.tradeKey).filter(Boolean)).size === 5);

  ok("the row nothing maps is still banked with a null trade", by("Bertrand")?.tradeKey === null);
  ok("…at status discovered, which is what the bank IS", by("Bertrand")?.status === "discovered");
  ok("the paint SHOP is still rejected — all trades is not all businesses", !by("Benjamin"));

  const c = allStore.campaign();
  ok("every trade counts toward the target, because the campaign asked for every trade", c.acceptedCount === 5, `accepted ${c.acceptedCount}`);
  ok("…and the trade-less row does NOT, because nobody can call it", c.bankedCount === 1 && c.unmappedCount === 1, `banked ${c.bankedCount} unmapped ${c.unmappedCount}`);
  ok("the shop is counted as rejected", c.rejectedCount === 1, `rejected ${c.rejectedCount}`);
  ok("nothing was skipped for being the wrong trade — only the shop", result.counters.foundCount === 7 && result.skipped === 1, JSON.stringify(result.counters));
  ok("the funnel reconciles: found = unmapped + duplicates + rejected + review + accepted", funnelProblems(c).length === 0, JSON.stringify(c));
  ok("banked is still a SUBSET of unmapped, not a stage of its own", funnelRows(c).find((r) => r.key === "banked")?.kind === "subset");
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The single-trade campaign is UNCHANGED
   ═══════════════════════════════════════════════════════════════════════════ */
section("3. A single-trade campaign still skips the other trades");

{
  const store = makeStore(campaignRow({ tradeKey: "painting", allTrades: false, name: "Ottawa painters" }));
  await ingestPage(
    { campaign: store.campaign(), businesses: PAGE, provider: "fixture", release: "r1", now: NOW },
    { deps: { db: store.db } },
  );
  const names = store.prospects.map((p) => p.businessName);
  ok("the painter is written", names.some((n) => n.includes("Rivard")));
  ok("the roofer is NOT — a painting campaign files no roofers under its own territory", !names.some((n) => n.includes("Tremblay")));
  ok("…nor the plumber, the HVAC company or the paver", !names.some((n) => /Beaudry|Climatisation|Boulet/.test(n)));
  ok("the trade-less row is still banked, which was true before this change", names.some((n) => n.includes("Bertrand")));

  const c = store.campaign();
  ok("only the painter counts toward the target", c.acceptedCount === 1, `accepted ${c.acceptedCount}`);
  ok("the other trades are counted as not usable for THIS campaign", c.unmappedCount === 5, `unmapped ${c.unmappedCount}`);
  ok("…of which exactly one was kept, the trade-less one", c.bankedCount === 1, `banked ${c.bankedCount}`);
  ok("the funnel still reconciles", funnelProblems(c).length === 0, JSON.stringify(c));

  // The skip reason itself, from the shipped planner rather than from the row
  // count — a page that dropped rows for some other reason would otherwise
  // pass this section.
  const { plans } = planIngest(PAGE, { provider: "fixture", tradeKey: "painting" }, buildDedupeIndex([]));
  const roofer = plans.find((p) => p.business?.sourceRecordId === "ov:2");
  ok('the roofer is skipped with reason "other_trade"', roofer?.action === "skip" && roofer?.reason === "other_trade", JSON.stringify(roofer?.reason));
  const { plans: open } = planIngest(PAGE, { provider: "fixture", tradeKey: null }, buildDedupeIndex([]));
  ok("…and with no campaign trade there is no such reason to give", !open.some((p) => p.reason === "other_trade"));
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. THE assertion: a banked roofer cannot be claimed into a painting queue
   ═══════════════════════════════════════════════════════════════════════════ */
section("4. Queue safety, run against the rows the ingest actually wrote");

{
  const rows = allStore.prospects;
  const claimable = (tradeKey) => rows.filter((r) => matchesWhere(r, claimCandidateWhere({ tradeKey, now: NOW })));

  const painting = claimable("painting");
  ok("a rep working PAINTING is offered exactly one row", painting.length === 1, String(painting.length));
  ok("…and it is the painter", painting[0]?.businessName?.includes("Rivard"));
  ok("the roofer banked by this campaign is NOT claimable into the painting queue", !painting.some((r) => r.tradeKey === "roofing"));
  ok("…nor the plumber, nor the HVAC company, nor the paver", !painting.some((r) => ["plumbing", "hvac", "paving"].includes(r.tradeKey)));

  const roofing = claimable("roofing");
  ok("the roofer IS claimable from the ROOFING queue — banked, not buried", roofing.length === 1 && roofing[0].tradeKey === "roofing");
  ok("…which is the point: a trade-less bank would have made it uncallable for ever", roofing[0]?.businessName?.includes("Tremblay"));

  // Every shipped trade, so this cannot pass because the fixture happened to
  // contain only trades nobody queries.
  const leaks = discoveryTradeKeys().filter((key) => claimable(key).some((r) => r.tradeKey !== key));
  ok("NO shipped trade's queue contains a row of another trade", leaks.length === 0, leaks.join(","));

  const banked = rows.find((r) => r.tradeKey === null);
  const anyQueue = discoveryTradeKeys().some((key) => matchesWhere(banked, claimCandidateWhere({ tradeKey: key, now: NOW })));
  ok("the trade-less banked row is in NO queue at all", !anyQueue);
  ok("…because an absent trade becomes a sentinel no trade is called", claimCandidateWhere({ tradeKey: banked.tradeKey }).tradeKey === "__none__");
  ok("…and no shipped trade is called that", !Object.keys(DISCOVERY_TRADES).includes("__none__"));

  // A needs_review row is written and held back. Proved on the same query, so
  // a change that widened the status filter would fail here too.
  ok(
    "a needs_review row is claimable by nobody, whatever its trade",
    !matchesWhere({ tradeKey: "painting", status: "needs_review", doNotContactAt: null, assignedRepId: null }, claimCandidateWhere({ tradeKey: "painting", now: NOW })),
  );
  ok(
    "…and neither is a do-not-contact row",
    !matchesWhere({ tradeKey: "painting", status: "discovered", doNotContactAt: NOW, assignedRepId: null }, claimCandidateWhere({ tradeKey: "painting", now: NOW })),
  );

  // The claim route: the same query on the READ and on the guarded WRITE. A
  // read-only scope would let two reps take one prospect, and an unguarded
  // update would let a rep claim a row of any trade by posting its id.
  const route = stripComments(read("app/api/sales/queue/route.js"));
  ok("the queue route claims through claimCandidateWhere", /findFirst\(\{\s*where: claimCandidateWhere\(/.test(route));
  ok("…and the write is guarded by the SAME where, not just the id", /where: \{ id: candidate\.id, \.\.\.claimCandidateWhere\(/.test(route));
  ok("…and it refuses a trade this build does not ship", /if \(!DISCOVERY_TRADES\[tradeKey\]\)/.test(route));
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. The research budget: banking everything is not researching everything
   ═══════════════════════════════════════════════════════════════════════════ */
section("5. Banking is unbounded, researching is bounded");

{
  ok("a target of 500 with nothing spent leaves 500", researchBudget({ targetCount: 500, spent: 0 }) === 500);
  ok("…and spending 500 leaves none", researchBudget({ targetCount: 500, spent: 500 }) === 0);
  ok("overspending never goes negative", researchBudget({ targetCount: 10, spent: 99 }) === 0);
  // Number(null) is 0 and Number(undefined) is NaN. Both mean "nobody said",
  // and the fail-open reading queues tasks before anybody sees the number.
  ok("a null target is NO budget, not an unlimited one", researchBudget({ targetCount: null, spent: 0 }) === 0);
  ok("…and so is an absent one", researchBudget({}) === 0);
  ok("…and a non-numeric one", researchBudget({ targetCount: "lots" }) === 0);
  ok("…and a negative one", researchBudget({ targetCount: -5 }) === 0);
  ok("a fractional target is floored rather than rounded up", researchBudget({ targetCount: 10.9, spent: 0 }) === 10);
  ok("a spend that is not a number is treated as nothing spent, never as a licence to spend more", researchBudget({ targetCount: 10, spent: "x" }) === 10);
}

{
  // A source of trade-less rows — the register's case, and the one that would
  // have queued 54,264 enrichments. Two pages, a target of 2.
  __resetDiscoveryProvidersForTests();
  const pages = [
    { businesses: bankRows(0, 5), nextCursor: "5" },
    { businesses: bankRows(5, 5), nextCursor: "10" },
  ];
  const calls = [];
  registerDiscoveryProvider({
    key: "register",
    label: "Register",
    description: "stub",
    configFields: [{ name: "snapshotUrl", label: "Snapshot URL", required: true }],
    licence: { name: "CC-BY 4.0", url: "https://x.test", obligation: "attribution" },
    describeConfig: (config = {}) =>
      config?.snapshotUrl ? { ok: true, problems: [], summary: "ok" } : { ok: false, problems: ["no url"], summary: "none" },
    async fetchPage({ cursor, config }) {
      calls.push({ cursor, snapshotUrl: config?.snapshotUrl ?? null });
      return { release: "r1", ...(pages[calls.length - 1] || { businesses: [], nextCursor: null }) };
    },
  });

  const store = makeStore(
    campaignRow({
      targetCount: 2,
      discoverySources: ["register"],
      sourceConfigs: { register: { snapshotUrl: "https://r.test/r.ndjson" } },
    }),
  );
  const runTask = () => runDiscoverBusinesses({ task: { campaignId: "camp1" }, payload: {}, now: NOW, db: store.db });

  const first = await runTask();
  ok("the page ran", first.done === true, first.reason || "");
  ok("five rows were banked", store.prospects.length === 5, String(store.prospects.length));
  const enrich = () => store.tasks.filter((t) => t.kind === "ENRICH_BUSINESS");
  ok("…and only TWO were promoted into research, because the target is 2", enrich().length === 2, String(enrich().length));

  const second = await runTask();
  ok("the campaign keeps discovering — a spent research budget is not a stop", second.done === true);
  ok("…so the bank grows to ten", store.prospects.length === 10, String(store.prospects.length));
  ok("…and the research spend does NOT grow", enrich().length === 2, String(enrich().length));
  ok("…and the task note SAYS the budget is spent rather than reporting a silent zero", /research budget spent: 2 of 2/.test(second.note), second.note);
  ok(
    "the note still reports what it queued, so an empty promotion is visible",
    /queued 0 for research/.test(second.note),
    second.note,
  );

  // The arithmetic this bound exists for, stated on the numbers the check
  // itself produced: rows banked ≫ rows researched.
  ok("banking outran researching by five to one on this run", store.prospects.length / enrich().length === 5);
}

{
  // Ordering. A budget spends in the order rows are handed to it, and a
  // register import is entirely trade-less: oldest-first alone would spend a
  // campaign's whole budget on rows in nobody's queue.
  const store = makeStore(campaignRow({ targetCount: 1 }));
  await store.db.prospect.createMany({
    data: [
      { id: "old-bank", campaignId: "camp1", status: "discovered", tradeKey: null, businessName: "Groupe Bertrand", sourceProvider: "fixture", sourceRecordId: "b1" },
      { id: "new-roofer", campaignId: "camp1", status: "discovered", tradeKey: "roofing", businessName: "Toitures Tremblay", sourceProvider: "fixture", sourceRecordId: "b2" },
    ],
  });
  const promoted = await promoteToResearch({ prisma: store.db, campaignId: "camp1", limit: 1 });
  ok("one prospect is promoted when the budget is one", promoted === 1, String(promoted));
  ok(
    "…and it is the row that has a trade, even though the trade-less one is older",
    store.tasks[0]?.prospectId === "new-roofer",
    String(store.tasks[0]?.prospectId),
  );

  const more = await promoteToResearch({ prisma: store.db, campaignId: "camp1", limit: 5 });
  ok("a bigger budget then reaches the banked row — it is deferred, not dropped", more === 1 && store.tasks.some((t) => t.prospectId === "old-bank"));
  ok("a budget of zero promotes nothing at all", (await promoteToResearch({ prisma: store.db, campaignId: "camp1", limit: 0 })) === 0);
  ok("…and so does a budget that is not a number", (await promoteToResearch({ prisma: store.db, campaignId: "camp1", limit: null })) === 0);
  ok("the per-task ceiling is still a page's worth", PROMOTE_LIMIT === 100);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. A campaign that states neither is refused, not guessed at
   ═══════════════════════════════════════════════════════════════════════════ */
section("6. Neither statement is refused at the point of action");

{
  __resetDiscoveryProvidersForTests();
  registerDiscoveryProvider({
    key: "register",
    label: "Register",
    description: "stub",
    configFields: [{ name: "snapshotUrl", label: "Snapshot URL", required: true }],
    licence: { name: "CC-BY 4.0", url: "https://x.test", obligation: "attribution" },
    describeConfig: () => ({ ok: true, problems: [], summary: "ok" }),
    async fetchPage() {
      throw new Error("a campaign with no trade statement must never reach a source");
    },
  });
  const store = makeStore(
    campaignRow({
      allTrades: false,
      tradeKey: null,
      discoverySources: ["register"],
      sourceConfigs: { register: { snapshotUrl: "https://r.test/r" } },
    }),
  );
  const result = await runDiscoverBusinesses({ task: { campaignId: "camp1" }, payload: {}, now: NOW, db: store.db });
  ok("the run is refused", result.done !== true, JSON.stringify(result));
  ok("…terminally, because waiting does not fill in a choice nobody made", result.retry === false);
  ok("…and the sentence names the actual problem", /names no trade/.test(result.reason || ""), result.reason);
  ok("…and nothing was written", store.prospects.length === 0 && store.tasks.length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The completion rule is not fooled by a big bank
   ═══════════════════════════════════════════════════════════════════════════ */
section("7. Finished means accepted, in both modes");

{
  const banked = { targetCount: 1000, acceptedCount: 0, bankedCount: 54264, unmappedCount: 54264, foundCount: 54264 };
  ok("54,264 banked rows are 0% of a target measured in accepted", campaignProgress(banked).percent === 0);
  ok("…so the campaign does not report itself finished", discoveryStopReason(banked, { nextCursor: "more" }) !== "target_reached");
  ok("…and its funnel still reconciles", funnelProblems(banked).length === 0, JSON.stringify(banked));
  ok(
    "a source that ran out is a DIFFERENT outcome from a target reached",
    discoveryStopReason(banked, { nextCursor: null }) === "source_ended",
  );
  ok(
    "an all-trades campaign DOES finish on accepted rows of any trade",
    discoveryStopReason({ targetCount: 5, acceptedCount: 5 }, { nextCursor: "more" }) === "target_reached",
  );

  // The wording on the screen. An all-trades campaign has no "different trade"
  // to drop a row for, and offering that as a reason a number is big sends a
  // superadmin looking for a trade-map gap that cannot exist.
  const single = funnelRows({ allTrades: false, unmappedCount: 3 }).find((r) => r.key === "unmapped");
  const every = funnelRows({ allTrades: true, unmappedCount: 3 }).find((r) => r.key === "unmapped");
  ok("the single-trade note still names the different-trade reason", /different trade/.test(single.note));
  ok("…and the all-trades note does not", !/different trade/.test(every.note), every.note);
  ok("…and says instead that nothing was dropped for being the wrong trade", /wrong one/.test(every.note));
  ok("the numbers are identical in both modes — wording changed, arithmetic did not", single.value === every.value);
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The form and the route, on comment-stripped source
   ═══════════════════════════════════════════════════════════════════════════ */
section("8. What the superadmin is offered, and what the route accepts");

{
  const form = stripComments(read("app/platform/sales/campaigns/page.js"));
  ok("the form offers an every-trade control", /id="c-all-trades"/.test(form));
  ok("…as a checkbox that has to be ticked, not a menu row one key from Painting", /id="c-all-trades"[\s\S]{0,200}type="checkbox"/.test(form));
  ok("…which CLEARS the trade, so the payload cannot claim both", /allTrades: e\.target\.checked, tradeKey: ""/.test(form));
  ok("…and disables the trade menu while it is ticked", /disabled=\{draft\.allTrades\}/.test(form));
  ok("…and meets the 44px touch floor this screen is held to", /id="c-all-trades"[\s\S]{0,400}min-h-\[44px\]|min-h-\[44px\][\s\S]{0,400}id="c-all-trades"/.test(form));
  ok("nothing is ticked by default", /allTrades: false/.test(form));

  // The reasoning was UPDATED rather than deleted. It was always an argument
  // about queues and it is still true about queues.
  const raw = read("app/platform/sales/campaigns/page.js");
  ok(
    "the owner's queue argument survived the change, in the words he gave it",
    /same\s+script\s+forty\s+times\s+gets\s+better\s+at\s+it/.test(raw),
  );
  ok("…and the header now says which of the two questions it answers", /about\s+the\s+QUEUE/.test(raw));
  ok("…and the screen tells the superadmin the queue is unaffected", /claimed\s+by\s+exact\s+trade/.test(raw));
  ok("…and the target field says it bounds research, not just discovery", /research\s+budget/.test(raw));

  const route = stripComments(read("app/api/platform/sales/campaigns/route.js"));
  ok("the route reads allTrades as a strict boolean", /body\?\.allTrades === true/.test(route));
  ok("…refuses a campaign claiming one trade AND every trade", /if \(allTrades && tradeKey\)/.test(route));
  ok("…refuses one claiming neither", /if \(!allTrades && !tradeKey\)/.test(route));
  ok("…still refuses a trade this build does not discover", /!DISCOVERY_TRADES\[tradeKey\]/.test(route));
  ok("…writes null rather than an empty string for an all-trades campaign", /tradeKey: allTrades \? null : tradeKey/.test(route));
  ok("…and records the choice in the audit log, where a null alone could not explain itself", /allTrades,/.test(route));

  const ingest = stripComments(read("lib/sales/discovery/ingest.js"));
  ok(
    "the ingest asks campaignTradeScope rather than reading the column directly, so the two cannot disagree",
    /campaignTradeScope\(campaign/.test(ingest) && !/tradeKey: campaign\?\.tradeKey \|\| null/.test(ingest),
  );
  const handler = stripComments(read("lib/sales/pipeline/handlers/discoverBusinesses.js"));
  ok("the handler bounds promotion by the budget rather than by the page alone", /Math\.min\(PROMOTE_LIMIT, budget\)/.test(handler));
  ok("…and counts what has already been spent from the database, not from the payload", /salesPipelineTask\.count\(/.test(handler));
  ok("…and promotes nothing at all when the budget is gone", /budget\s*\n?\s*\? await promoteToResearch/.test(handler));
}

/* Trade-less businesses, the shape a licence register emits. */
function bankRows(from, count) {
  return Array.from({ length: count }, (_, i) =>
    business(`rbq:${from + i}`, {
      // A contractor by name — a licence register's rows carry trading names,
      // and a fixture that landed in needs_review would prove nothing about
      // promotion, which never touches a needs_review row.
      name: `Construction Groupe ${from + i} inc.`,
      categories: { primary: null, alternate: ["rbq:1.3"] },
      phones: [`613 555 1${String(from + i).padStart(3, "0")}`],
      websites: [],
    }),
  );
}

console.log(`\n${checks} checks, ${failures} failure(s).\n`);
process.exit(failures ? 1 : 0);
