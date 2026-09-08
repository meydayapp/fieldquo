// scripts/check-invoice-chase.mjs
//
//   npm run check:invoice-chase
//
// The chase trail: what happens after "Chase payment" is pressed, and what the
// two screens that show unpaid invoices say about it afterwards.
//
// ══ The bug this pins ══════════════════════════════════════════════════════
//
// POST /api/invoices/[id]/request-payment sent a real email and then wrote
// almost nothing down. sentAt is the ISSUE date and is stamped only when
// empty, so a second chase changed no column; the send route records an
// activity row and this one did not. Two chases a day apart were
// indistinguishable from none, on the dashboard, on the invoice page and in
// the activity log. Meanwhile the automated overdue reminder (FollowUpRule +
// cron) wrote its sends to FollowUpLog, which no screen read — so the
// contractor pressing the button could not know the client had been emailed
// by the rule yesterday.
//
// And the "Money owed" card was inert: nothing in a row was a link, the chase
// result rendered only in the NeedsToday card at the top of the page, and the
// sentence "No automatic overdue reminder is set up" named a problem with no
// door to where it is fixed.
//
// ══ What is executed rather than read ═════════════════════════════════════
//
//   1. buildReceivables, with a family whose chases are split across versions
//      and with hostile FollowUpLog rows — the family-wide rule is arithmetic,
//      and arithmetic is checked by running it.
//   2. The receivables GET handler, against a Prisma stub, so the payload the
//      card reads is the one asserted on and the FollowUpLog query is proven
//      tenant-scoped (a log from another company's rule must not surface).
//
// The rest are source pins, each naming the line that would go missing.
//
// Verified by mutation when written: removing the `rule: { companyId }` scope
// from the receivables route's FollowUpLog query fails section 2 ("another
// company's reminder log never surfaces"); the mutation was reverted.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-invoice-chase.mjs

import { readFileSync } from "node:fs";
import { buildReceivables } from "@/lib/analytics/receivables";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
const ok = (label, condition, detail) => {
  if (condition) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
  }
};

const read = (p) => readFileSync(p, "utf8");
const AS_OF = new Date("2026-09-08T12:00:00Z");
const at = (iso) => new Date(`${iso}T12:00:00Z`);
const COMPANY = "co_1";

const inv = (over = {}) => ({
  id: over.id,
  companyId: COMPANY,
  parentInvoiceId: null,
  version: 1,
  invoiceNumber: over.invoiceNumber || "INV-1",
  status: "sent",
  total: 0,
  dueDate: at("2026-08-01"),
  sentAt: at("2026-07-01"),
  createdAt: at("2026-07-01"),
  clientId: "cl_1",
  client: { id: "cl_1", name: "Tremblay", email: "t@example.com", phone: "555-0100", address: "12 Maple St", city: "Laval", province: "QC" },
  jobId: null,
  lastChasedAt: null,
  chaseCount: 0,
  ...over,
});

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. buildReceivables — the chase trail is the FAMILY's, executed\n");

// INV-200: v1 chased twice, linked to a job; v2 (the live figure) chased once,
// no job link of its own. The cron fired against v1.
const ROWS = [
  inv({ id: "a1", invoiceNumber: "INV-200", total: 800, jobId: "job_9", lastChasedAt: at("2026-08-10"), chaseCount: 2 }),
  inv({ id: "a2", invoiceNumber: "INV-200", total: 900, parentInvoiceId: "a1", version: 2, sentAt: null, createdAt: at("2026-08-12"), lastChasedAt: at("2026-08-20"), chaseCount: 1 }),
  // INV-201: never chased, no job, no reminder. Every trail field must be
  // absent — a zero or a date here would be a claim nobody made.
  inv({ id: "b", invoiceNumber: "INV-201", total: 300 }),
  // INV-202: hostile columns — a string date, a negative count, a NaN count.
  inv({ id: "c", invoiceNumber: "INV-202", total: 100, lastChasedAt: "2026-08-05T12:00:00Z", chaseCount: -4 }),
  inv({ id: "d", invoiceNumber: "INV-203", total: 100, lastChasedAt: "not a date", chaseCount: "many" }),
];
const LOGS = [
  { entityId: "a1", sentAt: at("2026-08-15") },
  { entityId: "a1", sentAt: at("2026-08-08") },
  // Rows that must be ignored rather than thrown on.
  { entityId: null, sentAt: at("2026-08-30") },
  { entityId: "b", sentAt: "garbage" },
  { entityId: "zzz", sentAt: at("2026-08-30") },
];

const built = buildReceivables({ invoices: ROWS, payments: [], followUpLogs: LOGS, asOf: AS_OF });
const byNo = Object.fromEntries(built.invoices.map((r) => [r.invoiceNumber, r]));

ok("the amended invoice is one card", built.invoices.filter((r) => r.invoiceNumber === "INV-200").length === 1);
ok("...chases are SUMMED across versions", byNo["INV-200"]?.chaseCount === 3, byNo["INV-200"]?.chaseCount);
ok(
  "...lastChasedAt is the NEWEST across versions",
  byNo["INV-200"]?.lastChasedAt?.toISOString() === at("2026-08-20").toISOString(),
  byNo["INV-200"]?.lastChasedAt,
);
ok(
  "...the job link survives the amendment (set on v1, not copied to v2)",
  byNo["INV-200"]?.jobId === "job_9",
  byNo["INV-200"]?.jobId,
);
ok(
  "...and the newest automated reminder logged against ANY version is reported",
  byNo["INV-200"]?.autoReminderAt?.toISOString() === at("2026-08-15").toISOString(),
  byNo["INV-200"]?.autoReminderAt,
);
ok("a never-chased invoice carries null, not a date", byNo["INV-201"]?.lastChasedAt === null);
ok("...zero chases", byNo["INV-201"]?.chaseCount === 0, byNo["INV-201"]?.chaseCount);
ok("...no job", byNo["INV-201"]?.jobId === null);
ok("...and no automated reminder (the unparseable log row is dropped)", byNo["INV-201"]?.autoReminderAt === null);
ok(
  "a string date column still parses",
  byNo["INV-202"]?.lastChasedAt instanceof Date && !Number.isNaN(byNo["INV-202"].lastChasedAt.getTime()),
);
ok("a negative chaseCount is clamped to zero, never shown as −4", byNo["INV-202"]?.chaseCount === 0, byNo["INV-202"]?.chaseCount);
ok("an unparseable date is null, not Invalid Date", byNo["INV-203"]?.lastChasedAt === null, byNo["INV-203"]?.lastChasedAt);
ok("a non-numeric chaseCount is zero", byNo["INV-203"]?.chaseCount === 0, byNo["INV-203"]?.chaseCount);
ok("a log for an unknown invoice id is ignored", !built.invoices.some((r) => r.autoReminderAt && r.invoiceNumber !== "INV-200"));
ok("followUpLogs is optional", buildReceivables({ invoices: ROWS, payments: [], asOf: AS_OF }).invoices.every((r) => r.autoReminderAt === null));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The receivables endpoint, EXECUTED — the card's payload, tenant-scoped\n");
//
// Same technique as scripts/check-dashboard.mjs section 7: the real handler,
// with "@/lib/db", "@/lib/currentMember" and "next/server" swapped for stubs.

const { register } = await import("node:module");

globalThis.__FQ_ROWS = { member: [], invoice: [], payment: [], company: [], followUpRule: [], followUpLog: [] };
const RELATIONS = new Set(["client", "invoice", "template", "rule"]);

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}
function projectRelation(value, spec) {
  if (spec === true) return value;
  if (Array.isArray(value)) return value.map((v) => projectRow(v, spec));
  if (value == null) return null;
  return projectRow(value, spec);
}
function projectRow(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
    }
    return out;
  }
  const out = {};
  for (const [key, value] of Object.entries(row)) if (!RELATIONS.has(key)) out[key] = value;
  for (const [key, sub] of Object.entries(spec.include || {})) {
    out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  }
  return out;
}
function applyOrder(rows, orderBy) {
  if (!orderBy) return rows;
  const [key, dir] = Object.entries(orderBy)[0] || [];
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const cmp = av === bv ? 0 : av > bv ? 1 : -1;
    return dir === "desc" ? -cmp : cmp;
  });
}
function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  return {
    async findMany(args = {}) {
      return applyOrder(all().filter((r) => matchWhere(r, args.where)), args.orderBy).map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      const hit = applyOrder(all().filter((r) => matchWhere(r, args.where)), args.orderBy)[0];
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
  };
}
globalThis.__FQ_DB = new Proxy(
  {
    member: stubModel("member"),
    invoice: stubModel("invoice"),
    payment: stubModel("payment"),
    company: stubModel("company"),
    followUpRule: stubModel("followUpRule"),
    followUpLog: stubModel("followUpLog"),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
    },
  },
);
globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const receivablesRoute = await import("@/app/api/analytics/receivables/route.js");

const OWNER = { id: "m_owner", userId: "u_owner", role: "owner", permissions: null, companyId: COMPANY };
globalThis.__FQ_ROWS.member = [OWNER];
globalThis.__FQ_ROWS.company = [{ id: COMPANY, currency: "CAD" }];
globalThis.__FQ_ROWS.invoice = ROWS.map((r) => ({ ...r }));
globalThis.__FQ_ROWS.payment = [];
globalThis.__FQ_ROWS.followUpRule = [];
// The cron's log rows, as Prisma would hand them back with the rule relation
// attached: one from THIS company's rule, one from another tenant's rule that
// happens to name the same invoice id (ids are cuids, but the scope must not
// depend on that).
globalThis.__FQ_ROWS.followUpLog = [
  { id: "l1", ruleId: "r1", entityType: "invoice", entityId: "b", sentAt: at("2026-09-01"), rule: { id: "r1", companyId: COMPANY } },
  { id: "l2", ruleId: "r2", entityType: "invoice", entityId: "c", sentAt: at("2026-09-02"), rule: { id: "r2", companyId: "co_other" } },
  { id: "l3", ruleId: "r1", entityType: "quote", entityId: "c", sentAt: at("2026-09-03"), rule: { id: "r1", companyId: COMPANY } },
];

globalThis.__FQ_SESSION = OWNER;
const res = await receivablesRoute.GET({ url: "http://x/api/analytics/receivables", headers: { get: () => null } });
ok("an owner gets the panel", res.status === 200, res.status);
const cards = Object.fromEntries((res.body?.receivables?.invoices || []).map((r) => [r.invoiceNumber, r]));
ok("every card carries the invoice id the links open", (res.body?.receivables?.invoices || []).every((r) => typeof r.id === "string" && r.id));
ok("...and the jobId column, through the route's select", cards["INV-200"]?.jobId === "job_9", cards["INV-200"]?.jobId);
ok("...and lastChasedAt", Boolean(cards["INV-200"]?.lastChasedAt), cards["INV-200"]?.lastChasedAt);
ok("...and chaseCount", cards["INV-200"]?.chaseCount === 3, cards["INV-200"]?.chaseCount);
ok(
  "this company's reminder log reaches its card as autoReminderAt",
  new Date(cards["INV-201"]?.autoReminderAt).toISOString() === at("2026-09-01").toISOString(),
  cards["INV-201"]?.autoReminderAt,
);
ok("another company's reminder log never surfaces", cards["INV-202"]?.autoReminderAt === null, cards["INV-202"]?.autoReminderAt);
ok("a quote's log is not an invoice reminder", !cards["INV-202"]?.autoReminderAt && !cards["INV-203"]?.autoReminderAt);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The schema — two columns sentAt could not be\n");

const schema = read("prisma/schema.prisma");
const invoiceModel = schema.slice(schema.indexOf("model Invoice {"), schema.indexOf("model InvoiceCosting"));
ok("Invoice.lastChasedAt DateTime?", /^\s*lastChasedAt\s+DateTime\?/m.test(invoiceModel));
ok("Invoice.chaseCount Int @default(0)", /^\s*chaseCount\s+Int\s+@default\(0\)/m.test(invoiceModel));
ok("...with the reason sentAt could not carry it, next to the columns", /sentAt could not carry this/.test(invoiceModel));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The request-payment route — a chase leaves a trace\n");

const route = read("app/api/invoices/[id]/request-payment/route.js");
ok("imports recordActivity from the one activity writer", /import \{ recordActivity \} from "@\/lib\/activity\/log"/.test(route));
ok("records action invoice.chased", /action: "invoice\.chased"/.test(route));
ok("...on entityType invoice", /entityType: "invoice"/.test(route));
ok("...with the address and balance in the metadata, and marked manual", /metadata: \{ to: invoice\.client\.email, balance, manual: true \}/.test(route));
ok("stamps lastChasedAt on every send", /lastChasedAt: chasedAt/.test(route));
ok("...and increments chaseCount", /chaseCount: \{ increment: 1 \}/.test(route));
ok("...while sentAt keeps its stamp-only-if-empty rule", /\.\.\.\(invoice\.sentAt \? \{\} : \{ sentAt: chasedAt/.test(route));
ok("returns lastChasedAt and chaseCount", /lastChasedAt: stamped\.lastChasedAt,\s*chaseCount: stamped\.chaseCount/.test(route));
// Ordering: the write and the log come AFTER the send result is checked.
const sendCheck = route.indexOf("if (result?.error)");
ok(
  "the stamp and the activity row come after Resend's answer is checked",
  sendCheck > 0 && route.indexOf("lastChasedAt: chasedAt") > sendCheck && route.indexOf('action: "invoice.chased"') > sendCheck,
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The owed card — every row is a door, and the result lands on the row\n");

const page = read("app/app/page.js");
const owedCard = page.slice(page.indexOf('t("app.dash.owed.title"'), page.indexOf("Yearly goal + pace"));
ok("the client name links to the invoice", /<Link\s+href=\{`\/app\/invoices\/\$\{inv\.id\}`\}[^>]*>\s*\{inv\.client\?\.name\}/.test(owedCard));
ok("the invoice number links to the invoice", /<Link href=\{`\/app\/invoices\/\$\{inv\.id\}`\}[^>]*>\s*\{inv\.invoiceNumber\}/.test(owedCard));
ok("a Job link appears when jobId exists", /\{inv\.jobId && \(/.test(owedCard) && /href=\{`\/app\/jobs\/\$\{inv\.jobId\}`\}/.test(owedCard));
ok("...and nowhere else — no guessed job", (owedCard.match(/\/app\/jobs\//g) || []).length === 1);
ok("shows Last chased {date} · {count}×", /"app\.dash\.owed\.lastChased",\s*"Last chased \{date\} · \{count\}×"/.test(owedCard) && /\{inv\.lastChasedAt && \(/.test(owedCard));
ok("shows Automatic reminder sent {date}", /"app\.dash\.owed\.autoReminderSent",\s*"Automatic reminder sent \{date\}"/.test(owedCard) && /\{inv\.autoReminderAt && \(/.test(owedCard));
ok("the chase result is keyed by invoice id", /const \[chaseResults, setChaseResults\] = useState\(\{\}\)/.test(page) && /\[invoice\.id\]: \{\s*note:/.test(page));
ok("...success is rendered on the row, naming address and time", /\{chaseResults\[inv\.id\]\?\.note && \(/.test(owedCard) && /"Payment request emailed to \{address\} at \{time\}"/.test(page));
ok("...and so is the failure", /\{chaseResults\[inv\.id\]\?\.error && \(/.test(owedCard));
ok("the failure path still goes through reportResponseError", /await reportResponseError\(\s*res,\s*\(message\) => \{\s*rowError\(message\)/.test(page));
ok("NeedsToday keeps its own line", /<NeedsToday[\s\S]*?chaseError=\{chaseError\}[\s\S]*?chaseNote=\{chaseNote\}/.test(page));
ok("...fed only by chases pressed there", /onChase=\{\(inv\) => chase\(inv, "top"\)\}/.test(page) && /if \(origin === "top"\) \{\s*setChaseNote\(/.test(page));
ok("the no-rule sentence links to /app/settings/follow-ups", /href="\/app\/settings\/follow-ups"/.test(owedCard) && /"app\.dash\.owed\.setUpAuto", "Set one up"/.test(owedCard));
ok("...and so does the positive one", /"app\.dash\.owed\.changeAuto", "Change it"/.test(owedCard));
ok("the request still hits the real route", /\/api\/invoices\/\$\{invoice\.id\}\/request-payment/.test(page));
ok("no hand-written currency symbol on the new lines", !/\$\{formatMoney|>\$\{/.test(owedCard));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The invoice page — the trail past the first send\n");

const detailRoute = read("app/api/invoices/[id]/route.js");
const getHandler = detailRoute.slice(detailRoute.indexOf("export async function GET"), detailRoute.indexOf("export async function PATCH"));
ok("GET /api/invoices/[id] builds chaseTrail", /invoice\.chaseTrail = \{/.test(getHandler));
ok("...family-wide, through the one family helper", /familyMembers\(db, invoice\.id\)/.test(getHandler));
ok("...reading FollowUpLog scoped through the rule's company", /db\.followUpLog\.findMany\(\{[\s\S]*?rule: \{ companyId: member\.companyId \}/.test(getHandler));
ok("...with the rule's name for the line", /rule: \{ select: \{ name: true \} \}/.test(getHandler));
ok("...and the invoice rows scoped to the company too", /id: \{ in: ids \}, companyId: member\.companyId/.test(getHandler));

const detail = read("app/app/invoices/[id]/page.js");
ok("the trail card opens on any of the three events", /invoice\.sentAt \|\|\s*invoice\.chaseTrail\?\.lastChasedAt \|\|\s*invoice\.chaseTrail\?\.automated\?\.length > 0/.test(detail));
ok("shows the first send", /t\("app\.invoiceDetail\.emailed"\)/.test(detail));
ok("shows the last manual chase with its count", /t\("app\.invoiceDetail\.lastChasedCount", \{\s*count: invoice\.chaseTrail\.chaseCount/.test(detail));
ok("lists every automated reminder", /\(invoice\.chaseTrail\?\.automated \|\| \[\]\)\.map\(/.test(detail) && /t\("app\.invoiceDetail\.autoReminderSent"\)/.test(detail));
ok("...dated through the company's own date format", /\{formatDate\(r\.sentAt\)\}/.test(detail) && /\{formatDate\(invoice\.chaseTrail\.lastChasedAt\)\}/.test(detail));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. Every new key, in every language the catalogue has\n");

const NEW_KEYS = [
  "app.dash.owed.job",
  "app.dash.owed.lastChased",
  "app.dash.owed.autoReminderSent",
  "app.dash.owed.chased",
  "app.dash.owed.setUpAuto",
  "app.dash.owed.changeAuto",
  "app.invoiceDetail.lastChasedCount",
  "app.invoiceDetail.autoReminderSent",
];
const codes = Object.keys(APP_MESSAGES);
ok("the catalogue still has its languages", codes.length >= 9, codes.length);
for (const key of NEW_KEYS) {
  const missing = codes.filter((c) => typeof APP_MESSAGES[c]?.[key] !== "string" || !APP_MESSAGES[c][key].trim());
  ok(`${key} in every language`, missing.length === 0, missing.join(","));
}
ok(
  "placeholders survive translation",
  codes.every(
    (c) =>
      /\{date\}/.test(APP_MESSAGES[c]["app.dash.owed.lastChased"]) &&
      /\{count\}/.test(APP_MESSAGES[c]["app.dash.owed.lastChased"]) &&
      /\{date\}/.test(APP_MESSAGES[c]["app.dash.owed.autoReminderSent"]) &&
      /\{address\}/.test(APP_MESSAGES[c]["app.dash.owed.chased"]) &&
      /\{time\}/.test(APP_MESSAGES[c]["app.dash.owed.chased"]) &&
      /\{count\}/.test(APP_MESSAGES[c]["app.invoiceDetail.lastChasedCount"]),
  ),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
