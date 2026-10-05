// scripts/import-truefinish-quotes.mjs
//
//   node --env-file=.env --import ./scripts/alias-loader.mjs scripts/import-truefinish-quotes.mjs \
//     --source-env ../truefinish-cabinets/.env --company <fieldquo company id> [--only Q2026-0134,…] [--apply]
//
// The owner, 2026-10-05: bring over the rest of TrueFinish's quotes — the
// ones that were sent and never answered, and the ones that were declined —
// "to help with the stats of the company: how many leads turn into a quote,
// how many turn into an invoice". The accepted ones came over on 2026-10-03/04
// (scripts/import-truefinish-history.mjs). What each remaining quote becomes,
// and who it is filed under, is decided in scripts/truefinish/remainingQuotes.mjs
// (pure; executed by scripts/check-truefinish-quote-import.mjs).
//
// ── Safety ─────────────────────────────────────────────────────────────────
//
//   * Dry by default. A dry run reads both databases inside
//     BEGIN TRANSACTION READ ONLY … ROLLBACK, and removes DATABASE_URL from
//     the environment before loading any product code, so the Prisma client
//     the product modules construct has nowhere to connect to: a dry run
//     CANNOT write, not merely does not.
//   * --apply additionally requires --company <id>; the script prints the
//     company's name before writing.
//   * The TrueFinish database is only ever read. Its URL is read from the
//     file given to --source-env and never printed.
//   * Idempotent. Every quote carries "[truefinish:quote:<id>]" and "Old
//     system: <number>" on its internal note; the plan skips a quote whose
//     marker OR number is on file, and createRecordedQuote re-checks the
//     marker inside its transaction, under the per-company lock every past-job
//     write takes. A second run creates nothing.
//   * Creates only: a Quote (status sent or declined, historicalImportedAt
//     stamped), its scope group, a Client when there is no match, and — only
//     where the lead has none — LeadRequest.quoteId. Never a job, an invoice,
//     a payment, a task or a message. Nothing existing is updated except that
//     one empty lead column.
//   * Sends nothing. Neither this script nor createRecordedQuote imports a
//     mailer, SMS, voice or task module, and every follow-up, callback, call
//     and chase path refuses historicalImportedAt rows by name — pinned by
//     scripts/check-truefinish-quote-import.mjs.

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name) => {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return null;
  const a = argv[i];
  return a.includes("=") ? a.slice(a.indexOf("=") + 1) : argv[i + 1] ?? null;
};

const APPLY = flag("apply");
const COMPANY_ID = opt("company");
const SOURCE_ENV = opt("source-env");
const ONLY = (opt("only") || "").split(",").map((s) => s.trim()).filter(Boolean);
const TODAY = new Date();

function die(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!COMPANY_ID) die("--company <FieldQuo company id> is required — the exact company to compare against (and, with --apply, to write into).");
if (!SOURCE_ENV) die("--source-env <path to the TrueFinish .env> is required.");

const TARGET_URL = process.env.DATABASE_URL || null;
if (!TARGET_URL) die("DATABASE_URL (FieldQuo) is not set — run with node --env-file=.env.");

// A dry run must not be ABLE to write — see the header.
if (!APPLY) delete process.env.DATABASE_URL;

const { urlFromEnvFile, readOnly, tfDay, money } = await import("./truefinish/source.mjs");
const { planRemainingQuotes, summarise } = await import("./truefinish/remainingQuotes.mjs");

const SOURCE_URL = urlFromEnvFile(SOURCE_ENV, die);
if (SOURCE_URL === TARGET_URL) die("The TrueFinish and FieldQuo connection strings are the same database. Refusing.");

// ── TrueFinish, as stored ──────────────────────────────────────────────────
async function readTrueFinish() {
  return readOnly(SOURCE_URL, async (q) => {
    const quotes = await q(
      `select id, "quoteNumber", status::text as status, "clientId", "lineItems", subtotal::text, discount::text, tax::text,
              total::text, "taxEnabled", notes, language, "quoteType", "createdAt", "sentAt"
         from "Quote" order by "createdAt", "quoteNumber"`,
    );
    const clients = await q(
      `select id, name, email, phone, address, city, province from "Client" where id = any($1)`,
      [[...new Set(quotes.map((r) => r.clientId))]],
    );
    return { quotes, clients };
  });
}

// ── FieldQuo, the target company ──────────────────────────────────────────
// The same rows in both modes: read-only SQL on a dry run, Prisma on --apply
// (which re-reads at write time, so the numbers it prints are the ones it
// writes).
const TARGET_SQL = {
  company: `select id, name from "Company" where id = $1`,
  clients: `select id, "companyId", name, email, phone, address, city, province, country, language, "createdAt" from "Client" where "companyId" = $1`,
  leads: `select id, "companyId", name, email, phone, status::text as status, "quoteId", "createdAt" from "LeadRequest" where "companyId" = $1`,
  quoteNumbers: `select "quoteNumber" from "Quote" where "companyId" = $1`,
  jobNotes: `select "costReviewNote" as note from "Job" where "companyId" = $1 and "costReviewNote" ilike '%truefinish%'`,
  quoteNotes: `select "reviewNotes" as note from "Quote" where "companyId" = $1 and ("reviewNotes" ilike '%truefinish%' or "reviewNotes" like '%Old system: %')`,
  categories: `select id, key, label from "ServiceCategory" where "isSystem" or "companyId" = $1`,
};
function shapeTarget(raw) {
  return {
    companyId: COMPANY_ID,
    company: raw.company[0] || null,
    clients: raw.clients,
    leads: raw.leads,
    quoteNumbers: raw.quoteNumbers.map((r) => r.quoteNumber),
    jobNotes: raw.jobNotes.map((r) => r.note),
    quoteNotes: raw.quoteNotes.map((r) => r.note),
    categories: raw.categories,
  };
}
async function readFieldQuoReadOnly() {
  return readOnly(TARGET_URL, async (q) => {
    const out = {};
    for (const [k, sql] of Object.entries(TARGET_SQL)) out[k] = await q(sql, [COMPANY_ID]);
    return shapeTarget(out);
  });
}
async function readFieldQuoPrisma(db) {
  const where = { companyId: COMPANY_ID };
  const [company, clients, leads, quoteNumbers, jobNotes, quoteNotes, categories] = await Promise.all([
    db.company.findMany({ where: { id: COMPANY_ID }, select: { id: true, name: true } }),
    db.client.findMany({ where, select: { id: true, companyId: true, name: true, email: true, phone: true, address: true, city: true, province: true, country: true, language: true, createdAt: true } }),
    db.leadRequest.findMany({ where, select: { id: true, companyId: true, name: true, email: true, phone: true, status: true, quoteId: true, createdAt: true } }),
    db.quote.findMany({ where, select: { quoteNumber: true } }),
    db.job.findMany({ where: { ...where, costReviewNote: { contains: "truefinish", mode: "insensitive" } }, select: { costReviewNote: true } }),
    db.quote.findMany({
      where: { ...where, OR: [{ reviewNotes: { contains: "truefinish", mode: "insensitive" } }, { reviewNotes: { contains: "Old system: " } }] },
      select: { reviewNotes: true },
    }),
    db.serviceCategory.findMany({ where: { OR: [{ isSystem: true }, { companyId: COMPANY_ID }] }, select: { id: true, key: true, label: true } }),
  ]);
  return shapeTarget({
    company,
    clients,
    leads,
    quoteNumbers,
    jobNotes: jobNotes.map((r) => ({ note: r.costReviewNote })),
    quoteNotes: quoteNotes.map((r) => ({ note: r.reviewNotes })),
    categories,
  });
}

// ── Printing ───────────────────────────────────────────────────────────────
const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);

function printPlan(items, fq) {
  console.log(`\nFieldQuo company: ${fq.company?.name ?? "(not found)"} (${COMPANY_ID})`);
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN — nothing is written"}\n`);
  console.log(`${pad("TrueFinish", 11)} ${pad("status", 9)} ${pad("total", 12)} ${pad("client", 26)} ${pad("→ FieldQuo", 15)} ${pad("client match", 34)} lead`);
  for (const it of items) {
    if (it.decision !== "create") continue;
    const c = it.client;
    const who = c.kind === "existing" ? `existing by ${c.by}${c.batch ? " (again)" : ""}` : c.batch ? "new (created above)" : "new";
    const lead = it.lead ? `${String(it.lead.name).trim()} (${it.lead.by}; stays ${it.lead.status})` : "—";
    console.log(
      `${pad(it.quote.quoteNumber, 11)} ${pad(it.kind, 9)} ${pad(money(it.recorded.quote.total), 12)} ${pad(it.tfClient.name, 26)} ${pad(it.quoteNumber, 15)} ${pad(who, 34)} ${lead}`,
    );
    for (const n of it.notes) console.log(`${" ".repeat(12)}· ${n}`);
  }
  const errored = items.filter((i) => i.decision === "error");
  if (errored.length) console.log("\n── Refused (nothing written for these) ──");
  for (const it of errored) console.log(`${pad(it.quote.quoteNumber, 11)} ${pad(it.quote.status, 9)} ${pad(it.tfClient?.name, 26)} ✗ ${it.problems.join("; ")}`);
  const skipped = items.filter((i) => i.decision === "skip");
  if (skipped.length) console.log("\n── Skipped ──");
  const reasons = new Map();
  for (const it of skipped) reasons.set(it.reason, [...(reasons.get(it.reason) || []), it.quote.quoteNumber]);
  for (const [reason, nums] of reasons) console.log(`  ${nums.length} × ${reason}${nums.length <= 25 ? `: ${nums.join(", ")}` : ""}`);

  const s = summarise(items);
  const create = items.filter((i) => i.decision === "create");
  const dates = create.map((i) => tfDay(i.quote.createdAt)).sort();
  console.log(`\nWould create, through createRecordedQuote (one transaction per quote):`);
  console.log(`  ${s.create} historical quotes: ${s.sent} sent (${money(s.sentTotal)}), ${s.declined} declined (${money(s.declinedTotal)})${dates.length ? `, written ${dates[0]} → ${dates[dates.length - 1]}` : ""}`);
  console.log(`  numbers ${create[0]?.quoteNumber ?? "—"} → ${create[create.length - 1]?.quoteNumber ?? "—"}`);
  console.log(`  clients: ${s.newClients} new, ${s.existingClientQuotes} quotes on an existing client`);
  console.log(`  leads linked (LeadRequest.quoteId, status unchanged): ${s.leadsLinked}`);
  console.log(`  no jobs, no invoices, no payments, no tasks, no messages`);
  console.log(`Skipped: ${s.skipped}, refused: ${s.refused}`);
  return { create, errored };
}

// ── Run ────────────────────────────────────────────────────────────────────
const tf = await readTrueFinish();

if (!APPLY) {
  const fq = await readFieldQuoReadOnly();
  if (!fq.company) die(`No FieldQuo company ${COMPANY_ID}.`);
  const items = planRemainingQuotes(tf, fq, { today: TODAY, only: ONLY });
  const { errored } = printPlan(items, fq);
  console.log(`\nDry run: nothing was written. Re-run with --apply --company ${COMPANY_ID} to write${errored.length ? " (refused rows will be skipped)" : ""}.`);
  process.exit(0);
}

// APPLY.
const { db } = await import("@/lib/db");
const { createRecordedQuote, loadPastJobContext } = await import("@/lib/jobs/importPastJob");
const { recordActivity } = await import("@/lib/activity/log");

const fq = await readFieldQuoPrisma(db);
if (!fq.company) die(`No FieldQuo company ${COMPANY_ID}.`);
const items = planRemainingQuotes(tf, fq, { today: TODAY, only: ONLY });
const { create } = printPlan(items, fq);
if (!create.length) {
  console.log("\nNothing to write.");
  await db.$disconnect();
  process.exit(0);
}
console.log(`\nWriting ${create.length} quotes into "${fq.company.name}" (${COMPANY_ID}) …`);

const context = await loadPastJobContext(db, COMPANY_ID);
const now = new Date();
const createdClients = new Map(); // TrueFinish client id → FieldQuo client id
const results = [];
// In plan order, so the numbers allocated are the numbers printed above.
for (const it of create) {
  const clientId = createdClients.get(it.tfClient.id) || (it.client.kind === "existing" ? it.client.clientId : null);
  const category = it.category ? context.categories.find((c) => c.id === it.category.id) || null : null;
  let outcome;
  try {
    outcome = await createRecordedQuote(db, {
      companyId: COMPANY_ID,
      createdByUserId: null,
      row: { ...it.row, clientId },
      category,
      context,
      now,
      recorded: it.recorded,
    });
  } catch (err) {
    outcome = { status: "error", error: err?.message || "write_failed" };
  }
  if (outcome.status === "created") createdClients.set(it.tfClient.id, outcome.clientId);
  results.push({ it, outcome });
  const what =
    outcome.status === "created"
      ? ` → ${outcome.quoteNumber} (${outcome.quoteStatus})${outcome.clientCreated ? " + new client" : ""}${it.recorded.leadId ? (outcome.leadLinked ? " + lead linked" : " (lead had a quote by now — not linked)") : ""}`
      : ` ${outcome.reason || outcome.error || ""}${outcome.problems ? ` ${JSON.stringify(outcome.problems)}` : ""}`;
  console.log(`  ${it.quote.quoteNumber}: ${outcome.status}${what}`);
}

const created = results.filter((r) => r.outcome.status === "created");
if (created.length) {
  // One office-trail line for the batch — attributed to the migration, not
  // to a person who did not do it.
  await recordActivity(
    { companyId: COMPANY_ID, userId: null, id: null, role: null },
    {
      action: "quote.past_imported",
      entityType: "quote",
      entityId: created.length === 1 ? created[0].outcome.quoteId : null,
      actorName: "TrueFinish migration",
      summary: `Entered from TrueFinish: ${created.filter((r) => r.outcome.quoteStatus === "sent").length} sent and ${created.filter((r) => r.outcome.quoteStatus === "declined").length} declined quotes (no messages sent)`,
      metadata: {
        source: "truefinish",
        created: created.length,
        skipped: results.filter((r) => r.outcome.status === "skipped").length,
        failed: results.filter((r) => r.outcome.status === "error").length,
        clientsCreated: created.filter((r) => r.outcome.clientCreated).length,
        leadsLinked: created.filter((r) => r.outcome.leadLinked).length,
        quoteIds: created.map((r) => r.outcome.quoteId),
      },
    },
  );
}
console.log(
  `\nDone: ${created.length} created, ${results.filter((r) => r.outcome.status === "skipped").length} skipped, ${results.filter((r) => r.outcome.status === "error").length} failed.`,
);
await db.$disconnect();
process.exit(results.some((r) => r.outcome.status === "error") ? 1 : 0);
