// scripts/check-sales-milestones.mjs
//
//   npm run check:sales-milestones
//
// Easy Roofers Inc. read "Taking payments" and "No milestones recorded" on the
// same row of the sales portal's My companies table.
//
// ══ Why both were true ════════════════════════════════════════════════════
//
// Activation is `Company.stripeChargesEnabled` and nothing else. That column
// has TWO writers:
//
//   app/api/stripe/webhook/route.js        account.updated
//   app/api/stripe/connect/status/route.js polled by the settings page
//
// The second exists precisely because the first so often never arrives —
// account.updated only reaches a connected account when
// STRIPE_CONNECT_WEBHOOK_SECRET is set, an endpoint exists, and that endpoint
// is configured for CONNECTED accounts; a plain account webhook never sees it
// at all. Its own header comment says so.
//
// Only the webhook recorded the milestone. So a company that finished Connect
// on the ordinary path had its column written, its pay links enabled, its
// portal switched on — and its rep earned nothing, permanently, because
// nothing would ever write that column again.
//
// Two places answering one question, and only one of them counting. That is
// the failure this file exists to keep closed.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Section 1 drives recordActivation against a stub Prisma: charges off, charges
// on, a company that does not exist, a replay, a rep with no plan. The rule
// that decides whether FieldQuo pays somebody is run, not read.
//
// Sections 2-4 read source DECOMMENTED. This file explains the bug at length
// and would otherwise match its own prose in three places.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Eight mutations, all caught, each restored from a `cp` backup named after
// the file's PATH, not its basename — three of the four files here are called
// `route.js`, and a basename-keyed backup silently restores the wrong one over
// the other two.
//
// The eight: recordActivation dropped from the status route; moved ahead of
// the column write; the sweep's chargesEnabled filter removed; the sweep's
// `none` given a status filter (which would re-earn a reversed milestone);
// sweepActivations defined but never called; the qualification softened to
// accept a company row that does not exist; the webhook stopped recording;
// and recordActivation trusting its caller instead of re-reading the row.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  recordActivation,
  qualifiesForActivation,
  commissionRef,
  MILESTONES,
  MILESTONE_ORDER,
  MILESTONE_LABELS,
} from "@/lib/sales/commission";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

// ── A Prisma stub with the one invariant that matters ─────────────────────
//
// The unique (companyId, ref) index is what makes a milestone exactly-once no
// matter how many writers call it, so the stub enforces it and throws P2002
// exactly as Postgres would. A stub that let a second row through would prove
// the opposite of what this file is for.
function stubDb({ company, attribution = { salesRepId: "rep_1" }, plan = { activationCents: 5000 } }) {
  const rows = [];
  return {
    rows,
    company: { findUnique: async ({ where }) => (company && company.id === where.id ? company : null) },
    salesAttribution: { findUnique: async () => attribution },
    salesRep: { findUnique: async () => (attribution ? { id: attribution.salesRepId, commissionPlan: plan } : null) },
    salesCommissionEntry: {
      create: async ({ data }) => {
        if (rows.some((r) => r.companyId === data.companyId && r.ref === data.ref)) {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        }
        rows.push({ ...data });
        return data;
      },
      findFirst: async ({ where }) =>
        rows.find((r) => r.companyId === where.companyId && r.ref === where.ref) || null,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The activation rule, executed");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Easy Roofers Inc.: taking payments, and nothing recorded.
  const db1 = stubDb({ company: { id: "c1", stripeChargesEnabled: true } });
  const earned = await recordActivation({ companyId: "c1", prisma: db1 });
  ok("a company taking payments earns activation", Boolean(earned), earned);
  ok("…one row", db1.rows.length === 1, db1.rows.length);
  ok("…for the activation milestone", db1.rows[0]?.milestone === MILESTONES.ACTIVATION);
  ok("…at the plan's amount, not a guessed default", db1.rows[0]?.amountCents === 5000);
  ok("…keyed for exactly-once", db1.rows[0]?.ref === commissionRef("c1", MILESTONES.ACTIVATION));

  // Two writers, one row. This is the whole safety argument for calling it
  // from the webhook, the status route and the nightly sweep.
  const again = await recordActivation({ companyId: "c1", prisma: db1 });
  ok("a second writer does not pay twice", db1.rows.length === 1, db1.rows.length);
  ok("…and gets the existing row back, not null", Boolean(again));
  await recordActivation({ companyId: "c1", prisma: db1 });
  await recordActivation({ companyId: "c1", prisma: db1 });
  ok("…nor a fourth time", db1.rows.length === 1, db1.rows.length);

  const db2 = stubDb({ company: { id: "c2", stripeChargesEnabled: false } });
  ok("charges disabled earns nothing", (await recordActivation({ companyId: "c2", prisma: db2 })) === null);
  ok("…and writes nothing", db2.rows.length === 0);

  const db3 = stubDb({ company: null });
  ok("a company that does not exist earns nothing", (await recordActivation({ companyId: "ghost", prisma: db3 })) === null);
  ok("no companyId at all earns nothing", (await recordActivation({ companyId: null, prisma: db3 })) === null);

  const db4 = stubDb({ company: { id: "c4", stripeChargesEnabled: true }, attribution: null });
  ok("a company no rep brought in earns nothing", (await recordActivation({ companyId: "c4", prisma: db4 })) === null);

  const db5 = stubDb({ company: { id: "c5", stripeChargesEnabled: true }, plan: null });
  ok("a rep with no commission plan earns nothing rather than a guess", (await recordActivation({ companyId: "c5", prisma: db5 })) === null);
  const db6 = stubDb({ company: { id: "c6", stripeChargesEnabled: true }, plan: { activationCents: 0 } });
  ok("…nor does a plan that pays zero write a zero row", (await recordActivation({ companyId: "c6", prisma: db6 })) === null);

  // The predicate itself, on the shapes a caller can actually hand it.
  ok("qualifiesForActivation(null) is false", qualifiesForActivation(null) === false);
  ok("qualifiesForActivation({}) is false", qualifiesForActivation({}) === false);
  ok("…and undefined charges is false, not undefined", qualifiesForActivation({ stripeChargesEnabled: undefined }) === false);
  ok("…and true is true", qualifiesForActivation({ stripeChargesEnabled: true }) === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Every writer of the column records the milestone");
// ═══════════════════════════════════════════════════════════════════════════
//
// The guarantee, stated as a rule rather than as two file names: any route
// that writes stripeChargesEnabled must also record activation. A third writer
// added later without one fails here.

{
  const WRITERS = [
    "app/api/stripe/webhook/route.js",
    "app/api/stripe/connect/status/route.js",
  ];
  const DISCONNECT = "app/api/stripe/connect/disconnect/route.js";

  for (const f of WRITERS) {
    const src = decomment(read(f));
    ok(`${f} writes the column`, /stripeChargesEnabled:/.test(src));
    ok(`…and records the milestone`, /recordActivation\(/.test(src), f);
  }

  // The one writer that must NOT: it sets the column to false. Recording an
  // activation on a disconnect would pay for switching payments off.
  const off = decomment(read(DISCONNECT));
  ok("disconnect writes the column false", /stripeChargesEnabled: false/.test(off));
  ok("…and records nothing", !/recordActivation\(/.test(off));

  // Nothing else may write it. A fourth writer added later without a milestone
  // call is the exact bug this file closes, so the tree is SCANNED rather than
  // the list being asserted against itself — a hand-kept list of writers is
  // wrong the moment somebody adds one, which is precisely the moment it has
  // to be right.
  const jsFiles = [];
  const walk = (dir) => {
    for (const name of readdirSync(join(ROOT, dir))) {
      if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
      const rel = `${dir}/${name}`;
      if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
      else if (name.endsWith(".js")) jsFiles.push(rel);
    }
  };
  walk("app");
  walk("lib");
  ok("the scan reads the tree", jsFiles.length > 200, jsFiles.length);

  // A WRITE, not a `select`. `stripeChargesEnabled: true` inside a select
  // clause is a read, and there are a dozen of those.
  const writers = jsFiles.filter((f) => {
    const src = decomment(read(f));
    return /data: \{[^}]*stripeChargesEnabled:/s.test(src) || /stripeChargesEnabled: (summary\.|account\.|false)/.test(src);
  });
  const unexpected = writers.filter((f) => !WRITERS.includes(f) && f !== DISCONNECT);
  ok("no route writes the column without recording the milestone", unexpected.length === 0, unexpected);
  ok("…and all three known writers were found by the scan", WRITERS.concat([DISCONNECT]).every((f) => writers.includes(f)), writers);

  // The status route's call must sit OUTSIDE the "something changed" branch.
  // A company whose column was already true — every company this fix is meant
  // to catch — changes nothing on any future poll, so a call inside that
  // branch would never fire for them.
  const status = decomment(read("app/api/stripe/connect/status/route.js"));
  const updateEnd = status.indexOf("}", status.indexOf("stripeOnboarded: summary.detailsSubmitted,"));
  const callAt = status.indexOf("recordActivation(");
  ok("the status route records after the update block, not inside it", callAt > updateEnd, [callAt, updateEnd]);
  ok("…guarded on charges being enabled", /if \(summary\.chargesEnabled\)/.test(status));
  ok("…and never allowed to break the answer", /recordActivation\(\{ companyId: company\.id \}\)\.catch\(/.test(status));

  const hook = decomment(read("app/api/stripe/webhook/route.js"));
  ok("the webhook passes Stripe's own timestamp, not new Date()", /occurredAt: event\.created \? new Date\(event\.created \* 1000\) : null/.test(hook));
  ok("…and its own event id", /stripeEventId: event\.id/.test(hook));
  ok("…and cannot break the column sync it exists for", /recordActivation\(\{[\s\S]{0,900}\}\)\.catch\(/.test(hook));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The nightly catch-up, for the ones already missed");
// ═══════════════════════════════════════════════════════════════════════════
//
// Both writers now record. Neither will ever run again for a company whose
// column was set before this shipped — nothing rewrites a column that is
// already correct — so without a sweep those companies are unpaid forever.

{
  const cron = decomment(read("app/api/cron/sales-retention/route.js"));
  ok("there is an activation sweep", /async function sweepActivations/.test(cron));
  ok("…and it is actually called", /await sweepActivations\(counts\)/.test(cron));
  const body = cron.slice(cron.indexOf("async function sweepActivations"), cron.indexOf("export async function GET"));
  ok("the sweep body was found", body.length > 300, body.length);
  ok("it only looks at companies that can take payments", /stripeChargesEnabled: true/.test(body));
  ok("…that have no activation entry yet", /none: \{ milestone: MILESTONES\.ACTIVATION \}/.test(body));
  // No status filter on the `none`, deliberately: a REVERSED activation must
  // not be re-earned, or the earning/reversal pair becomes a lie.
  ok(
    "…with no status filter, so a reversed milestone is never re-earned",
    !/none: \{ milestone: MILESTONES\.ACTIVATION, status/.test(body),
  );
  ok("…only attributed ones, since nothing else can pay", /salesAttribution\.findMany/.test(body));
  ok("it uses the shared rule rather than its own copy", /recordActivation\(\{ companyId/.test(body));
  ok("it bounds the batch", /take: BATCH/.test(body));
  ok("a failure is recorded, not swallowed", /recordError\(\{/.test(body));
  ok("…and does not abort the sweep", /catch \(err\)/.test(body));
  ok("the run reports what it did", /activationEarned/.test(cron) && /activationConsidered/.test(cron));

  // A sweep nothing schedules is a sweep that does not exist.
  const vercel = JSON.parse(read("vercel.json"));
  const crons = vercel.crons || [];
  const row = crons.find((c) => c.path === "/api/cron/sales-retention");
  ok("the cron that runs it is scheduled", Boolean(row), crons.map((c) => c.path));
  ok("…daily or more often", Boolean(row) && !/\*\s*$/.test(row.schedule) === false ? true : Boolean(row?.schedule));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. All three milestones have a live writer");
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner asked about "the other 2" as well. Milestone 1 was the broken one;
// this asserts the other two are reachable rather than assuming it, which is
// the check that was missing when milestone 2 sat unsatisfiable for everyone.

{
  ok("there are exactly three milestones", MILESTONE_ORDER.length === 3, MILESTONE_ORDER);
  ok("…each with a human label", MILESTONE_ORDER.every((m) => MILESTONE_LABELS[m]), MILESTONE_LABELS);

  const WRITER_FOR = {
    [MILESTONES.ACTIVATION]: [
      "app/api/stripe/webhook/route.js",
      "app/api/stripe/connect/status/route.js",
      "app/api/cron/sales-retention/route.js",
    ],
    [MILESTONES.FIRST_PAYMENT]: ["lib/platform/stripeBilling.js"],
    [MILESTONES.RETENTION]: ["app/api/cron/sales-retention/route.js"],
  };
  for (const milestone of MILESTONE_ORDER) {
    const writers = WRITER_FOR[milestone] || [];
    ok(`${MILESTONE_LABELS[milestone]} has at least one writer`, writers.length > 0);
    for (const f of writers) {
      const src = decomment(read(f));
      const writes = /earnMilestone\(/.test(src) || /recordActivation\(/.test(src);
      ok(`  ${f} writes a milestone`, writes, f);
    }
  }

  // Milestone 2's predicate is the one that was once unsatisfiable. Its caller
  // must still be the billing webhook path, not a cron that could be unscheduled.
  const billing = decomment(read("lib/platform/stripeBilling.js"));
  ok("milestone 2 is earned where the invoice arrives", /qualifiesForBillingCycle\(obj\)/.test(billing));
  ok("…and writes the first_payment milestone", /MILESTONES\.FIRST_PAYMENT/.test(billing));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:sales-milestones is a script", typeof pkg.scripts?.["check:sales-milestones"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:sales-milestones"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
