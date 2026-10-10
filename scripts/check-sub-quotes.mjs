// scripts/check-sub-quotes.mjs
//
//   npm run check:sub-quotes
//
// "Quotes from my subs" (/app/subcontractors/quotes) — one place a general
// contractor sees every price their subs have sent them. The owner,
// 2026-10-10: every price their subs have sent them, with status and "Add
// to my quote".
//
// ══ What is EXECUTED ═══════════════════════════════════════════════════════
//
//   1. Who sees it: the page's gate and the sidebar row, against every role
//      and every preset — they must agree, and Crew must get neither.
//   2. Status: each placement / change-order state maps to its status.
//   3. The list builder (lib/subcontractors/receivedPrices.js) through the
//      real loader (receivedPricesServer.js), against an in-memory database
//      holding TWO general contractors and a sub:
//        · the GC sees exactly their own received prices;
//        · another company's quotes and imports never appear, and no query
//          the loader makes reaches a Quote outside the GC's company;
//        · the sub's price (the GC's cost) is absent without jobCosting —
//          not zero, absent, and not anywhere in the serialised output;
//        · every action routes to the existing path (the compare's select
//          route, the price request's confirm route, the quote page's own
//          panels), and only when that route would accept the member.
//   4. The filters.
//   5. Wiring — the route, the page, the anchors, the nav, the strings.
//
// Then every guarantee is broken on purpose (the mutation pass) and the run
// must fail for each. Backups are copies (cpSync), never `git checkout`.

import { readFileSync, writeFileSync, cpSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

import * as R from "@/lib/subcontractors/receivedPrices";
import { loadReceivedPrices } from "@/lib/subcontractors/receivedPricesServer";
import { NAV_REQUIREMENTS, navRowAllowed } from "@/lib/permissions/nav";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let pass = 0;
const fails = [];
function ok(name, condition, got) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fails.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(condition);
}
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), got);
const section = (s) => console.log(`\n${s}\n`);

// Members, as loadEnforceableMember returns them plus the session's userId.
const preset = (name, extra = {}) => ({
  id: `m_${name}`,
  userId: `u_${name}`,
  companyId: "gc1",
  role: PRESET_TO_ROLE[name],
  permissions: { ...PERMISSION_PRESETS[name].values },
  ...extra,
});
const OWNER = { id: "m_owner", userId: "u_owner", companyId: "gc1", role: "owner", permissions: null };
const MANAGER = preset("manager");
const DISPATCHER = preset("dispatcher");
const ESTIMATOR = preset("estimator");
const CREW = preset("worker");

// ═══════════════════════════════════════════════════════════════════════════
section("1. Who sees it — the page's gate and the sidebar row agree");
// ═══════════════════════════════════════════════════════════════════════════
{
  const rule = NAV_REQUIREMENTS["app.nav.subQuotes"];
  eq("the row asks quotes view_only AND showPricing", rule, { category: "quotes", level: "view_only", toggle: "showPricing" });
  const disagreements = [];
  const members = [
    ...["owner", "admin", "supervisor", "employee"].map((role) => ({ label: role, m: { role, permissions: null } })),
    ...Object.keys(PERMISSION_PRESETS)
      .filter((p) => PRESET_TO_ROLE[p])
      .map((p) => ({ label: p, m: { role: PRESET_TO_ROLE[p], permissions: { ...PERMISSION_PRESETS[p].values } } })),
    // A hand-built grid that holds the toggle but not the level, and the
    // reverse — the cases a first-match nav rule would get wrong.
    { label: "showPricing without quotes", m: { role: "employee", permissions: { quotes: "none", showPricing: true } } },
    { label: "quotes without showPricing", m: { role: "employee", permissions: { quotes: "view_create_edit", showPricing: false } } },
  ];
  for (const { label, m } of members) {
    const nav = navRowAllowed("app.nav.subQuotes", m);
    const page = R.canSeeReceivedPrices(m);
    if (nav !== page) disagreements.push({ label, nav, page });
  }
  ok("for every role, preset and split grid, the row shows exactly when the page answers", disagreements.length === 0, disagreements);
  ok("Crew gets neither the row nor the page", !navRowAllowed("app.nav.subQuotes", CREW) && !R.canSeeReceivedPrices(CREW));
  ok("the marketing agency gets neither", !navRowAllowed("app.nav.subQuotes", preset("marketingAgency")) && !R.canSeeReceivedPrices(preset("marketingAgency")));
  ok("an Estimator (prices, no costing) gets both", navRowAllowed("app.nav.subQuotes", ESTIMATOR) && R.canSeeReceivedPrices(ESTIMATOR));
  ok("showPricing without quotes: refused", !R.canSeeReceivedPrices({ role: "employee", permissions: { quotes: "none", showPricing: true } }));
  ok("quotes without showPricing: refused", !R.canSeeReceivedPrices({ role: "employee", permissions: { quotes: "view_only", showPricing: false } }));
  ok("a null member is refused", !R.canSeeReceivedPrices(null));

  // Every other row still reads the way the old first-match chain read it:
  // each names one condition, so ANDing them changes nothing for them.
  const multi = Object.entries(NAV_REQUIREMENTS).filter(([, r]) => ["role", "toggle", "category"].filter((k) => r[k]).length > 1).map(([k]) => k);
  eq("app.nav.subQuotes is the only row naming two conditions", multi, ["app.nav.subQuotes"]);

  const a = (m) => R.receivedPriceAccess(m);
  eq("owner: everything", a(OWNER), { see: true, mayCost: true, mayReplies: true, mayJobs: true, choose: true, offerExtra: true, confirm: true, request: true });
  eq("manager: everything", a(MANAGER), { see: true, mayCost: true, mayReplies: true, mayJobs: true, choose: true, offerExtra: true, confirm: true, request: true });
  eq("dispatcher: no cost (jobCosting off), replies (supervisor), all actions", a(DISPATCHER), { see: true, mayCost: false, mayReplies: true, mayJobs: true, choose: true, offerExtra: true, confirm: true, request: true });
  eq("estimator: no cost, no replies (not user:manage), no extra work (jobs view_only), no request", a(ESTIMATOR), { see: true, mayCost: false, mayReplies: false, mayJobs: true, choose: true, offerExtra: false, confirm: true, request: false });
  eq("crew: nothing", a(CREW), { see: false, mayCost: false, mayReplies: false, mayJobs: false, choose: false, offerExtra: false, confirm: false, request: false });
  const support = a({ ...OWNER, userId: null });
  ok("a read-only support session sees, and is offered no write", support.see && support.mayCost && !support.choose && !support.offerExtra && !support.confirm && !support.request);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Status — each placement maps to one status");
// ═══════════════════════════════════════════════════════════════════════════
{
  const s = R.importStatus;
  eq("a line → on_quote", s({ kind: "line" }), "on_quote");
  eq("a change order not yet sent → extra_pending", s({ kind: "change_order", changeOrder: { status: "pending" } }), "extra_pending");
  eq("a change order out for signature → extra_pending", s({ kind: "change_order", changeOrder: { status: "waiting_client" } }), "extra_pending");
  eq("an approved change order → extra_approved", s({ kind: "change_order", changeOrder: { status: "approved" } }), "extra_approved");
  eq("an option the client declined as extra work → extra_declined", s({ kind: "option" }, [{ status: "rejected" }]), "extra_declined");
  eq("an option with no change order → option", s({ kind: "option" }, []), "option");
  eq("an option whose only change order is unrecognised → option (carries nothing)", s({ kind: "option" }, [{ status: "lost" }]), "option");
  eq("the statuses, in reading order", [...R.RECEIVED_PRICE_STATUSES], ["not_used", "option", "on_quote", "extra_pending", "extra_approved", "extra_declined"]);
}

// ═══════════════════════════════════════════════════════════════════════════
// The in-memory database: equality, { in }, { not }, OR, relation filters,
// nested select with orderBy/take; every query recorded.
// ═══════════════════════════════════════════════════════════════════════════

function makeDb(T) {
  const queries = [];
  const REL = {
    quoteImport: { sourceCompany: ["company", (r) => T.company.find((c) => c.id === r.sourceCompanyId) || null] },
    subPriceRequestRecipient: {
      request: ["subPriceRequest", (r) => T.subPriceRequest.find((q) => q.id === r.requestId) || null],
      subcontractor: ["subcontractor", (r) => T.subcontractor.find((s) => s.id === r.subcontractorId) || null],
    },
    quote: {
      client: ["client", (r) => T.client.find((c) => c.id === r.clientId) || null],
      jobs: ["job", (r) => T.job.filter((j) => j.quoteId === r.id)],
    },
    changeOrder: { job: ["job", (r) => T.job.find((j) => j.id === r.jobId) || null] },
  };
  const matches = (model, row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "OR") return v.some((w) => matches(model, row, w));
      if (v && typeof v === "object" && !(v instanceof Date)) {
        if ("in" in v) return v.in.includes(row[k]);
        if ("not" in v) return (row[k] ?? null) !== (v.not ?? null);
        const rel = REL[model]?.[k];
        if (rel) {
          const got = rel[1](row);
          return Boolean(got) && !Array.isArray(got) && matches(rel[0], got, v);
        }
        throw new Error(`fake db: unsupported filter ${model}.${k}`);
      }
      return (row[k] ?? null) === (v ?? null);
    });
  const order = (rows, orderBy) => {
    const k = orderBy && Object.keys(orderBy)[0];
    if (!k) return rows;
    const dir = orderBy[k] === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => (a[k] > b[k] ? dir : a[k] < b[k] ? -dir : 0));
  };
  const shape = (model, row, select) => {
    if (!row) return null;
    if (!select) return { ...row };
    const out = {};
    for (const [k, v] of Object.entries(select)) {
      if (!v) continue;
      const rel = REL[model]?.[k];
      if (!rel) {
        out[k] = row[k];
        continue;
      }
      const got = rel[1](row);
      const sub = v === true ? {} : v;
      if (Array.isArray(got)) {
        let list = order(got, sub.orderBy);
        if (sub.take) list = list.slice(0, sub.take);
        out[k] = list.map((x) => shape(rel[0], x, sub.select));
      } else out[k] = shape(rel[0], got, sub.select);
    }
    return out;
  };
  const model = (name) => ({
    findMany: async (args = {}) => {
      queries.push({ model: name, where: args.where || {} });
      let rows = T[name].filter((r) => matches(name, r, args.where || {}));
      rows = order(rows, args.orderBy);
      if (args.take) rows = rows.slice(0, args.take);
      return rows.map((r) => shape(name, r, args.select));
    },
  });
  const db = {};
  for (const name of Object.keys(T)) db[name] = model(name);
  return { db, queries };
}

const d = (n) => new Date(Date.UTC(2026, 9, n, 12));

// Two GCs (gc1, gc2) and one sub (sub1) who quotes both. Distinctive cents
// so a leaked cost is findable in the serialised output.
function fixtures() {
  return {
    company: [
      { id: "gc1", name: "Northline GC" },
      { id: "gc2", name: "Rival Builders" },
      { id: "sub1", name: "Sparky Electric" },
    ],
    client: [
      { id: "c_home", companyId: "gc1", name: "Hortense Homeowner" },
      { id: "c_rival", companyId: "gc2", name: "Rival's Client" },
      // The GC as a business client IN THE SUB's tenant.
      { id: "c_gc_in_sub", companyId: "sub1", name: "Northline GC", linkedCompanyId: "gc1" },
    ],
    quote: [
      { id: "QA", companyId: "gc1", quoteNumber: "Q-1001", status: "draft", clientId: "c_home", historicalImportedAt: null, createdAt: d(1) },
      { id: "QB", companyId: "gc1", quoteNumber: "Q-1002", status: "accepted", clientId: "c_home", historicalImportedAt: null, createdAt: d(2) },
      { id: "QC", companyId: "gc1", quoteNumber: "Q-1003", status: "declined", clientId: "c_home", historicalImportedAt: null, createdAt: d(3) },
      { id: "QX", companyId: "gc2", quoteNumber: "R-9001", status: "draft", clientId: "c_rival", historicalImportedAt: null, createdAt: d(4) },
      // The sub's own quotes, addressed to gc1 as a business client. Only
      // SQ1 was ever imported; SQ2 must never appear for gc1.
      { id: "SQ1", companyId: "sub1", quoteNumber: "S-1", status: "sent", clientId: "c_gc_in_sub", historicalImportedAt: null, createdAt: d(1) },
      { id: "SQ2", companyId: "sub1", quoteNumber: "S-2-NEVER", status: "sent", clientId: "c_gc_in_sub", historicalImportedAt: null, createdAt: d(5) },
    ],
    job: [{ id: "J1", companyId: "gc1", quoteId: "QB", title: "Kitchen reno", createdAt: d(2) }],
    subcontractor: [
      { id: "S1", companyId: "gc1", name: "Sparky Electric", trade: "Electrical", linkedCompanyId: "sub1", insuranceExpiresAt: null, clearanceExpiresAt: null, createdAt: d(1) },
      { id: "S2", companyId: "gc1", name: "Paul's Painting", trade: "Painting", linkedCompanyId: null, insuranceExpiresAt: null, clearanceExpiresAt: null, createdAt: d(1) },
      { id: "S3", companyId: "gc1", name: "Pipe Pros", trade: "Plumbing", linkedCompanyId: null, insuranceExpiresAt: null, clearanceExpiresAt: null, createdAt: d(1) },
      { id: "SX", companyId: "gc2", name: "Sparky Electric", trade: "Electrical", linkedCompanyId: "sub1", insuranceExpiresAt: null, clearanceExpiresAt: null, createdAt: d(1) },
    ],
    quoteImport: [
      // QA (draft): a line and a competing option for Electrical, and an upload.
      { id: "I1", targetCompanyId: "gc1", targetQuoteId: "QA", sourceQuoteId: "SQ1", sourceCompanyId: "sub1", subcontractorId: null, uploadedSource: null, snapshotAmount: 1234.56, markupPercent: 10, label: "Electrical", placement: "line", createdAt: d(6) },
      { id: "I2", targetCompanyId: "gc1", targetQuoteId: "QA", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S1", uploadedSource: null, snapshotAmount: 1111.11, markupPercent: 0, label: "electrical ", placement: "option", createdAt: d(7) },
      { id: "I3", targetCompanyId: "gc1", targetQuoteId: "QA", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S2", uploadedSource: { files: [] }, snapshotAmount: 2222.22, markupPercent: 20, label: "Painting", placement: "option", createdAt: d(8) },
      // QB (approved, job J1): carried, approved, declined, unused.
      { id: "I4", targetCompanyId: "gc1", targetQuoteId: "QB", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S2", uploadedSource: null, snapshotAmount: 3333.33, markupPercent: 0, label: "Painting", placement: "option", createdAt: d(9) },
      { id: "I5", targetCompanyId: "gc1", targetQuoteId: "QB", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S3", uploadedSource: null, snapshotAmount: 4444.44, markupPercent: 0, label: "Plumbing", placement: "option", createdAt: d(10) },
      { id: "I6", targetCompanyId: "gc1", targetQuoteId: "QB", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S1", uploadedSource: null, snapshotAmount: 5555.55, markupPercent: 0, label: "Electrical", placement: "option", createdAt: d(11) },
      { id: "I7", targetCompanyId: "gc1", targetQuoteId: "QB", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S3", uploadedSource: null, snapshotAmount: 6666.66, markupPercent: 0, label: "Drains", placement: "option", createdAt: d(12) },
      // QC (declined): an option nobody can use now.
      { id: "I8", targetCompanyId: "gc1", targetQuoteId: "QC", sourceQuoteId: null, sourceCompanyId: null, subcontractorId: "S2", uploadedSource: null, snapshotAmount: 7777.77, markupPercent: 0, label: "Painting", placement: "option", createdAt: d(13) },
      // gc2 imported the SAME sub quote.
      { id: "I9", targetCompanyId: "gc2", targetQuoteId: "QX", sourceQuoteId: "SQ1", sourceCompanyId: "sub1", subcontractorId: "SX", uploadedSource: null, snapshotAmount: 9999.99, markupPercent: 0, label: "Electrical", placement: "option", createdAt: d(14) },
    ],
    changeOrder: [
      { id: "CO1", jobId: "J1", quoteImportId: "I4", status: "waiting_client", seq: 1, createdAt: d(9) },
      { id: "CO2", jobId: "J1", quoteImportId: "I5", status: "approved", seq: 2, createdAt: d(10) },
      { id: "CO3", jobId: "J1", quoteImportId: "I6", status: "rejected", seq: 3, createdAt: d(11) },
    ],
    subPriceRequest: [
      { id: "PR1", companyId: "gc1", quoteId: "QA", trade: "Plumbing" },
      { id: "PR2", companyId: "gc1", quoteId: "QA", trade: "Electrical" },
      { id: "PRX", companyId: "gc2", quoteId: "QX", trade: "Electrical" },
    ],
    subPriceRequestRecipient: [
      // Waiting for gc1 to put it in the compare.
      { id: "R1", requestId: "PR1", companyId: "gc1", subcontractorId: "S3", repliedAt: d(15), replyAmount: 888.88, quoteImportId: null, declinedAt: null, createdAt: d(5) },
      // Already confirmed → it is I2, not a second row.
      { id: "R2", requestId: "PR2", companyId: "gc1", subcontractorId: "S1", repliedAt: d(7), replyAmount: 1111.11, quoteImportId: "I2", declinedAt: null, createdAt: d(5) },
      // Replied, then declined → no price stands.
      { id: "R3", requestId: "PR1", companyId: "gc1", subcontractorId: "S2", repliedAt: d(6), replyAmount: 777.0, quoteImportId: null, declinedAt: d(7), createdAt: d(5) },
      // gc2's waiting reply.
      { id: "RX", requestId: "PRX", companyId: "gc2", subcontractorId: "SX", repliedAt: d(16), replyAmount: 9898.98, quoteImportId: null, declinedAt: null, createdAt: d(5) },
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The list — own prices only, statuses, money, actions");
// ═══════════════════════════════════════════════════════════════════════════

const byId = (rows) => Object.fromEntries(rows.map((r) => [r.id, r]));
{
  const T = fixtures();
  const { db, queries } = makeDb(T);
  const out = await loadReceivedPrices(db, { companyId: "gc1", access: R.receivedPriceAccess(MANAGER), asOf: d(20) });
  const rows = out.rows;
  const ids = rows.map((r) => r.id).sort();
  eq("gc1 sees exactly its eight imports and its one waiting reply", ids, ["imp:I1", "imp:I2", "imp:I3", "imp:I4", "imp:I5", "imp:I6", "imp:I7", "imp:I8", "req:R1"].sort());
  const json = JSON.stringify(out);
  ok("gc2's import, reply and quote never appear", !/I9|RX|QX|R-9001|Rival|9999\.99|9898\.98/.test(json));
  ok("the sub's quote gc1 never imported never appears", !/SQ2|S-2-NEVER/.test(json));
  ok("a confirmed reply is its import, not a second row", !rows.some((r) => r.id === "req:R2"));
  ok("a reply the sub then declined is not a price", !rows.some((r) => r.id === "req:R3"));
  ok("newest first", rows[0].id === "req:R1" && rows[rows.length - 1].id === "imp:I1");

  // Every query the loader made stays in gc1.
  const quoteQs = queries.filter((q) => q.model === "quote");
  ok("every Quote query is scoped to the GC's company", quoteQs.length > 0 && quoteQs.every((q) => q.where.companyId === "gc1"), quoteQs);
  // The roster is matched BY the sub's company id (linkedCompanyId) inside
  // the GC's own rows — that is a value, not a scope. No scope names anyone
  // but the GC.
  ok("no query is scoped to the sub's company or anyone else's", !queries.some((q) => /"(companyId|targetCompanyId)":"(?!gc1")/.test(JSON.stringify(q.where))));
  const imp = queries.find((q) => q.model === "quoteImport");
  eq("imports: targetCompanyId = the GC", imp?.where, { targetCompanyId: "gc1" });
  const rec = queries.find((q) => q.model === "subPriceRequestRecipient");
  ok("replies: the GC's own recipient rows on the GC's own requests", rec?.where.companyId === "gc1" && rec?.where.request?.companyId === "gc1");
  ok("change orders: through the GC's own jobs", queries.find((q) => q.model === "changeOrder")?.where.job?.companyId === "gc1");
  ok("roster: the GC's own subs", queries.filter((q) => q.model === "subcontractor").every((q) => q.where.companyId === "gc1"));

  const R_ = byId(rows);
  eq(
    "each status maps",
    ["imp:I1", "imp:I2", "imp:I3", "imp:I4", "imp:I5", "imp:I6", "imp:I7", "imp:I8", "req:R1"].map((k) => R_[k].status),
    ["on_quote", "option", "option", "extra_pending", "extra_approved", "extra_declined", "option", "option", "not_used"],
  );
  eq("how each arrived", [R_["imp:I1"].source, R_["imp:I2"].source, R_["imp:I3"].source, R_["req:R1"].source], ["fieldquo_quote", "reply", "upload", "reply"]);
  eq("the sub: their company name, else the GC's roster name", [R_["imp:I1"].subName, R_["imp:I2"].subName, R_["imp:I3"].subName, R_["req:R1"].subName], ["Sparky Electric", "Sparky Electric", "Paul's Painting", "Pipe Pros"]);
  ok("…and one sub is one filter value, however the price arrived", R_["imp:I1"].subKey === R_["imp:I2"].subKey && R_["imp:I2"].subKey === "sub:S1");
  eq("the trade: the price's label; a request's trade for a reply", [R_["imp:I3"].trade, R_["req:R1"].trade], ["Painting", "Plumbing"]);
  ok("'Electrical' and 'electrical ' are one trade", R_["imp:I1"].tradeKey === R_["imp:I2"].tradeKey);
  eq("the quote and job it is for", R_["imp:I5"].quote, { id: "QB", quoteNumber: "Q-1002", status: "accepted", clientName: "Hortense Homeowner", job: { id: "J1", title: "Kitchen reno" } });
  eq("when it was received", [R_["imp:I3"].receivedAt, R_["req:R1"].receivedAt].map((x) => new Date(x).toISOString()), [d(8).toISOString(), d(15).toISOString()]);
  eq("with jobCosting: cost, markup and client price", [R_["imp:I1"].cost, R_["imp:I1"].markupPercent, R_["imp:I1"].clientPrice], [1234.56, 10, 1358.02]);
  eq("a waiting reply: its figure is cost, with no client price yet", [R_["req:R1"].cost, R_["req:R1"].clientPrice], [888.88, null]);
  eq("the change order carrying it", R_["imp:I4"].changeOrder, { label: "CO-1", status: "waiting_client" });

  // Actions — each to the existing path, only when it would be accepted.
  eq("Open → the quote's compare panel", R_["imp:I2"].actions.open, "/app/quotes/QA#sub-compare");
  eq("Open a waiting reply → the quote's price-request panel", R_["req:R1"].actions.open, "/app/quotes/QA#price-requests");
  eq("Add an option beside the trade's line → the select route, 'use instead'", R_["imp:I2"].actions.add, { kind: "select", method: "POST", url: "/api/quotes/QA/imports/I2/select", mode: "use_instead" });
  eq("Add an option with no line in its trade → the select route, 'use'", R_["imp:I3"].actions.add, { kind: "select", method: "POST", url: "/api/quotes/QA/imports/I3/select", mode: "use" });
  eq("Add on an approved quote with a job → the select route, extra work", R_["imp:I7"].actions.add?.mode, "offer_extra");
  eq("…and one the client declined as extra work may be offered again", R_["imp:I6"].actions.add?.mode, "offer_extra");
  ok("nothing to add for a price already on the quote or on a change order", [R_["imp:I1"], R_["imp:I4"], R_["imp:I5"]].every((r) => r.actions.add === null));
  ok("nothing to add on a declined quote", R_["imp:I8"].actions.add === null);
  eq("a waiting reply → the confirm route (into the compare first)", R_["req:R1"].actions.add, { kind: "confirm", method: "POST", url: "/api/price-requests/recipients/R1/confirm", mode: "add_to_compare" });
  eq("Request a price → the quote page's own dialog", R_["imp:I2"].actions.request, "/app/quotes/QA?requestPrices=1#price-requests");
  ok("…not on a declined quote", R_["imp:I8"].actions.request === null);
  eq("request targets: the GC's open and approved quotes only", out.requestTargets.map((q) => q.id).sort(), ["QA", "QB"]);
  ok("no action URL carries a figure", !rows.some((r) => /\d+\.\d{2}/.test(JSON.stringify(r.actions))));
}

{
  // The same database, read by an Estimator: prices, no costing.
  const { db } = makeDb(fixtures());
  const out = await loadReceivedPrices(db, { companyId: "gc1", access: R.receivedPriceAccess(ESTIMATOR), asOf: d(20) });
  const json = JSON.stringify(out.rows);
  ok("without jobCosting no row carries a cost or a markup key", out.rows.every((r) => !("cost" in r) && !("markupPercent" in r) && r.costHidden === true));
  // (A price with 0% markup has a client price equal to the cost — the
  // compare shows that too; the marked-up ones prove the cost is withheld.)
  ok("…and no sub's figure is anywhere in the output", !/1234\.56|2222\.22|888\.88/.test(json));
  eq("…the client price the compare shows stays", byId(out.rows)["imp:I1"].clientPrice, 1358.02);
  ok("without the roster gate, waiting replies are not listed", !out.rows.some((r) => r.kind === "reply"));
  ok("an Estimator may use an option on an open quote", byId(out.rows)["imp:I3"].actions.add?.mode === "use");
  ok("…but not raise extra work (jobs view_only) or a price request (no roster)", byId(out.rows)["imp:I7"].actions.add === null && out.rows.every((r) => r.actions.request === null) && out.requestTargets.length === 0);
}

{
  // A Dispatcher: replies yes (supervisor), cost no.
  const { db } = makeDb(fixtures());
  const out = await loadReceivedPrices(db, { companyId: "gc1", access: R.receivedPriceAccess(DISPATCHER), asOf: d(20) });
  const reply = byId(out.rows)["req:R1"];
  ok("a supervisor without jobCosting sees the waiting reply, without its figure", reply && reply.costHidden === true && !("cost" in reply) && !/888\.88/.test(JSON.stringify(out.rows)));
}

{
  // A read-only support session: everything readable, no action.
  const { db } = makeDb(fixtures());
  const out = await loadReceivedPrices(db, { companyId: "gc1", access: R.receivedPriceAccess({ ...OWNER, userId: null }), asOf: d(20) });
  ok("impersonation: rows, and not one write offered", out.rows.length === 9 && out.rows.every((r) => r.actions.add === null && r.actions.request === null) && out.requestTargets.length === 0);
}

{
  // Crew, or a member the route refused: the loader returns nothing at all.
  const { db, queries } = makeDb(fixtures());
  const out = await loadReceivedPrices(db, { companyId: "gc1", access: R.receivedPriceAccess(CREW) });
  ok("no access → no rows and no query", out.rows.length === 0 && queries.length === 0);
}

{
  // The builder's own guard: a foreign row handed to it is dropped even if
  // a loader bug fetched it.
  const T = fixtures();
  const access = R.receivedPriceAccess(OWNER);
  const rows = R.buildReceivedPrices({
    companyId: "gc1",
    imports: [...T.quoteImport.map((i) => ({ ...i, sourceCompany: T.company.find((c) => c.id === i.sourceCompanyId) })), { ...T.quoteImport[8], id: "SNEAK", targetQuoteId: "QA" },
      // An import that claims the GC but points at another company's quote.
      { ...T.quoteImport[2], id: "SNEAK2", targetQuoteId: "QX" }],
    recipients: T.subPriceRequestRecipient.map((r) => ({ ...r, request: T.subPriceRequest.find((q) => q.id === r.requestId), subcontractor: T.subcontractor.find((s) => s.id === r.subcontractorId) })),
    quotes: T.quote.map((q) => ({ ...q, client: T.client.find((c) => c.id === q.clientId), jobs: T.job.filter((j) => j.quoteId === q.id) })),
    changeOrders: T.changeOrder,
    roster: T.subcontractor,
    access,
  });
  const json = JSON.stringify(rows);
  ok("the builder drops another company's import, reply and quote it was handed", !/I9|SNEAK|RX|QX|R-9001|9999\.99/.test(json) && rows.length === 9);
  ok("the builder drops the sub's own quotes it was handed", !/SQ1"|SQ2|S-2-NEVER/.test(JSON.stringify(rows.map((r) => r.quote))));
  eq("an empty company: an empty list, not an error", R.buildReceivedPrices({ companyId: "gc9", imports: [], access }), []);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Filters");
// ═══════════════════════════════════════════════════════════════════════════
{
  const { db } = makeDb(fixtures());
  const { rows } = await loadReceivedPrices(db, { companyId: "gc1", access: R.receivedPriceAccess(MANAGER), asOf: d(20) });
  const f = (x) => R.filterReceivedPrices(rows, x).map((r) => r.id).sort();
  eq("no filter: everything", f({}).length, 9);
  eq("trade: electrical", f({ trade: "electrical" }), ["imp:I1", "imp:I2", "imp:I6"]);
  eq("status: option", f({ status: "option" }), ["imp:I2", "imp:I3", "imp:I7", "imp:I8"]);
  eq("sub: Pipe Pros", f({ sub: "sub:S3" }), ["imp:I5", "imp:I7", "req:R1"]);
  eq("combined: Painting options", f({ trade: "painting", status: "option" }), ["imp:I3", "imp:I8"]);
  eq("an unknown value matches nothing, not everything", f({ status: "bogus" }), []);
  const o = R.receivedPriceFilterOptions(rows);
  eq("status choices: only those present, in reading order, counted", o.statuses.map((s) => [s.value, s.count]), [["not_used", 1], ["option", 4], ["on_quote", 1], ["extra_pending", 1], ["extra_approved", 1], ["extra_declined", 1]]);
  eq("trade choices: each once", o.trades.map((t) => t.value), ["drains", "electrical", "painting", "plumbing"]);
  eq("sub choices: each once, by name", o.subs.map((s) => s.label), ["Paul's Painting", "Pipe Pros", "Sparky Electric"]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Wiring — routes, page, anchors, nav, strings");
// ═══════════════════════════════════════════════════════════════════════════
{
  const route = stripComments(read("app/api/subcontractors/received-prices/route.js"));
  ok("the route asks quotes view_only and showPricing", /requireLevel\(full, "quotes", "view_only"/.test(route) && /requireToggle\(full, "showPricing"/.test(route));
  ok("…scopes by the session's company and passes the session's userId", /companyId: member\.companyId/.test(route) && /userId: member\.userId/.test(route));
  ok("…and only reads (no POST, PATCH or DELETE)", !/export async function (POST|PATCH|PUT|DELETE)/.test(route));

  // The actions' targets are real routes with the gates the access flags mirror.
  const select = stripComments(read("app/api/quotes/[id]/imports/[importId]/select/route.js"));
  ok("the select route exists, POST, quotes view_create_edit + showPricing (+ jobs on approved)", /export async function POST/.test(select) && /requireLevel\(full, "quotes", "view_create_edit"/.test(select) && /requireToggle\(full, "showPricing"/.test(select) && /requireLevel\(full, "jobs", "view_create_edit"/.test(select));
  const confirm = stripComments(read("app/api/price-requests/recipients/[id]/confirm/route.js"));
  ok("the confirm route exists, POST, quotes view_create_edit + showPricing", /export async function POST/.test(confirm) && /requireLevel\(full, "quotes", "view_create_edit"/.test(confirm) && /requireToggle\(full, "showPricing"/.test(confirm));
  const prRoute = stripComments(read("app/api/price-requests/route.js"));
  ok("the price-request list asks the roster gate the replies rows ask", /requireSubcontractorRead\(full\)/.test(prRoute));

  const panel = read("app/app/quotes/[id]/ImportedCostsPanel.js");
  ok("the compare panel carries the anchor Open links to", panel.includes(`id="${R.comparePath("Q").split("#")[1]}"`));
  const prPanel = read("app/components/subRequests/PriceRequestsPanel.js");
  ok("the price-request panel carries its anchor and opens its dialog on requestPrices=1", prPanel.includes(`id="${R.priceRequestsPath("Q").split("#")[1]}"`) && /get\("requestPrices"\) === "1"/.test(prPanel) && /data\.canSend\) setOpen\(true\)/.test(prPanel));
  ok("the paths say what the panels read", R.requestPricePath("Q").includes("requestPrices=1"));

  const page = stripComments(read("app/app/subcontractors/quotes/page.js"));
  ok("the page reads the route", page.includes('"/api/subcontractors/received-prices"'));
  ok("the page posts the server's action URL with no figure (select: \"{}\", confirm: no body)", /fetchJson\(\s*action\.url/.test(page) && /body: "\{\}"/.test(page) && !/JSON\.stringify\(/.test(page));
  ok("the page draws Add only when the server offered it", /row\.actions\.add &&/.test(page));
  ok("the page uses the shared insurance lines, not a copy", /SubCredentials/.test(page) && /SubCredentials/.test(panel) && !/function Credentials/.test(page + panel));
  ok("loading, failed and empty are exclusive (ListState) with a three-way empty state", /<ListState/.test(page) && /emptyRequest/.test(page) && /emptyLink/.test(page) && /emptyUpload/.test(page));
  ok("the page lives where the sidebar row points", existsSync(join(ROOT, "app/app/subcontractors/quotes/page.js")));

  const sidebar = read("app/components/layout/AdminSidebar.js");
  ok("the sidebar row sits right after Subcontractors", /key: "app\.nav\.subcontractors"[^\n]*\n(?:\s*\/\/[^\n]*\n)*\s*\{ key: "app\.nav\.subQuotes", href: "\/app\/subcontractors\/quotes"/.test(sidebar));
  ok("the product-analytics catalogue has its own line", /href: "\/app\/subcontractors\/quotes", navKey: "app\.nav\.subQuotes"/.test(read("lib/analytics/product/appPages.js")));
  ok("the app-guide harness lists the screen", /nav: "app\.nav\.subQuotes", href: "\/app\/subcontractors\/quotes"/.test(read("docs/screens/app-guide/harness/screens.js")));

  // Every key the page asks for exists in every app locale.
  const raw = read("app/app/subcontractors/quotes/page.js");
  const keys = new Set([...raw.matchAll(/t\(\s*"(app\.[A-Za-z0-9_.]+)"/g)].map((m) => m[1]));
  for (const s of R.RECEIVED_PRICE_STATUSES) keys.add(`app.subQuotes.status.${s}`);
  for (const s of ["fieldquo_quote", "reply", "upload"]) keys.add(`app.subQuotes.source.${s}`);
  keys.add("app.nav.subQuotes");
  const missing = [];
  for (const [lang, dict] of Object.entries(APP_MESSAGES)) for (const k of keys) if (!dict[k]) missing.push(`${lang}:${k}`);
  ok(`every string the page uses (${keys.size}) exists in all ${Object.keys(APP_MESSAGES).length} app locales`, missing.length === 0, missing.slice(0, 10));
  const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  const badPh = [];
  for (const [lang, dict] of Object.entries(APP_MESSAGES))
    for (const k of keys) if (dict[k] && placeholders(dict[k]) !== placeholders(APP_MESSAGES.en[k])) badPh.push(`${lang}:${k}`);
  ok("…with the same placeholders as English", badPh.length === 0, badPh);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Mutation pass — every guarantee above must be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(fails.length ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}` : `\nPASSED — ${pass}/${pass} assertions`);
  process.exit(fails.length ? 1 : 0);
}

section("6. Mutation pass — break each guarantee, confirm it is caught");

const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const P = "lib/subcontractors/receivedPrices.js";
const S = "lib/subcontractors/receivedPricesServer.js";
const F = "lib/subcontractors/receivedPriceFilters.js";

const MUTATIONS = [
  [S, "the quote read is not scoped to the GC", (s) => s.replace("db.quote.findMany({ where: { id: { in: quoteIds }, companyId }, select: QUOTE_SELECT })", "db.quote.findMany({ where: { id: { in: quoteIds } }, select: QUOTE_SELECT })")],
  [S, "the import read takes every company's imports", (s) => s.replace("where: { targetCompanyId: companyId },", "where: {},")],
  [S, "the reply read takes every company's replies", (s) => s.replace("            companyId,\n            request: { companyId },", "            request: {},")],
  [S, "change orders read across tenants", (s) => s.replace("where: { quoteImportId: { in: importIds }, job: { companyId } },", "where: { quoteImportId: { in: importIds } },")],
  [P, "the builder trusts whatever imports it is handed", (s) => s.replace("(imp) => imp && imp.id && imp.targetCompanyId === companyId && quoteById.has(imp.targetQuoteId),", "(imp) => imp && imp.id,")],
  [P, "the builder keeps another company's quotes", (s) => s.replace("(Array.isArray(quotes) ? quotes : []).filter((q) => q && q.companyId === companyId).map", "(Array.isArray(quotes) ? quotes : []).filter((q) => q).map")],
  [P, "the cost shows without jobCosting", (s) => s.replace('mayCost: see && hasToggle(member, "jobCosting"),', "mayCost: see,")],
  [P, "a reply's figure is always sent", (s) => s.replace("...(access.mayCost ? { cost: round2(r.replyAmount), markupPercent: null } : { costHidden: true }),", "cost: round2(r.replyAmount), markupPercent: null,")],
  [P, "replies are listed without the roster gate", (s) => s.replace("mayReplies: see && canReadSubcontractors(member),", "mayReplies: see,")],
  [P, "the page opens without showPricing", (s) => s.replace('return hasLevel(member, "quotes", "view_only") && hasToggle(member, "showPricing");', 'return hasLevel(member, "quotes", "view_only");')],
  [P, "a declined change order reads as a plain option", (s) => s.replace('return rejected ? "extra_declined" : "option";', 'return "option";')],
  [P, "a change order out for signature reads as approved", (s) => s.replace('return changeOrderStatus(placement.changeOrder) === "approved" ? "extra_approved" : "extra_pending";', 'return "extra_approved";')],
  [P, "a price already on the quote offers Add again", (s) => s.replace('if (status !== "option" && status !== "extra_declined") return null;', "")],
  [P, "extra work offered without the jobs level", (s) => s.replace("    if (!access?.offerExtra) return null;\n", "")],
  [P, "a support session is offered writes", (s) => s.replace("const writer = Boolean(member?.userId) && !member?.impersonation;", "const writer = true;")],
  [P, "Open points at an anchor no panel has", (s) => s.replace("#sub-compare`;", "#compare`;")],
  [P, "'use instead' is never said", (s) => s.replace("lineInTrade: lineInTrade && o.placement !== \"line\",", "lineInTrade: false,")],
  [F, "an unknown filter value matches everything", (s) => s.replace("(status === ALL || r.status === status) &&", "(status === ALL || !RECEIVED_PRICE_STATUSES.includes(status) || r.status === status) &&")],
  ["lib/permissions/nav.js", "the nav row reverts to first-match (toggle only)", (s) => s.replace("  if (req.toggle && !hasToggle(member, req.toggle)) return false;\n  if (req.category && !hasLevel(member, req.category, req.level)) return false;\n  return true;", "  if (req.toggle) return hasToggle(member, req.toggle);\n  if (req.category && !hasLevel(member, req.category, req.level)) return false;\n  return true;")],
];

const backupDir = mkdtempSync(join(tmpdir(), "check-sub-quotes-"));
const files = [...new Set(MUTATIONS.map(([f]) => f))];
const ORIGINALS = {};
for (const f of files) {
  ORIGINALS[f] = readFileSync(join(ROOT, f), "utf8");
  cpSync(join(ROOT, f), join(backupDir, f.replace(/\//g, "__")));
}
const restore = (f) => cpSync(join(backupDir, f.replace(/\//g, "__")), join(ROOT, f));

let caught = 0;
const escaped = [];
try {
  for (const [file, label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINALS[file]);
    if (mutated === ORIGINALS[file]) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(join(ROOT, file), mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], { stdio: ["ignore", "pipe", "pipe"] });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    restore(file);
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  for (const f of files) restore(f);
  rmSync(backupDir, { recursive: true, force: true });
}
for (const f of files) ok(`${f} restored byte-for-byte`, readFileSync(join(ROOT, f), "utf8") === ORIGINALS[f]);
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions — a GC sees every price their subs sent, and nobody else's`,
);
process.exit(fails.length ? 1 : 0);
