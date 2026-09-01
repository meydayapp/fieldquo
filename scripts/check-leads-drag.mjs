// scripts/check-leads-drag.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-leads-drag.mjs
//
// Drag-to-move on the leads board (app/app/leads/page.js) — four claims,
// each one a documented failure class from AGENTS.md, and each one EXECUTED
// rather than read where the module makes that possible:
//
//   1. THE TRAP. "Converted" is Won, and lib/leads/pipeline.js's
//      canSetLeadStatus is the one place that decides whether a lead may
//      reach it. A drop into Converted with no quote behind the lead must be
//      refused — not silently downgraded to a no-op, not auto-converted as a
//      side effect of a slide gesture — with a reason a person can read.
//      canSetLeadStatus is pure, so it is executed directly against hostile
//      input (section 1), and then the SAME question is asked of the two
//      PATCH routes that actually write the column (section 2), because a
//      rule that only the client enforces is a rule an attacker skips.
//
//   2. PERMISSION, SERVER-SIDE. The drawer's status buttons have always
//      relied on the server refusing rather than on a client-side check —
//      this board does the same, deliberately (see the comment in
//      app/app/leads/page.js on why one client-side check exists at all: to
//      avoid a wasted round trip, not to be the gate). Section 2 executes
//      both PATCH handlers as a member whose grid sits below
//      requests:view_create_edit and confirms they are refused AND that no
//      write is attempted — a silent no-op that returns 200 would be just as
//      wrong as a write.
//
//   3. REVERT ON FAILURE. The reference Trello clone this feature is modelled
//      on applied a drop locally and never rolled back when the server
//      refused it. Section 3 reads app/app/leads/page.js's moveLead function
//      — and only that function, not the file at large — and proves the
//      optimistic status change and its rollback both exist, scoped so a
//      change elsewhere in the file can't make this pass by accident.
//
//   4. THE NON-DRAG PATH STILL WORKS. Mobile users get the drawer's buttons,
//      not the drag board (AGENTS.md: contractors run this "from a van", one
//      thumb, on a bad connection). Section 3 also confirms LEAD_STATUSES
//      still drives an unconditionally-rendered button row wired to the same
//      PATCH the drawer always used, and section 5 confirms @dnd-kit is the
//      library in use — never @hello-pangea/dnd, whose React 19 support is
//      unverified and this app is on React 19.
//
// ── Why sections 2's routes are EXECUTED, not read ──────────────────────────
//
// A regex over a route file proves a gate is written down, and passes exactly
// as happily against `requireLevel(...)` commented out, or wired to the wrong
// category, as it does against the real thing — check-trade-gate.mjs and
// check-win-loss.mjs both say so and both execute for it. "@/lib/db",
// "@/lib/currentMember" and "next/server" are swapped for stubs (same
// technique, inlined rather than shared, because the fixture shape here —
// one leadRequest table, one member table — is smaller than any existing
// harness's) so the real PATCH handlers run against a scripted database.
//
// ── Comments stripped before any regex over source ──────────────────────────
//
// A header comment describing the trap in prose (this file has several) would
// make a naive grep for "canSetLeadStatus" pass whether or not the code below
// it actually calls it. Every source-text assertion below runs on
// stripComments() output, and every positional assertion is scoped to ONE
// function's body — sliced out by brace-matching, not by an end-of-file regex
// — so a change to an unrelated function can't accidentally satisfy it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { register } from "node:module";

import {
  LEAD_STATUSES,
  isValidLeadStatus,
  canSetLeadStatus,
} from "@/lib/leads/pipeline";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let checks = 0;
let failures = 0;
function ok(name, pass, detail) {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail !== undefined ? `  — ${JSON.stringify(detail)}` : ""}`);
}
function section(s) {
  console.log(`\n${s}\n`);
}

// Line comments first, then block comments — reversed, a `/*` inside a
// header's own prose (this file has several) would open a block comment that
// swallows real code before the next `*/`. Matches check-trade-gate.mjs.
function stripComments(src) {
  return src.replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/** The source of one named function, brace-matched from its `function NAME(` (or `async function NAME(`). */
function functionBody(src, name) {
  const m = src.match(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`));
  if (!m) throw new Error(`function ${name} not found`);
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  for (; i < src.length && depth > 0; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") depth--;
  }
  return src.slice(start, i);
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. canSetLeadStatus / isValidLeadStatus, EXECUTED against hostile input");
// ═══════════════════════════════════════════════════════════════════════════

ok("LEAD_STATUSES is exactly the board's four columns, in board order",
  JSON.stringify(LEAD_STATUSES) === JSON.stringify(["new", "contacted", "converted", "lost"]),
  LEAD_STATUSES);

ok("isValidLeadStatus('converted') is true", isValidLeadStatus("converted") === true);
ok("isValidLeadStatus('won') is false — there is no separate won value", isValidLeadStatus("won") === false);
ok("isValidLeadStatus(null) is false", isValidLeadStatus(null) === false);
ok("isValidLeadStatus(undefined) is false", isValidLeadStatus(undefined) === false);
ok("isValidLeadStatus(123) is false (a number, not a string)", isValidLeadStatus(123) === false);
ok("isValidLeadStatus('') is false", isValidLeadStatus("") === false);

// THE TRAP, in the pure function that both routes and the client share.
ok("canSetLeadStatus(null, 'converted') refuses — no lead, nothing to point at",
  canSetLeadStatus(null, "converted").ok === false);
ok("canSetLeadStatus(undefined, 'converted') refuses",
  canSetLeadStatus(undefined, "converted").ok === false);
ok("canSetLeadStatus({}, 'converted') refuses — a real lead, but no quote",
  canSetLeadStatus({}, "converted").ok === false);
ok("canSetLeadStatus({ quoteId: null }, 'converted') refuses — quoteId explicitly absent",
  canSetLeadStatus({ quoteId: null }, "converted").ok === false);
ok("…the refusal names the reason, not just false",
  typeof canSetLeadStatus({}, "converted").reason === "string" &&
    canSetLeadStatus({}, "converted").reason.length > 0);
ok("canSetLeadStatus({ quoteId: 'q_1' }, 'converted') is allowed — a quote exists",
  canSetLeadStatus({ quoteId: "q_1" }, "converted").ok === true);
ok("canSetLeadStatus({ quote: { id: 'q_1' } }, 'converted') is allowed — the nested include also counts",
  canSetLeadStatus({ quote: { id: "q_1" } }, "converted").ok === true);
ok("canSetLeadStatus({ quoteId: '', quote: null }, 'converted') refuses — an empty string is not an id",
  canSetLeadStatus({ quoteId: "", quote: null }, "converted").ok === false);

// The rule is SPECIFIC to "converted" — every other transition is unaffected
// by whether a quote exists, in either direction.
ok("canSetLeadStatus({}, 'new') is allowed with no quote at all",
  canSetLeadStatus({}, "new").ok === true);
ok("canSetLeadStatus({}, 'contacted') is allowed with no quote at all",
  canSetLeadStatus({}, "contacted").ok === true);
// "lost" needs no quote either way — but, separately, it DOES need a real
// reason (see the block below this one), so these two pass one to isolate
// the thing they're actually testing: the quote rule, not the reason rule.
ok("canSetLeadStatus({}, 'lost', { lostReason: 'other' }) is allowed with no quote at all",
  canSetLeadStatus({}, "lost", { lostReason: "other" }).ok === true);
ok("canSetLeadStatus({ quoteId: 'q_1' }, 'lost', { lostReason: 'other' }) is ALSO allowed — having a quote doesn't lock a lead out of Lost",
  canSetLeadStatus({ quoteId: "q_1" }, "lost", { lostReason: "other" }).ok === true);

// The SEPARATE rule "lost" is the one status transition that DOES need — a
// real, closed-vocabulary lostReason, new or already on the lead. See this
// file's own header comment for why (docs/META-ADS-INTEGRATION.md Part 2b).
ok("canSetLeadStatus({}, 'lost') with NO reason at all, new or existing, refuses",
  canSetLeadStatus({}, "lost").ok === false);
ok("canSetLeadStatus({}, 'lost', { lostReason: 'not_a_real_code' }) refuses — not in the closed vocabulary",
  canSetLeadStatus({}, "lost", { lostReason: "not_a_real_code" }).ok === false);
ok("canSetLeadStatus({ lostReason: 'price_too_high' }, 'lost') — a re-drag with an EXISTING reason and none new is allowed",
  canSetLeadStatus({ lostReason: "price_too_high" }, "lost").ok === true);

// Invalid enum values are refused independently of the quote rule.
ok("canSetLeadStatus({ quoteId: 'q_1' }, 'won') refuses — not a real status, even with a quote",
  canSetLeadStatus({ quoteId: "q_1" }, "won").ok === false);
ok("canSetLeadStatus({}, 'DROP TABLE leads') refuses harmlessly",
  canSetLeadStatus({}, "DROP TABLE leads").ok === false);
ok("canSetLeadStatus({}, null) refuses", canSetLeadStatus({}, null).ok === false);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Both PATCH routes, EXECUTED against a stubbed db and session");
// ═══════════════════════════════════════════════════════════════════════════
//
// Section 8 of check-crew-access.mjs (and check-win-loss.mjs section 9 after
// it) explain why a regex is not enough for a permission gate: it proves the
// gate is written down and passes exactly as happily against one that is
// disabled or wired to the wrong category. So the real handlers run.

function matchWhere(row, where = {}) {
  if (!row) return false;
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (row[key] !== cond) return false;
  }
  return true;
}

function makeDb() {
  const writes = [];
  const leadRequest = {
    async findFirst({ where } = {}) {
      return globalThis.__FQ_ROWS.leadRequest.find((r) => matchWhere(r, where)) || null;
    },
    async update({ where, data } = {}) {
      const row = globalThis.__FQ_ROWS.leadRequest.find((r) => matchWhere(r, where));
      writes.push({ model: "leadRequest", action: "update", where, data });
      if (!row) return null;
      Object.assign(row, data);
      return { ...row };
    },
  };
  const member = {
    async findUnique({ where } = {}) {
      return globalThis.__FQ_ROWS.member.find((r) => matchWhere(r, where)) || null;
    },
  };
  return {
    writes,
    db: new Proxy(
      { leadRequest, member },
      {
        get(target, prop) {
          if (prop in target) return target[prop];
          throw new Error(`stub db.${String(prop)} is not scripted in this check`);
        },
      },
    ),
  };
}

let currentDb;
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

const bulkRoute = await import("@/app/api/leads/route.js");
const singleRoute = await import("@/app/api/leads/[id]/route.js");

const COMPANY = "co_1";
const OTHER_COMPANY = "co_2";

function resetFixtures() {
  currentDb = makeDb();
  globalThis.__FQ_DB = currentDb.db;
  globalThis.__FQ_ROWS = {
    member: [
      { id: "m_edit", userId: "u_edit", role: "employee", companyId: COMPANY,
        permissions: { requests: "view_create_edit" } },
      { id: "m_view", userId: "u_view", role: "employee", companyId: COMPANY,
        permissions: { requests: "view_only" } },
      { id: "m_none", userId: "u_none", role: "employee", companyId: COMPANY,
        permissions: { requests: "none" } },
      // Owner/admin bypass the grid entirely (UNRESTRICTED_ROLES in
      // lib/permissions/enforce.js) — worth asserting so a future change to
      // that set is caught here too, not just in the check that owns it.
      { id: "m_owner", userId: "u_owner", role: "owner", companyId: COMPANY, permissions: null },
    ],
    leadRequest: [
      { id: "lead_no_quote", companyId: COMPANY, status: "new", quoteId: null },
      { id: "lead_with_quote", companyId: COMPANY, status: "new", quoteId: "q_1" },
      { id: "lead_other_co", companyId: OTHER_COMPANY, status: "new", quoteId: null },
    ],
  };
}

function asMember(id) {
  globalThis.__FQ_SESSION = globalThis.__FQ_ROWS.member.find((m) => m.id === id);
}

const bulkReq = (body) => ({ json: async () => body });
const singleReq = (body) => ({ json: async () => body });
const singleCtx = (id) => ({ params: Promise.resolve({ id }) });

for (const [label, patch] of [
  [
    "PATCH /api/leads (bulk, drag)",
    (memberId, body) => {
      asMember(memberId);
      return bulkRoute.PATCH(bulkReq(body));
    },
  ],
  [
    "PATCH /api/leads/[id] (drawer)",
    (memberId, body) => {
      asMember(memberId);
      const { id, ...rest } = body;
      return singleRoute.PATCH(singleReq(rest), singleCtx(id));
    },
  ],
]) {
  section(`  ${label}`);

  // ── Permission, independent of the client ──────────────────────────────
  resetFixtures();
  let res = await patch("m_view", { id: "lead_with_quote", status: "contacted" });
  ok(`${label}: requests:view_only is REFUSED (403) — a drag/move needs edit`,
    res.status === 403, res.status);
  ok(`${label}: …and nothing was written`, currentDb.writes.length === 0, currentDb.writes);

  resetFixtures();
  res = await patch("m_none", { id: "lead_with_quote", status: "contacted" });
  ok(`${label}: requests:none is REFUSED (403)`, res.status === 403, res.status);
  ok(`${label}: …and nothing was written`, currentDb.writes.length === 0, currentDb.writes);

  resetFixtures();
  res = await patch("m_edit", { id: "lead_with_quote", status: "contacted" });
  ok(`${label}: requests:view_create_edit is ALLOWED (200)`, res.status === 200, res.status);
  ok(`${label}: …and the write actually happened`,
    currentDb.writes.some((w) => w.model === "leadRequest" && w.action === "update"),
    currentDb.writes);

  resetFixtures();
  res = await patch("m_owner", { id: "lead_with_quote", status: "lost", lostReason: "price_too_high" });
  ok(`${label}: an owner bypasses the grid entirely (200)`, res.status === 200, res.status);

  // ── THE OTHER TRAP: "lost" needs a REAL reason too, grid or no grid ─────
  //
  // lib/leads/pipeline.js's canSetLeadStatus refuses "lost" without one, same
  // shape as the "converted" trap below — an owner holding every grid
  // permission there is still isn't a reason a human recorded existing.
  // docs/META-ADS-INTEGRATION.md Part 2b is why: "not a real inquiry" has to
  // be something a person picked, not the enum accepting the value on its own.
  resetFixtures();
  res = await patch("m_owner", { id: "lead_with_quote", status: "lost" });
  ok(`${label}: an owner still can't drop a lead onto Lost with no reason (409, not 200)`,
    res.status === 409, res.status);
  ok(`${label}: …and nothing was written`,
    !currentDb.writes.some((w) => w.model === "leadRequest" && w.action === "update"),
    currentDb.writes);

  resetFixtures();
  res = await patch("m_owner", { id: "lead_with_quote", status: "lost", lostReason: "not_a_real_code" });
  ok(`${label}: an invalid lost reason is refused as 400 — same distinction as an invalid status`,
    res.status === 400, res.status);
  ok(`${label}: …and nothing was written`,
    !currentDb.writes.some((w) => w.model === "leadRequest" && w.action === "update"),
    currentDb.writes);

  // ── THE TRAP ────────────────────────────────────────────────────────────
  resetFixtures();
  res = await patch("m_edit", { id: "lead_no_quote", status: "converted" });
  ok(`${label}: dropping a lead with NO quote onto Converted is REFUSED (409, not 200)`,
    res.status === 409, res.status);
  ok(`${label}: …with a human reason, not a bare enum error`,
    typeof res.body.error === "string" && /quote/i.test(res.body.error), res.body);
  ok(`${label}: …and the status was NOT written`,
    !currentDb.writes.some((w) => w.model === "leadRequest" && w.action === "update"),
    currentDb.writes);
  ok(`${label}: …the lead is still 'new' in the fixture, not silently 'converted'`,
    globalThis.__FQ_ROWS.leadRequest.find((l) => l.id === "lead_no_quote").status === "new");

  resetFixtures();
  res = await patch("m_edit", { id: "lead_with_quote", status: "converted" });
  ok(`${label}: a lead that DOES have a quote may move to Converted (200)`,
    res.status === 200, res.status);
  ok(`${label}: …and it was actually written`,
    currentDb.writes.some((w) => w.data?.status === "converted"), currentDb.writes);

  // ── Ordinary validation is unaffected by any of the above ──────────────
  resetFixtures();
  res = await patch("m_edit", { id: "lead_with_quote", status: "not_a_real_status" });
  ok(`${label}: an invalid status is 400, not 409 — distinct failure from the quote rule`,
    res.status === 400, res.status);

  resetFixtures();
  res = await patch("m_edit", { id: "lead_other_co", status: "contacted" });
  ok(`${label}: a lead belonging to another company is 404, not leaked as 403/409`,
    res.status === 404, res.status);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. app/app/leads/page.js — the client, read structurally");
// ═══════════════════════════════════════════════════════════════════════════

const pageSrc = stripComments(read("app/app/leads/page.js"));

ok("imports @dnd-kit/core", pageSrc.includes('from "@dnd-kit/core"'));
ok("imports KeyboardSensor — keyboard dragging is kept, not just pointer",
  /KeyboardSensor/.test(pageSrc) && /useSensor\(\s*KeyboardSensor/.test(pageSrc));
ok("imports canSetLeadStatus from the SAME module the routes use",
  pageSrc.includes('canSetLeadStatus') && pageSrc.includes('from "@/lib/leads/pipeline"'));

// ── handleDragEnd: refused BEFORE anything moves ────────────────────────
const dragEndBody = functionBody(pageSrc, "handleDragEnd");
ok("handleDragEnd calls canSetLeadStatus", /canSetLeadStatus\(/.test(dragEndBody));
{
  const checkIdx = dragEndBody.search(/canSetLeadStatus\(/);
  const moveIdx = dragEndBody.search(/moveLead\(/);
  ok("…and checks it BEFORE calling moveLead, not after",
    checkIdx !== -1 && moveIdx !== -1 && checkIdx < moveIdx, { checkIdx, moveIdx });
}
ok("a refused drop sets an error and does NOT touch setLeads (nothing moved, nothing to revert)",
  /setBoardError\(/.test(dragEndBody) && !/setLeads\(/.test(dragEndBody));

// ── moveLead: optimistic AND reverting, scoped to this one function ────
const moveLeadBody = functionBody(pageSrc, "moveLead");
ok("moveLead captures the PREVIOUS status before changing anything",
  /const\s+prevStatus\s*=\s*lead\.status/.test(moveLeadBody));
ok("moveLead applies the move optimistically (setLeads to the NEW status)",
  /setLeads\([\s\S]*?status:\s*targetStatus/.test(moveLeadBody));
{
  const optimisticIdx = moveLeadBody.search(/status:\s*targetStatus/);
  const fetchIdx = moveLeadBody.search(/fetch\(/);
  ok("…and the optimistic move happens BEFORE the network request, not after",
    optimisticIdx !== -1 && fetchIdx !== -1 && optimisticIdx < fetchIdx,
    { optimisticIdx, fetchIdx });
}
ok("moveLead REVERTS to prevStatus when the response is not ok",
  /if\s*\(\s*!res\.ok\s*\)\s*\{[^}]*status:\s*prevStatus/s.test(moveLeadBody));
ok("moveLead ALSO reverts on a thrown network error (catch block), not just a bad response",
  /catch[^{]*\{[^}]*status:\s*prevStatus/s.test(moveLeadBody));
ok("a failed move reports something to the user (reportResponseError or setBoardError), not silence",
  /reportResponseError\(|setBoardError\(/.test(moveLeadBody));

// ── The drag handle can never masquerade as the "open drawer" button ───
const cardSrc = pageSrc.slice(pageSrc.indexOf("function LeadCard("));
const handleBlock = cardSrc.slice(cardSrc.indexOf("dragHandle &&"), cardSrc.indexOf("<GripVertical") + 40);
ok("the drag handle element does not wire onOpen/onClick to open the drawer",
  !/onOpen|onClick=\{onOpen\}/.test(handleBlock));
ok("the drag handle has an aria-label (screen reader users can find it)",
  /aria-label=/.test(handleBlock));

// ── The non-drag path (drawer buttons) is untouched and unconditional ──
const drawerSrc = pageSrc.slice(pageSrc.indexOf("function LeadDrawer("));
ok("the drawer still renders a status button for every LEAD_STATUSES entry",
  /LEAD_STATUSES\.map/.test(drawerSrc));
ok("…wired to the same PATCH the drawer always used (patch({ status: s }))",
  /patch\(\{\s*status:\s*s\s*\}\)/.test(drawerSrc));
ok("…and canSetLeadStatus gates the SAME button here too, not just the drag path",
  /canSetLeadStatus\(\s*lead,\s*s\s*\)/.test(drawerSrc));
ok("the status button row is NOT hidden behind a desktop-only class — it's the phone's primary path",
  !/(?:hidden\s+md:|md:hidden)[^`]*LEAD_STATUSES/.test(drawerSrc));

// ── Mobile still reflows to one column; nothing forces a drag ──────────
ok("the board grid still reflows md:2-up / xl:4-up (stacks to one column below md, as it did before)",
  /grid gap-4 md:grid-cols-2 xl:grid-cols-4/.test(pageSrc));
ok("draggable cards are DISABLED, not hidden, for someone without edit access — the drawer buttons remain their path",
  /disabled=\{!canEdit/.test(pageSrc));

// ═══════════════════════════════════════════════════════════════════════════
section("4. The two PATCH routes actually CALL the guard, not just import it");
// ═══════════════════════════════════════════════════════════════════════════

const bulkSrc = stripComments(read("app/api/leads/route.js"));
const singleSrc = stripComments(read("app/api/leads/[id]/route.js"));

for (const [label, src] of [["bulk PATCH /api/leads", bulkSrc], ["single PATCH /api/leads/[id]", singleSrc]]) {
  ok(`${label}: imports canSetLeadStatus from lib/leads/pipeline`,
    src.includes("canSetLeadStatus") && src.includes('from "@/lib/leads/pipeline"'));
  ok(`${label}: actually CALLS canSetLeadStatus(...)`, /canSetLeadStatus\(/.test(src));
  const checkIdx = src.search(/canSetLeadStatus\(/);
  const updateIdx = src.search(/leadRequest\.update\(/);
  ok(`${label}: the check runs BEFORE db.leadRequest.update, not after (a check nobody acts on is no check)`,
    checkIdx !== -1 && updateIdx !== -1 && checkIdx < updateIdx, { checkIdx, updateIdx });
  ok(`${label}: still enforces requireLevel(..., "requests", "view_create_edit", ...) — this feature didn't touch that gate`,
    /requireLevel\([^)]*"requests"[^)]*"view_create_edit"/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The library is @dnd-kit — never @hello-pangea/dnd");
// ═══════════════════════════════════════════════════════════════════════════

const pkg = JSON.parse(read("package.json"));
ok("@dnd-kit/core is a real dependency", Boolean(pkg.dependencies?.["@dnd-kit/core"]));
ok("@hello-pangea/dnd is NOT a dependency — unverified on React 19, explicitly excluded",
  !pkg.dependencies?.["@hello-pangea/dnd"] && !pkg.devDependencies?.["@hello-pangea/dnd"]);
ok("react is on major version 19, which is why the choice above matters",
  /^\^?19\./.test(pkg.dependencies?.react || ""));
ok("app/app/leads/page.js never imports @hello-pangea/dnd",
  !pageSrc.includes("@hello-pangea/dnd"));

console.log(`\n${checks} checks, ${failures} failure(s).`);
process.exit(failures ? 1 : 0);
