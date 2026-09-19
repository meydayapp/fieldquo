// scripts/check-quote-decision.mjs
//
// The client's answer, recorded by hand on the quote page.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-quote-decision.mjs
//
// ══ What the owner found ═══════════════════════════════════════════════════
//
// "The quotes don't have a way to have them be rejected if it was sent and
// the client didn't move forward." PATCH /api/quotes/[id] had accepted
// `status: "declined"` (+ declineReason) all along, and the quote page's own
// updateStatus() had no button calling it — the only door was the approval
// page, behind a button called "Get approved" that nobody looking for "they
// said no" would press.
//
// ══ What this executes ═════════════════════════════════════════════════════
//
// The REAL PATCH handler, against a scripted database, with the lifecycle
// hooks recorded rather than run (they create jobs and invoices, which is a
// different check's business): a sent quote is declined with the reason,
// accepted with the hooks, reopened from declined without re-stamping its
// issue date; a draft cannot be decided; an accepted quote cannot be left; a
// garbage status is a 400 not a 500; the activity names who did it. The page
// is JSX and is asserted as text: the buttons exist on a sent quote, the
// dialogs confirm before anything is sent, the quick picks fill (not replace)
// the free-text reason, the reopen exists for declined and not for accepted.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { register } from "node:module";

import { PERMISSION_PRESETS } from "@/lib/permissions";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

let pass = 0;
let fail = 0;
const t = (name, got, want = true) => {
  const ok = String(got) === String(want);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "  ok  " : "  FAIL"} ${name}${ok ? "" : `  got=${got} want=${want}`}`);
};

// ═══════════════════════════════════════════════════════════════════════════
// The scripted database
// ═══════════════════════════════════════════════════════════════════════════

globalThis.__FQ_ROWS = {};
globalThis.__FQ_WRITES = [];
globalThis.__FQ_HOOKS = [];

function matchWhere(row, where) {
  if (!where) return true;
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") {
      if (!(Array.isArray(cond) ? cond : [cond]).every((c) => matchWhere(row, c))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(Array.isArray(cond) ? cond : [cond]).some((c) => matchWhere(row, c))) return false;
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
      if ("not" in cond) {
        if (cond.not === null ? value == null : value === cond.not) return false;
        continue;
      }
      if ("equals" in cond) {
        if (String(value) !== String(cond.equals)) return false;
        continue;
      }
      if (!matchWhere(value, cond)) return false;
      continue;
    }
    if (value instanceof Date && cond instanceof Date) {
      if (value.getTime() !== cond.getTime()) return false;
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

function project(row, spec = {}) {
  if (!row) return row;
  if (spec.select) {
    const out = {};
    for (const [key, sub] of Object.entries(spec.select)) {
      if (sub === true) out[key] = row[key];
      else if (Array.isArray(row[key])) out[key] = row[key].map((v) => project(v, sub));
      else out[key] = project(row[key], sub);
    }
    return out;
  }
  return { ...row };
}

function stubModel(name) {
  const all = () => (globalThis.__FQ_ROWS[name] ||= []);
  const note = (op, args) => globalThis.__FQ_WRITES.push({ model: name, op, args });
  return {
    async findMany(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).map((r) => project(r, args));
    },
    async findFirst(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? project(hit, args) : null;
    },
    async findUnique(args = {}) {
      const hit = all().find((r) => matchWhere(r, args.where));
      return hit ? project(hit, args) : null;
    },
    async count(args = {}) {
      return all().filter((r) => matchWhere(r, args.where)).length;
    },
    async create(args = {}) {
      note("create", args);
      const row = { id: `${name}_${all().length + 1}`, ...args.data };
      all().push(row);
      return row;
    },
    async update(args = {}) {
      note("update", args);
      const hit = all().find((r) => matchWhere(r, args.where));
      if (!hit) {
        const err = new Error("Record to update not found.");
        err.code = "P2025";
        throw err;
      }
      const { costing, ...data } = args.data || {};
      Object.assign(hit, data, { updatedAt: new Date() });
      return hit;
    },
    async updateMany(args = {}) {
      note("updateMany", args);
      const hits = all().filter((r) => matchWhere(r, args.where));
      for (const h of hits) Object.assign(h, args.data);
      return { count: hits.length };
    },
    async deleteMany(args = {}) {
      note("deleteMany", args);
      const keep = all().filter((r) => !matchWhere(r, args.where));
      const count = all().length - keep.length;
      globalThis.__FQ_ROWS[name] = keep;
      return { count };
    },
  };
}

const MODELS = ["member", "quote", "user", "activityLog", "company", "client"];
const stubDb = Object.fromEntries(MODELS.map((m) => [m, stubModel(m)]));
// The stale-write guard records who last edited (lib/concurrency/staleWrite.js);
// best-effort there, and not what this check is about.
stubDb.recordEdit = { findUnique: async () => null, upsert: async () => null };
stubDb.$transaction = async (fn) => fn(globalThis.__FQ_DB);
globalThis.__FQ_DB = new Proxy(stubDb, {
  get(target, prop) {
    if (prop in target) return target[prop];
    if (typeof prop === "symbol" || prop === "then") return undefined;
    throw new Error(`dbStub: db.${String(prop)} is not scripted in this check`);
  },
});
globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "@/lib/quotes/quoteLifecycle": "fq-stub:lifecycle",
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
  if (url === "fq-stub:lifecycle") {
    return { format: "module", shortCircuit: true, source: \`
const rec = (name) => async (...a) => { globalThis.__FQ_HOOKS.push([name, ...a]); return name === "onQuoteAccepted" ? { job: { id: "job_1" }, invoice: { id: "inv_1", invoiceNumber: "INV-7" } } : undefined; };
export const onQuoteAccepted = rec("onQuoteAccepted");
export const onQuoteDeclined = rec("onQuoteDeclined");
export const onQuoteSent = rec("onQuoteSent");
\` };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true, source: \`
export class NextResponse {
  constructor(body, init) { this.body = body; this.status = init?.status ?? 200; }
  static json(body, init) { const r = new NextResponse(body, init); r.json = async () => body; return r; }
}\` };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const route = await import("@/app/api/quotes/[id]/route.js");

// ═══════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════

const CO = "co";
const SENT_AT = new Date("2026-09-01T10:00:00Z");
const quote = (id, status, extra = {}) => ({
  id,
  companyId: CO,
  quoteNumber: `Q-${id}`,
  status,
  clientId: "c1",
  client: { id: "c1", name: "Dana" },
  subtotal: 1000,
  discount: 0,
  tax: 0,
  total: 1000,
  scopeGroups: [],
  costing: null,
  assignedTo: null,
  assignedToId: null,
  sentAt: status === "draft" ? null : SENT_AT,
  acceptedAt: null,
  declinedAt: null,
  declineReason: null,
  historicalImportedAt: null,
  updatedAt: new Date("2026-09-02T10:00:00Z"),
  ...extra,
});

const PEOPLE = {
  owner: { id: "m_owner", userId: "u1", companyId: CO, role: "owner", permissions: null },
  viewer: {
    id: "m_viewer",
    userId: "u1",
    companyId: CO,
    role: "employee",
    permissions: { ...PERMISSION_PRESETS.worker.values, quotes: "view_only" },
  },
  editor: {
    id: "m_editor",
    userId: "u2",
    companyId: CO,
    role: "employee",
    permissions: { ...PERMISSION_PRESETS.estimator.values, quotes: "view_create_edit" },
  },
};

function reset() {
  globalThis.__FQ_ROWS = {
    member: Object.values(PEOPLE),
    user: [
      { id: "u1", name: "Dana Owner", email: "dana@x.com" },
      { id: "u2", name: null, email: "sam@x.com" },
    ],
    company: [{ id: CO, currency: "CAD" }],
    client: [{ id: "c1", name: "Dana" }],
    quote: [
      quote("sent1", "sent"),
      quote("sent2", "sent"),
      quote("draft1", "draft"),
      quote("acc1", "accepted", { acceptedAt: new Date("2026-09-03T10:00:00Z") }),
      quote("dec1", "declined", { declinedAt: new Date("2026-09-04T10:00:00Z"), declineReason: "Too expensive" }),
    ],
    activityLog: [],
  };
  globalThis.__FQ_WRITES = [];
  globalThis.__FQ_HOOKS = [];
}

async function patch(who, id, body) {
  const row = PEOPLE[who];
  globalThis.__FQ_SESSION = { id: row.id, userId: row.userId, companyId: row.companyId, role: row.role };
  const req = {
    url: `http://local/api/quotes/${id}`,
    method: "PATCH",
    headers: new Map(),
    json: async () => body,
  };
  const res = await route.PATCH(req, { params: Promise.resolve({ id }) });
  const data = await res.json();
  return { status: res.status, data };
}
const row = (id) => globalThis.__FQ_ROWS.quote.find((q) => q.id === id);
const activity = () => globalThis.__FQ_ROWS.activityLog;

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. A sent quote is declined by hand, with the client's words");
reset();
let r = await patch("owner", "sent1", { status: "declined", declineReason: "  Went with another quote — $800 under us.  " });
t("200", r.status, 200);
t("the row is declined", row("sent1").status, "declined");
t("the decline hook ran with the trimmed reason", JSON.stringify(globalThis.__FQ_HOOKS[0]), JSON.stringify(["onQuoteDeclined", "sent1", { reason: "Went with another quote — $800 under us." }]));
t("the activity names who did it and the reason", activity()[0]?.summary, "Quote Q-sent1 marked declined by Dana Owner — Went with another quote — $800 under us.");
t("the issue date is untouched", row("sent1").sentAt.getTime(), SENT_AT.getTime());

reset();
r = await patch("owner", "sent1", { status: "declined" });
t("no reason → the hook gets null, not an empty string", globalThis.__FQ_HOOKS[0]?.[2]?.reason, null);
t("...and the summary says nothing about a reason", activity()[0]?.summary, "Quote Q-sent1 marked declined by Dana Owner");

reset();
r = await patch("editor", "sent2", { status: "declined", declineReason: "x".repeat(900) });
t("a member with view_create_edit may decide", r.status, 200);
t("an over-long reason is cut to 500", globalThis.__FQ_HOOKS[0]?.[2]?.reason.length, 500);
t("a member with no name is named by email", /by sam@x.com/.test(activity()[0]?.summary));

console.log("\n2. A sent quote is accepted by hand — the same hooks as an online approval");
reset();
r = await patch("owner", "sent1", { status: "accepted" });
t("200", r.status, 200);
t("the row is accepted", row("sent1").status, "accepted");
t("onQuoteAccepted ran with the member as creator", JSON.stringify(globalThis.__FQ_HOOKS[0]), JSON.stringify(["onQuoteAccepted", "sent1", { createdById: "u1" }]));
t("the activity says 'marked accepted by Dana Owner' and what came of it", activity()[0]?.summary, "Quote Q-sent1 marked accepted by Dana Owner — job created, ready to schedule, invoice INV-7 drafted");
t("...and links the job and invoice", JSON.stringify(activity()[0]?.metadata), JSON.stringify({ jobId: "job_1", invoiceId: "inv_1" }));

console.log("\n3. Reopen: declined → sent, once, without re-stamping the issue date");
reset();
r = await patch("owner", "dec1", { status: "sent" });
t("200", r.status, 200);
t("the row is sent again", row("dec1").status, "sent");
t("the decision is cleared so a second decline stamps afresh", row("dec1").declinedAt === null && row("dec1").declineReason === null);
t("sentAt is the ORIGINAL issue date, not now", row("dec1").sentAt.getTime(), SENT_AT.getTime());
t("the lead is moved back with the quote", globalThis.__FQ_HOOKS[0]?.[0], "onQuoteSent");
t("the activity says reopened by whom", activity()[0]?.summary, "Quote Q-dec1 reopened by Dana Owner — the client is reconsidering");
r = await patch("owner", "dec1", { status: "declined", declineReason: "Still too expensive" });
t("...and it can be declined again afterwards", r.status === 200 && row("dec1").status === "declined");

console.log("\n4. The moves that are not real");
reset();
r = await patch("owner", "acc1", { status: "declined" });
t("leaving accepted is refused with 409", r.status, 409);
t("...in words that name the job", /job came from it/.test(r.data.error));
t("...and nothing ran", globalThis.__FQ_HOOKS.length === 0 && row("acc1").status === "accepted");
r = await patch("owner", "acc1", { status: "sent" });
t("accepted cannot be reopened either", r.status, 409);
r = await patch("owner", "draft1", { status: "declined" });
t("declining a draft is refused with 400", r.status, 400);
t("...saying to send it first", /Send the quote first/.test(r.data.error));
r = await patch("owner", "draft1", { status: "accepted" });
t("accepting a draft is refused too", r.status, 400);
r = await patch("owner", "sent1", { status: "voided" });
t("a garbage status is a 400, not a Prisma 500", r.status, 400);
t("...and the row is untouched", row("sent1").status, "sent");
r = await patch("owner", "sent1", { status: "sent" });
t("re-saving the same status is not a transition", r.status === 200 && globalThis.__FQ_HOOKS.length === 0);
r = await patch("owner", "sent1", { notes: "call back Tuesday" });
t("a PATCH with no status still saves", r.status === 200 && row("sent1").notes === "call back Tuesday");

console.log("\n5. Who may, and whose");
reset();
r = await patch("viewer", "sent1", { status: "declined" });
t("view_only is refused", r.status, 403);
t("...and the row stays sent", row("sent1").status, "sent");
reset();
globalThis.__FQ_ROWS.quote.push({ ...quote("foreign1", "sent"), companyId: "other" });
r = await patch("owner", "foreign1", { status: "declined" });
t("another company's quote is a 404", r.status, 404);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The quote page: the buttons, the dialogs, the reopen");
const PAGE = read("app/app/quotes/[id]/page.js");
const bar = PAGE.slice(PAGE.indexOf('t("app.quoteDetail.getApproved")'), PAGE.indexOf("canDuplicateQuote &&"));
t("a 'Client didn't go ahead' button exists on a sent quote", /quote\.status === "sent" && !quote\.historicalImportedAt && \(\s*<>[\s\S]*?setDecision\("declined"\)/.test(bar));
t("a 'Client accepted' button exists beside it", /setDecision\("accepted"\)/.test(bar));
t("both are gated on the route's rung (view_create_edit)", /const canDecide = hasLevel\(caller, "quotes", "view_create_edit"\)/.test(PAGE) && /canDecide && quote\.status === "sent"/.test(bar));
t("neither shows on a past job", /canDecide && quote\.status === "sent" && !quote\.historicalImportedAt/.test(bar));
t("Reopen shows only for a declined quote", /canDecide && quote\.status === "declined" && !quote\.historicalImportedAt && \(\s*<button[\s\S]*?updateStatus\("sent"\)/.test(bar));
t("nothing offers a way out of accepted", !/quote\.status === "accepted"[\s\S]{0,300}updateStatus\("sent"\)/.test(PAGE));
t("the dialog is the only thing that PATCHes a decision", (PAGE.match(/updateStatus\("declined"/g) || []).length === 1 && (PAGE.match(/updateStatus\("accepted"\)/g) || []).length === 1);
t("...and it lives in a confirm dialog with a Cancel", /function DecisionDialog/.test(PAGE) && /role="dialog"/.test(PAGE) && /t\("app\.action\.cancel", "Cancel"\)/.test(PAGE.slice(PAGE.indexOf("function DecisionDialog"))));
t("the reason is optional free text", /<textarea[\s\S]*?maxLength=\{500\}[\s\S]*?value=\{reason\}/.test(PAGE));
t("the quick picks fill the box rather than replacing it", /onClick=\{\(\) => onReason\(t\(`app\.quoteDetail\.declinePick_\$\{key\}`, english\)\)\}/.test(PAGE));
t("the three picks are the owner's", /\["another", "Went with another quote"\],\s*\["postponed", "Postponed"\],\s*\["price", "Too expensive"\]/.test(PAGE));
t("a blank reason sends no declineReason at all", /declineReason\.trim\(\) \? \{ declineReason: declineReason\.trim\(\) \} : \{\}/.test(PAGE));
t("the accept dialog says a job is created and a deposit invoice may be drafted", /"app\.quoteDetail\.acceptBody": "[^"]*job is created[^"]*deposit invoice is drafted/.test(read("app/i18n/appMessages.js")));
t("the server's refusal is shown as-is", /\(await res\.json\(\)\.catch\(\(\) => null\)\)\?\.error \|\|/.test(PAGE));
t("the recorded reason is shown on the page", /data-declined-note/.test(PAGE) && /declinedWithReason", \{ reason: quote\.declineReason \}/.test(PAGE));
t("the dialog does not close itself on confirm — the page closes it on a 200", /if \(res\.ok\) \{\s*setQuote\(await res\.json\(\)\);\s*setDecision\(null\);/.test(PAGE));

const MSGS = read("app/i18n/appMessages.js");
for (const key of ["markAccepted", "markDeclined", "reopen", "declineTitle", "declineBody", "declineConfirm", "acceptTitle", "acceptBody", "acceptConfirm", "declinedWithReason", "declinedNoReason", "declinePick_another", "declinePick_postponed", "declinePick_price"]) {
  t(`app.quoteDetail.${key} is in nine languages`, (MSGS.match(new RegExp(`"app\\.quoteDetail\\.${key}":`, "g")) || []).length, 9);
}

console.log("\n7. The win/loss report still reads the same column");
t("win-loss reads declineReason", /declineReason/.test(read("app/api/analytics/win-loss/route.js")));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
