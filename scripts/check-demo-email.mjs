#!/usr/bin/env node
//
// scripts/check-demo-email.mjs
//
// A sales demo must never put mail in a real inbox, and must never contribute
// a price to what real customers are told the market charges.
//
// ══ Why this is a build check and not a code review note ═══════════════════
//
// Both hazards were invisible in a diff, for the same reason: the code was
// correct for the caller the author had in mind. What kept a demo's mail off
// the internet was that lib/demo/seedDemo.js gives its fictional clients
// @example.com addresses — DATA, not a guard. The first sales rep who types a
// live prospect's real address into a demo quote to make a walkthrough feel
// real sends that homeowner a genuine, white-labelled quote from a company
// that does not exist. Nothing in the send path ever asked.
//
// The benchmark half is the same shape pointing the other way: what kept a
// demo's invented rates out of the platform average was that
// shareAnonymizedPricing happened to be off — one checkbox, on an account that
// is deliberately re-configured between prospects. lib/pricing/benchmarkData.js
// did not even have that much: it read every priced row on the platform.
//
// ══ What the two halves assert, and why the shapes differ ══════════════════
//
// ONE SEAM (section 1). The demo interception only works if there is a single
// place mail leaves. There wasn't: thirteen files each built their own
// `new Resend(...)` and called `resend.emails.send()`. A guard in one of
// fourteen send paths protects nothing, so the structural rule — nobody but
// lib/email/resend.js constructs a Resend client — is the load-bearing one
// here. It is checked across the whole tree rather than at named call sites,
// because the failure it catches is a NEW file, which by definition is not on
// any list.
//
// ORDER (section 2). Inside that seam, the demo branch must come before the
// vendor call. A check that only asserts presence passes on a guard that runs
// after the message is away.
//
// COVERAGE (section 3). Every tenant-scoped send must pass `companyId`, since
// that is what makes the guard fire at all. A send path that forgets it is
// silently a real send — the exact failure mode this whole file exists for,
// arriving through a route somebody added later.
//
// EXCLUSION (section 4). The cross-tenant aggregates, by query.
//
// ══ Why every rule is scoped to ONE function ═══════════════════════════════
//
// scripts/check-demo-spend.mjs learned this the hard way and its header says
// so: a whole-file search passed while purchaseCrewLine's guard had been
// deleted outright, because a different function's identical guard string
// satisfied the match a few hundred lines earlier. Every ordered rule below
// names its function and searches only the text between that signature and the
// next top-level export.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

// Comments in this repo explain WHY at length, and several of them quote the
// very strings these rules search for — this file's own header quotes
// `resend.emails.send()` three times. A regex that reads justification prose
// passes on broken code, which two earlier check scripts in this repo did. So
// source is stripped before anything is matched against it.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const read = (f) => stripComments(readFileSync(f, "utf8"));

/**
 * The source of ONE function: from its signature to the start of the next
 * top-level declaration, or end of file. Crude on purpose — same tactic as
 * check-demo-spend.mjs, and every file it reads is one this repo controls.
 *
 * Widened from that file's version to match unexported functions too. Three of
 * the send paths below (`emailInvoice`, `emailChannel`, …) are module-private
 * helpers, and scoping their rule to the exported function that eventually
 * calls them would put a few hundred unrelated lines inside the search — which
 * is precisely the false pass check-demo-spend.mjs's header describes.
 *
 * The boundary is a declaration at column 0. Anything inside a function body is
 * indented, so this cannot cut early, and it stops the search well before the
 * next helper's own guard can satisfy it.
 *
 * `null` when the function is not there, which every caller treats as a
 * failure rather than a skip: a renamed function means the rule has stopped
 * proving anything, and silently passing would make this file read as evidence
 * while checking nothing.
 */
function functionSource(src, name) {
  const sig = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\b`, "m");
  const m = sig.exec(src);
  if (m === null) return null;
  const start = m.index;
  const after = start + m[0].length;
  const boundary = /\n(?:export\s|async\s+function\s|function\s|const\s|class\s)/g;
  boundary.lastIndex = after;
  const next = boundary.exec(src);
  return src.slice(start, next ? next.index : src.length);
}

/** Every .js/.mjs under a directory, ignoring build output. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(entry)) out.push(p);
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
section("1. One seam — lib/email/resend.js is the only Resend client");

// The construction itself, not the import: `import { Resend }` is harmless,
// `new Resend(...)` is the thing that creates a second way out of the building.
const CONSTRUCT = /new\s+Resend\s*\(/;
const SEAM = "lib/email/resend.js";
// lazyClient's own documentation uses `new Resend(...)` as its worked example.
// Named explicitly rather than matched loosely, so the allowance cannot widen.
const DOC_ONLY = new Set(["lib/lazyClient.js"]);

const offenders = [];
for (const file of [...walk("app"), ...walk("lib")]) {
  const rel = file.replace(/^\.\//, "");
  if (rel === SEAM || DOC_ONLY.has(rel)) continue;
  if (CONSTRUCT.test(read(file))) offenders.push(rel);
}
ok(
  offenders.length === 0,
  "no file outside lib/email/resend.js constructs a Resend client",
  offenders.length ? offenders : undefined,
);

// And the seam still exists. Without this, deleting the client from resend.js
// would make the rule above vacuously true.
ok(CONSTRUCT.test(read(SEAM)), "lib/email/resend.js does construct the one client");

// ════════════════════════════════════════════════════════════════════════════
section("2. Order — the demo branch runs before the vendor call");

{
  const src = read(SEAM);
  const body = functionSource(src, "sendEmail");
  if (body === null) {
    ok(false, "lib/email/resend.js exports sendEmail — renamed? this rule proves nothing now");
  } else {
    const guard = body.indexOf("isDemoCompany(companyId)");
    const substitute = body.indexOf("recordSimulatedSend(");
    const vendor = body.indexOf("resend.emails.send(");
    const noKey = body.indexOf("if (!resend)");

    ok(guard !== -1, "sendEmail asks isDemoCompany(companyId)");
    ok(substitute !== -1, "sendEmail substitutes recordSimulatedSend() for a demo");
    ok(
      vendor !== -1,
      "sendEmail still reaches resend.emails.send() — otherwise this ordering proves nothing",
    );
    ok(
      guard !== -1 && vendor !== -1 && guard < vendor,
      "the demo check runs BEFORE resend.emails.send(). A guard after the send is not a guard",
    );
    ok(
      substitute !== -1 && vendor !== -1 && substitute < vendor,
      "the substitute is returned before the vendor call can be reached",
    );
    // A demo has to walk the whole flow. If the missing-key branch came first,
    // a deployment without RESEND_API_KEY would answer { skipped }, which the
    // send routes turn into a 503 that leaves the quote a draft — and the demo
    // would demonstrate a broken product rather than a working one.
    ok(
      guard !== -1 && noKey !== -1 && guard < noKey,
      "the demo check runs before the missing-API-key branch, so a demo completes the flow",
    );
    // The verdict is re-derived from the row, never accepted from the caller.
    // `isDemo` arriving as a parameter is how a real tenant would end up on the
    // simulated path — the same class of bug as skipping a real charge, which
    // lib/demo/simulatedSpend.js's header spells out.
    ok(
      !/\bisDemo\s*[,}]/.test(body) && !/\bisDemo\s*=/.test(body),
      "sendEmail takes no isDemo flag — the verdict is re-read from the row, not passed in",
    );
  }
}

{
  // The substitute itself must not be able to reach a vendor, and must record
  // what would have gone out. The ActivityLog row IS the "show the rep what
  // they would have sent" surface — app/app/activity reads /api/activity,
  // which renders `summary` for any dotted verb.
  const src = read("lib/email/demoMail.js");
  const body = functionSource(src, "recordSimulatedSend");
  if (body === null) {
    ok(false, "lib/email/demoMail.js exports recordSimulatedSend — renamed?");
  } else {
    ok(!CONSTRUCT.test(body), "recordSimulatedSend never constructs a Resend client");
    ok(
      !/emails\.send\(|sendEmail\(/.test(body),
      "recordSimulatedSend never calls a send function — it is the end of the road",
    );
    ok(
      body.includes("db.activityLog.create("),
      "recordSimulatedSend records the letter, so a rep can be shown what would have gone out",
    );
    ok(
      body.includes("simulated: true"),
      "recordSimulatedSend returns simulated:true, which the send routes hand to the browser",
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
section("3. Coverage — every tenant send names its company");

// The guard fires on `companyId`. A send path that omits it is a real send,
// however correct the seam is. Each rule is one FUNCTION in one file, for the
// false-pass reason in the header: several of these files send more than once,
// and a companyId in a neighbouring function would satisfy a whole-file match
// while the client-facing send had none.
const COVERAGE = [
  {
    file: "app/api/quotes/[id]/send/route.js",
    fn: "POST",
    what: "the quote send — the path a rep uses in a walkthrough",
    needle: "companyId: member.companyId",
  },
  {
    file: "app/api/invoices/[id]/send/route.js",
    fn: "POST",
    what: "the invoice send",
    needle: "companyId: member.companyId",
  },
  {
    file: "app/api/invoices/[id]/request-payment/route.js",
    fn: "POST",
    what: "chasing payment — a real link to pay a fictional company",
    needle: "companyId: member.companyId",
  },
  {
    file: "app/api/marketing/campaigns/[id]/send/route.js",
    fn: "sendCampaignEmails",
    what: "a marketing campaign — one press reaches every subscriber at once",
    needle: "companyId: campaign.companyId",
  },
  {
    file: "app/api/service-plans/[id]/authorise/route.js",
    fn: "POST",
    what: "the payment-mandate request",
    needle: "companyId: member.companyId",
  },
  {
    file: "app/api/settings/document-templates/[id]/test/route.js",
    fn: "POST",
    what: "the template test send — a free-text address straight off a form",
    needle: "companyId: member.companyId",
  },
  {
    file: "app/api/settings/referral/invite/route.js",
    fn: "POST",
    what: "the referral invite — a stranger the contractor named",
    needle: "companyId: company.id",
  },
  {
    file: "app/api/self-quote/route.js",
    fn: "POST",
    what: "the public self-quote confirmation",
    needle: "companyId: company.id",
  },
  {
    file: "app/api/instant-quote/[companySlug]/request/route.js",
    fn: "POST",
    what: "the instant-quote confirmation",
    needle: "companyId: company.id",
  },
  {
    file: "app/api/cron/follow-ups/route.js",
    fn: "GET",
    what: "the follow-up cron — unattended, so nobody is watching when it leaks",
    needle: "companyId: entity.companyId",
  },
  {
    file: "app/api/cron/review-requests/route.js",
    fn: "GET",
    what: "the review-request cron",
    needle: "companyId: company.id",
  },
  {
    file: "lib/servicePlans/run.js",
    fn: "emailInvoice",
    what: "the recurring service-plan invoice",
    needle: "companyId: plan.companyId",
  },
  {
    file: "lib/paymentSchedule/run.js",
    fn: "requestStagePayment",
    what: "the payment-schedule stage request",
    needle: "companyId: stage.companyId",
  },
  {
    file: "lib/email/teamInvite.js",
    fn: "deliver",
    what: "the team invitation — mail to somebody not yet in the product",
    needle: "companyId,",
  },
];

for (const rule of COVERAGE) {
  let src;
  try {
    src = read(rule.file);
  } catch {
    ok(false, `${rule.file} — cannot be read. ${rule.what}`);
    continue;
  }
  const body = functionSource(src, rule.fn);
  if (body === null) {
    ok(false, `${rule.file} — no exported \`${rule.fn}\`. Renamed? This rule proves nothing now`);
    continue;
  }
  const send = body.search(/\bsendEmail\s*\(|\bmailer\s*\(/);
  if (send === -1) {
    // The send moved or was renamed. Failing rather than passing: the point of
    // the rule is that it survives a refactor, and a rule that quietly stops
    // looking at anything is worse than none.
    ok(false, `${rule.file} ${rule.fn}() — no sendEmail call here any more. Re-point this rule`);
    continue;
  }
  // AFTER the call opens, not merely somewhere in the function. `deliver()` in
  // teamInvite.js takes `companyId` as a parameter and then passes it on; a
  // plain presence test would go on passing if the second half were deleted,
  // which is the whole failure this file's header describes in a different
  // costume.
  const c = body.indexOf(rule.needle, send);
  ok(c !== -1, `${rule.file} ${rule.fn}() passes ${rule.needle} into its send — ${rule.what}`);
}

// The other half of the invitation path: the exported entry point has to hand
// `deliver` a company at all. Asserted separately because sendTeamInviteEmail
// contains no send of its own, so the loop above cannot see it.
{
  const body = functionSource(read("lib/email/teamInvite.js"), "sendTeamInviteEmail");
  ok(
    body !== null && body.includes("companyId: organizationId"),
    "lib/email/teamInvite.js sendTeamInviteEmail() hands the organisation to deliver()",
  );
}

// The two functions whose whole job is to be substitutable in tests. Their
// injection seam has to be sendEmail, not a Resend client: a fake client is a
// fake for a path nothing takes any more, so the test would pass while the
// real code went somewhere else entirely.
for (const [file, fn, needle] of [
  ["lib/notifications/invoicePaymentNotice.js", "notifyInvoicePayment", "deps.sendEmail || sendEmail"],
  ["lib/photoComments/notify.js", "emailChannel", "deps.sendEmail || sendEmail"],
]) {
  const src = read(file);
  const body = functionSource(src, fn);
  if (body === null) {
    ok(false, `${file} — no exported \`${fn}\`. Renamed?`);
    continue;
  }
  ok(body.includes(needle), `${file} ${fn}() carries the tenant into its send (${needle})`);
}

// The UI half. A demo's send writes every field a real one writes, on purpose
// — so the ONLY thing that stops the green banner claiming the homeowner got
// an email is this flag reaching the browser and being rendered.
for (const [file, fn] of [
  ["app/api/quotes/[id]/send/route.js", "POST"],
  ["app/api/invoices/[id]/send/route.js", "POST"],
]) {
  const body = functionSource(read(file), fn);
  ok(
    body !== null && body.includes("simulated: result?.simulated === true"),
    `${file} tells the browser whether the letter actually left`,
  );
}
for (const page of ["app/app/quotes/[id]/page.js", "app/app/invoices/[id]/page.js"]) {
  const src = read(page);
  ok(
    src.includes("data.simulated === true") && src.includes('t("app.demo.notEmailed")'),
    `${page} says so on screen instead of showing a bare "Sent to …"`,
  );
}

// ════════════════════════════════════════════════════════════════════════════
section("4. Benchmarks — a fixture is not a contractor");

// Both of these are cross-tenant: one company's prices shown to another. That
// is what makes a demo's invented rates a correctness problem rather than
// noise on an internal dashboard — and why the platform console's own
// aggregates, which cross tenants but are only ever read by FieldQuo, are not
// on this list.
{
  const src = read("lib/analytics/pricingBenchmark.js");
  const body = functionSource(src, "getPricingBenchmark");
  if (body === null) {
    ok(false, "lib/analytics/pricingBenchmark.js exports getPricingBenchmark — renamed?");
  } else {
    // The platform-wide aggregate specifically. `yourGroups` next to it is
    // scoped by companyId and must NOT be touched — a demo still sees its own
    // average, it just doesn't join anyone else's.
    const platform = body.slice(body.indexOf("platformGroups"));
    ok(
      body.includes("shareAnonymizedPricing: true"),
      "the platform aggregate still filters on shareAnonymizedPricing — otherwise this rule is pointed at the wrong query",
    );
    ok(
      /isDemo:\s*false/.test(platform) || /\.\.\.NOT_DEMO/.test(platform),
      "the platform-wide average excludes demo companies",
    );
  }
}

{
  const src = read("lib/pricing/benchmarkData.js");
  const body = functionSource(src, "collectPricedRows");
  if (body === null) {
    ok(false, "lib/pricing/benchmarkData.js exports collectPricedRows — renamed?");
  } else {
    // Two queries, two exclusions. Asserted separately because they are
    // separate tables and losing one leaves half the platform's fixtures in
    // the pool while the file still reads as guarded.
    const products = body.slice(body.indexOf("db.product.findMany("), body.indexOf("db.companyServiceCategory.findMany("));
    const rateCards = body.slice(body.indexOf("db.companyServiceCategory.findMany("));
    ok(
      /company:\s*NOT_DEMO/.test(products) || /isDemo:\s*false/.test(products),
      "the Product price pool excludes demo companies",
    );
    ok(
      /company:\s*NOT_DEMO/.test(rateCards) || /isDemo:\s*false/.test(rateCards),
      "the rate-card price pool excludes demo companies",
    );
  }
}

// ════════════════════════════════════════════════════════════════════════════
console.log("");
if (fail) {
  console.error(`check:demo-email FAILED — ${fail} problem${fail === 1 ? "" : "s"}\n`);
  console.error(
    "A demo company must not put mail in a real inbox (lib/email/demoMail.js),\n" +
      "and its invented prices must not join a benchmark a paying customer reads.\n",
  );
  process.exit(1);
}
console.log("check:demo-email passed — one send seam, ordered guard, tenant coverage, benchmark exclusions.\n");
