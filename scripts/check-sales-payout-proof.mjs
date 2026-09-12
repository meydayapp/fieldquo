#!/usr/bin/env node
//
// scripts/check-sales-payout-proof.mjs
//
// Proof of payment on payout batches, the owed ledger, and the Pay/Settings
// split — executed, not read.
//
// The claims worth executing here are the ones a source grep cannot settle:
// that a batch cannot be marked paid with neither a file nor a reference;
// that a non-superadmin is refused by the WRITER, not only by a hidden
// button; that the receipt lands under FieldQuo's own Cloudinary folder and
// never a company's; that a rep's read is scoped to their own batches; that
// the rep is told; and that the owed table sums to the ledger after a
// reversal lands on a closed week — with the CSV saying the same numbers.
//
// Runs with alias-loader only: markBatchPaid takes its database, uploader
// and push as `deps`, so a tiny in-memory Prisma stand-in below is enough,
// and the real `@/lib/db` is imported but never touched.
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";
import { markBatchPaid, proofFolderFor, proofProblem, classifyProofFile, PROOF_FOLDER_ROOT, normaliseProofFields } from "../lib/sales/payoutProof.js";
import { owedSnapshot, periodTable, periodTableCsv, periodBounds } from "../lib/sales/payoutLedger.js";
import { repPayouts, repMoney, batchView, canViewPayouts } from "../lib/sales/payoutAdmin.js";
import { earningsView } from "../lib/sales/earnings.js";
import { weekBounds } from "../lib/sales/payouts.js";
import { SUPERADMIN_ONLY_PERMISSIONS } from "../lib/platform/permissions.js";

const ROOT = process.cwd();
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  const d = detail === "" ? "" : ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
  if (cond) { passed++; console.log("  ok   " + name); }
  else { failures.push(name + d); console.log("  FAIL " + name + d); }
}
const section = (t) => console.log(`\n${t}`);

// ── A tiny Prisma stand-in ─────────────────────────────────────────────────
//
// Enough of findUnique / findMany / update / create over plain arrays for
// the functions under test. `where` is matched on scalar equality (and
// `{ in: [...] }`), `select` is ignored (the whole row comes back, which is
// the permissive direction — a select that leaked would still be caught by
// the source assertions below), `orderBy` is ignored.
function fakePrisma(tables) {
  const writes = [];
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && !(v instanceof Date) && "in" in v) return v.in.includes(row[k]);
      return row[k] === v;
    });
  const model = (name) => ({
    findUnique: async ({ where }) => tables[name].find((r) => match(r, where)) || null,
    findFirst: async ({ where } = {}) => tables[name].find((r) => match(r, where || {})) || null,
    findMany: async ({ where } = {}) => tables[name].filter((r) => match(r, where || {})),
    update: async ({ where, data }) => {
      const row = tables[name].find((r) => match(r, where));
      if (!row) throw new Error(`${name}.update: no row`);
      Object.assign(row, data);
      writes.push({ model: name, action: "update", where, data });
      return { ...row };
    },
    create: async ({ data }) => {
      const row = { id: `${name}_${tables[name].length + 1}`, ...data };
      tables[name].push(row);
      writes.push({ model: name, action: "create", data });
      return row;
    },
  });
  return {
    writes,
    salesPayoutBatch: model("salesPayoutBatch"),
    salesCommissionEntry: model("salesCommissionEntry"),
    platformAuditLog: model("platformAuditLog"),
    salesRep: model("salesRep"),
  };
}

// ── The fixture: two reps, two closed weeks, a reversal after a close ──────
//
// Week W1 = 24–31 Aug 2026 (UTC Mondays). Rep A earned $20 + $40 in W1,
// closed into batch bA1 at $60. On 2 Sep a $40 reversal landed — dated INTO
// W1 (occurredAt inside the closed week, as reverseMilestone dates it to the
// event it reverses) and NOT in any batch. So bA1's rows still sum to $60 but
// the week's ledger is $20, and that is exactly the case the table has to be
// honest about. Rep B earned $65 in W1, closed into bB1, paid on 1 Sep. This
// week (W2, 31 Aug–7 Sep) rep A has $20 open.
const W1 = new Date("2026-08-24T00:00:00Z");
const W1end = new Date("2026-08-31T00:00:00Z");
const NOW = new Date("2026-09-03T15:00:00Z");
function fixture() {
  return fakePrisma({
    salesRep: [
      { id: "repa1234567", name: "Ana Rep", language: "fr" },
      { id: "repb1234567", name: "Ben Rep", language: "en" },
    ],
    salesCommissionEntry: [
      { id: "e1", salesRepId: "repa1234567", amountCents: 2000, occurredAt: new Date("2026-08-25T10:00:00Z"), payoutBatchId: "bA1000000001" },
      { id: "e2", salesRepId: "repa1234567", amountCents: 4000, occurredAt: new Date("2026-08-27T10:00:00Z"), payoutBatchId: "bA1000000001" },
      // The reversal: after the close, not batched, dated into the closed week.
      { id: "e3", salesRepId: "repa1234567", amountCents: -4000, occurredAt: new Date("2026-08-27T10:00:01Z"), payoutBatchId: null },
      { id: "e4", salesRepId: "repa1234567", amountCents: 2000, occurredAt: new Date("2026-09-02T10:00:00Z"), payoutBatchId: null },
      { id: "e5", salesRepId: "repb1234567", amountCents: 6500, occurredAt: new Date("2026-08-26T10:00:00Z"), payoutBatchId: "bB1000000001" },
    ],
    salesPayoutBatch: [
      { id: "bA1000000001", salesRepId: "repa1234567", periodStart: W1, periodEnd: W1end, status: "ready", totalCentsAtClose: 6000, paidAt: null, proofUrl: null, proofPublicId: null, proofFilename: null, paymentReference: null, paidVia: null, paymentNote: null },
      { id: "bB1000000001", salesRepId: "repb1234567", periodStart: W1, periodEnd: W1end, status: "paid", totalCentsAtClose: 6500, paidAt: new Date("2026-09-01T14:00:00Z"), proofUrl: "https://res.cloudinary.com/x/raw/upload/fieldquo/platform/payouts/bB1000000001/r.pdf", proofPublicId: "fieldquo/platform/payouts/bB1000000001/r", proofFilename: "wise.pdf", paymentReference: "WISE-777", paidVia: "Wise", paymentNote: null },
    ],
    platformAuditLog: [],
  });
}

const superadmin = { id: "adm1", role: "superadmin" };
const admin = { id: "adm2", role: "admin" };
const png = { buffer: Buffer.from("png"), type: "image/png", size: 3, name: "receipt.png" };

// ═══════════════════════════════════════════════════════════════════════════
section("1. Neither a file nor a reference: refused");
{
  ok("the rule is stated by proofProblem()", typeof proofProblem({}) === "string");
  ok("…and satisfied by a file alone", proofProblem({ hasFile: true }) === null);
  ok("…or a reference alone", proofProblem({ paymentReference: "X-1" }) === null);
  ok("…or a receipt already on the batch", proofProblem({ existing: { proofUrl: "https://x/y" } }) === null);
  ok("whitespace is not a reference", proofProblem({ paymentReference: normaliseProofFields({ paymentReference: "   " }).paymentReference }) !== null);

  const db = fixture();
  const uploads = [];
  const r = await markBatchPaid({ batchId: "bA1000000001", admin: superadmin, fields: {}, file: null, deps: { prisma: db, upload: async (b, o) => (uploads.push(o), {}), push: async () => {}, now: () => NOW } });
  ok("markBatchPaid refuses with neither", r.ok === false && r.status === 400, r);
  ok("…and the batch is untouched", (await db.salesPayoutBatch.findUnique({ where: { id: "bA1000000001" } })).status === "ready");
  ok("…nothing was written", db.writes.length === 0, db.writes);
  ok("…nothing was uploaded", uploads.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Not a superadmin: refused by the writer");
{
  const db = fixture();
  for (const who of [admin, { id: "s1", role: "support" }, { id: "x", role: "superadmin " }, null, { role: "superadmin" }]) {
    const r = await markBatchPaid({ batchId: "bA1000000001", admin: who, fields: { paymentReference: "REF-1" }, deps: { prisma: db, push: async () => {} } });
    ok(`${JSON.stringify(who)} is refused with 403`, r.ok === false && r.status === 403, r);
  }
  ok("…and nothing was written", db.writes.length === 0);
  ok("the route refuses below superadmin before reading the form", /admin\.role !== "superadmin"[\s\S]*formData\(\)/.test(decomment(read("app/api/platform/sales/payouts/[batchId]/paid/route.js"))));
  ok("SUPERADMIN_ONLY_PERMISSIONS still names the money class the writer follows", SUPERADMIN_ONLY_PERMISSIONS.includes("billing:manage"));
  ok("admins can VIEW payouts, support cannot", canViewPayouts("admin") && canViewPayouts("superadmin") && !canViewPayouts("support") && !canViewPayouts(undefined));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Marked paid with a receipt: the folder is FieldQuo's, never a company's");
{
  const db = fixture();
  const uploads = [];
  const pushes = [];
  const r = await markBatchPaid({
    batchId: "bA1000000001",
    admin: superadmin,
    fields: { paidVia: "  Wise ", paymentReference: "", paymentNote: "Sent minus fee" },
    file: png,
    deps: {
      prisma: db,
      upload: async (buffer, opts) => {
        uploads.push({ buffer, ...opts });
        return { secure_url: "https://res.cloudinary.com/x/image/upload/v1/" + opts.folder + "/abc.png", public_id: opts.folder + "/abc" };
      },
      push: (args) => { pushes.push(args); return Promise.resolve({ sent: 1 }); },
      appSentence: async (lang, key, params = {}) => `${lang}:${key}:${params.week || ""}:${params.amount || ""}`,
      now: () => NOW,
    },
  });
  ok("marked paid", r.ok === true && r.batch.status === "paid", r);
  ok("paidAt is the server's clock at the click", r.batch.paidAt instanceof Date && r.batch.paidAt.getTime() === NOW.getTime());
  ok("one upload happened", uploads.length === 1);
  ok("…into fieldquo/platform/payouts/<batchId>", uploads[0]?.folder === `${PROOF_FOLDER_ROOT}/bA1000000001`, uploads[0]?.folder);
  ok("…which starts with the platform root, not a company folder", String(uploads[0]?.folder).startsWith("fieldquo/platform/") && !/compan/i.test(uploads[0]?.folder));
  ok("…as an image resource", uploads[0]?.resourceType === "image");
  ok("the url and public id are on the batch", r.batch.proofUrl?.includes("/fieldquo/platform/payouts/bA1000000001/") && r.batch.proofPublicId === "fieldquo/platform/payouts/bA1000000001/abc");
  ok("the filename is the sanitised original", r.batch.proofFilename === "receipt.png");
  ok("paidVia is trimmed", r.batch.paidVia === "Wise");
  ok("an empty reference is not written as \"\"", r.batch.paymentReference === null);
  ok("the amount is re-summed from the batch's rows ($60), not the close", r.cents === 6000);
  const audit = db.writes.find((w) => w.model === "platformAuditLog");
  ok("an audit row names who, which batch and what", audit?.data.platformAdminId === "adm1" && audit?.data.action === "sales_payout_marked_paid" && audit?.data.details.batchId === "bA1000000001");

  // The folder rule against hostile ids.
  for (const bad of ["../companies/abc", "abc/def", "", null, "a b", "x".repeat(41)]) {
    let threw = false;
    try { proofFolderFor(bad); } catch { threw = true; }
    ok(`proofFolderFor refuses ${JSON.stringify(bad)}`, threw);
  }
  const hostile = await markBatchPaid({ batchId: "../companies/abc", admin: superadmin, fields: { paymentReference: "R" }, deps: { prisma: db } });
  ok("markBatchPaid refuses a path-shaped batch id", hostile.ok === false && hostile.status === 400);

  // ── The rep is told, in their language, with the week and the amount ──
  ok("one push went to the rep", pushes.length === 1 && JSON.stringify(pushes[0].salesRepIds) === JSON.stringify(["repa1234567"]));
  const payload = await pushes[0].payload("fr");
  ok("…resolved in the rep's language", payload.title.startsWith("fr:app.salesPay.paidPushTitle"));
  ok("…saying the week and the amount", /app\.salesPay\.paidPushBody:.+:\$60\.00$/.test(payload.body), payload.body);
  ok("…tagged per batch and pointing at Pay", payload.tag === "sales-payout-bA1000000001" && payload.url === "/sales/pay");
  ok("the nine catalogues carry the push sentence", (() => {
    const src = read("app/i18n/appMessages.js");
    return (src.match(/"app\.salesPay\.paidPushBody": /g) || []).length === 9 && (src.match(/"app\.salesPay\.paidPushTitle": /g) || []).length === 9;
  })());

  // ── Add proof later: update, never delete, and no second push ──────
  const pushesBefore = pushes.length;
  const r2 = await markBatchPaid({ batchId: "bA1000000001", admin: superadmin, fields: { paymentReference: "WISE-123", paidVia: "", paymentNote: "" }, deps: { prisma: db, push: (a) => { pushes.push(a); return Promise.resolve(); }, now: () => new Date("2026-09-05T00:00:00Z") } });
  ok("a paid batch takes more proof", r2.ok === true && r2.batch.paymentReference === "WISE-123");
  ok("…without moving paidAt", r2.batch.paidAt.getTime() === NOW.getTime());
  ok("…without blanking paidVia or the note", r2.batch.paidVia === "Wise" && r2.batch.paymentNote === "Sent minus fee");
  ok("…keeping the receipt", r2.batch.proofUrl?.includes("bA1000000001"));
  ok("…and the rep is not pushed twice", pushes.length === pushesBefore && r2.notified === false);
  const audit2 = db.writes.filter((w) => w.model === "platformAuditLog").pop();
  ok("…logged as proof added, not paid again", audit2?.data.action === "sales_payout_proof_added");
  ok("nothing in the writer deletes or nulls a proof column", !/proofUrl:\s*null|deleteAsset|\.delete\(/.test(decomment(read("lib/sales/payoutProof.js"))));

  // ── Only a closed batch ───────────────────────────────────────────
  await db.salesPayoutBatch.update({ where: { id: "bB1000000001" }, data: { status: "open" } });
  const r3 = await markBatchPaid({ batchId: "bB1000000001", admin: superadmin, fields: { paymentReference: "R" }, deps: { prisma: db } });
  ok("an open batch cannot be paid", r3.ok === false && r3.status === 409);
  const r4 = await markBatchPaid({ batchId: "nosuchbatch00", admin: superadmin, fields: { paymentReference: "R" }, deps: { prisma: db } });
  ok("a missing batch is 404", r4.ok === false && r4.status === 404);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. What counts as a receipt");
{
  ok("a PNG is a photo", classifyProofFile({ type: "image/png", size: 10 }).ok);
  ok("a PDF is a document, uploaded raw", classifyProofFile({ type: "application/pdf", size: 10 }).resourceType === "raw");
  ok("a video is refused", classifyProofFile({ type: "video/mp4", size: 10 }).ok === false);
  ok("an SVG is refused (not a logo)", classifyProofFile({ type: "image/svg+xml", size: 10 }).ok === false);
  ok("an empty file is refused", classifyProofFile({ type: "image/png", size: 0 }).ok === false);
  ok("a .docx is refused", classifyProofFile({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 10 }).ok === false);
  const db = fixture();
  const r = await markBatchPaid({ batchId: "bA1000000001", admin: superadmin, fields: {}, file: { buffer: Buffer.from("x"), type: "video/mp4", size: 1, name: "clip.mp4" }, deps: { prisma: db, upload: async () => { throw new Error("must not upload"); } } });
  ok("the writer refuses a video before uploading", r.ok === false && r.status === 400 && db.writes.length === 0);
  const pdf = [];
  const r2 = await markBatchPaid({ batchId: "bA1000000001", admin: superadmin, fields: {}, file: { buffer: Buffer.from("%PDF"), type: "application/pdf", size: 4, name: "../../x/wise receipt.pdf" }, deps: { prisma: db, upload: async (b, o) => (pdf.push(o), { secure_url: "https://r/x.pdf", public_id: o.folder + "/" + o.publicId }), push: async () => {} } });
  ok("a PDF goes up raw with a .pdf public id", r2.ok && pdf[0]?.resourceType === "raw" && /\.pdf$/.test(pdf[0]?.publicId), pdf[0]);
  ok("…and the filename shown to the rep has no path in it", r2.batch.proofFilename === "wise receipt.pdf");
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The rep reads their OWN batches' proof, and nobody else's");
{
  const db = fixture();
  // Platform side: scoped in the query.
  const a = await repPayouts({ salesRepId: "repa1234567", prisma: db });
  const b = await repPayouts({ salesRepId: "repb1234567", prisma: db });
  ok("rep A's read returns rep A's batch only", a.batches.length === 1 && a.batches[0].id === "bA1000000001");
  ok("rep B's read returns rep B's batch only", b.batches.length === 1 && b.batches[0].id === "bB1000000001");
  ok("…with the proof fields on it", b.batches[0].paidVia === "Wise" && b.batches[0].paymentReference === "WISE-777" && b.batches[0].proofUrl?.includes("bB1000000001") && b.batches[0].hasProof === true);
  ok("…and no proofPublicId (an internal handle) in the view", !("proofPublicId" in b.batches[0]));
  ok("rep A's view cannot see rep B's reference", JSON.stringify(a).includes("WISE-777") === false);
  ok("rep A's accruing figure is the reversal net of the open week (-$40 + $20)", a.accruingCents === -2000, a.accruingCents);
  ok("a missing id reads nothing rather than everything", (await repPayouts({ prisma: db })).batches.length === 0);

  // Rep side: the route scopes both queries on the session's rep id, and
  // the view carries the proof through by name.
  const route = decomment(read("app/api/sales/earnings/route.js"));
  const batchesQuery = route.slice(route.indexOf("db.salesPayoutBatch.findMany"), route.indexOf("orderBy: { periodStart"));
  ok("/api/sales/earnings selects batches where salesRepId is the SESSION's rep", /where: \{ salesRepId: rep\.id \}/.test(batchesQuery));
  ok("…and selects the proof fields by name", ["paidVia", "paymentReference", "paymentNote", "proofUrl", "proofFilename"].every((f) => new RegExp(`${f}: true`).test(batchesQuery)));
  ok("…but never proofPublicId", !/proofPublicId/.test(route));
  ok("…and the rep id never comes from the request", !/searchParams|body\.salesRepId|params\.salesRepId/.test(route));
  const view = earningsView({
    entries: [{ id: "e5", companyId: "c1", amountCents: 6500, occurredAt: "2026-08-26T10:00:00Z", payoutBatchId: "bB1000000001", milestone: "activation", status: "earned" }],
    batches: [await db.salesPayoutBatch.findUnique({ where: { id: "bB1000000001" } })],
  });
  ok("earningsView carries paidVia / reference / receipt on the week", view.weeks[0].paidVia === "Wise" && view.weeks[0].paymentReference === "WISE-777" && view.weeks[0].proofUrl?.includes("r.pdf") && view.weeks[0].proofFilename === "wise.pdf");
  const panel = decomment(read("app/components/sales/EarningsPanel.js"));
  ok("the Pay screen says paid-via and links the receipt in a new tab", /app\.salesPay\.weekPaidVia/.test(panel) && /href=\{w\.proofUrl\}[\s\S]*target="_blank"[\s\S]*rel="noopener noreferrer"/.test(panel));
  ok("…and shows the reference", /app\.salesPay\.paymentReference/.test(panel));
  ok("…with paidAt as an instant in the rep's own zone (toLocaleString)", /function when\(value\)[\s\S]*toLocaleString\(/.test(panel));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The owed ledger: sums equal the ledger, after a reversal on a closed week");
{
  const db = fixture();
  const reps = await db.salesRep.findMany();
  const entries = await db.salesCommissionEntry.findMany();
  const batches = await db.salesPayoutBatch.findMany();

  const snap = owedSnapshot({ entries, batches, period: "week", now: NOW });
  ok("owed today = rep A's ready batch, summed from its rows ($60)", snap.owedNowCents === 6000, snap);
  ok("…never from totalCentsAtClose (the source says so)", !/totalCentsAtClose/.test(decomment(read("lib/sales/payoutLedger.js")).replace(/periodTable|owedSnapshot/g, "")));
  ok("accruing = every unbatched row (-$40 reversal + $20 this week)", snap.accruingCents === -2000, snap.accruingCents);
  ok("paid this cycle = rep B's $65, paid 1 Sep inside the current week", snap.paidThisCycleCents === 6500);
  ok("one ready batch counted", snap.readyBatchCount === 1);
  const snapM = owedSnapshot({ entries, batches, period: "month", now: NOW });
  ok("by month the paid figure is the same $65 (1 Sep is in September)", snapM.paidThisCycleCents === 6500);

  const table = periodTable({ reps, entries, batches, period: "week", now: NOW });
  ok("two columns, one per rep", table.columns.map((c) => c.name).join(",") === "Ana Rep,Ben Rep");
  ok("the current week is the first row even though rep B has nothing in it", table.rows[0].key === weekBounds(NOW).start.toISOString());
  const w1 = table.rows.find((r) => r.key === W1.toISOString());
  const w2 = table.rows[0];
  const cell = (row, repId) => row.cells.find((c) => c.repId === repId);
  ok("W1 / rep A = $20: the batch's $60 minus the $40 reversal dated into the week", cell(w1, "repa1234567").cents === 2000, cell(w1, "repa1234567"));
  ok("…and it is OPEN, because the reversal row is not batched", cell(w1, "repa1234567").status === "open");
  ok("W1 / rep B = $65, paid, with the paid date", cell(w1, "repb1234567").cents === 6500 && cell(w1, "repb1234567").status === "paid" && cell(w1, "repb1234567").paidAt === "2026-09-01T14:00:00.000Z");
  ok("…linking to its one batch", cell(w1, "repb1234567").batchId === "bB1000000001");
  ok("W2 / rep A = $20 open", cell(w2, "repa1234567").cents === 2000 && cell(w2, "repa1234567").status === "open");
  ok("W2 / rep B is blank, not zero-as-a-statement", cell(w2, "repb1234567").status === null);
  ok("row totals sum the cells", w1.totalCents === 8500 && w2.totalCents === 2000);
  ok("column totals equal each rep's ledger", table.totals.byRep.find((t) => t.repId === "repa1234567").cents === 4000 && table.totals.byRep.find((t) => t.repId === "repb1234567").cents === 6500);
  const ledger = entries.reduce((s, e) => s + e.amountCents, 0);
  ok("the grand total equals the whole ledger", table.totals.cents === ledger && ledger === 10500);
  ok("every row's total equals the ledger rows in that period", table.rows.every((row) => {
    const { start, end } = periodBounds("week", row.key);
    const sum = entries.filter((e) => e.occurredAt >= start && e.occurredAt < end).reduce((s, e) => s + e.amountCents, 0);
    return sum === row.totalCents;
  }));

  const month = periodTable({ reps, entries, batches, period: "month", now: NOW });
  const aug = month.rows.find((r) => r.key === "2026-08-01T00:00:00.000Z");
  const sep = month.rows.find((r) => r.key === "2026-09-01T00:00:00.000Z");
  ok("by month: August rows sum the ledger's August entries", aug && aug.totalCents === 8500 && cell(aug, "repa1234567").cents === 2000 && cell(aug, "repb1234567").cents === 6500);
  ok("…September is rep A's $20, open", sep && cell(sep, "repa1234567").cents === 2000 && cell(sep, "repa1234567").status === "open");
  ok("…and the grand total is still the whole ledger", month.totals.cents === ledger);
  // A month with a paid week and a ready week is OWED, not paid.
  const mixed = periodTable({ reps: [{ id: "r", name: "R" }], batches: [{ id: "p", status: "paid", paidAt: "2026-09-01T00:00:00Z" }, { id: "q", status: "ready" }], entries: [
    { salesRepId: "r", amountCents: 100, occurredAt: "2026-08-04T00:00:00Z", payoutBatchId: "p" },
    { salesRepId: "r", amountCents: 100, occurredAt: "2026-08-11T00:00:00Z", payoutBatchId: "q" },
  ], period: "month", now: NOW });
  const mrow = mixed.rows.find((r) => r.key === "2026-08-01T00:00:00.000Z");
  ok("a month with one paid week and one ready week reads OWED, and links to the rep (two batches)", mrow.cells[0].status === "owed" && mrow.cells[0].batchId === null && mrow.cells[0].batchIds.length === 2);
  ok("hostile input yields an empty, well-formed table", periodTable({ reps: null, entries: "x", batches: 4, period: "nonsense" }).rows.length === 1);

  // ── The CSV says the same numbers ─────────────────────────────────
  const csv = periodTableCsv(table);
  const lines = csv.trimEnd().split("\r\n").map((l) => l.split(","));
  ok("one header, one line per row, one total line", lines.length === table.rows.length + 2);
  ok("the header names each rep and a status column", lines[0].join(",") === "Period,Ana Rep,Ana Rep status,Ben Rep,Ben Rep status,Total");
  ok("every data line matches its table row cell for cell", table.rows.every((row, i) => {
    const l = lines[i + 1];
    const money = (c) => (c < 0 ? "-" : "") + "$" + Math.abs(c / 100).toFixed(2);
    return l[0] === row.label && row.cells.every((c, j) => l[1 + j * 2] === money(c.cents) && l[2 + j * 2] === (c.status ? (c.status === "paid" ? `paid ${c.paidAt.slice(0, 10)}` : c.status) : "")) && l[l.length - 1] === money(row.totalCents);
  }));
  const last = lines[lines.length - 1];
  ok("the total line matches the table's totals", last[0] === "Total" && last[1] === "$40.00" && last[3] === "$65.00" && last[last.length - 1] === "$105.00", last);
  ok("a label with a comma is quoted", periodTableCsv({ columns: [{ id: "r", name: "Doe, Jane" }], rows: [], totals: { byRep: [{ repId: "r", cents: 0 }], cents: 0 } }).startsWith('Period,"Doe, Jane"'));
  ok("the csv route hands the same table through periodTableCsv", /payoutsOverview\(\{ period \}\)[\s\S]*periodTableCsv\(table\)/.test(decomment(read("app/api/platform/sales/payouts/csv/route.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The reps accordion, and the per-rep figures");
{
  const db = fixture();
  const entries = await db.salesCommissionEntry.findMany();
  const batches = await db.salesPayoutBatch.findMany();
  const a = repMoney(entries.filter((e) => e.salesRepId === "repa1234567"), batches);
  ok("rep A: this week -$20 (reversal + open), owed $60 (ready batch rows), paid $0", a.thisWeekCents === -2000 && a.owedCents === 6000 && a.paidCents === 0, a);
  const b = repMoney(entries.filter((e) => e.salesRepId === "repb1234567"), batches);
  ok("rep B: paid $65, nothing owed", b.paidCents === 6500 && b.owedCents === 0 && b.thisWeekCents === 0);
  ok("batchView re-sums and flags a moved batch", (() => {
    const v = batchView(batches[0], [...entries, { payoutBatchId: "bA1000000001", amountCents: -4000 }]);
    return v.cents === 2000 && v.closedCents === 6000 && v.movedSinceClose === true;
  })());

  const page = decomment(read("app/platform/sales/reps/page.js"));
  ok("the reps route hands each rep its money", /money: repMoney\(/.test(decomment(read("app/api/platform/sales/reps/route.js"))));
  ok("each rep is a toggle button with aria-expanded", /aria-expanded=\{open\}/.test(page) && /data-rep-toggle=\{rep\.id\}/.test(page));
  ok("…and the panel is rendered only when open", /\{open \? \(\s*<div id=\{`rep-panel-\$\{rep\.id\}`\}/.test(page));
  ok("the open rep is read from the URL hash", /window\.location\.hash/.test(page) && /\^#rep-/.test(page));
  ok("…written with replaceState, and cleared on collapse", /history\.replaceState\(null, "", url\)/.test(page) && /\$\{next \? `#rep-\$\{next\}` : ""\}/.test(page));
  ok("…and follows hashchange (a link from the payouts table)", /addEventListener\("hashchange"/.test(page));
  ok("the header row shows sells-in and the three figures", /Sells in\{" "\}/.test(page) && /money\.thisWeekCents/.test(page) && /money\.owedCents/.test(page) && /money\.paidCents/.test(page));
  ok("the Payments section is mounted inside the panel", /<RepPaymentsPanel[\s\S]*repId=\{rep\.id\}/.test(page));
  ok("…and the owed strip at the top", /<OwedStrip snapshot=\{owed\} \/>/.test(page));
  ok("every control the card had is still inside the panel", ["<QueuePanel", "<DeactivatePanel", "Resend invite", "Signup link", "Sells in"].every((s) => page.includes(s)));
  ok("the toggle has a 44px floor", /min-h-\[44px\] text-left flex items-start/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. One form, one route, both screens");
{
  const form = "app/components/platform/payouts/MarkPaidForm.js";
  const card = "app/components/platform/payouts/BatchCard.js";
  ok("the form exists once", existsSync(join(ROOT, form)));
  const formSrc = decomment(read(form));
  ok("…posts multipart to the one route", /new FormData\(\)/.test(formSrc) && /\/api\/platform\/sales\/payouts\/\$\{encodeURIComponent\(batch\.id\)\}\/paid/.test(formSrc) && /method: "POST"/.test(formSrc));
  ok("…applies the same file-or-reference rule before the click", /proofProblem\(\{/.test(formSrc) && /disabled=\{busy \|\| Boolean\(problem\)\}/.test(formSrc));
  ok("…from the browser-safe rules module, not the db-bound one", /from "@\/lib\/sales\/payoutProofRules"/.test(formSrc) && !/payoutProof"/.test(formSrc));
  ok("…accepts images and PDFs only", /accept="image\/\*,application\/pdf"/.test(formSrc));
  ok("…and reports every failure (no bare if res.ok)", /setError\(err\.message/.test(formSrc) && !/if\s*\(res\.ok\)/.test(formSrc));
  ok("BatchCard mounts the form", /<MarkPaidForm/.test(decomment(read(card))));
  const payoutsPage = decomment(read("app/platform/sales/payouts/page.js"));
  const repsPanel = decomment(read("app/components/platform/payouts/RepPaymentsPanel.js"));
  ok("the payouts screen and the rep panel both render BatchCard", /<BatchCard/.test(payoutsPage) && /<BatchCard/.test(repsPanel));
  ok("…and neither builds its own mark-paid request", !/\/paid/.test(payoutsPage) && !/\/paid/.test(repsPanel));
  const posters = execSync("grep -rl 'sales/payouts/${' app || true", { cwd: ROOT }).toString().trim().split("\n").filter(Boolean);
  ok("MarkPaidForm is the only client that posts to /paid", posters.length === 1 && posters[0] === form, posters);
  ok("the payouts page says no money moves from it", /no money moves from this screen/.test(payoutsPage));
  ok("the period switcher and the CSV link are on it", /<PeriodTable table=\{data\.table\} period=\{period\} onPeriod=\{setPeriod\}/.test(payoutsPage) && /data-csv-link/.test(decomment(read("app/components/platform/payouts/OwedView.js"))));
  ok("the platform rail links to it", /href: "\/platform\/sales\/payouts"/.test(decomment(read("app/components/platform/PlatformSidebar.js"))));
  const src = read("prisma/schema.prisma");
  ok("the six proof columns are on SalesPayoutBatch, all optional", ["proofUrl", "proofPublicId", "proofFilename", "paymentReference", "paymentNote", "paidVia"].every((f) => new RegExp(`\\n  ${f}\\s+String\\?`).test(src.slice(src.indexOf("model SalesPayoutBatch")))));
  ok("the audit wording exists for both actions", (() => {
    const a = read("lib/platform/auditActions.js");
    return /sales_payout_marked_paid:/.test(a) && /sales_payout_proof_added:/.test(a);
  })());
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Pay is money, Settings is the rest");
{
  const pay = decomment(read("app/sales/pay/page.js"));
  const settings = decomment(read("app/sales/settings/page.js"));
  ok("/sales/settings exists and carries language, sells-in, notifications and the profile", /<RepLanguageChoice/.test(settings) && /<RepSellsInChoice/.test(settings) && /<BrowserNotifications endpoint="\/api\/sales\/push-subscription"/.test(settings) && /data-rep-profile/.test(settings));
  ok("/sales/pay carries earnings and the destination and nothing of the above", /<EarningsPanel/.test(pay) && /<PayoutDestinationForm/.test(pay) && !/RepLanguageChoice|RepSellsInChoice|BrowserNotifications/.test(pay));
  const shell = decomment(read("app/sales/SalesShell.js"));
  ok("the shell has a Settings tab after Pay, with a gear", /"\/sales\/pay"[\s\S]*"\/sales\/settings", label: t\("app\.salesPortal\.navSettings"\)/.test(shell) && /"\/sales\/settings": Settings/.test(shell));
  ok("the tour has a Settings step targeting the page's own anchor", /key: "settings"[\s\S]*target: at\("sales-settings"\)/.test(read("app/sales/tourSteps.js")) && /data-tour="sales-settings"/.test(settings));
  ok("the push test opens Settings, where the switch lives", /testUrl: "\/sales\/settings"/.test(read("app/api/sales/push-subscription/route.js")));
  const msgs = read("app/i18n/appMessages.js");
  for (const key of ["app.salesPortal.navSettings", "app.salesSettings.title", "app.salesSettings.intro", "app.salesTour.settingsTitle", "app.salesTour.settingsBody", "app.salesPay.weekPaidVia", "app.salesPay.viewReceipt", "app.salesPay.paymentReference"]) {
    ok(`${key} is in all nine catalogues`, (msgs.match(new RegExp(`"${key.replace(/\./g, "\\.")}": `, "g")) || []).length === 9);
  }
  ok("the manual no longer sends a rep to Pay for the language pickers", ["docs/sales/manual/content.en.js", "docs/sales/manual/content.fr.js", "docs/sales/manual/content.es.js"].every((p) => /navSettings/.test(read(p))));
}

console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log("  · " + f);
process.exit(failures.length ? 1 : 0);
