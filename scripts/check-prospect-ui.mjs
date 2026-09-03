// scripts/check-prospect-ui.mjs
//
//   npm run check:prospect-ui
//
// The two screens that make the sales-intelligence pipeline usable, and the one
// rule that decides whether they are any good: fact, inference and
// recommendation stay visibly separate — the spec's §2, and the reason the
// schema is six tables instead of one wide row.
//
// ══ The assertion this file exists for ═════════════════════════════════════
//
// `ProspectCapability.value` is three-valued. `false` means "we looked and
// found nothing"; `null` means "we could not look". If those two render the
// same, a rep tells a contractor they have no booking page while the
// contractor is looking at one. Section 2 is that assertion, executed against
// the real shipped functions, and it is the most important thing here.
//
// ══ Why this is execution and not reading ══════════════════════════════════
//
// lib/sales/prospectView.js is pure by design — no @/lib/db, no React — so
// every scenario the brief names runs the shipped code:
//
//   * a capability that is false versus the same capability null;
//   * an inference whose confidence cannot be computed (must refuse);
//   * an inference carrying a NUMBER (must refuse — a bucket is not a count);
//   * an opportunity with no evidence (must refuse);
//   * a prospect on do-not-contact;
//   * a rep looking at another rep's claim;
//   * a claim that lapsed;
//   * an empty queue.
//
// ══ The parts that cannot be executed ══════════════════════════════════════
//
// "Does the SCREEN use the layering module, and does the ROUTE scope the
// query" are source questions. Those run against source with comments
// stripped, and every positional rule is scoped to ONE named function by brace
// matching — `src.indexOf(a) < src.indexOf(b)` false-passes when `a` is
// absent, which has produced a false pass twice in this repo.
//
// Mutation-tested: each guarantee was broken in turn against a `cp` backup and
// this script was confirmed to fail. See the session report for the list.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  LAYER_FACT,
  LAYER_INFERENCE,
  LAYER_RECOMMENDATION,
  LAYER_HEADINGS,
  CLAIM_HOURS,
  PROSPECT_STATUS_LABELS,
  buildQueue,
  capabilityStatement,
  claimCandidateWhere,
  claimExpiryFrom,
  claimState,
  claimable,
  competitorSummary,
  contactability,
  inferenceStatement,
  opportunityStatement,
  prospectFacts,
  prospectView,
  queueWhere,
  signalsFor,
  sourceCategoryParts,
  sourceCategoryView,
  SIGNAL_BY_EVIDENCE_TYPE,
  SOURCE_CATEGORY_HEADING,
} from "@/lib/sales/prospectView";
import { SIGNALS, seedConfidenceRules } from "@/lib/sales/intel/confidence";
import { REP_QUEUE_WRITES } from "@/lib/sales/queueGate";
import { DISPOSITIONS } from "@/lib/sales/calls/dispositions";
import { OBSERVABLE_CAPABILITY_CODES } from "@/lib/sales/intel/capabilities";

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
const section = (title) => console.log(`\n${title}\n`);

/** Strip comments so a source assertion cannot pass on a sentence about it. */
function codeOnly(src) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The body of ONE named function, by brace matching past its parameter list. */
function bodyOf(src, declaration) {
  const start = src.indexOf(declaration);
  if (start === -1) return null;
  const openParen = src.indexOf("(", start);
  if (openParen === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = openParen; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i + 1;
        break;
      }
    }
  }
  if (afterParams === -1) return null;
  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * The object literal a call was given, by brace matching from the call site.
 *
 * `db.prospect.findMany({ ... })` — the argument, not the whole file. A
 * file-wide regex asking "is queueWhere used" passes when ONE of four queries
 * still uses it and the other three have been unscoped, which is the bug
 * rather than the absence of the string.
 */
function argsOf(src, call) {
  const out = [];
  let from = 0;
  for (;;) {
    const at = src.indexOf(call, from);
    if (at === -1) return out;
    const open = src.indexOf("{", at + call.length - 1);
    if (open === -1) return out;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          out.push(src.slice(open, i + 1));
          from = i + 1;
          break;
        }
      }
    }
    if (from <= at) return out;
  }
}

/**
 * The matcher, asserted before anything trusts it.
 *
 * A matcher that silently returns a parameter list makes assertions pass for
 * no reason, which is the false pass every section below is written to avoid.
 */
{
  const sample =
    'export function f(a, { b = [] } = {}) {\n  return "MARKER";\n}\nfunction g() { return "OTHER"; }\n';
  const body = bodyOf(sample, "export function f");
  ok("the brace matcher returns a body, not a parameter list", /MARKER/.test(body || ""), body);
  ok("…and stops at the end of that function", !/OTHER/.test(body || ""), body);
  ok("codeOnly strips a comment", !/GONE/.test(codeOnly("// GONE\nconst a = 1;")));
  ok("codeOnly keeps a string that looks like one", /https:/.test(codeOnly('const u = "https://x";')));
  const args = argsOf('a.b({ x: 1 }); zz; a.b({ y: { z: 2 } });', "a.b(");
  ok("argsOf finds every call's argument", args.length === 2, args);
  ok("…and brace-matches past a nested object", /z: 2/.test(args[1] || "") && !/zz/.test(args[1] || ""), args[1]);
}

const rules = seedConfidenceRules();

/* ═══════════════════════════════════════════════════════════════════════════
   1. The files exist and are wired to something
   ═══════════════════════════════════════════════════════════════════════ */
section("1. The screens, the routes, and the way in");

const FILES = [
  "lib/sales/prospectView.js",
  "app/platform/sales/prospects/page.js",
  "app/api/platform/sales/prospects/route.js",
  "app/api/platform/sales/prospects/[id]/route.js",
  "app/sales/queue/page.js",
  "app/api/sales/queue/route.js",
  "lib/sales/queueGate.js",
];
for (const f of FILES) ok(`${f} exists`, existsSync(join(ROOT, f)));

const platformPage = codeOnly(read("app/platform/sales/prospects/page.js"));
const platformList = codeOnly(read("app/api/platform/sales/prospects/route.js"));
const platformDetail = codeOnly(read("app/api/platform/sales/prospects/[id]/route.js"));
const queuePage = codeOnly(read("app/sales/queue/page.js"));
const queueRoute = codeOnly(read("app/api/sales/queue/route.js"));
const queueGate = codeOnly(read("lib/sales/queueGate.js"));
const viewSrc = codeOnly(read("lib/sales/prospectView.js"));

// ── The "Has none" filter, and the fact that decides whether it may be offered
//
// `hasWebsite` is three-valued, and nothing in the codebase writes `false`:
// normalise.js writes true-or-null, crawlSite.js writes only true, and
// enrichBusiness.js refuses on purpose — a directory omitting a website is a
// gap in the DIRECTORY, and a rep opening with "I see you have no website" to
// somebody who has one is the most expensive sentence this pipeline can make.
//
// So an enabled "Has none" filter could only ever return zero rows, and zero
// rows there reads as "every prospect has a website" — a confident wrong answer
// from a control that cannot work.
//
// This assertion is CONDITIONAL, so it retires itself: the day a writer for
// `hasWebsite: false` exists, the filter must be re-enabled, and this flips to
// demanding exactly that instead of forbidding it.
{
  const writers = ["lib/sales/discovery/normalise.js", "lib/sales/crawl/crawlSite.js",
                   "lib/sales/pipeline/handlers/enrichBusiness.js", "lib/sales/intel/capabilityDetect.js"]
    .map((f) => codeOnly(read(f)))
    .filter((src) => /hasWebsite:\s*[^,;}\n]*\bfalse\b/.test(src));
  const canProveAbsence = writers.length > 0;
  const optionDisabled = /<option value="no"[^>]*\sdisabled/.test(platformPage);
  ok(
    canProveAbsence
      ? "something writes hasWebsite:false, so the 'Has none' filter is offered again"
      : "nothing writes hasWebsite:false, so the 'Has none' filter is disabled rather than silently empty",
    canProveAbsence ? optionDisabled === false : optionDisabled === true,
    `writers=${writers.length} disabled=${optionDisabled}`,
  );
}

const sidebar = read("app/components/platform/PlatformSidebar.js");
ok(
  "the superadmin screen is reachable from the platform sidebar",
  sidebar.includes('href: "/platform/sales/prospects"'),
);
const shell = read("app/sales/SalesShell.js");
ok("the rep queue is reachable from the sales portal's own tabs", shell.includes('href: "/sales/queue"'));

// A route with no caller is the failure check-route-callers.mjs exists for.
ok("the platform list route has a caller", platformPage.includes("/api/platform/sales/prospects"));
ok("the rep queue route has a caller", queuePage.includes("/api/sales/queue"));

/* ═══════════════════════════════════════════════════════════════════════════
   2. THE ONE THAT MATTERS: false is not null
   ═══════════════════════════════════════════════════════════════════════ */
section("2. A capability that is FALSE and one that is NULL do not render the same");

const gap = capabilityStatement(
  { code: "ONLINE_BOOKING", value: false, evidenceIds: ["e_absent"] },
  { rules, evidenceById: new Map([["e_absent", { id: "e_absent", type: "page_content" }]]) },
);
const unknown = capabilityStatement(
  { code: "ONLINE_BOOKING", value: null, evidenceIds: [] },
  { rules, evidenceById: new Map() },
);
const has = capabilityStatement(
  { code: "ONLINE_BOOKING", value: true, evidenceIds: ["e_script"] },
  { rules, evidenceById: new Map([["e_script", { id: "e_script", type: "script_src" }]]) },
);

ok("a false capability keeps its value as false", gap.value === false, gap.value);
ok("a null capability keeps its value as null — never coerced", unknown.value === null, unknown.value);
ok(
  "THE ASSERTION: the two produce DIFFERENT sentences",
  typeof gap.text === "string" &&
    typeof unknown.text === "string" &&
    gap.text.length > 0 &&
    unknown.text.length > 0 &&
    gap.text !== unknown.text,
  { gap: gap.text, unknown: unknown.text },
);
ok(
  "…and different states, so a renderer cannot paint them alike",
  gap.state === "gap" && unknown.state === "unknown" && gap.state !== unknown.state,
  { gap: gap.state, unknown: unknown.state },
);
ok(
  "…and different tones, which is what a scanning eye actually reads",
  gap.tone !== unknown.tone,
  { gap: gap.tone, unknown: unknown.tone },
);
ok("a false is KNOWN — we looked", gap.known === true);
ok("a null is NOT known — we could not look", unknown.known === false);
ok(
  "the unknown sentence never says the business lacks the thing",
  !/\bno\b/i.test(unknown.text),
  unknown.text,
);
ok("the false sentence DOES say they lack it", /\bno\b/i.test(gap.text), gap.text);
ok(
  "a rep may assert a verified finding",
  has.sayable === true && has.verified === true,
  has,
);
ok(
  "a rep may NOT assert an unknown, at any confidence",
  unknown.sayable === false,
  unknown,
);
ok(
  "an unknown is never marked verified — there is no statement to verify",
  unknown.verified === false,
);
ok(
  "a false seen only in page prose is NOT verified, so the rep hedges",
  gap.verified === false && gap.sayable === false,
  gap,
);
ok("all three are stamped as FACTS", [gap, unknown, has].every((s) => s.layer === LAYER_FACT));

// Every observable code has its own three sentences, and no code's "unknown"
// is its "no". A code added to the vocabulary with no words falls back to a
// generic form that still keeps the three apart.
{
  const collisions = [];
  for (const code of [...OBSERVABLE_CAPABILITY_CODES, "A_CODE_NOBODY_DECLARED"]) {
    const a = capabilityStatement({ code, value: false, evidenceIds: [] }, { rules });
    const b = capabilityStatement({ code, value: null, evidenceIds: [] }, { rules });
    if (a.text === b.text || a.state === b.state) collisions.push(code);
  }
  ok(
    "every capability code — declared or not — keeps false and null apart",
    collisions.length === 0,
    collisions,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. An inference without its confidence is not rendered
   ═══════════════════════════════════════════════════════════════════════ */
section("3. An inference is never shown without how sure we are");

const evidence = new Map([
  ["e_page", { id: "e_page", type: "page_content" }],
  ["e_call", { id: "e_call", type: "transcript" }],
  ["e_weird", { id: "e_weird", type: "a_type_no_signal_maps_to" }],
]);

const goodInference = inferenceStatement(
  { kind: "company_scale", value: "SMALL_BUSINESS", evidenceIds: ["e_call"], source: "call" },
  { rules, evidenceById: evidence },
);
ok("an inference with a real signal renders", goodInference.renderable === true, goodInference);
ok("…and is stamped as an inference", goodInference.layer === LAYER_INFERENCE);
ok(
  "…and carries a confidence figure in words",
  typeof goodInference.confidenceText === "string" && /%/.test(goodInference.confidenceText),
  goodInference.confidenceText,
);
ok(
  "…and is NOT verified, at any confidence",
  goodInference.verified === false && goodInference.confidence.value >= 0.9,
  goodInference,
);

// No signals at all → fieldConfidence returns a null value → MUST refuse.
const noConfidence = inferenceStatement(
  { kind: "company_scale", value: "SMALL_BUSINESS", evidenceIds: [] },
  { rules, evidenceById: evidence },
);
ok(
  "an inference whose confidence cannot be computed is REFUSED, not shown",
  noConfidence.renderable === false,
  noConfidence,
);
ok(
  "…and the refusal says why, rather than the row vanishing",
  typeof noConfidence.refusal === "string" && noConfidence.refusal.length > 40,
  noConfidence.refusal,
);
ok(
  "…and no claim text is handed to the renderer at all",
  noConfidence.text === undefined,
  noConfidence.text,
);

// Evidence of a type no signal maps to is the same case arriving by a
// different door: signals present, none recognised, so still no figure.
const unrecognised = inferenceStatement(
  { kind: "company_scale", value: "SOLO_LIKELY", evidenceIds: ["e_weird"] },
  { rules, evidenceById: evidence },
);
ok(
  "evidence of an unmapped type contributes nothing, so the inference is refused",
  unrecognised.renderable === false,
  unrecognised,
);

// A number is not a bucket.
const counted = inferenceStatement(
  { kind: "company_scale", value: "11 employees", evidenceIds: ["e_call"] },
  { rules, evidenceById: evidence },
);
ok(
  "an inference carrying a NUMBER is refused — \"small team\", never \"eleven employees\"",
  counted.renderable === false,
  counted,
);
ok(
  "the rendered inference's own claim text carries no digits",
  !/\d/.test(String(goodInference.text)),
  goodInference.text,
);

/* ═══════════════════════════════════════════════════════════════════════════
   4. A recommendation with no evidence
   ═══════════════════════════════════════════════════════════════════════ */
section("4. A recommendation cites evidence, or it is shown as broken");

const goodRec = opportunityStatement(
  {
    capabilityCode: "ONLINE_BOOKING",
    rank: 90,
    reason: "They publish no way to book, and no competitor platform was detected.",
    confidence: 0.72,
    evidenceIds: ["e_absent"],
    ruleCode: "NO_ONLINE_BOOKING",
    ruleVersion: "1",
  },
  { capabilityName: "Online booking" },
);
ok("a cited recommendation renders", goodRec.renderable === true, goodRec);
ok("…stamped as a recommendation", goodRec.layer === LAYER_RECOMMENDATION);
ok("…never verified — it is an argument", goodRec.verified === false);
ok("…leads with its reason", typeof goodRec.reason === "string" && goodRec.reason.length > 10);
ok("…and names the rule that produced it", goodRec.ruleCode === "NO_ONLINE_BOOKING");

const uncited = opportunityStatement(
  {
    capabilityCode: "ONLINE_BOOKING",
    rank: 90,
    reason: "They should really get online booking.",
    confidence: 0.9,
    evidenceIds: [],
    ruleCode: "NO_ONLINE_BOOKING",
  },
  { capabilityName: "Online booking" },
);
ok(
  "a recommendation with NO evidence is refused, however confident",
  uncited.renderable === false,
  uncited,
);
ok(
  "…and its unsupported reason is not handed to the renderer",
  uncited.reason === undefined,
  uncited.reason,
);
ok(
  "…and the refusal is visible rather than the row being dropped",
  typeof uncited.refusal === "string" && uncited.refusal.length > 40,
);

const reasonless = opportunityStatement(
  { capabilityCode: "ONLINE_BOOKING", reason: "   ", evidenceIds: ["e_absent"], confidence: 0.5 },
  { capabilityName: "Online booking" },
);
ok("a recommendation with a blank reason is refused too", reasonless.renderable === false, reasonless);

/* ═══════════════════════════════════════════════════════════════════════════
   5. Do not contact
   ═══════════════════════════════════════════════════════════════════════ */
section("5. do-not-contact is obeyed, and obvious");

const dncAt = new Date("2026-08-01T10:00:00Z");
const dnc = {
  id: "p_dnc",
  businessName: "Nordic Painting",
  phoneE164: "+16135550100",
  doNotContactAt: dncAt,
  doNotContactReason: "Asked to be taken off the list",
};
const dncContact = contactability(dnc);
ok("a do-not-contact prospect is not callable", dncContact.callable === false, dncContact);
ok("…with its own code, not a generic refusal", dncContact.code === "do_not_contact");
ok("…and the reason is on screen", /taken off the list/.test(dncContact.text), dncContact.text);
ok("…and the date it was recorded", /2026-08-01/.test(dncContact.text), dncContact.text);
ok(
  "do-not-contact outranks having a phone number",
  dnc.phoneE164 && contactability(dnc).callable === false,
);
ok(
  "a do-not-contact prospect cannot be claimed, even by nobody's rep",
  claimable(dnc, { repId: "rep_a", now: new Date("2026-09-02T09:00:00Z") }) === false,
);
ok(
  "a prospect with no phone is also not callable — but says so differently",
  contactability({ id: "p", businessName: "X" }).code === "no_phone",
);
ok(
  "a callable prospect is callable",
  contactability({ phoneE164: "+16135550101" }).callable === true,
);
ok(
  "the candidate query excludes do-not-contact rows at the database, not on screen",
  claimCandidateWhere({ tradeKey: "painting" }).doNotContactAt === null,
  claimCandidateWhere({ tradeKey: "painting" }),
);

/* ═══════════════════════════════════════════════════════════════════════════
   6. Ownership: another rep's claim, and a lapsed one
   ═══════════════════════════════════════════════════════════════════════ */
section("6. One rep works a prospect at a time, and a stale claim goes back");

const NOW = new Date("2026-09-02T12:00:00Z");
const later = new Date("2026-09-04T12:00:00Z");
const earlier = new Date("2026-09-01T12:00:00Z");

const mine = { id: "p1", assignedRepId: "rep_a", assignedAt: earlier, claimExpiresAt: later };
const theirs = { id: "p2", assignedRepId: "rep_b", assignedAt: earlier, claimExpiresAt: later };
const lapsed = { id: "p3", assignedRepId: "rep_b", assignedAt: earlier, claimExpiresAt: earlier };
const worked = { id: "p4", assignedRepId: "rep_b", assignedAt: earlier, claimExpiresAt: null };
const free = { id: "p5", assignedRepId: null, assignedAt: null, claimExpiresAt: null };

ok("my live claim is mine", claimState(mine, { repId: "rep_a", now: NOW }).state === "mine");
ok(
  "another rep's live claim is HELD, not mine",
  claimState(theirs, { repId: "rep_a", now: NOW }).state === "held",
  claimState(theirs, { repId: "rep_a", now: NOW }),
);
ok(
  "…and says out loud that two reps must not phone the same contractor",
  /two reps/i.test(claimState(theirs, { repId: "rep_a", now: NOW }).text),
);
ok(
  "I cannot claim a prospect another rep is holding",
  claimable(theirs, { repId: "rep_a", now: NOW }) === false,
);
ok("a lapsed claim is LAPSED", claimState(lapsed, { repId: "rep_a", now: NOW }).state === "lapsed");
ok(
  "…and is claimable again by anybody",
  claimable(lapsed, { repId: "rep_a", now: NOW }) === true,
);
ok(
  "…and still reports who had it",
  claimState(lapsed, { repId: "rep_a", now: NOW }).holderId === "rep_b",
);
ok(
  "a WORKED claim never lapses — a real conversation is not a lease",
  claimState(worked, { repId: "rep_b", now: later }).state === "mine_worked" &&
    claimState(worked, { repId: "rep_a", now: later }).state === "held_worked",
);
ok(
  "…and another rep cannot take a worked prospect",
  claimable(worked, { repId: "rep_a", now: later }) === false,
);
ok("an unclaimed prospect is claimable", claimable(free, { repId: "rep_a", now: NOW }) === true);
ok("the lease is a stated number of hours", CLAIM_HOURS > 0 && Number.isFinite(CLAIM_HOURS));
ok(
  "a claim taken now expires exactly CLAIM_HOURS later",
  claimExpiryFrom(NOW).getTime() - NOW.getTime() === CLAIM_HOURS * 3600 * 1000,
);

// The scoping RULE, executed the way check-sales-auth.mjs executes
// assignedCompanyWhere: against fixture rows, not read off the source.
{
  const rows = [mine, theirs, lapsed, worked, free];
  const where = queueWhere("rep_a", { now: NOW });
  const matches = (row) => {
    if (row.assignedRepId !== where.assignedRepId) return false;
    return where.OR.some((clause) =>
      clause.claimExpiresAt === null
        ? row.claimExpiresAt === null
        : new Date(row.claimExpiresAt ?? 0) > clause.claimExpiresAt.gt,
    );
  };
  const visible = rows.filter(matches).map((r) => r.id);
  ok("a rep sees their own live claim", visible.includes("p1"));
  ok("a rep does NOT see another rep's claim", !visible.includes("p2"), visible);
  ok("a rep does NOT see a lapsed claim — it is back in the pool", !visible.includes("p3"), visible);
  ok("a rep does NOT see an unclaimed prospect — there is no browsing the pool", !visible.includes("p5"));

  const nobody = queueWhere(null);
  ok(
    "an unidentified caller gets the __none__ sentinel, never an empty object",
    nobody.assignedRepId === "__none__" && Object.keys(nobody).length > 0,
    nobody,
  );
  ok(
    "…and matches nothing",
    rows.filter((r) => r.assignedRepId === nobody.assignedRepId).length === 0,
  );
  ok(
    "the candidate query with no trade also refuses rather than widening",
    claimCandidateWhere({}).tradeKey === "__none__",
  );
  ok(
    "…and only ever offers a workable status",
    claimCandidateWhere({ tradeKey: "painting" }).status === "discovered",
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. An empty queue
   ═══════════════════════════════════════════════════════════════════════ */
section("7. An empty queue says which kind of empty it is");

const emptyWithPool = buildQueue({ prospects: [], repId: "rep_a", now: NOW, availableToClaim: 12, tradeKey: "painting" });
ok("an empty queue is reported empty", emptyWithPool.empty === true);
ok("…with no invented item", emptyWithPool.items.length === 0);
ok("…and says the pool has something in it", emptyWithPool.emptyReason === "nothing_claimed", emptyWithPool);
ok("…naming how many", /12/.test(emptyWithPool.emptyText), emptyWithPool.emptyText);

const emptyPool = buildQueue({ prospects: [], repId: "rep_a", now: NOW, availableToClaim: 0, tradeKey: "painting" });
ok(
  "an empty queue with an empty pool is a DIFFERENT answer",
  emptyPool.emptyReason === "pool_empty" && emptyPool.emptyText !== emptyWithPool.emptyText,
  emptyPool,
);
ok(
  "…and says discovery has to run again, rather than 'nothing here'",
  /discovery/i.test(emptyPool.emptyText),
  emptyPool.emptyText,
);

const uncounted = buildQueue({ prospects: [], repId: "rep_a", now: NOW });
ok(
  "an uncounted pool is a third answer, not padded to zero",
  uncounted.emptyReason === "unknown_pool",
  uncounted,
);

const full = buildQueue({ prospects: [mine, { ...dnc, assignedRepId: "rep_a", claimExpiresAt: later }], repId: "rep_a", now: NOW, availableToClaim: 3 });
ok("a non-empty queue is not empty", full.empty === false && full.items.length === 2);
ok(
  "…and separates what can be called from what must not be",
  full.callableCount === 0 && full.blockedCount === 2,
  full,
);

/* ═══════════════════════════════════════════════════════════════════════════
   8. The three layers survive the whole view
   ═══════════════════════════════════════════════════════════════════════ */
section("8. prospectView keeps the three layers in three places");

const view = prospectView({
  prospect: {
    id: "p_view",
    businessName: "Nordic Painting",
    city: "Ottawa",
    province: "ON",
    phoneE164: "+16135550100",
    googleRating: 4.6,
    googleReviewCount: 31,
    hasWebsite: true,
    websiteUrl: "https://nordicpainting.example",
    lastCrawledAt: new Date("2026-09-01T00:00:00Z"),
    tradeKey: "painting",
    assignedRepId: "rep_a",
    assignedAt: earlier,
    claimExpiresAt: later,
  },
  capabilities: [
    { code: "ONLINE_BOOKING", value: false, evidenceIds: ["e_absent"] },
    { code: "LIVE_CHAT", value: null, evidenceIds: [] },
    { code: "ONLINE_PAYMENT", value: true, evidenceIds: ["e_script"] },
  ],
  technologies: [
    { technologyCode: "JOBBER", name: "Jobber", isCompetitor: true, confidence: 0.9, evidenceIds: ["e_script"] },
  ],
  inferences: [{ kind: "company_scale", value: "SMALL_BUSINESS", evidenceIds: ["e_call"], source: "call" }],
  opportunities: [
    {
      capabilityCode: "ONLINE_BOOKING",
      rank: 90,
      reason: "No way to book on their site.",
      confidence: 0.7,
      evidenceIds: ["e_absent"],
      ruleCode: "NO_ONLINE_BOOKING",
    },
  ],
  evidence: [
    { id: "e_absent", type: "page_content" },
    { id: "e_script", type: "script_src" },
    { id: "e_call", type: "transcript" },
  ],
  scores: [],
  rules,
  capabilityNames: { ONLINE_BOOKING: "Online booking" },
  repId: "rep_a",
  now: NOW,
});

ok("facts land in `capabilities`", view.capabilities.every((c) => c.layer === LAYER_FACT));
ok("inferences land in `inferences`", view.inferences.every((i) => i.layer === LAYER_INFERENCE));
ok(
  "recommendations land in `opportunities`",
  view.opportunities.every((o) => o.layer === LAYER_RECOMMENDATION),
);
ok(
  "the three arrays are three arrays, never merged",
  view.capabilities !== view.inferences && view.inferences !== view.opportunities,
);
ok(
  "the false and the null capability are still distinct after the whole view is built",
  view.capabilities.find((c) => c.code === "ONLINE_BOOKING").text !==
    view.capabilities.find((c) => c.code === "LIVE_CHAT").text,
);
ok(
  "an unknown capability is listed under what we do NOT know",
  view.unknowns.some((u) => /live chat/i.test(u)),
  view.unknowns,
);
ok(
  "…and a known absence is NOT listed as an unknown",
  !view.unknowns.some((u) => /no online booking/i.test(u)),
  view.unknowns,
);
ok(
  "no lead score is reported as absent, never as zero",
  view.score === null && typeof view.scoreNote === "string",
  { score: view.score, note: view.scoreNote },
);
ok("a detected competitor is named", /Jobber/.test(view.competitor.text), view.competitor.text);
ok("…and the competitor summary knows it looked", view.competitor.known === true);

// The other half of the null-versus-false trap, one level up.
{
  const never = competitorSummary({ technologies: [], lastCrawledAt: null });
  const looked = competitorSummary({ technologies: [], lastCrawledAt: new Date() });
  ok("no technology rows and no crawl is UNKNOWN, not 'no competitor'", never.known === false, never);
  ok("…and says nothing has crawled them", /crawl/i.test(never.text), never.text);
  ok("no technology rows after a crawl IS a finding", looked.known === true && looked.present === false);
  ok("…and the two say different things", never.text !== looked.text);
}

// Absent facts on the row itself.
{
  const bare = prospectFacts({ businessName: "Bare Co" });
  const rating = bare.find((f) => f.key === "rating");
  const reviews = bare.find((f) => f.key === "reviews");
  const status = bare.find((f) => f.key === "businessStatus");
  ok("a missing rating is stated as missing, never 0", rating.known === false && !/0/.test(rating.text), rating);
  ok("a missing review count is stated as missing", reviews.known === false, reviews);
  ok(
    "a business the source said nothing about is NOT reported as open",
    status.known === false && !/\bopen\b/i.test(status.text),
    status,
  );
  const listed = prospectFacts({ businessName: "X", hasWebsite: null, websiteUrl: null }).find(
    (f) => f.key === "website",
  );
  ok(
    "the source listing no website is not the claim 'this business has no website'",
    !/^No website/.test(listed.text),
    listed.text,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. Evidence → signals, the join the layering depends on
   ═══════════════════════════════════════════════════════════════════════ */
section("9. Evidence types map to signals the confidence engine knows");

{
  const unknownSignals = Object.values(SIGNAL_BY_EVIDENCE_TYPE).filter((s) => !SIGNALS[s]);
  ok(
    "every mapped signal is one lib/sales/intel/confidence.js declares",
    unknownSignals.length === 0,
    unknownSignals,
  );
  const byId = new Map([
    ["a", { type: "script_src" }],
    ["b", { type: "not_a_type" }],
  ]);
  ok("a known evidence type yields its signal", signalsFor(["a"], byId)[0] === "detection.script_src");
  ok("an unknown evidence type yields nothing, never a default", signalsFor(["b"], byId).length === 0);
  ok("a missing evidence id yields nothing", signalsFor(["zzz"], byId).length === 0);
  ok("a non-array is tolerated", signalsFor(null, byId).length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. The screens use the module rather than re-deciding
   ═══════════════════════════════════════════════════════════════════════ */
section("10. Neither screen decides for itself what is verified");

for (const [name, src] of [
  ["the superadmin screen", platformPage],
  ["the rep queue", queuePage],
]) {
  ok(`${name} imports the layer headings from the shared module`, /prospectView/.test(src));
  ok(
    `${name} does not import a presenter directly and re-decide the layers`,
    !/presentCapability|presentInference|presentOpportunity/.test(src),
    name,
  );
  ok(
    `${name} renders an INFERENCE's refusal rather than dropping the row`,
    /inf\.renderable/.test(src) && /inf\.refusal/.test(src),
    name,
  );
  ok(
    `${name} renders a RECOMMENDATION's refusal too`,
    /o\.renderable/.test(src) && /o\.refusal/.test(src),
    name,
  );
  ok(
    `${name} keeps the three layers in three sections, each with its own heading`,
    (src.match(/LayerHeader layer=/g) || []).length >= 3,
    (src.match(/LayerHeader layer=/g) || []).length,
  );
  ok(
    `${name} never compares a confidence number to decide what to say`,
    // `.value` between the two halves is exactly how this regex was fooled
    // once: `c.confidence.value > 0.8` is the mutation, and a pattern that
    // only sees `confidence >` passes against it.
    !/confidence(?:\?)?(?:\.value)?\s*[><]=?\s*[0-9.]/.test(src),
    src.match(/.{0,40}confidence(?:\?)?(?:\.value)?\s*[><]=?\s*[0-9.].{0,20}/)?.[0] ?? name,
  );
}

ok(
  "the three layer headings exist and read as three different things",
  new Set([
    LAYER_HEADINGS[LAYER_FACT].title,
    LAYER_HEADINGS[LAYER_INFERENCE].title,
    LAYER_HEADINGS[LAYER_RECOMMENDATION].title,
  ]).size === 3,
);

// Scoped to ONE function each, by brace matching. A guard that moved out of
// the function that needs it must fail here.
{
  const capBody = bodyOf(viewSrc, "export function capabilityStatement");
  ok("capabilityStatement is findable", Boolean(capBody));
  ok(
    "capabilityStatement branches on `=== null` explicitly, never on truthiness",
    /value === null/.test(capBody || ""),
    capBody?.slice(0, 200),
  );
  ok(
    "capabilityStatement contains no truthiness coercion of the value",
    !/Boolean\(\s*presented\.value|!!presented\.value/.test(capBody || ""),
  );
  ok(
    "capabilityStatement takes `verified` from the presenter rather than computing it",
    !/verifying/.test(capBody || ""),
    capBody?.slice(0, 200),
  );

  const infBody = bodyOf(viewSrc, "export function inferenceStatement");
  ok("inferenceStatement is findable", Boolean(infBody));
  ok(
    "the no-confidence refusal is inside inferenceStatement itself",
    /renderable: false/.test(infBody || "") && /value === null/.test(infBody || ""),
    infBody?.slice(0, 300),
  );
  ok(
    "…and the digit guard is in there too",
    /\\d/.test(infBody || "") || /test\(String/.test(infBody || ""),
  );

  const oppBody = bodyOf(viewSrc, "export function opportunityStatement");
  ok("opportunityStatement is findable", Boolean(oppBody));
  ok(
    "the evidence gate is inside opportunityStatement itself",
    /evidenceIds\.length === 0/.test(oppBody || ""),
    oppBody?.slice(0, 300),
  );

  const queueBody = bodyOf(viewSrc, "export function queueWhere");
  ok("queueWhere is findable", Boolean(queueBody));
  ok(
    "queueWhere falls back to the __none__ sentinel inside itself",
    /__none__/.test(queueBody || ""),
    queueBody,
  );
  ok(
    "queueWhere never returns an empty object",
    !/return\s*\{\s*\}/.test(queueBody || ""),
    queueBody,
  );
}

/**
 * Is this query argument scoped to the row this rep holds?
 *
 * `where: mine` was the whole test until 2026-09-03, when the do-not-contact
 * action grew a second condition — `{ ...mine, doNotContactAt: null }`, so a
 * second press cannot move the date — and a correctly scoped write started
 * failing. Widening to "mentions mine" would have been the wrong repair: the
 * spread is order-sensitive, and `{ ...mine, assignedRepId: null }` mentions it
 * while handing the rep every prospect in the pool.
 *
 * So: `mine` has to be the FIRST thing in the where, and nothing after it may
 * re-declare either key `mine` supplies. That is strictly stronger than the
 * string it replaces, not weaker.
 */
function scopedToRep(arg) {
  if (/\.\.\.claimCandidateWhere\(/.test(arg)) return true;
  if (/where:\s*mine\b/.test(arg)) return true;
  const spread = arg.match(/where:\s*\{\s*\.\.\.mine\b([\s\S]*?)\}/);
  if (!spread) return false;
  // Anything that would override the id or the rep, after the spread that set
  // them. Nested objects are fine — `doNotContactAt: { not: null }` names
  // neither key — so this looks for the keys themselves at any depth and lets
  // the presence of one fail the query rather than trying to reason about it.
  return !/\b(id|assignedRepId)\s*:/.test(spread[1]);
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. The routes
   ═══════════════════════════════════════════════════════════════════════ */
section("11. The routes scope, gate and write only what they say they do");

{
  // Scoped to the handler body: an import at the top of the file is not a
  // gate, and a whole-file regex cannot tell the two apart.
  const listGet = bodyOf(platformList, "export async function GET");
  const detailGet = bodyOf(platformDetail, "export async function GET");
  ok("both superadmin handlers are findable", Boolean(listGet) && Boolean(detailGet));
  ok(
    "the superadmin list handler calls the superadmin gate itself",
    /await superadminOrRefusal\(request\)/.test(listGet || ""),
    listGet?.slice(0, 200),
  );
  ok(
    "the superadmin detail handler calls it too",
    /await superadminOrRefusal\(request\)/.test(detailGet || ""),
    detailGet?.slice(0, 200),
  );
  ok(
    "…and returns the refusal rather than carrying on",
    /if \(refusal\) return/.test(listGet || "") && /if \(refusal\) return/.test(detailGet || ""),
  );
}
ok(
  "the superadmin routes are read-only — no POST, PATCH or DELETE",
  !/export async function (POST|PATCH|PUT|DELETE)/.test(platformList) &&
    !/export async function (POST|PATCH|PUT|DELETE)/.test(platformDetail),
);
ok(
  "the detail route awaits params — they are a Promise in Next 16",
  /await params/.test(platformDetail),
);
ok(
  "the list route keeps the website filter three-valued",
  /hasWebsite = true/.test(platformList) &&
    /hasWebsite = false/.test(platformList) &&
    /hasWebsite = null/.test(platformList),
);
ok(
  "the list route separates 'no competitor found' from 'never crawled'",
  /uncrawled/.test(platformList) &&
    /where\.lastCrawledAt = \{ not: null \}/.test(platformList) &&
    /where\.lastCrawledAt = null/.test(platformList),
);
ok(
  "the detail route JOINS the evidence, without which every capability reads as unobserved",
  /evidence: \{ orderBy: \{ observedAt/.test(platformDetail) && /prospectView/.test(platformDetail),
);

// The rep route.
{
  const getBody = bodyOf(queueRoute, "export async function GET");
  const postBody = bodyOf(queueRoute, "export async function POST");
  ok("the queue route has a GET and a POST", Boolean(getBody) && Boolean(postBody));
  ok(
    "both handlers AWAIT the queue gate and take its refusal",
    /const \{ rep, refusal \} = await requireQueueRep\(request\);/.test(getBody || "") &&
      /const \{ rep, refusal \} = await requireQueueRep\(request\);/.test(postBody || ""),
    { get: getBody?.slice(0, 160), post: postBody?.slice(0, 160) },
  );
  ok(
    "…and return that refusal before touching the body",
    /if \(refusal\) return NextResponse/.test(getBody || "") &&
      /if \(refusal\) return NextResponse/.test(postBody || ""),
  );

  const gateBody = bodyOf(queueGate, "export async function requireQueueRep");
  ok("the gate is findable", Boolean(gateBody));
  ok(
    "the gate re-reads the rep row every request — a twelve-hour token is not proof of employment",
    /db\.salesRep\.findUnique/.test(gateBody || ""),
    gateBody?.slice(0, 200),
  );
  ok(
    "…and asks canAuthenticate rather than re-implementing it",
    /canAuthenticate/.test(gateBody || ""),
  );
  ok(
    "…and strips the password hash before the row can be spread into a response",
    /passwordHash: _passwordHash/.test(gateBody || ""),
  );

  // Every write in the route names a model on the gate's declared list, and
  // the list is exactly one model. Both halves matter: the first catches a new
  // write, the second catches somebody widening the list to allow one.
  const allowed = REP_QUEUE_WRITES;
  ok("REP_QUEUE_WRITES is declared beside the gate", Array.isArray(allowed) && allowed.length > 0, allowed);
  ok("…and names exactly one model: prospect", allowed.length === 1 && allowed[0] === "prospect", allowed);
  ok(
    "…and never the platform suppression list, which only a superadmin lifts",
    !allowed.includes("salesSuppression"),
  );
  ok(
    "the queue gate is named in check-sales-auth's SALES_GATES, so the addition was deliberate",
    /"requireQueueRep"/.test(read("scripts/check-sales-auth.mjs")),
  );
  const written = new Set(
    [...queueRoute.matchAll(/\bdb\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g)].map(
      (m) => m[1],
    ),
  );
  ok(
    "the queue route writes only the model REP_QUEUE_WRITES names",
    [...written].every((m) => allowed.includes(m)),
    [...written],
  );
  ok("…and it does write something, so the assertion is not vacuous", written.size > 0, [...written]);

  ok(
    "the claim is a compare-and-set: the availability condition is still in the WHERE",
    /where: \{ id: candidate\.id, \.\.\.claimCandidateWhere\(/.test(postBody || ""),
    postBody?.slice(0, 400),
  );
  ok(
    "…and a lost race is retried rather than overwriting the winner's claim",
    /claimed\.count === 1/.test(postBody || ""),
  );
  ok(
    "every non-claim action is scoped to a row this rep holds, in the WHERE",
    /const mine = \{ id: prospectId, assignedRepId: rep\.id \};/.test(postBody || ""),
    postBody?.slice(0, 400),
  );
  {
    // Each write's own argument, brace-matched. `assignedRepId: rep.id` also
    // appears in the CLAIM's data block, so a whole-body regex passes while
    // release, worked and do-not-contact are all unscoped.
    const writes = argsOf(postBody || "", "db.prospect.updateMany(");
    const unscoped = writes.filter((w) => !scopedToRep(w));
    ok(
      "every write in POST is scoped — either to the rep's own row or to the availability condition",
      writes.length >= 4 && unscoped.length === 0,
      { writes: writes.length, unscoped },
    );
  }
  {
    // EVERY read, not "queueWhere appears somewhere". Four queries read
    // Prospect in this file and three of them being scoped is a leak.
    const reads = [
      ...argsOf(queueRoute, "db.prospect.findMany("),
      ...argsOf(queueRoute, "db.prospect.findFirst("),
      ...argsOf(queueRoute, "db.prospect.count("),
    ];
    const unscoped = reads.filter(
      (r) => !/queueWhere\(rep\.id|claimCandidateWhere\(/.test(r) && !scopedToRep(r),
    );
    ok(
      "every Prospect read in the queue route is scoped to the rep or to the claimable pool",
      reads.length >= 4 && unscoped.length === 0,
      { reads: reads.length, unscoped },
    );
    // The one read that returns a WHOLE prospect — capabilities, inferences,
    // opportunities, evidence — is the one a leak would matter most in.
    const full = argsOf(queueRoute, "db.prospect.findFirst(").filter((r) => /include:/.test(r));
    ok(
      "the prospect handed to the rep is re-read through queueWhere, never by id alone",
      full.length === 1 && /queueWhere\(rep\.id/.test(full[0]),
      full.length,
    );
  }
  ok(
    "there is no endpoint that lists unclaimed prospects to a rep",
    !/findMany\(\{\s*where: claimCandidateWhere/.test(queueRoute),
  );
  ok(
    "a do-not-contact needs a stated reason",
    /if \(!reason\)/.test(postBody || ""),
  );
  {
    // ── The date cannot be moved by a second press ─────────────────────────
    //
    // The rule was stated in a comment and enforced by nothing: `updateMany`
    // with a plain `where: mine` overwrote `doNotContactAt` every time, losing
    // when the business actually asked — the one fact the column exists to
    // hold, and the one a regulator would ask for. lib/sales/calls/store.js
    // states the same rule and reads first for it. Here it rides in the WHERE.
    const dncWrite = argsOf(postBody || "", "db.prospect.updateMany(").find((w) =>
      /doNotContactAt: now/.test(w),
    );
    ok("the do-not-contact write is findable", Boolean(dncWrite));
    ok(
      "…and it refuses to move a date that is already set",
      /where: \{ \.\.\.mine, doNotContactAt: null \}/.test(dncWrite || ""),
      dncWrite?.slice(0, 200),
    );
    ok(
      "…and a row already recorded is a success, not a 404 that invites a second press",
      /if \(done\.count === 0\)[\s\S]{0,400}?if \(!already\) return notFound\(\);/.test(
        postBody || "",
      ),
    );
  }
  {
    // ── The screen may not promise what the route does not write ───────────
    //
    // This control writes Prospect.doNotContactAt and NOTHING else —
    // queueGate.js excludes SalesSuppression on purpose and REP_QUEUE_WRITES
    // above asserts it stays excluded. The screen said "Why should nobody
    // contact them again?" and "Only a superadmin can lift it". Neither was
    // true of a row flag: the same business re-ingested from a second register
    // is a new row and is callable, and nothing anywhere lifts this column —
    // the superadmin-with-a-reason rule belongs to `unsuppress`, on the list
    // this action never touches.
    //
    // Asserted on the QUEUE PAGE's source rather than on a translated string
    // because this page is rep-facing and English-only, the same reason the
    // page carries its copy inline.
    const page = read("app/sales/queue/page.js");
    ok(
      "the queue's do-not-contact does not claim the platform list",
      !/nobody contact them again/.test(page),
    );
    ok(
      "…and does not claim a superadmin lift it has no part in",
      !/Only a superadmin can lift it/.test(page),
    );
    ok(
      "…and names the disposition that DOES bind every rep and channel",
      /Asked not to be called again/.test(page) &&
        /binds every rep and every channel/.test(page),
    );
    ok(
      "…and the disposition it names is a real one that writes a suppression",
      DISPOSITIONS.do_not_call?.label === "Asked not to be called again" &&
        DISPOSITIONS.do_not_call?.doNotContact === true,
      DISPOSITIONS.do_not_call?.label,
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. Vocabulary the screens filter on is vocabulary something writes
   ═══════════════════════════════════════════════════════════════════════ */
section("12. Nothing filters on a status the pipeline never writes");

{
  const ingest = codeOnly(read("lib/sales/discovery/ingest.js"));
  const review = codeOnly(read("app/api/platform/sales/campaigns/[id]/review/route.js"));
  const writtenStatuses = new Set();
  for (const src of [ingest, review]) {
    for (const m of src.matchAll(/status:\s*"([a-z_]+)"/g)) writtenStatuses.add(m[1]);
    for (const m of src.matchAll(/"([a-z_]+)"\s*:\s*"[^"]*"\s*\?/g)) writtenStatuses.add(m[1]);
  }
  // The ternary in ingest.js writes both arms; pick them up explicitly.
  for (const m of ingest.matchAll(/=== "([a-z_]+)" \? "([a-z_]+)" : "([a-z_]+)"/g)) {
    writtenStatuses.add(m[2]);
    writtenStatuses.add(m[3]);
  }
  const offered = Object.keys(PROSPECT_STATUS_LABELS);
  const orphans = offered.filter((s) => !writtenStatuses.has(s));
  ok(
    "every status the filter offers is one the pipeline actually writes",
    orphans.length === 0,
    { orphans, writtenStatuses: [...writtenStatuses] },
  );
  ok("…and there are statuses to offer", offered.length >= 3, offered);
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. The source's own categories reach the screen, and are not called a trade
   ═══════════════════════════════════════════════════════════════════════ */
section("13. Every source category is shown, labelled as what it is");

// A real RBQ authorisation set: the thirteen-code general-contractor bundle
// plus four that actually distinguish this licence. Seventeen, which is the
// measured median — see lib/sales/discovery/rbq/licence.js's header. The point
// of the number is that a screen which truncates "the first three" would drop
// `rbq:16` (electrical), the one code here a rep could act on.
const RBQ_SEVENTEEN = [
  "rbq:1.1", "rbq:1.2", "rbq:1.3", "rbq:2.5", "rbq:2.7", "rbq:3.2", "rbq:4.2",
  "rbq:5.2", "rbq:6.2", "rbq:7", "rbq:8", "rbq:9", "rbq:11.2", "rbq:12",
  "rbq:13.5", "rbq:16", "rbq:17.2",
];

{
  const view = sourceCategoryView({
    sourceProvider: "rbq",
    sourceCategories: RBQ_SEVENTEEN,
    tradeKey: null,
  });
  const shown = view.groups.flatMap((g) => g.rows);

  ok("a prospect with 17 source categories reports 17", view.count === 17, view.count);
  ok(
    "…and all 17 are handed to the screen, not the first three",
    shown.length === 17,
    shown.length,
  );
  ok(
    "…and every one of the 17 raw strings survives verbatim",
    shown.map((r) => r.raw).join("|") === RBQ_SEVENTEEN.join("|"),
    shown.map((r) => r.raw),
  );
  ok(
    "…including the one a 'first three' truncation would have dropped",
    shown.some((r) => r.raw === "rbq:16"),
    shown.map((r) => r.raw).slice(0, 4),
  );
  ok(
    "the RBQ codes are presented as an authorisation, never as a listing",
    view.groups.length === 1 && view.groups[0].kind === "authorisation",
    view.groups.map((g) => g.kind),
  );
  ok(
    "the code is kept typeable — namespace split off, code left as the register prints it",
    shown.find((r) => r.raw === "rbq:13.5")?.code === "13.5",
    shown.find((r) => r.raw === "rbq:13.5"),
  );
  // The register publishes `9`, not `9 — travaux de finition`. Guessing the
  // forty subcategory titles from memory is AGENTS.md failure class 5 with a
  // legal document as the thing being padded.
  ok(
    "no title is invented for a code the source published without one",
    shown.every((r) => r.description === null),
    shown.filter((r) => r.description !== null),
  );
  ok(
    "…and the screen is told to say so, with the lookup that does answer it",
    typeof view.groups[0].untitled === "string" && view.groups[0].untitled.length > 20,
    view.groups[0].untitled,
  );
}

{
  // A directory listing: the source's string IS the description, slugged.
  const view = sourceCategoryView({
    sourceProvider: "overture",
    sourceCategories: ["painting", "carpet_installation"],
  });
  const rows = view.groups.flatMap((g) => g.rows);
  ok(
    "a slugged source string is read back as words",
    rows.find((r) => r.raw === "carpet_installation")?.description === "carpet installation",
    rows,
  );
  ok(
    "…with the raw string kept beside it, because that is what gets typed",
    rows.find((r) => r.raw === "carpet_installation")?.raw === "carpet_installation",
    rows,
  );
  ok(
    "a string that de-slugs to itself gets no second line rather than a duplicate one",
    rows.find((r) => r.raw === "painting")?.description === null,
    rows,
  );
  ok(
    "…and the untitled hint is NOT shown for a group that does carry descriptions",
    view.groups[0].untitled === null,
    view.groups[0].untitled,
  );
  ok(
    "a directory listing is presented as a listing, not an authorisation",
    view.groups[0].kind === "listing",
    view.groups[0].kind,
  );
}

{
  // Absence is a statement, and there are two different absences.
  const said = sourceCategoryView({ sourceProvider: "overture", sourceCategories: [] });
  const never = sourceCategoryView({ sourceProvider: null, sourceCategories: [] });

  ok("a prospect with no categories is not `known`", said.known === false, said);
  ok(
    "…and says so in words rather than rendering an empty box",
    typeof said.emptyText === "string" && said.emptyText.length > 20,
    said.emptyText,
  );
  ok(
    "…naming the source that said nothing",
    /Overture/i.test(said.emptyText || ""),
    said.emptyText,
  );
  ok(
    "a hand-typed row with no source at all gets a DIFFERENT sentence",
    typeof never.emptyText === "string" && never.emptyText !== said.emptyText,
    { said: said.emptyText, never: never.emptyText },
  );
  ok(
    "…and neither absence produces a group to render",
    said.groups.length === 0 && never.groups.length === 0,
    { said: said.groups.length, never: never.groups.length },
  );
  ok(
    "a prospect that never had the field at all does not throw",
    sourceCategoryView({}).count === 0 && sourceCategoryView().count === 0,
  );
}

{
  // normalise.js concatenates the source's primary category onto its
  // alternates, so a provider that repeats the primary produces two identical
  // strings. Both must survive — a screen promising "every category" that
  // de-duplicates is showing fewer than it says — and they must not collide
  // as React keys, which is how the second one would vanish anyway.
  const dup = sourceCategoryView({
    sourceProvider: "overture",
    sourceCategories: ["painting", "painting"],
  });
  const dupRows = dup.groups.flatMap((g) => g.rows);
  ok("a repeated category is shown twice, not silently de-duplicated", dup.count === 2, dup.count);
  ok(
    "…and the two carry distinct keys, so neither is dropped when rendered",
    dupRows.length === 2 && dupRows[0].key !== dupRows[1].key,
    dupRows.map((r) => r.key),
  );
  ok(
    "the screen keys rows on that key rather than on the raw string",
    /key=\{row\.key\}/.test(platformPage),
    platformPage.match(/.{0,20}key=\{row\..{0,10}/)?.[0],
  );
}

{
  // A namespace is only a namespace if we know it. Otherwise `https://x`
  // reads as namespace `https`, and the code shown is not the string stored.
  const parts = sourceCategoryParts("https://example.test/x");
  ok(
    "an unknown prefix is left in the code rather than eaten as a namespace",
    parts.namespace === null && parts.code === "https://example.test/x",
    parts,
  );
  // These strings arrive verbatim from a third-party CSV, and every plain
  // object answers to `constructor` — so a lookup that is not an own-property
  // check would have split this one and rendered an undefined source label.
  for (const poisoned of ["constructor:9", "toString:9", "__proto__:9"]) {
    const p = sourceCategoryParts(poisoned);
    ok(
      `a category named ${poisoned.split(":")[0]} is not mistaken for a known namespace`,
      p.namespace === null && p.code === poisoned,
      p,
    );
  }
  const poisonedView = sourceCategoryView({
    sourceProvider: "rbq",
    sourceCategories: ["constructor:9"],
  });
  ok(
    "…and it still renders with a real note rather than an undefined one",
    typeof poisonedView.groups[0]?.note === "string" && poisonedView.groups[0].kind === "listing",
    poisonedView.groups[0],
  );
}

// ── Nothing under this heading calls a category a trade ──────────────────
//
// The whole reason `tradeKey` is null on an RBQ row. The rule has two halves,
// because a blanket ban on the word would forbid the sentence that does the
// work: a LABEL may not contain it at all, and a NOTE may only contain it
// under a negation.
{
  const labels = [SOURCE_CATEGORY_HEADING.title];
  const notes = [SOURCE_CATEGORY_HEADING.note];
  for (const fixture of [
    { sourceProvider: "rbq", sourceCategories: RBQ_SEVENTEEN },
    { sourceProvider: "overture", sourceCategories: ["painting", "carpet_installation"] },
  ]) {
    const view = sourceCategoryView(fixture);
    if (view.emptyText) notes.push(view.emptyText);
    for (const g of view.groups) {
      if (g.sourceLabel) labels.push(g.sourceLabel);
      labels.push(g.kind);
      if (g.note) notes.push(g.note);
      if (g.untitled) notes.push(g.untitled);
    }
  }
  for (const view of [
    sourceCategoryView({ sourceProvider: "overture", sourceCategories: [] }),
    sourceCategoryView({}),
  ]) {
    if (view.emptyText) notes.push(view.emptyText);
  }

  ok("there are labels and notes to check", labels.length >= 4 && notes.length >= 5, {
    labels: labels.length,
    notes: notes.length,
  });
  const labelSaysTrade = labels.filter((s) => /trade/i.test(s));
  ok(
    "no label, heading or kind under this section calls a category a trade",
    labelSaysTrade.length === 0,
    labelSaysTrade,
  );

  // A note MAY say "never a trade". It may not say "the trade is". So every
  // occurrence has to sit downstream of a negation in the same breath.
  const unnegated = [];
  for (const note of notes) {
    for (const m of note.matchAll(/trade/gi)) {
      const before = note.slice(Math.max(0, m.index - 40), m.index);
      if (!/\b(no|not|never|neither|nothing|rather than)\b/i.test(before)) {
        unnegated.push(note.slice(Math.max(0, m.index - 40), m.index + 20));
      }
    }
  }
  ok(
    "…and every mention of a trade in the explanations is a denial that this is one",
    unnegated.length === 0,
    unnegated,
  );

  // The negation matcher, asserted before anything trusts it — the same
  // discipline the brace matcher gets at the top of this file.
  {
    const negated = (s) =>
      [...s.matchAll(/trade/gi)].every((m) =>
        /\b(no|not|never|neither|nothing|rather than)\b/i.test(s.slice(Math.max(0, m.index - 40), m.index)),
      );
    ok("the negation matcher accepts a denial", negated("these are never a trade"));
    ok("…and rejects a claim", !negated("the trade this business works in"));
  }
}

// ── The screen actually renders them ─────────────────────────────────────
{
  const body = bodyOf(platformPage, "function SourceCategories");
  ok("the categories section is a real component on the screen", Boolean(body));
  ok(
    "the detail view renders it rather than defining it and forgetting it",
    /<SourceCategories\b/.test(platformPage),
    platformPage.match(/.{0,40}<SourceCategories.{0,40}/)?.[0],
  );
  ok(
    "it is fed from the route's own presenter output",
    /view=\{p\.sourceCategoriesView\}/.test(platformPage),
    platformPage.match(/.{0,30}sourceCategoriesView.{0,30}/)?.[0],
  );
  ok(
    "the section maps over every row the presenter returned",
    /\.rows\.map\(/.test(body || ""),
    body?.slice(0, 200),
  );
  // `>{expr}<` and not just `{expr}`: the first draft of these two matched
  // `key={row.raw}`, so replacing the rendered code with `{row.code}` — losing
  // the `rbq:` namespace a person needs to know which register it is — passed.
  // A React key is not a rendered value.
  ok(
    "…rendering the raw code, which is the thing a superadmin types into the RBQ lookup",
    />\{row\.raw\}</.test(body || ""),
    body?.slice(0, 300),
  );
  ok(
    "…and the description underneath when the source gave one",
    />\{row\.description\}</.test(body || ""),
    body?.slice(0, 300),
  );
  ok(
    "the section truncates nothing — no slice, no take, no “+N more”",
    !/\.slice\(|\.splice\(|more\b/.test(body || ""),
    (body || "").match(/.{0,40}(\.slice\(|\.splice\(|more\b).{0,20}/)?.[0],
  );
  ok(
    "an empty set renders the presenter's sentence, not an empty box",
    />\{view\.emptyText\}</.test(body || ""),
    body?.slice(0, 300),
  );
  ok(
    "the heading comes from the shared module rather than being retyped in JSX",
    /SOURCE_CATEGORY_HEADING\.title/.test(body || "") &&
      /SOURCE_CATEGORY_HEADING/.test(platformPage.match(/import \{[^}]*\} from "@\/lib\/sales\/prospectView"/)?.[0] || ""),
    body?.slice(0, 300),
  );
  ok(
    "the group's honest note is rendered too, not just the codes",
    />\{g\.note\}</.test(body || ""),
    body?.slice(0, 400),
  );
  // The shape this task was called in to fix: returned by the API for months,
  // rendered as a comma-joined line nobody can read or type.
  ok(
    "the cramped provenance one-liner is gone, not left duplicating the section",
    !/sourceCategories\?\.join|sourceCategories\)\.join/.test(platformPage),
    platformPage.match(/.{0,40}sourceCategories.{0,30}join.{0,20}/)?.[0],
  );
  ok(
    "the detail route sends the presented view, not only the bare array",
    /sourceCategoriesView: sourceCategoryView\(/.test(platformDetail),
    platformDetail.match(/.{0,40}sourceCategoriesView.{0,40}/)?.[0],
  );
}

// ── Triage: the filter, and the population only it can reach ─────────────
{
  ok(
    "the list route reads a source category off the query string",
    /searchParams\.get\("sourceCategory"\)/.test(platformList),
    platformList.match(/.{0,30}sourceCategory.{0,40}/)?.[0],
  );
  ok(
    "…and filters on the array in Postgres, not by fetching and filtering in JS",
    /where\.sourceCategories = \{ has: sourceCategory \}/.test(platformList),
    platformList.match(/.{0,40}where\.sourceCategories.{0,40}/)?.[0],
  );
  ok(
    "the option list is built from the rows themselves, so a picked value cannot match nothing",
    /unnest\("sourceCategories"\)/.test(platformList),
    platformList.match(/.{0,40}unnest.{0,40}/)?.[0],
  );
  ok(
    "…and the 'no such category exists' claim is gated on that list being complete",
    /sourceCategoryOptionsComplete/.test(platformList) &&
      /data\.sourceCategoryOptionsComplete &&/.test(platformPage),
    platformPage.match(/.{0,60}sourceCategoryOptionsComplete.{0,40}/)?.[0],
  );
  ok(
    "a failure to build the option list is reported, never returned as an empty vocabulary",
    /sourceCategoryOptionsError/.test(platformList) && /sourceCategoryOptionsError/.test(platformPage),
    platformList.match(/.{0,40}sourceCategoryOptionsError.{0,30}/)?.[0],
  );
  // A separate control, never a second spelling of the trade one — the rows
  // this reaches have no trade by design.
  const labelText = platformPage.match(/htmlFor="f-source-category"\s*>\s*([^<]+)/)?.[1]?.trim();
  ok("the filter has its own labelled control", Boolean(labelText), labelText);
  ok(
    "…whose label does not call a category a trade",
    Boolean(labelText) && !/trade/i.test(labelText),
    labelText,
  );
  ok(
    "…and it is a search-as-you-type, not a flat select of ninety opaque codes",
    // `\s` before the attribute: without it, `data-list=` — which wires the
    // input to nothing — matched and this passed.
    /\slist="f-source-category-options"/.test(platformPage) &&
      /<datalist id="f-source-category-options">/.test(platformPage) &&
      /<input\b[^>]*id="f-source-category"/.test(platformPage),
    platformPage.match(/.{0,40}f-source-category-options.{0,30}/)?.[0],
  );
  // Scoped to the datalist's own body: a suggestion list wired to a literal
  // `[]` renders the element, satisfies every assertion above, and offers
  // nothing to pick — which is the "control that appears to work" AGENTS.md
  // names as the rule that matters most.
  {
    const open = platformPage.indexOf('<datalist id="f-source-category-options">');
    const close = platformPage.indexOf("</datalist>", open);
    const block = open === -1 || close === -1 ? "" : platformPage.slice(open, close);
    ok(
      "…and the suggestions are the categories the payload actually reported",
      /sourceCategoryOptions\b/.test(block) && /\.map\(/.test(block),
      block.slice(0, 200),
    );
  }
}

// ── The same filter, EXECUTED against the shipped route ──────────────────
//
// The assertion that matters: a prospect the trade filter cannot see — every
// Quebec licence-holder, because `tradeKey` is null by design — comes back
// when filtered on one of its authorisations. A regex over the route can show
// the `has` is written; only running it shows the row arrives.
{
  const { register } = await import("node:module");
  const prospects = [
    {
      id: "p_rbq",
      businessName: "Licence with no trade",
      tradeKey: null,
      sourceCategories: RBQ_SEVENTEEN,
      status: "discovered",
      hasWebsite: null,
      technologies: [],
      scores: [],
      territory: null,
      campaign: null,
      googleRating: null,
      googleReviewCount: null,
      lastCrawledAt: null,
      assignedRepId: null,
      claimExpiresAt: null,
      doNotContactAt: null,
    },
    {
      id: "p_other",
      businessName: "A painter the directory did categorise",
      tradeKey: "painting",
      sourceCategories: ["painting"],
      status: "discovered",
      hasWebsite: null,
      technologies: [],
      scores: [],
      territory: null,
      campaign: null,
      googleRating: null,
      googleReviewCount: null,
      lastCrawledAt: null,
      assignedRepId: null,
      claimExpiresAt: null,
      doNotContactAt: null,
    },
  ];

  /** Only the operators this route uses, and `has` really applied. */
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "AND") return value.every((w) => matches(row, w));
      if (key === "OR") return value.some((w) => matches(row, w));
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if ("has" in value) return (row[key] || []).includes(value.has);
        if ("hasSome" in value) return (row[key] || []).some((v) => value.hasSome.includes(v));
        if ("not" in value) return row[key] !== value.not;
        if ("contains" in value) return String(row[key] ?? "").includes(value.contains);
        // An operator this stub does not model must NOT quietly pass — that is
        // how a filter becomes a no-op and every assertion below goes green.
        throw new Error(`stub: unmodelled filter on ${key}: ${JSON.stringify(value)}`);
      }
      return row[key] === value;
    });

  const seen = [];
  globalThis.__FQ_PROSPECT_DB = {
    prospect: {
      findMany: async (args = {}) => {
        seen.push(args.where);
        return prospects.filter((p) => matches(p, args.where));
      },
      count: async (args = {}) => prospects.filter((p) => matches(p, args.where)).length,
      groupBy: async () => [],
    },
    salesTerritory: { findMany: async () => [] },
    prospectCampaign: { findMany: async () => [] },
    prospectScore: { count: async () => 0 },
    $queryRaw: async () => [
      { category: "rbq:9", n: 44134 },
      { category: "painting", n: 12 },
    ],
  };

  register(
    `data:text/javascript,${encodeURIComponent(`
      export async function resolve(specifier, context, nextResolve) {
        if (specifier === "@/lib/db") return { url: "fq-prospect:db", shortCircuit: true };
        if (specifier === "next/server") return { url: "fq-prospect:next", shortCircuit: true };
        if (specifier === "@/lib/sales/intel/configAdmin")
          return { url: "fq-prospect:admin", shortCircuit: true };
        return nextResolve(specifier, context);
      }
      export async function load(url, context, nextLoad) {
        if (url === "fq-prospect:db")
          return { format: "module", shortCircuit: true,
            source: "export const db = globalThis.__FQ_PROSPECT_DB;" };
        if (url === "fq-prospect:next")
          return { format: "module", shortCircuit: true,
            source: "export const NextResponse = { json: (body, init) => ({ status: init?.status ?? 200, body }) };" };
        if (url === "fq-prospect:admin")
          return { format: "module", shortCircuit: true,
            source: "export const superadminOrRefusal = async () => ({ admin: { role: 'superadmin' }, refusal: null });" };
        return nextLoad(url, context);
      }
    `)}`,
  );

  const { GET } = await import("../app/api/platform/sales/prospects/route.js");
  const call = async (qs) =>
    (await GET({ url: `https://x.test/api/platform/sales/prospects?${qs}` })).body;

  const filtered = await call("sourceCategory=rbq%3A9");
  ok(
    "the category filter returns the prospect whose tradeKey is null",
    filtered.prospects.length === 1 && filtered.prospects[0].id === "p_rbq",
    filtered.prospects.map((p) => p.id),
  );
  ok(
    "…and that prospect really does have no trade to filter it by",
    filtered.prospects[0]?.tradeKey === null && filtered.prospects[0]?.tradeLabel === null,
    filtered.prospects[0],
  );
  // Without this, a filter that silently did nothing would pass the one above.
  ok(
    "…and the filter EXCLUDES a prospect that does not carry the category",
    !filtered.prospects.some((p) => p.id === "p_other") && filtered.total === 1,
    { ids: filtered.prospects.map((p) => p.id), total: filtered.total },
  );
  ok(
    "the query Prisma was given used `has` on the array column",
    seen.some((w) => w?.sourceCategories?.has === "rbq:9"),
    seen,
  );
  ok(
    "…and filtering on a category never quietly constrains the trade as well",
    seen.every((w) => !("tradeKey" in (w || {}))),
    seen,
  );
  // The gap this control exists to close, executed rather than asserted in prose.
  const byTrade = await call("tradeKey=painting");
  ok(
    "the trade filter cannot reach that prospect — which is why this control exists",
    byTrade.prospects.length === 1 && byTrade.prospects[0].id === "p_other",
    byTrade.prospects.map((p) => p.id),
  );

  const unfiltered = await call("");
  ok(
    "with no category filter both prospects are listed",
    unfiltered.prospects.length === 2,
    unfiltered.prospects.map((p) => p.id),
  );
  ok(
    "each row reports how many source categories it carries, so the set is findable",
    unfiltered.prospects.find((p) => p.id === "p_rbq")?.sourceCategoryCount === 17,
    unfiltered.prospects.map((p) => [p.id, p.sourceCategoryCount]),
  );
  ok(
    "the picker's options carry the row counts that make a category triageable",
    unfiltered.sourceCategoryOptions?.[0]?.category === "rbq:9" &&
      unfiltered.sourceCategoryOptions[0].count === 44134,
    unfiltered.sourceCategoryOptions,
  );
  ok(
    "a complete option list says so, so the screen may call an unknown string a typo",
    unfiltered.sourceCategoryOptionsComplete === true &&
      unfiltered.sourceCategoryOptionsError === null,
    {
      complete: unfiltered.sourceCategoryOptionsComplete,
      error: unfiltered.sourceCategoryOptionsError,
    },
  );

  // A vocabulary too big to send whole. `complete` has to be COMPUTED — a
  // hardcoded `true` passes the assertion above, and the page uses that flag
  // to tell a superadmin a category does not exist, which would then be a lie
  // about every category past the cap.
  globalThis.__FQ_PROSPECT_DB.$queryRaw = async () =>
    Array.from({ length: 401 }, (_, i) => ({ category: `c${i}`, n: 401 - i }));
  const capped = await call("");
  ok(
    "an option list longer than the cap is trimmed to it",
    capped.sourceCategoryOptions.length === 400,
    capped.sourceCategoryOptions.length,
  );
  ok(
    "…and is reported as INCOMPLETE, so the screen may not call an unlisted category a typo",
    capped.sourceCategoryOptionsComplete === false,
    capped.sourceCategoryOptionsComplete,
  );

  // And when the aggregate fails, the LIST still works and the screen is told.
  globalThis.__FQ_PROSPECT_DB.$queryRaw = async () => {
    throw new Error("statement timeout");
  };
  const degraded = await call("");
  ok(
    "a failed option aggregate does not take the list of prospects down with it",
    degraded.prospects.length === 2,
    degraded.prospects.length,
  );
  ok(
    "…and it is reported as a failure rather than as an empty vocabulary",
    degraded.sourceCategoryOptions.length === 0 &&
      typeof degraded.sourceCategoryOptionsError === "string" &&
      degraded.sourceCategoryOptionsComplete === false,
    {
      options: degraded.sourceCategoryOptions.length,
      error: degraded.sourceCategoryOptionsError,
      complete: degraded.sourceCategoryOptionsComplete,
    },
  );
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  - ${f}`);
}
process.exit(failures.length ? 1 : 0);
