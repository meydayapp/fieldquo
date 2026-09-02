// scripts/check-sales-attribution.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-sales-attribution.mjs
//
// Which FieldQuo rep brought a company in, and — the part that actually
// matters — every way that answer can be got wrong.
//
// ══ Why this is executed rather than read ══════════════════════════════════
//
// lib/sales/attribution.js decides whether a commission is owed. Every
// interesting case is hostile: a code that arrives twice, two reps racing the
// same signup, a rep pointing their own link at their own company, a string
// with markup in it arriving from a query parameter anyone can type. AGENTS.md
// says most of the real bugs in this repo were found by running pure functions
// against input like that, not by reading them — so the decision layer is run
// here against all of it, and the WRITE layer is run too, against a scripted
// client that models the one database constraint the design leans on:
// SalesAttribution.companyId is @unique.
//
// ══ The cases, one section each ════════════════════════════════════════════
//
//   1. an unknown code                — nothing attributed, nothing recorded
//   2. an inactive (or departed) rep  — refused, and NOT recorded as a touch
//   3. the same code twice            — idempotent; no second row, no touch
//   4. two reps racing one company    — the loser becomes a TOUCH, executed
//                                        through the real retry, not asserted
//   5. a self-dealing rep             — both signals: matching email, and
//                                        membership of the company
//   6. a sales code beside a promo    — separate namespaces, no fallthrough
//   7. an empty code                  — silent; NOT logged as a miss, because
//                                        null attribution is a correct state
//   8. a code with markup in it       — refused before it reaches Postgres
//
// Plus: a superadmin correction writes the new attribution, the losing rep's
// touch and the audit row in ONE transaction, and cannot be used to break the
// self-dealing rules.
//
// Every guarantee below was mutation-tested: the guard was broken by hand, the
// corresponding assertion was confirmed to FAIL, and the file was restored
// from a `cp` backup taken first. The source-string rules are scoped to ONE
// named function each — an earlier session shipped a check that passed with
// its subject deleted, because the string it looked for also appeared in a
// different function in the same file.
import { readFileSync } from "node:fs";
import {
  ATTRIBUTION_SOURCES,
  MAX_SALES_CODE_LENGTH,
  readSalesCode,
  isRepAttributable,
  selfDealReason,
  decideAttribution,
  decideCorrection,
  isAttributionMiss,
  captureAttributionWithin,
  correctAttributionWithin,
  withUniqueRetry,
} from "@/lib/sales/attribution";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ok   ${label}`))
    : (console.log(`  FAIL ${label}${detail === undefined ? "" : `  — ${detail}`}`),
      fails.push(label));
const section = (t) => console.log(`\n${t}\n`);

// ── A scriptable stand-in for Prisma, big enough for exactly these paths ────
//
// Not scripts/fixtures/dbStub.mjs: that stub's create() has no notion of a
// unique index except for the one model it was extended for, and the whole
// lock in this feature IS a unique index. A fake that cannot refuse the second
// insert would let every assertion below pass on a design that doesn't lock.
function makeTx(seed = {}) {
  const store = {
    company: seed.company || [],
    salesRep: seed.salesRep || [],
    member: seed.member || [],
    user: seed.user || [],
    salesAttribution: seed.salesAttribution || [],
    salesAttributionTouch: [],
    salesAttributionAudit: [],
  };
  const ci = (a, b) => String(a || "").toLowerCase() === String(b || "").toLowerCase();
  // Monotonic, never derived from array length: a correction deletes the old
  // row before creating the new one, and a length-based id would hand the
  // replacement the SAME id the original had — making "this is a new row, not
  // the old one edited" unprovable.
  let seq = 0;
  const nextId = (prefix) => `${prefix}_${++seq}`;

  const tx = {
    company: {
      findUnique: async ({ where }) => store.company.find((c) => c.id === where.id) || null,
    },
    salesRep: {
      findUnique: async ({ where }) => store.salesRep.find((r) => r.id === where.id) || null,
      findFirst: async ({ where }) =>
        store.salesRep.find((r) => ci(r.code, where.code?.equals ?? where.code)) || null,
    },
    member: {
      findFirst: async ({ where }) => {
        const wanted = where.user?.email?.equals;
        return (
          store.member.find((m) => {
            if (m.companyId !== where.companyId) return false;
            const u = store.user.find((x) => x.id === m.userId);
            return u ? ci(u.email, wanted) : false;
          }) || null
        );
      },
    },
    salesAttribution: {
      findUnique: async ({ where }) =>
        store.salesAttribution.find((a) => a.companyId === where.companyId) || null,
      create: async ({ data }) => {
        // The @unique this whole design leans on. Modelled, not assumed.
        if (store.salesAttribution.some((a) => a.companyId === data.companyId)) {
          const err = new Error("Unique constraint failed on SalesAttribution.companyId");
          err.code = "P2002";
          throw err;
        }
        const row = { id: nextId("attr"), capturedAt: new Date(), ...data };
        store.salesAttribution.push(row);
        return row;
      },
      delete: async ({ where }) => {
        const i = store.salesAttribution.findIndex((a) => a.companyId === where.companyId);
        return i === -1 ? null : store.salesAttribution.splice(i, 1)[0];
      },
    },
    salesAttributionTouch: {
      create: async ({ data }) => {
        const row = { id: nextId("touch"), ...data };
        store.salesAttributionTouch.push(row);
        return row;
      },
    },
    salesAttributionAudit: {
      create: async ({ data }) => {
        const row = { id: nextId("audit"), ...data };
        store.salesAttributionAudit.push(row);
        return row;
      },
    },
  };
  return { tx, store };
}

const REP_A = { id: "rep_a", code: "amara", email: "amara@fieldquo.com", active: true, endedAt: null };
const REP_B = { id: "rep_b", code: "bo", email: "bo@fieldquo.com", active: true, endedAt: null };
const REP_GONE = { id: "rep_g", code: "gone", email: "g@fieldquo.com", active: false, endedAt: null };
const REP_LEFT = { id: "rep_l", code: "left", email: "l@fieldquo.com", active: true, endedAt: new Date() };
const CO = { id: "co_1", email: "owner@paintco.example" };

const seedAll = (extra = {}) => ({
  company: [{ ...CO }],
  salesRep: [REP_A, REP_B, REP_GONE, REP_LEFT],
  ...extra,
});

console.log("\nSales attribution — the waterfall, the lock, and the fraud guards");

// ══ 0. Reading a code off untrusted input ══════════════════════════════════
section("0. readSalesCode — every shape a query parameter can arrive in");

ok("a plain code is lower-cased", readSalesCode("Amara").code === "amara");
ok("surrounding whitespace is trimmed", readSalesCode("  amara \n").code === "amara");
ok("an empty string is absent, not rejected", (() => {
  const r = readSalesCode("");
  return r.code === null && r.rejected === null;
})());
ok("whitespace only is absent, not rejected", (() => {
  const r = readSalesCode("   ");
  return r.code === null && r.rejected === null;
})());
for (const junk of [null, undefined, 0, 42, {}, [], true, ["amara"]]) {
  ok(`a non-string (${JSON.stringify(junk) ?? "undefined"}) is absent, not a crash`, (() => {
    const r = readSalesCode(junk);
    return r.code === null && r.rejected === null;
  })());
}
ok('markup is REJECTED, not sanitised: "<script>"', readSalesCode("<script>").rejected === "markup");
ok('markup anywhere in the code is rejected: "amara<b>"', readSalesCode("amara<b>").rejected === "markup");
ok('a lone ">" is rejected', readSalesCode("amara>").rejected === "markup");
ok(
  "an absurdly long code is rejected before it reaches Postgres",
  readSalesCode("a".repeat(MAX_SALES_CODE_LENGTH + 1)).rejected === "too_long",
);
ok(
  "a code exactly at the limit is accepted",
  readSalesCode("a".repeat(MAX_SALES_CODE_LENGTH)).code?.length === MAX_SALES_CODE_LENGTH,
);
ok("a rejected code never comes back with a usable value", (() => {
  for (const bad of ["<script>alert(1)</script>", "a".repeat(500)]) {
    if (readSalesCode(bad).code !== null) return false;
  }
  return true;
})());

// ══ 1. An unknown code ═════════════════════════════════════════════════════
section("1. An unknown code");

{
  const v = decideAttribution({ source: "link", presented: true, rep: null, company: CO });
  ok("an unmatched code attributes nothing", v.outcome === "unknown_rep", v.outcome);
  ok("and writes nothing at all", v.writes.attribution === false && v.writes.touch === false);
  ok("and IS a miss worth logging", isAttributionMiss("unknown_rep") === true);
}
{
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, {
    companyId: CO.id,
    rawCode: "nobody-by-that-name",
    source: "link",
  });
  ok("executed: an unknown code writes no attribution row", store.salesAttribution.length === 0);
  ok("executed: and no touch row either", store.salesAttributionTouch.length === 0);
  ok("executed: outcome is unknown_rep", r.outcome === "unknown_rep", r.outcome);
}

// ══ 2. An inactive rep's code ══════════════════════════════════════════════
section("2. An inactive, or departed, rep's code");

ok("a live rep is attributable", isRepAttributable(REP_A) === true);
ok("a deactivated rep is not", isRepAttributable(REP_GONE) === false);
ok("a rep with an endedAt is not, even while active", isRepAttributable(REP_LEFT) === false);
ok("a null rep is not", isRepAttributable(null) === false);
ok(
  "acceptedAt is NOT required — the schema says a rep can be attributed from the moment they are added",
  isRepAttributable({ ...REP_A, acceptedAt: null, passwordHash: null }) === true,
);

for (const [label, rep] of [["deactivated", REP_GONE], ["departed", REP_LEFT]]) {
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: rep.code, source: "link" });
  ok(`executed: a ${label} rep's code attributes nothing`, store.salesAttribution.length === 0);
  // A touch here would put a claim that can never be paid into the table a
  // future split policy reads. Refused means refused.
  ok(`executed: and is NOT filed as a touch`, store.salesAttributionTouch.length === 0);
  ok(`executed: outcome is inactive_rep`, r.outcome === "inactive_rep", r.outcome);
}

// ══ 3. The same code twice ═════════════════════════════════════════════════
section("3. The same code arriving twice");

{
  const { tx, store } = makeTx(seedAll());
  const first = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  const second = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "AMARA", source: "link" });
  ok("the first capture attributes", first.outcome === "attribute", first.outcome);
  ok("the second is a no-op, not a second row", second.outcome === "already_attributed", second.outcome);
  ok("exactly one attribution row exists", store.salesAttribution.length === 1);
  ok("and the same rep still owns it", store.salesAttribution[0].salesRepId === REP_A.id);
  // One rep double-clicking their own link is not two reps' involvement.
  ok("no touch row was fabricated from one rep's double-click", store.salesAttributionTouch.length === 0);
  ok("a re-arriving code is not logged as a miss", isAttributionMiss("already_attributed") === false);
}

// ══ 4. Two reps, one company ═══════════════════════════════════════════════
section("4. Two reps touching the same company");

{
  const { tx, store } = makeTx(seedAll());
  await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  const second = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "bo", source: "manual" });
  ok("the second rep does NOT take the company", store.salesAttribution[0].salesRepId === REP_A.id);
  ok("the second rep's involvement is RECORDED", second.outcome === "touch", second.outcome);
  ok("as a SalesAttributionTouch row", store.salesAttributionTouch.length === 1);
  ok("naming the losing rep", store.salesAttributionTouch[0].salesRepId === REP_B.id);
  ok("and the door they came through", store.salesAttributionTouch[0].source === "manual");
  ok("still exactly one attribution", store.salesAttribution.length === 1);
  // The reason the whole design records instead of refusing.
  ok("nothing threw — a signup is never failed over bookkeeping", second.attribution === null);
}

// ── The RACE: both reps read "unattributed", one write is refused ──────────
//
// Executed through the real retry rather than asserted about. The runner fails
// exactly the way a lost race fails — the read said nothing was there, the
// write came back P2002 — and then succeeds on the second pass.
{
  const { tx, store } = makeTx(seedAll());
  let attempt = 0;

  // Rep B's transaction, with rep A's commit landing in the gap between rep
  // B's READ and rep B's WRITE. Rep B reads "nobody has this company",
  // decides `attribute`, and Postgres refuses the insert — which is exactly
  // what a lost race looks like from inside the losing transaction, and the
  // only shape of failure the retry is allowed to swallow.
  const raceTx = {
    ...tx,
    salesAttribution: {
      ...tx.salesAttribution,
      create: async (args) => {
        if (attempt === 1) {
          store.salesAttribution.push({
            id: "attr_winner",
            companyId: CO.id,
            salesRepId: REP_A.id,
            source: "link",
          });
          const err = new Error("Unique constraint failed on SalesAttribution.companyId");
          err.code = "P2002";
          throw err;
        }
        return tx.salesAttribution.create(args);
      },
    },
  };

  const result = await withUniqueRetry(async (args) => {
    attempt += 1;
    return captureAttributionWithin(raceTx, args);
  }, { companyId: CO.id, rawCode: "bo", source: "link" });

  ok("the race was actually retried", attempt === 2, `attempts: ${attempt}`);
  ok("the loser is recorded as a touch, not lost", result.outcome === "touch", result.outcome);
  ok("a touch row exists for the losing rep", store.salesAttributionTouch.some((t) => t.salesRepId === REP_B.id));
  ok("the winner keeps the company", store.salesAttribution.filter((a) => a.companyId === CO.id).length === 1);
  ok("and the winner is rep A", store.salesAttribution[0].salesRepId === REP_A.id);
}

{
  // Only P2002 is retried. Anything else must propagate — a real database
  // failure quietly turning into "no attribution" is how a commission goes
  // missing with nothing in any log.
  let calls = 0;
  let threw = null;
  try {
    await withUniqueRetry(async () => {
      calls += 1;
      const err = new Error("connection terminated");
      err.code = "P1001";
      throw err;
    }, {});
  } catch (err) {
    threw = err;
  }
  ok("a non-unique failure is NOT retried", calls === 1, `calls: ${calls}`);
  ok("and propagates to the caller", threw?.code === "P1001");
}
{
  // And a retry that fails again does not loop forever.
  let calls = 0;
  let threw = null;
  try {
    await withUniqueRetry(async () => {
      calls += 1;
      const err = new Error("unique");
      err.code = "P2002";
      throw err;
    }, {});
  } catch (err) {
    threw = err;
  }
  ok("a unique failure is retried exactly once, never in a loop", calls === 2, `calls: ${calls}`);
  ok("and the second failure propagates", threw?.code === "P2002");
}

// ══ 5. A self-dealing rep ══════════════════════════════════════════════════
section("5. A rep selling to themselves");

ok(
  "matching signup email is self-dealing",
  selfDealReason({ rep: { email: "a@x.com" }, company: { email: "a@x.com" } }) === "email",
);
ok(
  "case and whitespace do not defeat it",
  selfDealReason({ rep: { email: " A@X.COM " }, company: { email: "a@x.com" } }) === "email",
);
ok(
  "membership is self-dealing even with a different email",
  selfDealReason({ rep: { email: "a@x.com" }, company: { email: "b@y.com" }, repIsMember: true }) === "member",
);
ok(
  "two unrelated emails and no membership is not",
  selfDealReason({ rep: { email: "a@x.com" }, company: { email: "b@y.com" }, repIsMember: false }) === null,
);
ok(
  "a company with NO email on file does not match a rep with no email",
  selfDealReason({ rep: { email: null }, company: { email: null } }) === null,
);
ok(
  "an empty string on both sides is not a match either",
  selfDealReason({ rep: { email: "" }, company: { email: "" } }) === null,
);

{
  // Executed: the rep's own email is the company's signup email.
  const { tx, store } = makeTx(
    seedAll({ company: [{ id: CO.id, email: "AMARA@fieldquo.com" }] }),
  );
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  ok("executed: a rep cannot be attributed to their own signup email", r.outcome === "self_dealing", r.outcome);
  ok("executed: the reason is recorded as the email match", r.detail === "email");
  ok("executed: nothing was written", store.salesAttribution.length === 0);
  ok("executed: and no touch was filed for a disqualified claim", store.salesAttributionTouch.length === 0);
}
{
  // Executed: the rep is a Member of the company, under a different address.
  const { tx, store } = makeTx(
    seedAll({
      user: [{ id: "u1", email: "Amara@FieldQuo.com" }],
      member: [{ id: "m1", userId: "u1", companyId: CO.id }],
    }),
  );
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  ok("executed: a rep who is a Member cannot be attributed", r.outcome === "self_dealing", r.outcome);
  ok("executed: the reason is recorded as membership", r.detail === "member");
  ok("executed: nothing was written", store.salesAttribution.length === 0);
}
{
  // The membership join must be scoped to THIS company — a rep who is a member
  // of some other company entirely is at arm's length from this one.
  const { tx, store } = makeTx(
    seedAll({
      company: [{ ...CO }, { id: "co_2", email: "other@x.example" }],
      user: [{ id: "u1", email: "amara@fieldquo.com" }],
      member: [{ id: "m1", userId: "u1", companyId: "co_2" }],
    }),
  );
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  ok("membership of a DIFFERENT company does not disqualify", r.outcome === "attribute", r.outcome);
  ok("and the attribution landed", store.salesAttribution.length === 1);
}
{
  // A superadmin correction must not be a way round the fraud guards.
  const v = decideCorrection({
    rep: REP_A,
    company: { id: CO.id, email: REP_A.email },
    existing: { salesRepId: REP_B.id },
    reason: "Rep A ran the demo",
  });
  ok("a correction cannot self-deal either", v.outcome === "self_dealing", v.outcome);
  ok("and writes nothing", v.writes.attribution === false && v.writes.touch === false);
}

// ══ 6. A sales code alongside a promo code ═════════════════════════════════
section("6. A sales code arriving beside a promo / referral code");

{
  // The namespaces are separate at the API boundary. This is the assertion
  // that the third namespace was ADDED rather than folded into the existing
  // two-way waterfall — scoped to the POST handler, because the file's own
  // header comment mentions referralCode too and a whole-file match would
  // pass on a route that never reads salesCode at all.
  const SIGNUP_ROUTE = readFileSync("app/api/companies/route.js", "utf8");
  const post = namedFunction(SIGNUP_ROUTE, "POST");
  ok("the signup route's POST has a body", post.length > 500, `${post.length} chars`);
  ok("POST reads salesCode from the body", /\bsalesCode\b/.test(post));
  ok("POST calls captureSalesAttribution", /captureSalesAttribution\s*\(/.test(post));
  ok(
    "and hands it salesCode, never referralCode",
    /captureSalesAttribution\(\{[\s\S]*?rawCode:\s*salesCode/.test(post),
  );
  ok(
    "the promo/referral pair still reads referralCode and nothing else",
    /redeemPromoCode\(\{\s*company,\s*code:\s*referralCode\s*\}\)/.test(post) &&
      /applySignupReferral\(\{\s*company,\s*code:\s*referralCode\s*\}\)/.test(post),
  );
  ok(
    "no fallthrough: the sales capture is not conditional on the promo result",
    !/promo\s*===\s*null[\s\S]{0,200}captureSalesAttribution/.test(post),
  );

  // And the page sends it as its own field.
  const SIGNUP_PAGE = readFileSync("app/signup/page.js", "utf8");
  const finish = namedFunction(SIGNUP_PAGE, "handleFinish");
  ok("the signup page's handleFinish has a body", finish.length > 500, `${finish.length} chars`);
  ok("handleFinish posts salesCode as its own field", /salesCode:\s*salesCode\s*\|\|\s*undefined/.test(finish));
  ok("and still posts referralCode separately", /referralCode:\s*referralCode\s*\|\|\s*undefined/.test(finish));
}
{
  // Executed: a rep code resolves on its own terms whatever else the signup
  // carried. The promo waterfall never sees it and it never sees the promo.
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  ok("a sales code attributes regardless of any promo", r.outcome === "attribute", r.outcome);
  ok("with source 'link'", store.salesAttribution[0].source === "link");
  // A promo code posted in the sales field is just an unknown code, not a
  // second chance at a discount.
  const { tx: tx2, store: store2 } = makeTx(seedAll());
  const r2 = await captureAttributionWithin(tx2, { companyId: CO.id, rawCode: "FQ-ABCD", source: "link" });
  ok("a promo code in the sales field attributes nobody", r2.outcome === "unknown_rep", r2.outcome);
  ok("and writes nothing", store2.salesAttribution.length === 0);
}

// ══ 7. An empty code ═══════════════════════════════════════════════════════
section("7. An empty code — the ordinary signup");

for (const empty of [null, undefined, "", "   "]) {
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: empty, source: "link" });
  ok(`no code (${JSON.stringify(empty) ?? "undefined"}) attributes nothing`, r.outcome === "no_code", r.outcome);
  ok(`no code (${JSON.stringify(empty) ?? "undefined"}) writes nothing`, store.salesAttribution.length === 0);
}
// The honesty rule: null attribution is a permanent, correct state for every
// company that existed before this shipped. An ordinary signup is not a gap,
// so it must not be logged as one — a log full of "no rep" on every self-serve
// signup would bury the real misses it exists to surface.
ok("an ordinary signup is NOT a miss", isAttributionMiss("no_code") === false);
ok("but a presented code that matched nobody IS", isAttributionMiss("unknown_rep") === true);
ok("as is a code belonging to a departed rep", isAttributionMiss("inactive_rep") === true);
ok("as is a self-dealing attempt", isAttributionMiss("self_dealing") === true);
ok("as is markup in the parameter", isAttributionMiss("malformed_code") === true);
ok("a recorded touch is not a miss", isAttributionMiss("touch") === false);
ok("a successful attribution is not a miss", isAttributionMiss("attribute") === false);

// ══ 8. A code with markup in it ════════════════════════════════════════════
section("8. A code with markup in it");

for (const hostile of ["<script>alert(1)</script>", "amara<img src=x>", "<", ">"]) {
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: hostile, source: "link" });
  ok(`markup (${JSON.stringify(hostile)}) is refused`, r.outcome === "malformed_code", r.outcome);
  ok(`markup (${JSON.stringify(hostile)}) writes nothing`, store.salesAttribution.length === 0);
}
{
  const { tx } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, {
    companyId: CO.id,
    rawCode: "a".repeat(5000),
    source: "link",
  });
  ok("an oversized code is refused before any query", r.outcome === "malformed_code", r.outcome);
  ok("with the length named, not just 'bad code'", r.detail === "too_long");
}

// ══ 9. The source is a closed set ══════════════════════════════════════════
section("9. Only the three sanctioned doors exist");

ok("there are exactly three sources", ATTRIBUTION_SOURCES.length === 3);
ok("link, manual and admin", ["link", "manual", "admin"].every((s) => ATTRIBUTION_SOURCES.includes(s)));
for (const bogus of ["webhook", "", null, "LINK", "self"]) {
  const v = decideAttribution({ source: bogus, presented: true, rep: REP_A, company: CO });
  ok(`an unrecognised source (${JSON.stringify(bogus)}) attributes nothing`, v.outcome === "invalid_source");
}
{
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "sideways" });
  ok("executed: an invented source writes nothing", store.salesAttribution.length === 0);
  ok("executed: outcome is invalid_source", r.outcome === "invalid_source", r.outcome);
}
{
  // A company that does not exist is refused rather than attributed to a
  // dangling id — the FK would catch it, but only after a decision was made.
  const { tx, store } = makeTx(seedAll());
  const r = await captureAttributionWithin(tx, { companyId: "co_nope", rawCode: "amara", source: "link" });
  ok("an unknown company attributes nothing", r.outcome === "unknown_company", r.outcome);
  ok("and writes nothing", store.salesAttribution.length === 0);
}

// ══ 10. The superadmin correction ══════════════════════════════════════════
section("10. A superadmin correction — new row, audit row, one transaction");

{
  const { tx, store } = makeTx(seedAll());
  await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  const r = await correctAttributionWithin(tx, {
    companyId: CO.id,
    salesRepId: REP_B.id,
    actorAdminId: "admin_1",
    reason: "Amara passed the lead to Bo before the demo.",
  });

  ok("the correction succeeded", r.outcome === "correct", r.outcome);
  ok("exactly one attribution still exists", store.salesAttribution.length === 1);
  ok("and it now names the new rep", store.salesAttribution[0].salesRepId === REP_B.id);
  ok("the new row is a NEW row, not the old one edited", store.salesAttribution[0].id !== "attr_1");
  ok("its source records that an admin moved it", store.salesAttribution[0].source === "admin");
  ok("an audit row was written", store.salesAttributionAudit.length === 1);
  ok("naming who it came from", store.salesAttributionAudit[0].fromRepId === REP_A.id);
  ok("who it went to", store.salesAttributionAudit[0].toRepId === REP_B.id);
  ok("who did it", store.salesAttributionAudit[0].actorAdminId === "admin_1");
  ok("and why", /passed the lead/.test(store.salesAttributionAudit[0].reason));
  // The losing rep's involvement survives the correction, for the same reason
  // a second touch is recorded at all.
  ok("the outgoing rep survives as a touch", store.salesAttributionTouch.length === 1);
  ok("naming the outgoing rep", store.salesAttributionTouch[0].salesRepId === REP_A.id);
  ok("and saying it was a correction", /correction/i.test(store.salesAttributionTouch[0].note));
}
{
  // A correction on a company with no attribution at all. Legal — the audit
  // row's fromRepId is nullable precisely for this — and it must not invent a
  // touch for a rep who was never there.
  const { tx, store } = makeTx(seedAll());
  const r = await correctAttributionWithin(tx, {
    companyId: CO.id,
    salesRepId: REP_A.id,
    actorAdminId: "admin_1",
    reason: "Signed at a trade show; the link was never clicked.",
  });
  ok("correcting an unattributed company works", r.outcome === "correct", r.outcome);
  ok("fromRepId is null, not invented", store.salesAttributionAudit[0].fromRepId === null);
  ok("and no phantom touch was written", store.salesAttributionTouch.length === 0);
}
{
  // Corrections need a reason. An audit row that records that something
  // happened and nothing about why is the half not worth keeping.
  for (const reason of [null, undefined, "", "   ", 42, {}]) {
    const { tx, store } = makeTx(seedAll());
    const r = await correctAttributionWithin(tx, {
      companyId: CO.id,
      salesRepId: REP_A.id,
      actorAdminId: "admin_1",
      reason,
    });
    ok(`a correction with no reason (${JSON.stringify(reason) ?? "undefined"}) is refused`, r.outcome === "no_reason");
    ok("and writes nothing at all", store.salesAttribution.length === 0 && store.salesAttributionAudit.length === 0);
  }
  const { tx, store } = makeTx(seedAll());
  const r = await correctAttributionWithin(tx, {
    companyId: CO.id,
    salesRepId: REP_A.id,
    actorAdminId: "admin_1",
    reason: "<script>x</script>",
  });
  ok("a reason with markup in it is refused", r.outcome === "no_reason", r.outcome);
  ok("and writes nothing", store.salesAttributionAudit.length === 0);
}
{
  // Correcting to the rep who already has it is a no-op, not an audit row
  // saying nothing changed.
  const { tx, store } = makeTx(seedAll());
  await captureAttributionWithin(tx, { companyId: CO.id, rawCode: "amara", source: "link" });
  const r = await correctAttributionWithin(tx, {
    companyId: CO.id,
    salesRepId: REP_A.id,
    actorAdminId: "admin_1",
    reason: "Confirming.",
  });
  ok("a correction to the same rep is a no-op", r.outcome === "already_attributed", r.outcome);
  ok("no audit row was written for a change that didn't happen", store.salesAttributionAudit.length === 0);
  ok("and the attribution was not churned", store.salesAttribution.length === 1);
}
{
  // A departed rep cannot be the destination of a correction.
  const { tx, store } = makeTx(seedAll());
  const r = await correctAttributionWithin(tx, {
    companyId: CO.id,
    salesRepId: REP_LEFT.id,
    actorAdminId: "admin_1",
    reason: "They actually closed it.",
  });
  ok("a correction cannot point at a departed rep", r.outcome === "inactive_rep", r.outcome);
  ok("and writes nothing", store.salesAttribution.length === 0 && store.salesAttributionAudit.length === 0);
}

// ── The audit row and the change it describes cannot come apart ────────────
//
// Scoped to correctSalesAttribution ALONE. captureSalesAttribution in the same
// file also opens a transaction, so a whole-file search for "$transaction"
// would pass with the correction's transaction deleted outright — which is
// exactly the false pass that shipped earlier in this project's history.
{
  const LIB = readFileSync("lib/sales/attribution.js", "utf8");
  const correct = namedFunction(LIB, "correctSalesAttribution");
  ok("correctSalesAttribution has a body", correct.length > 80, `${correct.length} chars`);
  ok("and runs its work inside db.$transaction", /db\.\$transaction\s*\(/.test(correct));
  ok("delegating to correctAttributionWithin", /correctAttributionWithin\s*\(/.test(correct));

  const within = namedFunction(LIB, "correctAttributionWithin");
  ok("correctAttributionWithin has a body", within.length > 400, `${within.length} chars`);
  ok("it writes the audit row on the same tx it was handed", /tx\.salesAttributionAudit\.create/.test(within));
  ok("it writes the new attribution on that same tx", /tx\.salesAttribution\.create/.test(within));
  ok("and it never opens a transaction of its own", !/\$transaction/.test(within));
}

// ── The correction route is superadmin-only ───────────────────────────────
{
  const ROUTE = readFileSync("app/api/platform/sales/attribution/[companyId]/correct/route.js", "utf8");
  const post = namedFunction(ROUTE, "POST");
  ok("the correction route's POST has a body", post.length > 300, `${post.length} chars`);
  ok("it refuses an unauthenticated caller", /getCurrentPlatformAdmin/.test(post) && /401/.test(post));
  ok(
    "it demands a sales_attribution permission no role below superadmin holds",
    /requirePlatformPermission\(\s*admin\.role,\s*"sales_attribution:correct"\s*\)/.test(post),
  );
  ok("and calls the audited library, not Prisma directly", /correctSalesAttribution\s*\(/.test(post) && !/\bdb\./.test(post));
}
{
  const ROUTE = readFileSync("app/api/platform/sales/attribution/route.js", "utf8");
  const post = namedFunction(ROUTE, "POST");
  ok("the manual-attribution route's POST has a body", post.length > 300, `${post.length} chars`);
  ok(
    "it is gated on a sales_attribution permission",
    /requirePlatformPermission\(\s*admin\.role,\s*"sales_attribution:manage"\s*\)/.test(post),
  );
  ok("it captures with source 'manual'", /source:\s*"manual"/.test(post));
  // A touch is a success. Answering 409 would read as "retry", and retrying is
  // the one thing that must never look like the way to take a company.
  ok("a recorded touch is not reported as a failure", /outcome === "touch"[\s\S]{0,400}status: 200/.test(post));
}

// ── The signup draft keeps the codes ──────────────────────────────────────
//
// The gap this change closes: leaving /signup by a link and returning by a
// fresh navigation restored the whole draft and dropped the code. Scoped to
// the two effects that read and write the draft, by anchoring on DRAFT_KEY.
{
  const PAGE = readFileSync("app/signup/page.js", "utf8");
  const writer = between(PAGE, "sessionStorage.setItem(", "  }, [");
  ok("the draft writer was found", writer.length > 100, `${writer.length} chars`);
  ok("it persists the sales code", /\bsalesCode,/.test(writer));
  ok("and the referral code, which had the identical gap", /\breferralCode,/.test(writer));

  const reader = between(PAGE, "sessionStorage.getItem(DRAFT_KEY)", "setHydrated(true)");
  ok("the draft reader was found", reader.length > 200, `${reader.length} chars`);
  ok("it restores the sales code", /draft\?\.salesCode/.test(reader));
  ok("it restores the referral code", /draft\?\.referralCode/.test(reader));
  // A fresh link must beat a stale draft: someone arriving on a second rep's
  // link meant the link they just clicked.
  ok('a query "sales" still wins over the draft', /!query\.get\("sales"\)/.test(reader));
  ok('a query "ref" still wins over the draft', /!query\.get\("ref"\)/.test(reader));
}

console.log(`\n${pass} passed, ${fails.length} failed.`);
if (fails.length) {
  console.log("\nFailures:");
  for (const f of fails) console.log(`  - ${f}`);
  process.exit(1);
}

// ── Source-slicing helpers ─────────────────────────────────────────────────

/**
 * The body of ONE named function, by brace matching from its declaration.
 *
 * Every source-string rule in this file is scoped through here, and the reason
 * is a real false pass earlier in this project: a guard was deleted from
 * purchaseCrewLine() and the check still passed, because the same string
 * appeared in claimCrewLine() a few hundred lines above in the same file. A
 * check that cannot fail is worse than no check, since it reads as proof.
 *
 * Returns "" when the function isn't found, which fails the length assertion
 * that every caller makes first — so a renamed function is a loud failure
 * rather than a silently empty haystack that matches nothing and passes.
 */
function namedFunction(src, name) {
  const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return "";

  // Walk the PARAMETER list to its closing paren first. Jumping straight to
  // the next "{" lands inside a destructured parameter — `POST(request, {
  // params })` — and returns "{ params }" as the whole function, which is a
  // haystack that matches nothing and would fail every rule for the wrong
  // reason. (It did, on the first run of this file.)
  let p = src.indexOf("(", m.index);
  let parens = 0;
  let close = -1;
  for (let j = p; j < src.length; j++) {
    if (src[j] === "(") parens++;
    else if (src[j] === ")") {
      parens--;
      if (parens === 0) {
        close = j;
        break;
      }
    }
  }
  if (close === -1) return "";

  const i = src.indexOf("{", close);
  if (i === -1) return "";
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(i, j + 1);
    }
  }
  return "";
}

/** The slice between the first `start` and the next `end` after it. */
function between(src, start, end) {
  const a = src.indexOf(start);
  if (a === -1) return "";
  const b = src.indexOf(end, a + start.length);
  return b === -1 ? "" : src.slice(a, b);
}
