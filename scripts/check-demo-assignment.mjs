// scripts/check-demo-assignment.mjs
//
//   npm run check:demo-assignment
//
// "The sales should have one demo available in their account."
//
// ══ What was actually wrong ═══════════════════════════════════════════════
//
// Three failures in one small feature, and each one hid the next.
//
//   1. NOTHING WROTE SalesRep.demoCompanyId. The column was @unique, read in
//      three places (the rep's API, scope.js, gate.js) and written in NONE, on
//      either side of the product. /sales/demo told a rep "ask a FieldQuo admin
//      to assign you one on the platform demo screen — it takes them a click",
//      and there was no click and no screen for it. A sentence promising a
//      control that does not exist is the same failure as a dead button.
//
//   2. POST /api/sales/demo WAS GATED READ-ONLY. It went through
//      requireSalesRep(), which refuses every non-GET method under /api/sales
//      — correctly, that is its whole job. So "Reset the data" and the trade
//      picker both returned 403 for as long as they had existed.
//
//   3. THE ROUTE SELECTED Company.industry, WHICH DOES NOT EXIST. Any rep who
//      DID have a demo would have got a Prisma validation error on every load.
//
// The second and third were invisible because of the first: those controls only
// render for a rep who has a demo, and nobody could have one.
//
// ══ How this checks them ══════════════════════════════════════════════════
//
// The decision is a pure function over rows the caller has already read
// (lib/sales/demoPool.js, the shape lib/sales/calls/inboundDistribution.js
// established), so every branch below is a CALL with an asserted answer — no
// demos at all, every demo taken, a rep who already has one, a rep pointed at
// a company that stopped being a demo, duplicate ids in the pool. Those are
// exactly the states a manual test never reaches.
//
// The race is proven by executing claimDemoForRep() against a stubbed Prisma
// client that throws P2002 the way Postgres would, rather than by reading the
// catch block.
//
// ══ Source assertions are made on DECOMMENTED source ══════════════════════
//
// This repo's headers are deliberately thorough, and three checks have been
// fooled today by matching their own prose. Every regex below runs on source
// with comments stripped, so a check cannot be satisfied by a sentence about
// the code.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  planDemoClaim,
  usableDemos,
  takenDemoIds,
  claimRefusal,
  MAX_CLAIM_ATTEMPTS,
} from "@/lib/sales/demoPool";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

/** Comments blanked, string literals kept. Same job as check-sales-auth's. */
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
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") { out += c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    if (c === "\\") { out += "  "; i += 2; continue; }
    if (c === state) state = "code";
    out += c === "\n" ? "\n" : c;
    i++;
  }
  return out;
}

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);

const demo = (id, slug, extra = {}) => ({ id, slug, name: slug, isDemo: true, ...extra });
const POOL = [demo("c1", "demo1"), demo("c2", "demo2"), demo("c3", "demo3")];
const REP = { id: "rep_1", demoCompanyId: null };

// ═══════════════════════════════════════════════════════════════════════════
section("1. The decision, driven through every branch with no database");
// ═══════════════════════════════════════════════════════════════════════════

{
  // The happy path, and it is deterministic — WHICH demo, not merely one.
  const d = planDemoClaim({ rep: REP, demos: POOL, assignments: [] });
  ok("a rep with nothing gets the first free demo", d.outcome === "assign" && d.companyId === "c1", d);
  ok("...and is told how many were free", d.free === 3, d);

  // Order is by slug, not by the order rows came back in.
  const shuffled = [demo("c3", "demo3"), demo("c1", "demo1"), demo("c2", "demo2")];
  ok(
    "the answer does not depend on the order Postgres returned the rows in",
    planDemoClaim({ rep: REP, demos: shuffled, assignments: [] }).companyId === "c1",
  );
}

{
  // Already has one: idempotent, and never a second.
  const rep = { id: "rep_1", demoCompanyId: "c2" };
  const d = planDemoClaim({ rep, demos: POOL, assignments: [{ id: "rep_1", demoCompanyId: "c2" }] });
  ok("a rep who already has one gets theirs back", d.outcome === "already_assigned" && d.companyId === "c2", d);
  ok("...with the company attached", d.company?.slug === "demo2", d);
  ok("...and it is not a refusal", claimRefusal(d) === null);
  ok("...and it is never an assign", d.outcome !== "assign");
}

{
  // Every demo spoken for.
  const assignments = POOL.map((c, i) => ({ id: `rep_${i + 9}`, demoCompanyId: c.id }));
  const d = planDemoClaim({ rep: REP, demos: POOL, assignments });
  ok("all taken is its own outcome", d.outcome === "all_taken", d);
  ok("...carrying the real counts", d.total === 3 && d.taken === 3, d);
  const no = claimRefusal(d);
  ok("...and the refusal states them rather than being generic", /All 3 demo companies are/.test(no?.error || ""), no);
  ok("...as a 409, not a 500", no?.status === 409, no);
}

{
  // Nothing seeded at all. A different sentence from "all taken", because it
  // is a different thing for a superadmin to do about it.
  const d = planDemoClaim({ rep: REP, demos: [], assignments: [] });
  ok("an empty pool is no_pool, not all_taken", d.outcome === "no_pool", d);
  ok("...and says nothing exists rather than that everything is busy", /no demo companies at all/.test(claimRefusal(d)?.error || ""));
}

{
  // A demo assigned to a rep who no longer exists — the row is gone, the
  // pointer is not. Counted as TAKEN, because @unique does not care that
  // somebody left, and pretending otherwise produces a candidate whose write
  // can only ever fail.
  const assignments = [
    { id: "rep_departed", demoCompanyId: "c1" },
    { id: "rep_departed_2", demoCompanyId: "c2" },
  ];
  const d = planDemoClaim({ rep: REP, demos: POOL, assignments });
  ok("a departed rep's demo is still taken", d.companyId === "c3", d);
  ok("...and is counted in the taken total", planDemoClaim({ rep: REP, demos: POOL, assignments: [...assignments, { id: "x", demoCompanyId: "c3" }] }).taken === 3);
}

{
  // The rep's OWN pointer aims at something that is not in the pool.
  const rep = { id: "rep_1", demoCompanyId: "gone" };
  const d = planDemoClaim({ rep, demos: POOL, assignments: [{ id: "rep_1", demoCompanyId: "gone" }] });
  ok("a stale pointer is already_assigned, not a fresh demo", d.outcome === "already_assigned", d);
  ok("...with a null company, which is the honest answer", d.company === null, d);
  const no = claimRefusal(d);
  ok("...and it refuses rather than handing out a second", no?.status === 409, no);
  ok("...naming release as the fix", /release it/i.test(no?.error || ""), no);
}

{
  // Duplicate ids, non-demo rows, and junk. The pool must not be inflated and
  // a non-demo must never be handed out.
  const dirty = [
    demo("c1", "demo1"),
    demo("c1", "demo1"),
    { id: "real", slug: "acme", name: "Acme Painting", isDemo: false },
    { id: "", slug: "blank", isDemo: true },
    null,
    { slug: "no-id", isDemo: true },
  ];
  const clean = usableDemos(dirty);
  ok("duplicate ids are deduped", clean.length === 1, clean.map((c) => c.id));
  ok("a company that is not a demo is never in the pool", !clean.some((c) => c.id === "real"));
  const d = planDemoClaim({ rep: REP, demos: dirty, assignments: [] });
  ok("...so a real tenant can never be handed to a rep", d.companyId === "c1", d);
  ok(
    "all-taken counts the deduped pool, not the raw rows",
    planDemoClaim({ rep: REP, demos: dirty, assignments: [{ id: "r", demoCompanyId: "c1" }] }).total === 1,
  );
}

{
  // Junk assignment rows must not make a free demo look taken.
  const taken = takenDemoIds([null, {}, { demoCompanyId: null }, { demoCompanyId: "" }, { demoCompanyId: "c2" }, "nope"]);
  ok("only real pointers count as taken", taken.size === 1 && taken.has("c2"), [...taken]);
}

{
  // No identity at all. Refuse; never guess a rep.
  ok("a missing rep is refused, not handed a demo", planDemoClaim({ rep: null, demos: POOL, assignments: [] }).outcome === "no_rep");
  ok("...as a 401", claimRefusal({ outcome: "no_rep" })?.status === 401);
  ok("no arguments at all still refuses", planDemoClaim().outcome === "no_rep");
  ok("an unknown outcome refuses rather than returning null", claimRefusal({ outcome: "???" })?.status === 401);
}

{
  // excludeIds — what the retry loop feeds back after losing a race.
  const d1 = planDemoClaim({ rep: REP, demos: POOL, assignments: [], excludeIds: ["c1"] });
  ok("an excluded demo is skipped", d1.companyId === "c2", d1);
  const d2 = planDemoClaim({ rep: REP, demos: POOL, assignments: [], excludeIds: ["c1", "c2", "c3"] });
  ok("excluding everything is 'exhausted', NOT 'all taken'", d2.outcome === "exhausted", d2);
  ok("...because the advice differs — retry, not go ask for more", /Try again/.test(claimRefusal(d2)?.error || ""));
  ok("...and it says how many it tried", d2.tried === 3, d2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The race is settled by the constraint, executed not read");
// ═══════════════════════════════════════════════════════════════════════════

// A stand-in Prisma client whose unique index behaves like Postgres's: the
// second write to a taken demoCompanyId throws P2002. Executing this is the
// only way to prove the retry actually retries — the catch block reads
// correctly in every version of it, including the broken ones.
function stubDb({ demos, reps, contendedIds = new Set() }) {
  const byId = new Map(reps.map((r) => [r.id, { ...r }]));
  const calls = { updates: 0, p2002: 0 };
  return {
    calls,
    reps: byId,
    company: {
      findMany: async () => demos.map((d) => ({ ...d })),
      findUnique: async ({ where }) => demos.find((d) => d.id === where.id) || null,
    },
    salesRep: {
      findUnique: async ({ where }) => (byId.has(where.id) ? { ...byId.get(where.id) } : null),
      findFirst: async ({ where }) =>
        [...byId.values()].find((r) => r.demoCompanyId === where.demoCompanyId) || null,
      findMany: async () => [...byId.values()].filter((r) => r.demoCompanyId),
      updateMany: async ({ where, data }) => {
        calls.updates++;
        const row = byId.get(where.id);
        if (!row) return { count: 0 };
        if ("demoCompanyId" in where && row.demoCompanyId !== where.demoCompanyId) {
          return { count: 0 };
        }
        const target = data.demoCompanyId;
        if (target) {
          const heldByOther =
            contendedIds.has(target) ||
            [...byId.values()].some((r) => r.id !== where.id && r.demoCompanyId === target);
          if (heldByOther) {
            calls.p2002++;
            const err = new Error("Unique constraint failed on the fields: (`demoCompanyId`)");
            err.code = "P2002";
            throw err;
          }
        }
        row.demoCompanyId = target;
        return { count: 1 };
      },
    },
  };
}

// THE SHIPPED LOOP, not a copy of it. claimDemoForRep takes its Prisma client
// as an argument for exactly this reason: re-implementing the retry inside the
// check would prove the check retries, which nobody doubted.
const { claimDemoForRep } = await import("@/lib/sales/demoAssign");
const claimWithStub = (db, repId) => claimDemoForRep(repId, db);

{
  // The loser of a race does not get the winner's demo, and does not fail.
  const db = stubDb({
    demos: POOL,
    reps: [{ id: "rep_1", demoCompanyId: null }],
    // c1 was taken by another rep in the instant between our read and write —
    // exactly the window a read-then-write has and cannot close.
    contendedIds: new Set(["c1"]),
  });
  const d = await claimWithStub(db, "rep_1");
  ok("the loser of the race still gets a demo", d.outcome === "assign", d);
  ok("...a DIFFERENT one from the contended row", d.companyId === "c2", d);
  ok("...having actually hit the constraint", db.calls.p2002 === 1, db.calls);
  ok("...and it is retried, not swallowed as success", db.calls.updates === 2, db.calls);
}

{
  // Every free demo contended: bounded, and it refuses instead of spinning.
  const db = stubDb({
    demos: POOL,
    reps: [{ id: "rep_1", demoCompanyId: null }],
    contendedIds: new Set(["c1", "c2", "c3"]),
  });
  const d = await claimWithStub(db, "rep_1");
  ok("losing every race refuses rather than looping for ever", d.outcome === "exhausted", d);
  ok("...within the attempt bound", db.calls.updates <= MAX_CLAIM_ATTEMPTS, db.calls);
  ok("...and the bound is small enough to be a request, not a hang", MAX_CLAIM_ATTEMPTS <= 10);
}

{
  // Two tabs belonging to the SAME rep. The second must not overwrite the
  // first's claim — that would orphan a demo and show the rep the wrong one.
  const db = stubDb({ demos: POOL, reps: [{ id: "rep_1", demoCompanyId: null }] });
  const first = await claimWithStub(db, "rep_1");
  const second = await claimWithStub(db, "rep_1");
  ok("the first tab claims", first.outcome === "assign" && first.companyId === "c1", first);
  ok("the second tab gets the SAME demo back, not a second one", second.outcome === "already_assigned" && second.companyId === "c1", second);
  ok("...and only one demo is held", [...db.reps.values()].filter((r) => r.demoCompanyId).length === 1);
}

{
  // A non-P2002 error must propagate. Swallowing a real database failure as
  // "try a different demo" would burn the retry budget and then report the
  // wrong refusal.
  const db = stubDb({ demos: POOL, reps: [{ id: "rep_1", demoCompanyId: null }] });
  db.salesRep.updateMany = async () => {
    const err = new Error("connection lost");
    err.code = "P1001";
    throw err;
  };
  let threw = null;
  try { await claimWithStub(db, "rep_1"); } catch (err) { threw = err; }
  ok("a real database error is not mistaken for a lost race", threw?.code === "P1001", threw?.code);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The route: reps get their OWN demo now; the pool claim is the console's");
// ═══════════════════════════════════════════════════════════════════════════
//
// 2026-09-12: the owner asked for a unique demo per rep, so /api/sales/demo
// no longer hands out the pool — it seeds a company for the rep on first GET
// (lib/sales/repDemo.js, executed by scripts/check-demo-per-rep.mjs). The
// pool machinery in §1–§2 stays exactly as it was, because /platform/demo
// still assigns and releases through it. What this section holds is that
// the rep route rides the right gates and never reaches back into the pool.

{
  const route = decomment(read("app/api/sales/demo/route.js"));

  // Split so each handler is asserted on its OWN body. Testing the whole file
  // would pass on a POST that still rides the read-only gate, because GET
  // legitimately mentions it three lines earlier.
  const postBody = route.split("export async function POST")[1] || "";
  const getBody = (route.split("export async function GET")[1] || "").split("export async function POST")[0];
  ok("POST no longer rides the read-only gate", postBody.length > 0 && !/requireSalesRep\(/.test(postBody));
  ok("...it rides requireDemoRep", /requireDemoRep\(request\)/.test(postBody));
  ok("GET still rides requireSalesRep, which refuses writes", /requireSalesRep\(request\)/.test(getBody));
  ok("the rep route no longer claims from the pool", !/claimDemoForRep\(|action === "claim"/.test(route));
  ok("...it ensures the rep's own demo instead", /ensureRepDemo\(/.test(getBody));
  ok("...and reads only from lib/sales/repDemo for the rep's state", /repDemoState\(/.test(route) && !/demoPoolCounts\(/.test(route));

  // The column that does not exist.
  ok("the route never selects Company.industry", !/\bindustry:\s*true/.test(route));
}

{
  const gate = decomment(read("lib/sales/demoGate.js"));
  ok("the demo gate re-reads the rep row every request", /db\.salesRep\.findUnique/.test(gate));
  ok("...and asks canAuthenticate rather than re-implementing it", /canAuthenticate\(row\)/.test(gate));
  ok("...importing it from the same place gate.js does", /from "\.\/invite"/.test(gate));
  ok("...and never returns the password hash", /passwordHash: _passwordHash/.test(gate));
  ok("it names what it permits", /DEMO_GATE_WRITES/.test(gate));

  // The escalation guard: the claim's WHERE must require a null, or a rep can
  // swap demos and take one off a colleague.
  const assign = decomment(read("lib/sales/demoAssign.js"));
  ok("the claim writes only while demoCompanyId is null", /where: \{ id: repId, demoCompanyId: null \}/.test(assign));
  ok("...via updateMany, so the condition is IN the write", /updateMany/.test(assign));
  ok("...and only P2002 is treated as a lost race", /err\?\.code !== "P2002"/.test(assign));
  ok("the pool query only ever asks for demos — unowned ones, since reps have their own", /where: \{ isDemo: true, demoOwnerRepId: null \}/.test(assign));
  ok("releasing clears the pointer and deletes nothing", !/\.delete\(|deleteMany/.test(assign));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The platform control the rep screen promises");
// ═══════════════════════════════════════════════════════════════════════════

{
  const route = decomment(read("app/api/platform/demo/assign/route.js"));
  ok("assign is a platform route", /export async function POST/.test(route));
  ok("...gated on a platform admin read from the database", /getCurrentPlatformAdmin\(request\)/.test(route));
  ok("...assigning through the shared helper", /assignDemoToRep\(/.test(route));
  ok("release exists", /export async function DELETE/.test(route) && /releaseDemoFromRep\(/.test(route));
  ok("...and it deletes nothing", !/\.delete\(|deleteMany/.test(route));

  // One press = assign + login. Reusing the minting helper, not a second copy
  // of its guards.
  ok("one press can mint the login too", /createDemoLogin\(/.test(route));
  ok("...reported separately, so a refused login does not lose the assignment", /loginError/.test(route));

  const login = decomment(read("lib/demo/demoLogin.js"));
  ok("the minting guards live in ONE place", /admin\.role !== "superadmin"/.test(login));
  ok("...re-reading the company rather than trusting the caller", /db\.company\.findUnique/.test(login));
  ok("...refusing anything that is not a demo", /!company\.isDemo/.test(login));
  ok("...deriving the address from the slug, never from the request", /demoLoginEmail\(company\.slug\)/.test(login));
  ok("...and auditing every use", /platformAuditLog\.create/.test(login));

  const loginRoute = decomment(read("app/api/platform/demo/login/route.js"));
  ok("the original login route now delegates rather than duplicating", /createDemoLogin\(/.test(loginRoute));
  ok("...and no longer calls Better Auth itself", !/signUpEmail/.test(loginRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The rep screen never shows a dead sign-in");
// ═══════════════════════════════════════════════════════════════════════════
//
// The screen's three pool states (no demo / no login / ready) collapsed to
// two when reps got their own demos: the company always exists once GET has
// answered, so what can be missing is only the LOGIN. The invariant that
// mattered survives unchanged — a sign-in control renders only when signing
// in can work — and check-demo-per-rep.mjs holds the rest of the new screen.

{
  const page = decomment(read("app/sales/demo/page.js"));

  ok("no Claim on the rep screen any more", !/action: "claim"/.test(page));
  ok("the false 'it takes them a click' promise is gone", !/takes them a click/.test(page));
  ok("...and so is the request to a superadmin", !/superadmin/.test(page));

  // THE one that matters: the sign-in control must be inside the loginExists
  // branch. A rep with no login must not be shown a way in that cannot work.
  const loginIdx = page.indexOf("loginExists ?");
  const openIdx = page.indexOf("demoOpenButton");
  const needsIdx = page.indexOf("demoOpenNeedsLogin");
  ok("the login branch exists at all", loginIdx > 0);
  ok("the Open control is rendered only inside it", openIdx > loginIdx && loginIdx > 0);
  ok("...and the no-login state names what is missing instead of a button", needsIdx > openIdx && openIdx > 0);
  ok("the password is chosen on the screen, never shown", /type="password"/.test(page) && !/data\.login\.password/.test(page));

  // Shared, not copy-pasted — the failure class this repo names.
  ok("the password form is defined once", (page.match(/const passwordForm/g) || []).length === 1);
  ok("...and used by both the create and the replace states", (page.match(/passwordForm\(/g) || []).length === 2);

  ok("every response is error-handled — fetchJson, never a bare res.ok", /fetchJson\(/.test(page) && !/if \(res\.ok\)/.test(page));
}

{
  const page = decomment(read("app/platform/demo/page.js"));
  ok("the console shows who holds each demo", /salesRepDemo/.test(page));
  ok("...offers Assign", /assignDemo\(/.test(page));
  ok("...and Release", /releaseDemo\(/.test(page));
  ok("...warning when an assigned demo has no login", /No login yet/.test(page));
  ok("a failed rep list is reported rather than shown as 'no reps'", /repsFailed/.test(page));
  ok("...and every fetch has an else branch", !/if \(res\.ok\)\s*\{/.test(page));

  // Release must not borrow the reset warning: it destroys nothing.
  ok(
    "releasing does not print the 'this clears N quotes' warning",
    /confirming !== `\$\{d\.id\}:release`/.test(page),
  );

  // The holder is attached by the console's own route, not by listDemos —
  // seedDemo.js's select is shared with the seed script and the reset paths,
  // none of which care who holds a demo. Without this the card would render
  // "Assign to a rep" on every demo, including ones already taken.
  const listRoute = decomment(read("app/api/platform/demo/route.js"));
  ok("the console route attaches the holder, or every card looks free", /salesRepDemo: holders\.get\(d\.id\)/.test(listRoute));
  ok("...from a real query rather than a default", /demoCompanyId: \{ not: null \}/.test(listRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:demo-assignment is a script", typeof pkg.scripts?.["check:demo-assignment"] === "string");
  ok("...and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:demo-assignment"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) { for (const f of failures) console.log(`  · ${f}`); process.exit(1); }
