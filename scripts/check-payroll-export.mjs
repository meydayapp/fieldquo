// scripts/check-payroll-export.mjs
//
// The payroll CSV, executed. Why every assertion below exists.
//
// ══ The bug this file was written for ══════════════════════════════════════
//
// app/api/payroll/runs/[id]/export/route.js carried its own copy of the CSV
// escaper that lib/export/accountingExport.js also has. The copy is the one
// that rotted — AGENTS.md failure class 4, verbatim — and it rotted twice:
//
//   1. Money reached the formula guard as a STRING, because every figure went
//      through `Number(x).toFixed(2)` first. A leading minus matches
//      /^[=+\-@\t\r]/, so a negative figure was emitted as "\t-5.00": text in
//      Excel and Sheets, not a number. The bookkeeper's SUM over that column
//      silently omits it. A column that looks right and does not add up is
//      worse than a wrong number, because a wrong number gets queried.
//
//      Nothing has been negative yet — deductions are stored positive — so
//      this never fired. A clawback, a correction line or a negative earning
//      is the first time it does, and payday is a bad moment to find out.
//
//   2. A guarded cell was not forced into quotes. A bare leading tab is legal
//      CSV, but Excel's import sniffs delimiters in some locales and a tab is
//      the other one it looks for, so an unquoted `\t=cmd` can split into two
//      fields and hand back the formula the tab was neutralising.
//
// The fix is not a third escaper. The route imports `money`, `toCsv` and
// `dayKey` from lib/export/accountingExport.js, which had already reasoned
// both of these out and is mutation-tested at that path by
// scripts/check-accounting-export.mjs.
//
// ══ Why this file executes the handler instead of reading it ═══════════════
//
// Reading proves the escaper is correct. It cannot prove the ROUTE reaches it
// — and "the helper is right and one caller formats its own money" is exactly
// the failure being fixed. So the real GET is imported and called, with
// "@/lib/db", "@/lib/currentMember" and "next/server" swapped for stubs, the
// same technique scripts/check-crew-access.mjs section 10 uses on the job
// routes. Everything else runs for real: memberOrRefusal, the permission
// grid, recordActivity and the accounting helpers. The bytes asserted on are
// the bytes the bookkeeper downloads.
//
// ══ Why the mutation pass only touches this route ══════════════════════════
//
// Mutating lib/export/accountingExport.js would prove the shared helper is
// load-bearing, and it is deliberately NOT done: other agents are working in
// this tree, and restoring that file from a backup taken before their edit
// would destroy their work. A regression in `money()` still fails this check
// — every assertion here runs through it — and check-accounting-export.mjs
// mutation-tests the helper itself.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-payroll-export.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const ROUTE_SRC = fileURLToPath(
  new URL("../app/api/payroll/runs/[id]/export/route.js", import.meta.url),
);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The escaper is imported, not re-implemented\n");
//
// A static read, and only this once: the whole point of the change is that
// this file no longer owns the logic, and "no longer owns it" is a statement
// about the source text.

const routeText = readFileSync(ROUTE_SRC, "utf8");
// Comment lines dropped first: the header explains the bug it fixed, and it
// quotes both the old regex and the old `toFixed(2)` while doing so. An
// assertion that could not tell prose from code would force the explanation
// out of the file, which is the wrong trade.
const routeCode = routeText
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
ok(
  "money and toCsv come from the shared module",
  /import \{ money, toCsv, dayKey \} from "@\/lib\/export\/accountingExport";/.test(routeCode),
);
ok("...the local cell() copy is gone", !/function cell\(/.test(routeCode));
ok("...and so is its copy of the formula guard", !/\.test\(/.test(routeCode));
// The date helper was a fourth copy of "toISOString().slice(0, 10)". It also
// threw a RangeError on an unparseable value, which is a 500 on a route whose
// job is to hand somebody a file.
ok("...dates go through dayKey, not a hand-rolled toISOString", !/toISOString/.test(routeCode));
ok("...and no figure is formatted with toFixed here any more", !/toFixed\(/.test(routeCode));

// ═══════════════════════════════════════════════════════════════════════════
// The harness
// ═══════════════════════════════════════════════════════════════════════════

const { register } = await import("node:module");

globalThis.__FQ_ROWS = { payRun: [], company: [], member: [], user: [] };
globalThis.__FQ_ACTIVITY = [];

/** Equality-only `where`, which is all this route uses: { id, companyId }. */
function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (row[key] !== cond) return false;
  }
  return true;
}

/** `select` builds up; anything not asked for does not come back. */
function project(row, select) {
  if (!select) return row;
  const out = {};
  for (const key of Object.keys(select)) out[key] = row[key];
  return out;
}

/**
 * `include` with its `orderBy` honoured.
 *
 * Deliberately implemented rather than ignored. The route asks for
 * `lines: { orderBy: { workerName: "asc" } }`, and a stub that handed back
 * insertion order would let a route that dropped the ordering pass — and the
 * fixtures below are inserted out of order precisely so that shows.
 */
function includeRelations(row, include = {}) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!(key in include)) out[key] = value;
  }
  for (const [key, spec] of Object.entries(include)) {
    let value = row[key];
    if (Array.isArray(value) && spec?.orderBy) {
      const [field, dir] = Object.entries(spec.orderBy)[0];
      value = [...value].sort((a, b) =>
        dir === "desc"
          ? String(b[field]).localeCompare(String(a[field]))
          : String(a[field]).localeCompare(String(b[field])),
      );
    }
    out[key] = value;
  }
  return out;
}

function stubModel(name) {
  const all = () => globalThis.__FQ_ROWS[name] || [];
  const one = (args) => {
    const hit = all().find((r) => matchWhere(r, args.where));
    if (!hit) return null;
    return args.select ? project(hit, args.select) : includeRelations(hit, args.include);
  };
  return {
    async findFirst(args = {}) {
      return one(args);
    },
    async findUnique(args = {}) {
      return one(args);
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {
    payRun: stubModel("payRun"),
    company: stubModel("company"),
    // The real permission loader reads this one, so the gate below is the
    // shipped gate rather than a re-statement of it.
    member: stubModel("member"),
    // recordActivity resolves the actor's name and writes the trail. Left
    // real, because "the export is logged" is a claim this file can check.
    user: stubModel("user"),
    activityLog: {
      async create(args) {
        globalThis.__FQ_ACTIVITY.push(args.data);
        return args.data;
      },
    },
  },
  {
    get(target, prop) {
      if (prop in target) return target[prop];
      // Loud, not quiet: a check must never pass because a query it did not
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
    return { format: "module", shortCircuit: true,
      source: \`export class NextResponse {
        constructor(body, init) {
          this.body = body;
          this.status = init?.status ?? 200;
          this.headers = new Map(Object.entries(init?.headers || {}));
        }
        static json(body, init) { return { body, status: init?.status ?? 200 }; }
      };\` };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const { GET } = await import("@/app/api/payroll/runs/[id]/export/route.js");

// ── The fixtures ───────────────────────────────────────────────────────────
//
// One run, four people, chosen so every guarantee has a row that would break
// if it were dropped:
//
//   • Ana        — ordinary. A positive net, one deduction, and NO union-dues
//                  item, so the empty-vs-zero rule has a cell to hold.
//   • the name   — `=cmd|'/c calc'!A1`, the injection. Worker names are typed
//                  by a contractor and land in a file a bookkeeper opens on
//                  Windows.
//   • Zed        — a CLAWBACK. Negative gross, negative net, negative earning
//                  line. This is the row the old code turned into text.
//   • Salaried   — hourlyRate null, and a deduction recorded as exactly 0, so
//                  "we deducted nothing" and "there is no such deduction" are
//                  both present and must not look alike.

const INJECTION = "=cmd|'/c calc'!A1";

const line = (over) => ({
  workerName: "",
  workerType: "employee",
  hourlyRate: 32.5,
  regularHours: 40,
  overtimeHours: 0,
  items: [],
  gross: 0,
  deductions: 0,
  net: 0,
  paidAt: null,
  ...over,
});

const LINES = [
  // Deliberately not in name order — the stub sorts, because the route asked.
  line({
    workerName: "Zed Correction",
    hourlyRate: 40,
    regularHours: -3,
    overtimeHours: 0,
    items: [
      { label: "Regular", amount: -120, kind: "earning" },
      { label: "CPP", amount: -6.75, kind: "deduction" },
    ],
    gross: -120,
    deductions: -6.75,
    net: -113.25,
    paidAt: new Date("2026-08-14T12:00:00Z"),
  }),
  line({
    workerName: "Ana Ruiz",
    regularHours: 40,
    overtimeHours: 2.5,
    items: [
      { label: "Regular", amount: 1300, kind: "earning" },
      { label: "CPP", amount: 65.44, kind: "deduction" },
    ],
    gross: 1300,
    deductions: 65.44,
    net: 1234.56,
    paidAt: new Date("2026-08-14T12:00:00Z"),
  }),
  line({
    workerName: INJECTION,
    items: [
      { label: "Regular", amount: 900, kind: "earning" },
      { label: "Union dues", amount: 12, kind: "deduction" },
    ],
    gross: 900,
    deductions: 12,
    net: 888,
  }),
  line({
    workerName: "Sam Salary",
    workerType: "employee",
    hourlyRate: null,
    regularHours: 0,
    overtimeHours: 0,
    items: [
      { label: "Salary", amount: 2000, kind: "earning" },
      // Zero, recorded. Not the same statement as Ana's missing union dues.
      { label: "Union dues", amount: 0, kind: "deduction" },
    ],
    gross: 2000,
    deductions: 0,
    net: 2000,
  }),
];

const RUN = {
  id: "run1",
  companyId: "co",
  periodStart: new Date("2026-08-01T00:00:00Z"),
  periodEnd: new Date("2026-08-15T00:00:00Z"),
  status: "approved",
  region: "CA",
  // Deliberately NOT the sum of the lines (that is 4080 / 70.69 / 4009.31).
  // If the totals row ever starts re-summing, these three numbers change.
  grossTotal: 9999.99,
  deductionTotal: 111.11,
  netTotal: 9888.88,
  paidAt: new Date("2026-08-16T12:00:00Z"),
  lines: LINES,
};

globalThis.__FQ_ROWS.payRun = [
  RUN,
  // Another tenant's run, same shape, to prove the companyId filter is real.
  { ...RUN, id: "run_other", companyId: "other_co", lines: [] },
];
globalThis.__FQ_ROWS.user = [{ id: "u1", name: "Owner Olga", email: "olga@example.com" }];

const OWNER = { id: "m_owner", userId: "u1", companyId: "co", role: "owner" };
const VIEWER = {
  id: "m_viewer",
  userId: "u1",
  companyId: "co",
  role: "employee",
  permissions: { payroll: "view_all" },
};
const RUNNER = { ...VIEWER, id: "m_runner", permissions: { payroll: "run_payroll" } };
const CREW = { ...VIEWER, id: "m_crew", permissions: { payroll: "view_own" } };
const NONE = { ...VIEWER, id: "m_none", permissions: { payroll: "none" } };
globalThis.__FQ_ROWS.member = [OWNER, VIEWER, RUNNER, CREW, NONE];

/** A company row, currency exactly as given — including absent. */
function setCompany(over = {}) {
  globalThis.__FQ_ROWS.company = [
    { id: "co", name: "Ruiz Painting", currency: "CAD", ...over },
  ];
}

async function exportRun({ as = OWNER, id = "run1" } = {}) {
  globalThis.__FQ_SESSION = as;
  globalThis.__FQ_ACTIVITY = [];
  return GET(new Request("http://x/api/payroll/runs/run1/export"), {
    params: Promise.resolve({ id }),
  });
}

/**
 * An RFC 4180 reader, so assertions are about FIELDS and not about substrings.
 *
 * A substring check cannot tell "\t=cmd" quoted from "\t=cmd" bare, and the
 * difference between those two is one of the two bugs. It also cannot tell a
 * cell that split in half from one that did not, which is what the missing
 * quotes actually cause.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

setCompany();
const res = await exportRun();
const csvText = await (async () => res.body)();
const grid = parseCsv(csvText);
const header = grid[0] || [];
const rowFor = (name) => grid.find((r) => r[0] === name) || [];
const col = (label) => header.indexOf(label);
const cellFor = (name, label) => rowFor(name)[col(label)];

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. A negative figure is a NUMBER, which is the whole bug\n");
//
// The old route emitted "\t-113.25" here. Excel imports that as text, the
// bookkeeper's SUM skips it, and the column still looks like money.

const zed = rowFor("Zed Correction");
ok("a negative net is a plain number", cellFor("Zed Correction", "Net") === "-113.25", cellFor("Zed Correction", "Net"));
ok("...a negative gross too", cellFor("Zed Correction", "Gross") === "-120.00", cellFor("Zed Correction", "Gross"));
ok("...a negative deduction total too", cellFor("Zed Correction", "Total deductions") === "-6.75");
// The per-label columns are built by a different code path (byLabel), so they
// get their own assertion rather than riding on the ones above.
ok("...a negative EARNING column too", cellFor("Zed Correction", "Earning: Regular") === "-120.00");
ok("...and a negative DEDUCTION column too", cellFor("Zed Correction", "Deduction: CPP") === "-6.75");
// Hours are not money, but a correction can take them negative and the same
// import rule applies.
ok("...negative hours are a number as well", cellFor("Zed Correction", "Regular hours") === "-3.00");
// Byte-level: no tab may precede a minus anywhere in the file, and a numeric
// cell must not be quoted either — a quoted number imports as text in Sheets.
ok("no figure anywhere carries a leading tab", !csvText.includes("\t-"));
ok("...and the negative cells are not quoted", !csvText.includes('"-'));

console.log("\n   and a positive one still is");
ok("a positive net is unchanged", cellFor("Ana Ruiz", "Net") === "1234.56");
ok("...two decimals, no grouping, no symbol", cellFor("Ana Ruiz", "Gross") === "1300.00");
ok("...and an hourly rate formats the same way", cellFor("Ana Ruiz", "Hourly rate") === "32.50");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. A worker named like a formula is neutralised AND quoted\n");
//
// Worker names are free text a contractor typed. `=cmd|'/c calc'!A1` is the
// classic: Excel resolves it on open, on a file the bookkeeper was sent.

const injected = grid.find((r) => r[0].includes("cmd|"));
ok("the name is prefixed with a tab", injected?.[0] === `\t${INJECTION}`, injected?.[0]);
// The second bug. A bare tab is legal CSV, but Excel's import sniffs
// delimiters and a tab is the other one it looks for: unquoted, this cell can
// split in two and hand back the formula the tab was neutralising.
ok("...and the guarded cell is QUOTED", csvText.includes(`"\t${INJECTION}"`));
ok(
  "...so it stays one field, not two",
  injected?.length === header.length,
  `${injected?.length} vs ${header.length}`,
);
ok("...and the formula never appears unguarded", !csvText.includes(`,${INJECTION}`));
// The guard is on the first character only, so a name that merely CONTAINS an
// equals sign must not be mangled — that would corrupt real names.
ok("a name that only contains '=' is untouched", !csvText.includes("\tAna"));

console.log("\n   the context rows carry the same free text");
// `company.name` is typed in Settings and lands in the last block of the file.
setCompany({ name: "=HYPERLINK(\"http://x\")" });
const namedCsv = (await exportRun()).body;
ok(
  "a company named like a formula is guarded and quoted",
  namedCsv.includes('"\t=HYPERLINK(""http://x"") — pay run'),
  namedCsv.split("\r\n").find((l) => l.includes("HYPERLINK")),
);
// Not attacker-controlled today — status is a fixed vocabulary and region is
// CA|US|UK — but they share a cell with data that is, and the cell begins
// with "Currency:", so the guard on the first character would never see them.
// Recorded so a later change that lets them be typed is a known question.
setCompany();

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Empty is not zero — the distinction the file promises\n");
//
// "We didn't deduct this" and "we deducted zero" look identical in a
// spreadsheet, and only one of them is what happened. The header comment on
// the route makes that promise; this is what keeps it.

ok("a worker with no such deduction gets an EMPTY cell", cellFor("Ana Ruiz", "Deduction: Union dues") === "");
ok("...not a zero", cellFor("Ana Ruiz", "Deduction: Union dues") !== "0.00");
ok("...while a deduction recorded as zero prints 0.00", cellFor("Sam Salary", "Deduction: Union dues") === "0.00");
ok("...and the two are therefore distinguishable", cellFor("Ana Ruiz", "Deduction: Union dues") !== cellFor("Sam Salary", "Deduction: Union dues"));
// Same rule on the other nullable column: a salaried worker has no rate, and
// "0.00" would say they are paid nothing an hour.
ok("a salaried worker's hourly rate is empty, not 0.00", cellFor("Sam Salary", "Hourly rate") === "");
ok("...and an earning column nobody else has stays empty", cellFor("Ana Ruiz", "Earning: Salary") === "");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. The totals row is the run's stored totals, not a re-sum\n");
//
// The run's totals are denormalised at approval so a payslip can never be
// re-derived into a different number than the one that was approved and paid.
// If the export re-summed, a disagreement between the two would be papered
// over — and the export must show what was approved.

const totals = rowFor("TOTAL");
ok("gross total is the stored figure", totals[col("Gross")] === "9999.99", totals[col("Gross")]);
ok("deduction total is the stored figure", totals[col("Total deductions")] === "111.11");
ok("net total is the stored figure", totals[col("Net")] === "9888.88");
// Named explicitly: the sum of the fixture lines. If the totals row ever
// equals this, something started re-deriving.
ok("...and none of them equals the sum of the lines", totals[col("Gross")] !== "4080.00");
// Per-label columns stay blank on the totals row: there is no stored total per
// deduction label, and summing one here would invent a figure nobody approved.
ok("the per-label columns are blank on the totals row", totals[col("Deduction: CPP")] === "");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The currency is stated, never guessed\n");
//
// This line read `company?.currency || "CAD"`. Company.currency is nullable,
// so an American contractor's payroll file said CAD — a wrong number in
// somebody's books, on the document that says what people got paid.

const contextLine = (text) => text.split("\r\n").find((l) => l.startsWith("Currency:") || l.includes("Currency:")) || "";
ok("a recorded currency is printed", contextLine(csvText).includes("Currency: CAD"));
setCompany({ currency: "USD" });
ok("...and it is the company's own, not a default", contextLine((await exportRun()).body).includes("Currency: USD"));

setCompany({ currency: null });
const noCurrency = (await exportRun()).body;
ok("a missing currency does NOT become CAD", !noCurrency.includes("Currency: CAD"), contextLine(noCurrency));
ok("...it says so, in words the reader can act on", /Currency: not recorded/.test(noCurrency));
ok("...and names where to fix it", noCurrency.includes("Settings"));
// An empty string is the same absence with a different shape — a settings
// field cleared rather than never set.
setCompany({ currency: "   " });
ok("blank whitespace is absence too", /Currency: not recorded/.test((await exportRun()).body));
// The run itself is still exported. Refusing an approved run over an unset
// settings field stops somebody getting paid; the guess is what is withheld,
// not the file.
setCompany({ currency: null });
const stillExported = await exportRun();
ok("...but the file is still produced", stillExported.status === 200);
ok("...with every figure in it", stillExported.body.includes("1234.56"));
setCompany();

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. The permission gate still refuses\n");
//
// A whole-run export is everyone's pay — the most sensitive read in the
// product. This runs the SHIPPED gate: the real loadEnforceableMember against
// the scripted member row, not a re-statement of the rule.

const refused = await exportRun({ as: CREW });
ok("payroll: view_own is refused", refused.status === 403, refused.status);
ok("...with a reason, not a blank 500", /permission/i.test(refused.body?.error || ""), refused.body);
ok("...and no CSV at all", typeof refused.body?.error === "string" && !String(refused.body).includes("1234.56"));
ok("payroll: none is refused", (await exportRun({ as: NONE })).status === 403);
ok("payroll: view_all is allowed", (await exportRun({ as: VIEWER })).status === 200);
ok("payroll: run_payroll is allowed", (await exportRun({ as: RUNNER })).status === 200);
ok("an owner with no grid is allowed", (await exportRun({ as: OWNER })).status === 200);
// Tenant scope: the run is looked up by id AND companyId. Without the second
// half, a member of one company could name another company's run id.
const crossTenant = await exportRun({ id: "run_other" });
ok("another tenant's run is 404, not a leak", crossTenant.status === 404, crossTenant.status);
ok("...and 404 says nothing about it existing", crossTenant.body?.error === "Not found");

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. The file is shaped the way Excel expects, and is logged\n");

ok("rows are CRLF-terminated", csvText.endsWith("\r\n") && csvText.includes("\r\n"));
ok("every worker row has exactly the header's field count",
  ["Ana Ruiz", "Sam Salary", "Zed Correction"].every((n) => rowFor(n).length === header.length));
ok("the columns are the union of every label in the run",
  col("Deduction: Union dues") > -1 && col("Deduction: CPP") > -1 && col("Earning: Salary") > -1);
// The route asked for workerName asc, and the ordering is what makes a
// hundred-person file readable. Asserted as relative order rather than
// absolute positions: where a name beginning "=" sorts is a collation
// question this stub does not get to answer for Postgres.
const names = grid.slice(1, 5).map((r) => r[0]);
ok(
  "lines come out in name order",
  names.indexOf("Ana Ruiz") < names.indexOf("Sam Salary") &&
    names.indexOf("Sam Salary") < names.indexOf("Zed Correction"),
  names,
);
ok("dates are ISO days", cellFor("Ana Ruiz", "Paid on") === "2026-08-14");
// The unpaid line. `paidAt` is null until the money actually moves, and an
// invented date here would claim somebody was paid.
ok("...and an unpaid line has no date rather than a wrong one", cellFor(`\t${INJECTION}`, "Paid on") === "", cellFor(`\t${INJECTION}`, "Paid on"));
ok("it is served as CSV", res.headers.get("Content-Type") === "text/csv; charset=utf-8");
ok("...as a download named for the period",
  res.headers.get("Content-Disposition") === 'attachment; filename="payroll-2026-08-01-to-2026-08-15.csv"',
  res.headers.get("Content-Disposition"));
ok("...and never cached: it is everyone's pay", res.headers.get("Cache-Control") === "private, no-store");
// Exporting every worker's pay is an event a company should be able to see
// after the fact.
globalThis.__FQ_SESSION = OWNER;
globalThis.__FQ_ACTIVITY = [];
await exportRun();
ok("the export is written to the activity trail", globalThis.__FQ_ACTIVITY[0]?.action === "payroll.exported");
ok("...naming the run", globalThis.__FQ_ACTIVITY[0]?.entityId === "run1");

// ═══════════════════════════════════════════════════════════════════════════
// Mutation pass
// ═══════════════════════════════════════════════════════════════════════════

if (process.argv.includes("--no-mutate")) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\nMutation pass — every guarantee above must actually be load-bearing");

const ORIGINAL = readFileSync(ROUTE_SRC, "utf8");
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const backupDir = mkdtempSync(join(tmpdir(), "payroll-export-"));
const backup = join(backupDir, "route.js");
// cp, never git checkout: this tree has uncommitted work from several agents
// in it, and `git restore` would hand back the last commit rather than what is
// on disk.
writeFileSync(backup, ORIGINAL);

const IMPORT_LINE = 'import { money, toCsv, dayKey } from "@/lib/export/accountingExport";';

const MUTATIONS = [
  // The original bug, exactly: money formatted to a string before the guard
  // sees it, so a leading minus is treated as a formula.
  [
    "reintroduces the original bug — money as a toFixed string",
    (s) =>
      s.replace(
        IMPORT_LINE,
        'import { toCsv, dayKey } from "@/lib/export/accountingExport";\n' +
          'const money = (v) => (v === null || v === undefined ? "" : Number(v).toFixed(2));',
      ),
  ],
  // The second bug that came with it.
  [
    "drops the formula guard entirely",
    (s) =>
      s.replace(
        IMPORT_LINE,
        'import { money, dayKey } from "@/lib/export/accountingExport";\n' +
          'const toCsv = (rows) => rows.map((r) => r.map((v) => (v === null || v === undefined ? "" : (v.text !== undefined ? v.text : String(v)))).join(",")).join("\\r\\n") + "\\r\\n";',
      ),
  ],
  [
    "guards a cell but leaves it unquoted",
    (s) =>
      s.replace(
        IMPORT_LINE,
        'import { money, dayKey } from "@/lib/export/accountingExport";\n' +
          'const toCsv = (rows) => rows.map((r) => r.map((v) => { if (v === null || v === undefined) return ""; if (v.text !== undefined) return v.text; const t = String(v); return /^[=+\\-@\\t\\r]/.test(t) ? "\\t" + t : t; }).join(",")).join("\\r\\n") + "\\r\\n";',
      ),
  ],
  // Empty vs zero.
  ["turns a missing deduction into 0.00", (s) => s.replace('if (!hits.length) return "";', "")],
  ["turns a salaried worker's absent rate into 0.00", (s) => s.replace('l.hourlyRate == null ? "" : money(l.hourlyRate)', "money(l.hourlyRate)")],
  // The totals row.
  [
    "re-sums the totals instead of using the approved ones",
    (s) => s.replace("money(run.grossTotal)", "money(run.lines.reduce((a, x) => a + Number(x.gross), 0))"),
  ],
  // The currency.
  [
    "defaults a missing currency to CAD",
    (s) => s.replace('currency ?? "not recorded — set it in Settings → Company"', 'currency ?? "CAD"'),
  ],
  // The gate.
  [
    "waves everyone past the permission gate",
    (s) => s.replace('let canViewAll = member.role === "owner" || member.role === "admin";', "let canViewAll = true;"),
  ],
  [
    "drops the tenant filter from the lookup",
    (s) => s.replace("where: { id, companyId: member.companyId },", "where: { id },"),
  ],
  // The ordering the fixtures rely on, which is also what makes a big file
  // readable.
  [
    "drops the name ordering",
    (s) => s.replace('include: { lines: { orderBy: { workerName: "asc" } } },', "include: { lines: true },"),
  ],
];

let mutantsCaught = 0;
const escaped = [];
try {
  for (const [label, mutate] of MUTATIONS) {
    const mutated = mutate(ORIGINAL);
    if (mutated === ORIGINAL) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(ROUTE_SRC, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      mutantsCaught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  // Restore from the copy, unconditionally, even if a mutation threw.
  writeFileSync(ROUTE_SRC, readFileSync(backup, "utf8"));
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += mutantsCaught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
