// scripts/check-accounting-route.mjs
//
// The bookkeeping export, from the request to the bytes.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-accounting-route.mjs
//
// ══ What this file is for, and what it deliberately is not ═════════════════
//
// scripts/check-accounting-export.mjs already owns the MODULE — 96 assertions
// and ten mutants over lib/export/accountingExport.js. Nothing here re-asserts
// any of that. What is untested until this file exists is everything BETWEEN a
// browser and that module, and it is where the whole thing can quietly go
// wrong:
//
//   • The module can only group invoice families if it is handed the children.
//     A `parentInvoiceId: null` in the query — the obvious, tidy-looking
//     filter — hands a bookkeeper January's invoice at the total it had before
//     March corrected it. Every guarantee in the module survives that filter
//     intact and reports the wrong number anyway.
//   • The module THROWS when the currency is missing, on purpose. A route that
//     lets the throw escape turns "your company has no billing currency" into
//     a Next.js 500 with an empty body, which is indistinguishable from the
//     server being broken.
//   • The file names every client in the company and what they were charged.
//     A gate that is written down but does not refuse is the failure this
//     repo keeps finding, and a regex over the source cannot tell the two
//     apart.
//
// So the REAL handler is imported and called against a scripted database, the
// way scripts/check-crew-access.mjs section 10 does it: "@/lib/db",
// "@/lib/currentMember" and "next/server" are swapped for stubs through a
// module hook, and the assertions are made against the status, the headers and
// the actual bytes that come back. The `where` clauses the handler builds are
// captured on the way past, so "it does not filter parentInvoiceId" is a fact
// about the query that ran rather than a fact about the source text.
//
// The ZIP is opened two ways: inflated in-process by zlib (the other half of
// the deflate the route did) and, when the binary is present, by `unzip -t`,
// which knows nothing about this codebase. A ZIP writer that agrees only with
// itself is a ZIP writer nobody has tested.
//
// One thing is NOT executed, and this file says so rather than implying
// otherwise: the settings card is JSX, and nothing in an alias-loader run can
// parse JSX. So the CARD's gate is lifted out of the source as data — the
// toggle name and the category/level it asks for — and evaluated against the
// same permission helpers the route uses, then compared with what the route
// actually answered the same member. Deleting the guard, or pointing it at a
// different permission, fails. Only the placement of the guard is matched as
// text.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";
import { inflateRawSync } from "node:zlib";

import { PERMISSION_PRESETS } from "@/lib/permissions";
import { hasLevel, hasToggle } from "@/lib/permissions/enforce";
import { buildAccountingExport } from "@/lib/export/accountingExport";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTE = join(ROOT, "app/api/export/accounting/route.js");
const CARD = join(ROOT, "app/app/settings/expense-tracking/page.js");

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);

// ═══════════════════════════════════════════════════════════════════════════
// The scripted database
// ═══════════════════════════════════════════════════════════════════════════
//
// A small Prisma evaluator. It applies `where`, `select` and `include`,
// because all three are load-bearing here: the where decides which invoice
// rows the module ever sees, and the include decides whether a client's NAME
// rides along on one that comes back. A stub that ignored `include` would let
// the client-name assertions pass on a route that never asked for it.

globalThis.__FQ_ROWS = {
  member: [],
  company: [],
  invoice: [],
  payment: [],
  expense: [],
  user: [],
  activityLog: [],
};

// Captured so a query can be asserted about rather than read about.
globalThis.__FQ_QUERIES = [];

const RELATIONS = new Set(["client", "invoice", "versions", "parentInvoice"]);

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;

    if (key === "AND") {
      const terms = Array.isArray(cond) ? cond : [cond];
      if (!terms.every((c) => matchWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      const terms = Array.isArray(cond) ? cond : [cond];
      if (!terms.some((c) => matchWhere(row, c))) return false;
      continue;
    }

    const value = row[key];
    if (cond === null) {
      if (value != null) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !(cond instanceof Date)) {
      if ("in" in cond) {
        if (!cond.in.includes(value)) return false;
        continue;
      }
      if ("gte" in cond || "lte" in cond) {
        if (value == null) return false;
        const t = new Date(value).getTime();
        if ("gte" in cond && t < new Date(cond.gte).getTime()) return false;
        if ("lte" in cond && t > new Date(cond.lte).getTime()) return false;
        continue;
      }
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ("some" in cond) {
        if (!Array.isArray(value) || !value.some((v) => matchWhere(v, cond.some)))
          return false;
        continue;
      }
      // A to-one relation filter — `invoice: { companyId }`, which is the only
      // thing scoping the payments query to one tenant.
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
  for (const [key, value] of Object.entries(row)) {
    if (!RELATIONS.has(key)) out[key] = value;
  }
  for (const [key, sub] of Object.entries(spec.include || {})) {
    out[key] = sub === true ? row[key] : projectRelation(row[key], sub);
  }
  return out;
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  const note = (op, args) =>
    globalThis.__FQ_QUERIES.push({ model: name, op, args });
  return {
    async findMany(args = {}) {
      note("findMany", args);
      return all()
        .filter((r) => matchWhere(r, args.where))
        .map((r) => projectRow(r, args));
    },
    async findFirst(args = {}) {
      note("findFirst", args);
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async findUnique(args = {}) {
      note("findUnique", args);
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? projectRow(hit, args) : null;
    },
    async create(args = {}) {
      note("create", args);
      const row = { id: `${name}_${all().length + 1}`, ...args.data };
      all().push(row);
      return row;
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {
    member: stubModel("member"),
    company: stubModel("company"),
    invoice: stubModel("invoice"),
    payment: stubModel("payment"),
    expense: stubModel("expense"),
    user: stubModel("user"),
    activityLog: stubModel("activityLog"),
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, never quiet: a check must not pass because a query it failed to
      // model answered "nothing".
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
    // A real constructor, because the route returns \`new NextResponse(buffer)\`
    // for the archive and NextResponse.json() for every refusal. A stub with
    // only the static would throw on the success path — which would "pass"
    // every refusal assertion in this file while proving nothing.
    return { format: "module", shortCircuit: true, source: \`
export class NextResponse {
  constructor(body, init) {
    this.body = body;
    this.status = init?.status ?? 200;
    this.headers = new Map(Object.entries(init?.headers ?? {}));
  }
  static json(body, init) {
    const r = new NextResponse(body, init);
    r.json = async () => body;
    return r;
  }
}\` };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const route = await import("@/app/api/export/accounting/route.js");

// ═══════════════════════════════════════════════════════════════════════════
// The fixtures
// ═══════════════════════════════════════════════════════════════════════════
//
// One amended invoice, because that is the trap: 1042 was raised for $1,000 in
// January and corrected to $1,500 in March. The correction is a SEPARATE row
// with the same invoice number. The right answer is one line, at $1,500, dated
// January — the document was issued when v1 went out.
//
// The client's name is a formula. It is a real risk on this file (a homeowner
// types their own name into the self-quote form) and it also proves the route
// hands the raw value to the module rather than pre-formatting it somewhere.

const COMPANY = "co";
const HOSTILE_CLIENT = `=cmd|' /C calc'!A0`;

const client = { id: "c1", name: HOSTILE_CLIENT };

const invoiceV1 = {
  id: "inv_a_v1",
  companyId: COMPANY,
  invoiceNumber: "1042",
  status: "sent",
  version: 1,
  parentInvoiceId: null,
  subtotal: 1000,
  discount: 0,
  tax: 0,
  taxEnabled: false,
  total: 1000,
  amountPaid: 600,
  amountDue: 400,
  dueDate: new Date("2026-01-31T00:00:00Z"),
  sentAt: new Date("2026-01-10T15:00:00Z"),
  createdAt: new Date("2026-01-09T15:00:00Z"),
  client,
};

const invoiceV2 = {
  ...invoiceV1,
  id: "inv_a_v2",
  version: 2,
  parentInvoiceId: "inv_a_v1",
  subtotal: 1500,
  total: 1500,
  amountDue: 900,
  // The amendment happened in March. Nothing about it belongs to January
  // except the money it corrected.
  sentAt: new Date("2026-03-05T15:00:00Z"),
  createdAt: new Date("2026-03-05T15:00:00Z"),
};

const invoiceOutside = {
  ...invoiceV1,
  id: "inv_b",
  invoiceNumber: "1043",
  version: 1,
  parentInvoiceId: null,
  subtotal: 250,
  total: 250,
  amountPaid: 0,
  amountDue: 250,
  sentAt: new Date("2026-02-02T15:00:00Z"),
  createdAt: new Date("2026-02-02T15:00:00Z"),
};

// Another company's invoice, in the same range, with the same shape. Nothing
// about it may reach the file.
const invoiceForeign = {
  ...invoiceV1,
  id: "inv_foreign",
  companyId: "other_co",
  invoiceNumber: "9999",
  parentInvoiceId: null,
  client: { id: "c9", name: "Somebody Else Ltd" },
};

globalThis.__FQ_ROWS.invoice = [
  invoiceV1,
  invoiceV2,
  invoiceOutside,
  invoiceForeign,
];

// The joined side of Payment → Invoice. companyId is on it because that is
// the ONLY thing scoping the payments query to one tenant — Payment has no
// companyId column of its own — and a fixture without it would make the
// tenant-boundary assertions in section 4 pass by accident. It is dropped
// again by the route's `select`, which is the point of projecting at all.
const invoiceRef = (inv) => ({
  companyId: inv.companyId,
  invoiceNumber: inv.invoiceNumber,
  client: inv.client,
});

globalThis.__FQ_ROWS.payment = [
  {
    id: "pay_1",
    invoiceId: "inv_a_v1",
    amount: 400,
    method: "e_transfer",
    notes: null,
    stripePaymentIntentId: null,
    date: new Date("2026-01-15T12:00:00Z"),
    invoice: invoiceRef(invoiceV1),
  },
  {
    // Taken against the SUPERSEDED row. It is still money that arrived in
    // January and it must be rolled up to the family, not dropped.
    id: "pay_2",
    invoiceId: "inv_a_v2",
    amount: 200,
    method: "cash",
    notes: null,
    stripePaymentIntentId: null,
    date: new Date("2026-01-20T12:00:00Z"),
    invoice: invoiceRef(invoiceV2),
  },
  {
    id: "pay_foreign",
    invoiceId: "inv_foreign",
    amount: 5000,
    method: "stripe",
    notes: null,
    stripePaymentIntentId: "pi_foreign",
    date: new Date("2026-01-22T12:00:00Z"),
    invoice: invoiceRef(invoiceForeign),
  },
];

globalThis.__FQ_ROWS.expense = [
  {
    id: "exp_1",
    companyId: COMPANY,
    category: "Materials",
    amount: 250,
    date: new Date("2026-01-05T12:00:00Z"),
    notes: "Benjamin Moore Aura",
    projectId: null,
    isOverhead: false,
    recurring: false,
    frequency: "one_time",
  },
  {
    id: "exp_foreign",
    companyId: "other_co",
    category: "Fuel & Vehicle",
    amount: 90,
    date: new Date("2026-01-06T12:00:00Z"),
    notes: null,
    projectId: null,
    isOverhead: false,
    recurring: false,
    frequency: "one_time",
  },
];

globalThis.__FQ_ROWS.company = [
  { id: COMPANY, name: "Elm Street Painting", currency: "CAD" },
  // A different billing currency on purpose: if the tenant scope ever slipped,
  // the summary would be denominated in one company's currency over another
  // company's money, which is the loudest possible version of the failure.
  { id: "other_co", name: "Somebody Else Ltd", currency: "USD" },
  { id: "co_nocurrency", name: "No Currency Co", currency: null },
];

globalThis.__FQ_ROWS.user = [{ id: "u_owner", name: "Dana", email: "d@x.com" }];

// ── The people ─────────────────────────────────────────────────────────────

const CREW = PERMISSION_PRESETS.worker.values;
const ESTIMATOR = PERMISSION_PRESETS.estimator.values;

const memberRow = (id, role, permissions, companyId = COMPANY) => ({
  id,
  userId: "u_owner",
  companyId,
  role,
  permissions,
});

const PEOPLE = {
  // Owner: no grid at all. UNRESTRICTED_ROLES bypasses both questions.
  owner: memberRow("m_owner", "owner", null),
  // Crew, exactly as shipped. showPricing:false, invoices:"none".
  crew: memberRow("m_crew", "employee", { ...CREW }),
  // The half-cases, so a gate that only asks ONE of the two questions fails.
  noPricing: memberRow("m_nopricing", "employee", {
    ...CREW,
    invoices: "view_only",
    showPricing: false,
  }),
  noInvoices: memberRow("m_noinvoices", "employee", {
    ...CREW,
    invoices: "none",
    showPricing: true,
  }),
  // Estimator: showPricing true, invoices view_only. The person this screen is
  // for who is not an owner.
  estimator: memberRow("m_estimator", "employee", { ...ESTIMATOR }),
  // A member of ANOTHER company, holding everything, to prove the tenant scope.
  foreignOwner: memberRow("m_foreign", "owner", null, "other_co"),
  // No billing currency on the company. The module throws; the route must not
  // 500 and must not invent CAD.
  ownerNoCurrency: memberRow("m_nocur", "owner", null, "co_nocurrency"),
};

globalThis.__FQ_ROWS.member = Object.values(PEOPLE);

const asMember = (key) => {
  const row = PEOPLE[key];
  // The shape getCurrentMember returns — NO permissions, which is exactly why
  // loadEnforceableMember exists and why the grid is re-read per route.
  globalThis.__FQ_SESSION = {
    id: row.id,
    userId: row.userId,
    companyId: row.companyId,
    role: row.role,
  };
};

const FROM = "2026-01-01";
const TO = "2026-01-31";

const req = (query = `from=${FROM}&to=${TO}`) => ({
  url: `http://local/api/export/accounting?${query}`,
  method: "GET",
  headers: new Map(),
});

async function call(who, query) {
  asMember(who);
  globalThis.__FQ_QUERIES = [];
  globalThis.__FQ_ROWS.activityLog = [];
  return route.GET(req(query));
}

const headerOf = (res, name) => res?.headers?.get?.(name) ?? "";

// ═══════════════════════════════════════════════════════════════════════════
// A ZIP reader, written against the format rather than against the writer
// ═══════════════════════════════════════════════════════════════════════════
//
// Reading the central directory rather than scanning for local headers, which
// is what a real unzip does and what makes the offsets in the archive matter.
// If the route wrote a plausible-looking stream with wrong offsets, `unzip`
// would reject it and a naive reader would not.

function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("no end-of-central-directory record");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i += 1) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("bad central header");
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const compSize = buf.readUInt32LE(p + 20);
    const rawSize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);

    if (buf.readUInt32LE(offset) !== 0x04034b50) throw new Error("bad local header");
    const lNameLen = buf.readUInt16LE(offset + 26);
    const lExtraLen = buf.readUInt16LE(offset + 28);
    const start = offset + 30 + lNameLen + lExtraLen;
    const payload = buf.subarray(start, start + compSize);
    const data = method === 8 ? inflateRawSync(payload) : Buffer.from(payload);
    entries.push({ name, method, crc, rawSize, data });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const stripBom = (buf) =>
  buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf
    ? buf.subarray(3).toString("utf8")
    : buf.toString("utf8");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The gate — this file names every client and every total\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// Copied from the price book's gate on purpose (app/api/products/export), and
// it has to ask BOTH halves: showPricing, because this is money, and the
// invoices level, because it is specifically every invoice in the company. A
// gate that asks only one of them passes for somebody it should refuse, and
// the two half-cases below are what catch that.

const crewRes = await call("crew");
ok("Crew are refused", crewRes.status === 403, crewRes.status);
ok(
  "…with a sentence, not an empty body",
  typeof crewRes.body?.error === "string" && crewRes.body.error.length > 10,
  JSON.stringify(crewRes.body),
);
ok(
  "…and no archive comes back",
  !Buffer.isBuffer(crewRes.body),
  typeof crewRes.body,
);

const noPricingRes = await call("noPricing");
ok(
  "a member WITHOUT showPricing is refused, even holding invoices:view_only",
  noPricingRes.status === 403,
  noPricingRes.status,
);

const noInvoicesRes = await call("noInvoices");
ok(
  "a member at invoices:none is refused, even holding showPricing",
  noInvoicesRes.status === 403,
  noInvoicesRes.status,
);

const estimatorRes = await call("estimator");
ok(
  "an Estimator — showPricing, invoices:view_only — is let through",
  estimatorRes.status === 200,
  estimatorRes.status,
);

const ownerRes = await call("owner");
ok("an owner is let through", ownerRes.status === 200, ownerRes.status);

// Nothing is exported to somebody who was refused. A route that queried first
// and gated second would leak through timing and through the activity log.
asMember("crew");
globalThis.__FQ_QUERIES = [];
await route.GET(req());
ok(
  "a refused caller's request never queries invoices at all",
  !globalThis.__FQ_QUERIES.some((q) => q.model === "invoice"),
  globalThis.__FQ_QUERIES.map((q) => q.model).join(","),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. The range — refused with a sentence, never a 500, never an empty file\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// An empty CSV for a range nobody could parse looks exactly like an empty CSV
// for a quiet month, and a bookkeeper would file the second one. So every
// unusable range is a refusal that says which part was wrong.

const BAD_RANGES = [
  ["", "no dates at all"],
  [`from=${FROM}`, "only a start"],
  [`to=${TO}`, "only an end"],
  [`from=janury&to=${TO}`, "a start that is not a date"],
  [`from=${FROM}&to=2026-01-32`, "an end that is not a real day"],
  [`from=2026-02-31&to=2026-03-01`, "a day that does not exist in that month"],
  [`from=2026-01-31&to=2026-01-01`, "a range that runs backwards"],
  [`from=1970-01-01&to=${TO}`, "a start before the product existed"],
  [`from=2026-01-01&to=2099-01-01`, "an end absurdly far in the future"],
  [`from=2001-01-01&to=2026-01-01`, "a span of twenty-five years"],
];

for (const [query, why] of BAD_RANGES) {
  const res = await call("owner", query);
  ok(`${why} → 400`, res.status === 400, res.status);
  ok(
    `…and says what was wrong`,
    typeof res.body?.error === "string" && res.body.error.length > 10,
    JSON.stringify(res.body),
  );
}

// The two ends are INCLUSIVE, which is what "1 to 31 January" means to the
// person asking. A single-day range is legal and is the tightest test of that.
const oneDay = await call("owner", "from=2026-01-15&to=2026-01-15");
ok("a single day is a legal range", oneDay.status === 200, oneDay.status);
{
  const files = Object.fromEntries(
    readZip(oneDay.body).map((e) => [e.name.split("-")[0], stripBom(e.data)]),
  );
  ok(
    "…and it contains the payment recorded on that day",
    files.payments.includes("2026-01-15"),
  );
  ok(
    "…and not the one five days later",
    !files.payments.includes("2026-01-20"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The invoice query — families, not rows\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// This is the assertion the whole file is for. `parentInvoiceId: null` is the
// filter a careful person adds to avoid duplicates, and it is exactly wrong:
// the module de-duplicates by family and needs the children to know which
// version stands. Filtering them out reports January's invoice at the total it
// had before March corrected it — and every other guarantee in the module
// still holds while it does.
//
// Asserted about the QUERIES THAT RAN, not about the source text, so a filter
// added anywhere — inlined, spread in from a helper, hidden in a constant —
// fails this.

const familyRun = await call("owner");
const invoiceQueries = globalThis.__FQ_QUERIES.filter(
  (q) => q.model === "invoice",
);
ok("the invoices are fetched", invoiceQueries.length > 0);

const whereText = JSON.stringify(invoiceQueries.map((q) => q.args.where));
ok(
  "no invoice query filters parentInvoiceId to null",
  !/"parentInvoiceId":null/.test(whereText),
  whereText,
);
ok(
  "…and none asks for version 1 either, which is the same mistake spelled differently",
  !/"version":1/.test(whereText),
  whereText,
);
ok(
  "every invoice query is scoped to the caller's company",
  invoiceQueries.every((q) => q.args.where?.companyId === COMPANY),
  whereText,
);
ok(
  "the child row is actually fetched — the family is complete",
  JSON.stringify(invoiceQueries.map((q) => q.args.where)).includes("parentInvoiceId"),
);

const familyFiles = Object.fromEntries(
  readZip(familyRun.body).map((e) => [e.name.split("-")[0], stripBom(e.data)]),
);
const invoiceLines = familyFiles.invoices
  .trim()
  .split("\r\n")
  .slice(1)
  .filter(Boolean);

ok(
  "the amended invoice appears ONCE",
  invoiceLines.filter((l) => l.startsWith("1042")).length === 1,
  invoiceLines.join(" || "),
);
ok(
  "…at the LATEST version's money, not the original's",
  invoiceLines[0].includes("1500.00") && !invoiceLines[0].includes("1000.00"),
  invoiceLines[0],
);
ok(
  "…dated from the ROOT — amending in March did not re-issue a January document",
  invoiceLines[0].includes("2026-01-10"),
  invoiceLines[0],
);
ok(
  "…and says which version stands, out of how many",
  invoiceLines[0].includes("2 of 2"),
  invoiceLines[0],
);
ok(
  "an invoice outside the range is not in the file",
  !familyFiles.invoices.includes("1043"),
);
ok(
  "one document, so one row",
  invoiceLines.length === 1,
  String(invoiceLines.length),
);

// Payments taken against the superseded row are still January's money.
ok(
  "payments against BOTH versions are rolled up into the family",
  invoiceLines[0].includes("600.00"),
  invoiceLines[0],
);

// The client's name is included, and it is neutralised.
ok(
  "the client's name reaches the file",
  familyFiles.invoices.includes("cmd|"),
);
ok(
  "…tab-prefixed and quoted, so Excel does not run it",
  familyFiles.invoices.includes(`"\t=cmd|' /C calc'!A0"`),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. The tenant boundary\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// Payment carries no companyId of its own — the invoice it hangs off is the
// only thing scoping it — so this is the query most likely to be written
// unscoped, and the one whose leak would be a whole other company's revenue.

ok(
  "another company's invoice is not in the file",
  !familyFiles.invoices.includes("9999") &&
    !familyFiles.invoices.includes("Somebody Else"),
);
ok(
  "another company's PAYMENT is not in the file",
  !familyFiles.payments.includes("5000.00") &&
    !familyFiles.payments.includes("pi_foreign"),
);
ok(
  "another company's EXPENSE is not in the file",
  !familyFiles.expenses.includes("Fuel & Vehicle"),
);
{
  const foreign = await call("foreignOwner");
  const files = Object.fromEntries(
    readZip(foreign.body).map((e) => [e.name.split("-")[0], stripBom(e.data)]),
  );
  ok(
    "…and the other company's own owner sees only their own",
    files.invoices.includes("9999") && !files.invoices.includes("1042"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The currency is never assumed\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// The module throws when Company.currency is missing, deliberately: a currency
// guessed on an accounting export is a wrong number in somebody's books. The
// route's job is to turn that throw into a refusal a person can act on — not
// to catch it and default to CAD, and not to let it escape as a 500 with an
// empty body, which is indistinguishable from the server being down.

const noCurrency = await call("ownerNoCurrency");
ok(
  "a company with no billing currency is refused, not defaulted",
  noCurrency.status === 409,
  noCurrency.status,
);
ok(
  "…with the module's own sentence, not a restatement of it",
  typeof noCurrency.body?.error === "string" &&
    noCurrency.body.error.includes("currency"),
  JSON.stringify(noCurrency.body),
);
ok(
  "…and no archive, empty or otherwise",
  !Buffer.isBuffer(noCurrency.body),
  typeof noCurrency.body,
);
ok(
  "…and CAD appears nowhere in the refusal",
  !JSON.stringify(noCurrency.body).includes("CAD"),
);
// The other direction: the currency that IS set is the one on the file.
ok(
  "the company's own currency is what the summary states",
  familyFiles.summary.includes("CAD"),
);
ok(
  "…and the route did ask the company row for it",
  familyRun &&
    JSON.stringify(
      globalThis.__FQ_QUERIES.filter((q) => q.model === "company"),
    ) !== "[]",
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The archive is a real ZIP\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// Written by hand, so it is opened by something that is not this codebase.
// Inflated here by zlib — the other half of the deflate the route did — and
// then handed to `unzip -t`, which knows the format and knows nothing about
// us. A ZIP writer that only agrees with itself has not been tested.

const archive = ownerRes.body;
ok("the body is bytes", Buffer.isBuffer(archive), typeof archive);
ok(
  "it is served as a ZIP",
  headerOf(ownerRes, "Content-Type") === "application/zip",
  headerOf(ownerRes, "Content-Type"),
);
ok(
  "it downloads rather than rendering, and is named for its range",
  headerOf(ownerRes, "Content-Disposition") ===
    `attachment; filename="bookkeeping-${FROM}-to-${TO}.zip"`,
  headerOf(ownerRes, "Content-Disposition"),
);
ok(
  "client names and totals are not cached",
  /no-store/.test(headerOf(ownerRes, "Cache-Control")),
  headerOf(ownerRes, "Cache-Control"),
);

const entries = readZip(archive);
ok("four files", entries.length === 4, String(entries.length));
for (const kind of ["summary", "invoices", "payments", "expenses"]) {
  ok(
    `…including ${kind}, named for the range`,
    entries.some((e) => e.name === `${kind}-${FROM}-to-${TO}.csv`),
    entries.map((e) => e.name).join(", "),
  );
}
for (const entry of entries) {
  ok(
    `${entry.name}: the declared size matches the bytes`,
    entry.rawSize === entry.data.length,
    `${entry.rawSize} vs ${entry.data.length}`,
  );
  ok(
    `${entry.name}: starts with a UTF-8 BOM, so Excel reads accented names`,
    entry.data[0] === 0xef && entry.data[1] === 0xbb && entry.data[2] === 0xbf,
  );
  ok(
    `${entry.name}: ends its rows with CRLF, like the payroll export`,
    stripBom(entry.data).includes("\r\n"),
  );
}

// The bytes the route produced are the bytes the module produced. Anything
// that reformatted, re-escaped or re-sorted a CSV on the way out would show up
// here, and every guarantee check-accounting-export.mjs makes would be about a
// file nobody receives.
{
  const expected = buildAccountingExport({
    from: FROM,
    to: TO,
    invoices: [invoiceV1, invoiceV2, invoiceOutside],
    payments: globalThis.__FQ_ROWS.payment.filter(
      (p) => p.invoiceId !== "inv_foreign",
    ),
    expenses: globalThis.__FQ_ROWS.expense.filter(
      (e) => e.companyId === COMPANY,
    ),
    currency: "CAD",
    companyName: "Elm Street Painting",
  });
  for (const file of expected.files) {
    const entry = entries.find((e) => e.name === file.name);
    ok(
      `${file.kind}: byte-for-byte what the module built`,
      entry && stripBom(entry.data) === file.csv,
    );
  }
}

// …and a third party agrees it is a ZIP.
{
  const dir = mkdtempSync(join(tmpdir(), "fq-zip-"));
  const path = join(dir, "books.zip");
  writeFileSync(path, archive);
  let unzipVerdict = "";
  try {
    unzipVerdict = execFileSync("unzip", ["-t", path], { encoding: "utf8" });
  } catch (err) {
    unzipVerdict = `FAILED: ${err?.stdout || err?.message}`;
  }
  ok(
    "`unzip -t` says the archive has no errors",
    /No errors detected/.test(unzipVerdict),
    unzipVerdict.trim().split("\n").pop(),
  );
  ok(
    "…and lists all four members",
    (unzipVerdict.match(/testing:/g) || []).length === 4,
    String((unzipVerdict.match(/testing:/g) || []).length),
  );
}

// An empty month is empty, not broken — the whole set still arrives, with the
// summary that says the range was quiet.
{
  const quiet = await call("owner", "from=2026-06-01&to=2026-06-30");
  ok("a month with nothing in it still returns a ZIP", quiet.status === 200, quiet.status);
  const quietEntries = readZip(quiet.body);
  ok("…with all four files", quietEntries.length === 4);
  const invoicesCsv = stripBom(
    quietEntries.find((e) => e.name.startsWith("invoices")).data,
  );
  ok(
    "…the invoices file has its header and no rows",
    invoicesCsv.startsWith("Invoice number,") &&
      invoicesCsv.trim().split("\r\n").length === 1,
    JSON.stringify(invoicesCsv.slice(0, 40)),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The activity trail\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// Somebody downloaded every client and every amount in a period. That is a
// thing an owner should be able to see afterwards, and the payroll export
// beside this one already records its own.

{
  await call("owner");
  const logged = globalThis.__FQ_ROWS.activityLog;
  ok("the export is recorded", logged.length === 1, String(logged.length));
  ok(
    "…under a name that says what happened",
    logged[0]?.action === "accounting.exported",
    logged[0]?.action,
  );
  ok(
    "…naming the range, so the entry means something a year later",
    String(logged[0]?.summary).includes(FROM) &&
      String(logged[0]?.summary).includes(TO),
    logged[0]?.summary,
  );
  ok(
    "…and carrying the currency it was denominated in",
    logged[0]?.metadata?.currency === "CAD",
    JSON.stringify(logged[0]?.metadata),
  );
}
{
  await call("crew");
  ok(
    "a refusal records no export",
    globalThis.__FQ_ROWS.activityLog.length === 0,
    String(globalThis.__FQ_ROWS.activityLog.length),
  );
}
{
  await call("owner", "from=2026-01-31&to=2026-01-01");
  ok(
    "a refused range records no export either",
    globalThis.__FQ_ROWS.activityLog.length === 0,
    String(globalThis.__FQ_ROWS.activityLog.length),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. The card is hidden from exactly the people the route refuses\n");
// ═══════════════════════════════════════════════════════════════════════════
//
// The card is JSX and cannot be rendered in this run, so its guard is lifted
// out of the source AS DATA — which toggle, which category, which level — and
// evaluated with the same helpers the route uses. Then the two answers are
// compared per person. Pointing the card at a different permission, or
// deleting the guard, changes what this computes and fails.
//
// Hiding the card is not the access control; the route is, and section 1 is
// what proves it. This is the other half of the same rule: a control that
// 403s for the person looking at it is the failure AGENTS.md names first.

const cardSrc = readFileSync(CARD, "utf8");

// Scoped to the CARD's own source, not the page's. The screen it sits on
// already fetches, already reports its own errors and already reads the grid
// for other reasons — asserting against the whole file would let a guard
// deleted from the card pass on the strength of a line four hundred lines
// away. Every "the card does X" below is a statement about these lines.
const cardStart = cardSrc.indexOf("function BookkeepingExportCard()");
const cardEnd = cardSrc.indexOf("export default function ExpenseTrackingPage");
ok(
  "the card is a component in this file",
  cardStart > -1 && cardEnd > cardStart,
  `${cardStart}..${cardEnd}`,
);
const cardBody = cardSrc.slice(cardStart, cardEnd);

const toggleArg = cardBody.match(/useHasToggle\("([^"]+)"\)/)?.[1];
const levelArgs = cardBody.match(/useHasLevel\("([^"]+)",\s*"([^"]+)"\)/);

ok("the card asks the grid for a toggle", !!toggleArg, String(toggleArg));
ok("…and for a category level", !!levelArgs, String(levelArgs));
ok(
  "the guard returns null before any markup",
  /if \(!canSeePricing \|\| !canReadInvoices\) return null;/.test(cardBody),
);
ok(
  "the card is rendered on the page, not merely defined",
  /<BookkeepingExportCard \/>/.test(cardSrc.slice(cardEnd)),
);
ok(
  "the download goes to the route this file executes",
  /\/api\/export\/accounting\?from=/.test(cardBody),
);
// A dead `if (res.ok)` is the second failure class in AGENTS.md, and it is the
// one that makes a broken export look like a button that does nothing. Matched
// as the refusal BRANCH rather than as a mention of the helper: the page has
// three other call sites, and any of them would satisfy a bare name match
// while this button failed in silence.
ok(
  "a failed download is reported, not swallowed",
  /if \(!res\.ok\) \{[\s\S]{0,400}?await reportResponseError\(/.test(cardBody),
);

const cardVisibleTo = (member) =>
  /if \(!canSeePricing \|\| !canReadInvoices\) return null;/.test(cardBody) &&
  !!toggleArg &&
  !!levelArgs &&
  hasToggle(member, toggleArg) &&
  hasLevel(member, levelArgs[1], levelArgs[2]);

for (const [name, member] of Object.entries(PEOPLE)) {
  // Everyone is asked against the same company, so the only variable is the
  // grid — the tenant question is section 4's.
  const res = await call(name, `from=${FROM}&to=${TO}`);
  const allowed = res.status !== 403;
  ok(
    `${name}: the card is ${allowed ? "shown" : "hidden"}, matching the route`,
    cardVisibleTo(member) === allowed,
    `card=${cardVisibleTo(member)} route=${res.status}`,
  );
}

// And the limits are stated in front of the button, not only inside the file.
// A bookkeeper who imports this expecting a ledger blames us; the honest place
// to prevent that is before the download.
for (const [what, needle] of [
  ["it is not a filing", /not a filing/i],
  ["no sales-tax return", /sales-tax return/i],
  ["no expense tax or supplier", /no tax and no supplier/i],
  ["no refunds or credit notes", /refunds and no credit notes/i],
  ["no chart of accounts", /chart of accounts/i],
  ["no Stripe fee", /Stripe's fee/i],
  ["UTC days and no issue-date column", /issue-date field/i],
]) {
  ok(`the card says: ${what}`, needle.test(cardBody));
}
ok(
  "…and does not sell itself as a QuickBooks export",
  !/QuickBooks export/i.test(cardBody),
);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails
        .map((f) => `  ✗ ${f}`)
        .join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
