#!/usr/bin/env node
//
// scripts/check-sales-inbound-call.mjs
//
//   npm run check:sales-inbound-call
//
// A contractor rang one of FieldQuo's sales numbers back and reached nothing
// at all. Everything below exists because the fix touches three things that
// are each easy to get quietly wrong: a public endpoint that makes a phone
// call, a compliance rule that runs the OPPOSITE way from the outbound one,
// and a second row shape in a table every sales report already counts.
//
// ══ What is EXECUTED rather than read ══════════════════════════════════════
//
// FieldQuo owns zero phone numbers — the Twilio Trust Hub compliance profile
// is not approved, number search returns almost nothing and every purchase is
// refused — so there is no live number to ring. That is not an excuse for
// asserting by reading. Everything that decides anything is a pure function
// taking rows, and every one of them is run here against the cases that
// matter: a withheld caller ID, a number we do not hold, an empty floor, a
// floor we could not read, a rep who left, a suppressed caller, a transfer
// nobody picked up. The store's writes are run too, against a scripted client,
// so "the inbound row is direction in and does not consume the outbound cap"
// is a fact about an argument rather than a sentence in a comment.
//
// What is NOT executed, and is asserted structurally instead: the route
// itself. It imports next/server and the Twilio SDK, and standing those up
// here would test the harness. Those assertions are scoped to ONE named
// function each, over comment-stripped source, for the reason
// scripts/check-demo-spend.mjs records — a whole-file match passed once while
// the guard it checked had been deleted, because an identical string a few
// hundred lines earlier satisfied it.
//
// ══ Mutation-tested ════════════════════════════════════════════════════════
//
// Each guarantee below was broken in turn on disk, the break CONFIRMED present
// by re-reading the file, this script confirmed to FAIL, and the file restored
// from a `cp` backup taken first — never `git checkout`, which restores the
// commit rather than the working copy. The report accompanying this change
// lists which break failed which assertion.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { register } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── A stand-in for @/lib/db ───────────────────────────────────────────────
//
// lib/sales/calls/store.js imports it, and the real one constructs a
// PrismaClient against Neon at module load — so a check that imported the
// store would need a live database. Its own hook rather than
// scripts/db-stub-loader.mjs, following check-sales-auth.mjs's precedent and
// its reason: that stub is shared by several checks and adding a model to it
// is an edit to their fixture.
//
// The stub is deliberately USELESS: every store function below is called with
// an explicit `client`, so if one of them ever ignored the argument and
// reached for the module-level db, it would throw here rather than pass.
const DB_HOOKS = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") return { url: "fq-stub:inbound-db", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:inbound-db")
    return { format: "module", shortCircuit: true, source:
      "export const db = new Proxy({}, { get(_t, m) { throw new Error('the module-level db was used instead of the client argument: ' + String(m)); } });" };
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(DB_HOOKS)}`);

const {
  INBOUND_ACTIONS,
  INBOUND_CONNECT,
  INBOUND_MESSAGE,
  INBOUND_NOT_OURS,
  INBOUND_UNAVAILABLE,
  INBOUND_WEBHOOK_PATH,
  TRANSFER_RING_SECONDS,
  afterTransfer,
  anyRepLive,
  fallbackSayFor,
  inboundPlan,
  inboundWebhookUrl,
  repIsLive,
  salesVoiceInboundState,
} = await import("@/lib/sales/calls/inboundRouting");

const {
  WITHHELD_NUMBER,
  attemptsLast24h,
  lastOutboundBetween,
  recordDial,
  recordInbound,
  salesVoiceNumber,
} = await import("@/lib/sales/calls/store");

const { REP_CALL_WRITES } = await import("@/lib/sales/calls/gate");
const { matchInboundCaller } = await import("@/lib/sales/calls/inboundMatch");
const { normalisePhone } = await import("@/lib/sales/suppressionRules");
const { NOT_TRACKED_CALLS, campaignCallRows, repCallStats } = await import(
  "@/lib/sales/calls/reporting"
);
const {
  STATE_AVAILABLE,
  STATE_OFFLINE,
  STATE_ON_CALL,
  STATE_PAUSED,
} = await import("@/lib/sales/calls/agentState");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}`);

/** Comments stripped before any regex touches source. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const source = (rel) => stripComments(read(rel));

/**
 * One named function's body, comment-stripped, from its signature to the next
 * top-level declaration. Scoped so a guard deleted from THIS function cannot
 * be satisfied by an identical line elsewhere in the same file.
 */
function fnBody(rel, signature) {
  const src = source(rel);
  const start = src.indexOf(signature);
  if (start === -1) return "";
  const rest = src.slice(start + signature.length);
  const next = rest.search(/\n(export|async function|function) /);
  return next === -1 ? rest : rest.slice(0, next);
}

const ROUTE = "app/api/rep-dial/inbound/route.js";
const OUR_NUMBER = { id: "n1", e164: "+19185550100", purpose: "sales_voice", active: true };
const CALLER = "+19185559911";
const DESK = "+16135550123";
const NOW = new Date("2026-09-04T21:30:00Z");

// ═══════════════════════════════════════════════════════════════════════════
section("1. The route exists, is public, and the signature is the only door");

ok("the inbound webhook route is on disk", existsSync(join(ROOT, ROUTE)));

{
  const body = fnBody(ROUTE, "export async function POST(");
  ok(
    "it verifies the Twilio signature",
    /verifyTwilioWebhook\(request\)/.test(body),
  );
  ok(
    "…and refuses with 403 when it does not check out",
    /if \(!ok\)/.test(body) && /status: 403/.test(body),
  );
  ok(
    "…BEFORE it reads anything from the database",
    (() => {
      // Ordering, not presence. A verification that runs after the lookup is
      // not a gate — the same property check-sales-call-handling asserts about
      // the floor board's role check.
      const verify = body.indexOf("verifyTwilioWebhook");
      const refuse = body.indexOf("status: 403");
      const readDb = body.search(/salesVoiceNumber\(|db\.\w+\.find/);
      return verify !== -1 && refuse !== -1 && readDb !== -1 && verify < refuse && refuse < readDb;
    })(),
  );
  ok(
    "the verifier is the shared one, not a second copy of the HMAC dance",
    /from "@\/lib\/sms\/verifyTwilioWebhook"/.test(source(ROUTE)),
  );
  ok(
    "the second leg is behind the same signature check",
    // The stage branch must sit AFTER the verification, or a stranger could
    // post a DialCallStatus for any attempt id they liked.
    body.indexOf("verifyTwilioWebhook") < body.indexOf('"after-dial"'),
  );
}

ok(
  "the route is declared in check-route-callers' external-caller list",
  read("scripts/check-route-callers.mjs").includes('"/api/rep-dial/inbound":'),
);
ok(
  "…and the path the list names is the path the module builds",
  INBOUND_WEBHOOK_PATH === "/api/rep-dial/inbound",
);
ok(
  "the route is NOT under /api/sales, which middleware refuses without a rep cookie",
  !ROUTE.startsWith("app/api/sales"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. THE CALLING WINDOW DOES NOT GATE AN INBOUND ANSWER");

// The single most counter-intuitive rule in this feature, and the one a future
// change is most likely to "fix". A person ringing us has chosen the moment;
// refusing them at 21:00 because Oklahoma's solicitation statute closes at
// 20:00 would refuse a prospect who is trying to buy.
{
  const src = source(ROUTE);
  ok(
    "the route imports nothing from the calling-rules module",
    !/from "@\/lib\/sales\/callingRules"/.test(src),
  );
  ok("…and never calls salesCallReadiness", !/salesCallReadiness/.test(src));
  ok("…and never reads a CALL_ALLOWED decision", !/CALL_ALLOWED|CALL_REFUSED/.test(src));

  const routing = source("lib/sales/calls/inboundRouting.js");
  ok(
    "the routing module imports no calling-window code either",
    !/from "\.\.?\/callingRules"|from "@\/lib\/sales\/callingRules"/.test(routing),
  );
}

// A call arriving at 21:30 UTC — outside every window in the table — is
// answered, and answered the same way it would be at noon.
{
  const late = inboundPlan({
    numberRung: OUR_NUMBER,
    fromE164: CALLER,
    match: matchInboundCaller({ fromE164: CALLER }),
    transferTo: DESK,
    anyRepLive: true,
  });
  ok("a call outside every calling window still connects", late.action === INBOUND_CONNECT, late.action);
  ok("…and is still recorded", late.recordAttempt === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Every branch of the answer, executed");

ok("the action vocabulary is closed and complete", INBOUND_ACTIONS.length === 4 &&
  [INBOUND_NOT_OURS, INBOUND_UNAVAILABLE, INBOUND_CONNECT, INBOUND_MESSAGE].every((a) =>
    INBOUND_ACTIONS.includes(a),
  ));

{
  const notOurs = inboundPlan({ numberRung: null });
  ok("a number we do not hold is refused", notOurs.action === INBOUND_NOT_OURS, notOurs.action);
  ok("…and nothing is written for it", notOurs.recordAttempt === false);
  ok("…and the caller is told something rather than dropped", notOurs.say.length > 0);
}

{
  const noStore = inboundPlan({ numberRung: OUR_NUMBER, storeReady: false, transferTo: DESK });
  ok(
    "a deployment that cannot record the call does not silently take it",
    noStore.action === INBOUND_UNAVAILABLE,
    noStore.action,
  );
  ok("…and does not transfer it either", noStore.transferTo === null);
  ok("…and writes no row it cannot write", noStore.recordAttempt === false);
}

{
  const noDest = inboundPlan({ numberRung: OUR_NUMBER, transferTo: null, anyRepLive: true });
  ok("no transfer destination means a message, not a dead line", noDest.action === INBOUND_MESSAGE);
  ok("…and the call is still recorded", noDest.recordAttempt === true);
  ok("…and the reason is machine-readable", noDest.reason === "no_transfer_destination");
}

{
  const empty = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: false });
  ok("an empty floor is not rung", empty.action === INBOUND_MESSAGE, empty.action);
  ok("…and says why", empty.reason === "floor_empty");
}

{
  // The distinction that costs a call if it is collapsed: `null` is the
  // presence tables being unreadable, NOT an empty floor.
  const unknown = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: null });
  ok("an UNKNOWN floor is rung anyway", unknown.action === INBOUND_CONNECT, unknown.action);
  ok("…and the reason records that it was a guess", unknown.reason === "transfer_presence_unknown");
  ok("…and it is not confused with a live floor", unknown.reason !== "transfer_floor_live");
}

{
  const live = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true });
  ok("a live floor with a destination connects", live.action === INBOUND_CONNECT);
  ok("…to the configured destination and nowhere else", live.transferTo === DESK);
  ok("…with a ring timeout, so it cannot ring forever", live.timeoutSeconds === TRANSFER_RING_SECONDS);
  ok("…and nothing is spoken first, so the ring is not delayed", live.say.length === 0);
  ok("…but the message it falls back to is carried", live.fallbackSay.length > 0);
}

ok(
  "a destination that is not E.164 is not dialled",
  inboundPlan({ numberRung: OUR_NUMBER, transferTo: "the office", anyRepLive: true }).action ===
    INBOUND_MESSAGE,
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Recording is off on every branch, and there is no switch");

for (const [label, plan] of [
  ["a number we do not hold", inboundPlan({ numberRung: null })],
  ["an unrecordable deployment", inboundPlan({ numberRung: OUR_NUMBER, storeReady: false })],
  ["a message", inboundPlan({ numberRung: OUR_NUMBER, transferTo: null })],
  ["an empty floor", inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: false })],
  ["a transfer", inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true })],
]) {
  ok(`${label}: record is false`, plan.record === false, plan.record);
}

{
  const src = source(ROUTE);
  ok("the TwiML never sets a record attribute", !/record\s*:/.test(src));
  ok("…and never emits <Record>", !/\.record\(/.test(src) && !/<Record/.test(src));
  ok("…and never asks for a transcription", !/[Tt]ranscri/.test(src));
  ok(
    "the routing module states the decision rather than exposing a flag",
    /record: false/.test(source("lib/sales/calls/inboundRouting.js")),
  );
  ok(
    "no environment variable can turn recording on",
    !/RECORD/.test(src),
  );
}

ok(
  "the call report says out loud that no message can be left",
  NOT_TRACKED_CALLS.some((n) => n.key === "voicemail" && /recording/i.test(n.reason)),
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. What the caller is told is true, and no callback is promised");

{
  const named = fallbackSayFor({ repName: "Daniel Okonkwo" });
  const bare = fallbackSayFor({});
  const all = [...named, ...bare].join(" ");

  ok("a rep who will actually see the row is named", named.join(" ").includes("Daniel"));
  ok("…by first name only", !named.join(" ").includes("Okonkwo"));
  ok("no rep means no name, rather than an invented one", !/undefined|null/.test(bare.join(" ")));
  ok("both say the call was written down", named.some((l) => /logged/i.test(l)) && bare.some((l) => /logged/i.test(l)));

  // The one thing this must never say. A callback is an OUTBOUND call: it has
  // to clear the calling window, the do-not-contact flag and the 24h cap, none
  // of which can be promised from inside an inbound webhook.
  ok(
    "nothing promises a callback",
    !/call you back|ring you back|get back to you|we will call|we'll call/i.test(all),
    all,
  );
  ok("nothing promises a time", !/within|shortly, someone|first thing/i.test(all));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. SalesSuppression binds, and answering is not a breach of it");

{
  const clean = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true, suppressed: false });
  const blocked = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true, suppressed: true });

  ok("a suppressed caller is still answered — they rang us", blocked.action === clean.action);
  ok("…and the suppression travels on the plan so it can be logged", blocked.suppressed === true);
  ok("…and an unsuppressed caller is not marked as one", clean.suppressed === false);
  ok(
    "the two hear the same words — there is no pitch to soften",
    JSON.stringify(blocked.fallbackSay) === JSON.stringify(clean.fallbackSay),
  );
}

{
  const src = source(ROUTE);
  ok("the route never writes to the suppression list", !/salesSuppression/.test(src));
  ok("…in either direction — nothing unsuppresses either", !/unsuppress/.test(src));
  ok("…and it DOES read it before deciding", /checkSuppression\(/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The gate's permitted writes are not widened by this path");

ok(
  "REP_CALL_WRITES is unchanged — five models, none of them money",
  REP_CALL_WRITES.length === 5 &&
    ["salesCallAttempt", "salesRepActivity", "prospect", "salesLead", "salesSuppression"].every((m) =>
      REP_CALL_WRITES.includes(m),
    ),
  REP_CALL_WRITES,
);
ok(
  "the inbound route writes ONE model, and it is already on that list",
  (() => {
    const src = source(ROUTE);
    const writes = new Set();
    for (const m of src.matchAll(
      /\b(?:db|tx|client|prisma)\.([a-zA-Z]+)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g,
    )) {
      writes.add(m[1]);
    }
    // The route's only write goes through recordInbound/attachProviderCall in
    // the store, so a direct Prisma write appearing here at all is the thing
    // worth failing on.
    return writes.size === 0;
  })(),
);
ok(
  "…and the helpers it calls touch salesCallAttempt only",
  (() => {
    const inbound = fnBody("lib/sales/calls/store.js", "export async function recordInbound(");
    const models = new Set(
      [...inbound.matchAll(/\bclient\.([a-zA-Z]+)\./g)].map((m) => m[1]),
    );
    return models.size === 1 && models.has("salesCallAttempt");
  })(),
);
ok(
  "the inbound path never touches attribution, commission or payouts",
  !/salesAttribution|salesCommissionEntry|salesPayoutBatch/.test(source(ROUTE)),
);
ok(
  "…and never moves a claim",
  // `assignedRepId` legitimately appears in a SELECT — the match reads who
  // holds the claim in order to tell them their prospect rang, which
  // inboundMatch.js is explicit is a fact and not authority. What must not
  // appear is a write of it, or of the lease that goes with it.
  (() => {
    const src = source(ROUTE);
    const assigns = [...src.matchAll(/assignedRepId:\s*([A-Za-z0-9_."'+]+)/g)].map((m) => m[1]);
    return (
      !/claimExpiresAt/.test(src) &&
      assigns.every((v) => v === "true") &&
      !/db\.prospect\.(update|updateMany|upsert)/.test(src)
    );
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. Nothing in the request chooses who gets dialled");

{
  const body = fnBody(ROUTE, "export async function POST(");
  ok(
    "the transfer destination comes from the environment",
    /process\.env\.FIELDQUO_SALES_TRANSFER_TO/.test(body),
  );
  ok(
    "…and the number actually dialled is the plan's, not a request field",
    /dial\.number\(plan\.transferTo\)/.test(body),
  );
  ok(
    "the number rung selects a row and is not otherwise trusted",
    /salesVoiceNumber\(rung\)/.test(body),
  );
  ok(
    "a caller ID is only ever the caller or a number we own",
    /callerId: caller \|\| numberRung\.e164/.test(body),
  );
  ok(
    "the attempt id on the second leg travels in a URL we build, not in the body",
    /searchParams\.get\("attemptId"\)/.test(source(ROUTE)),
  );
}

ok(
  "FIELDQUO_SALES_TRANSFER_TO is documented for the owner",
  read("docs/VERCEL.md").includes("FIELDQUO_SALES_TRANSFER_TO"),
);

// ═══════════════════════════════════════════════════════════════════════════
section("9. Presence: one model, and three answers");

ok("no presence row at all is UNKNOWN, not absent", repIsLive(null) === null);
ok(
  "a rep who has never signed in is not live",
  repIsLive({ everSeen: false, state: STATE_OFFLINE }) === false,
);
ok(
  "a stale row is not live, whatever it says",
  repIsLive({ everSeen: true, stale: true, state: STATE_AVAILABLE }) === false,
);
ok(
  "available and fresh is live",
  repIsLive({ everSeen: true, stale: false, state: STATE_AVAILABLE }) === true,
);
ok(
  "on a call is live",
  repIsLive({ everSeen: true, stale: false, state: STATE_ON_CALL }) === true,
);
ok(
  "paused is live — they are at work, just not at the phone",
  repIsLive({ everSeen: true, stale: false, state: STATE_PAUSED }) === true,
);
ok(
  "offline is not live",
  repIsLive({ everSeen: true, stale: false, state: STATE_OFFLINE }) === false,
);

ok("an unreadable presence table is null, not an empty floor", anyRepLive(null) === null);
ok("a floor with no reps is a measured false", anyRepLive([]) === false);
ok(
  "one live rep is enough",
  anyRepLive([
    { salesRepId: "a", presence: { everSeen: true, stale: false, state: STATE_OFFLINE } },
    { salesRepId: "b", presence: { everSeen: true, stale: false, state: STATE_AVAILABLE } },
  ]) === true,
);
ok(
  "a floor of stale rows is not a live floor",
  anyRepLive([{ salesRepId: "a", presence: { everSeen: true, stale: true, state: STATE_AVAILABLE } }]) ===
    false,
);
ok(
  "the routing module does not invent a second presence vocabulary",
  !/available|on_call|after_call/.test(
    fnBody("lib/sales/calls/inboundRouting.js", "export function repIsLive("),
  ),
);

// ═══════════════════════════════════════════════════════════════════════════
section("10. The transfer's outcome");

{
  const plan = inboundPlan({ numberRung: OUR_NUMBER, transferTo: DESK, anyRepLive: true, rep: { id: "r1", name: "Daniel" } });

  const answered = afterTransfer({ dialCallStatus: "completed", plan });
  ok("a completed transfer counts as answered", answered.answered === true);
  ok("…and says nothing more to a caller who has hung up", answered.say.length === 0);

  for (const status of ["no-answer", "busy", "failed", "canceled"]) {
    const r = afterTransfer({ dialCallStatus: status, plan });
    ok(`${status}: not answered, and the caller is told`, r.answered === false && r.say.length > 0);
    ok(
      `${status}: told the same thing the message branch would have said`,
      JSON.stringify(r.say) === JSON.stringify(plan.fallbackSay),
    );
  }

  const missing = afterTransfer({ dialCallStatus: null, plan: null });
  ok("a missing status is not treated as answered", missing.answered === false);
  ok("…and still says something", missing.say.length > 0);
  ok("…and still promises no callback", !/call you back|we will call/i.test(missing.say.join(" ")));
}

{
  const body = fnBody(ROUTE, "async function afterDial(");
  ok("the second leg records what the carrier reported", /attachProviderCall\(/.test(body));
  ok(
    "…and never writes a disposition — that is the rep's account, not the network's",
    !/disposition/.test(body),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. The row: direction, and the cap it must not consume");

// A scriptable client. Every store function takes one, so the real shipped
// function runs and the assertion is about the argument it passed to Prisma.
function stubClient({ attempts = [], numbers = [] } = {}) {
  const calls = [];
  return {
    calls,
    salesCallAttempt: {
      findMany: async (args) => {
        calls.push(["findMany", args]);
        return attempts.filter((a) => {
          if (args.where.direction && a.direction !== args.where.direction) return false;
          if (args.where.toE164 && a.toE164 !== args.where.toE164) return false;
          return true;
        });
      },
      findFirst: async (args) => {
        calls.push(["findFirst", args]);
        return (
          attempts.find((a) => {
            const w = args.where || {};
            if (w.direction && a.direction !== w.direction) return false;
            if (w.toE164 && a.toE164 !== w.toE164) return false;
            if (w.fromE164 && a.fromE164 !== w.fromE164) return false;
            return true;
          }) || null
        );
      },
      create: async (args) => {
        calls.push(["create", args]);
        return { id: "att_new", ...args.data };
      },
      upsert: async (args) => {
        calls.push(["upsert", args]);
        return { id: "att_up", dialledAt: args.create.dialledAt, ...args.create };
      },
    },
    // Present so callStoreState()'s probe finds it. The store answers "are the
    // tables there" from the generated client rather than from a constant, and
    // a stub missing this delegate would make every write below refuse for a
    // reason that has nothing to do with what is being tested.
    salesRepActivity: {
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
    },
    platformSmsNumber: {
      findFirst: async (args) => {
        calls.push(["number.findFirst", args]);
        return (
          numbers.find(
            (n) =>
              n.e164 === args.where.e164 &&
              n.purpose === args.where.purpose &&
              n.active === args.where.active,
          ) || null
        );
      },
    },
  };
}

{
  const client = stubClient();
  const res = await recordInbound({
    salesRepId: "rep1",
    prospectId: "p1",
    contactE164: CALLER,
    ourE164: OUR_NUMBER.e164,
    providerCallSid: "CA123",
    matchedBy: "phone_e164",
    now: NOW,
    client,
  });
  const write = client.calls.find((c) => c[0] === "upsert");
  const data = write?.[1]?.create || {};

  ok("an inbound call is written", res.ok === true);
  ok("…with direction 'in'", data.direction === "in", data.direction);
  ok("…on its own dial channel, not claimed as a browser dial", data.dialChannel === "inbound");
  ok(
    "…with toE164 the CONTRACTOR, so the cap and callback tracker key on the right number",
    data.toE164 === CALLER,
    data.toE164,
  );
  ok("…and fromE164 the number of ours they rang", data.fromE164 === OUR_NUMBER.e164);
  ok("…recording HOW the caller was matched", data.matchedBy === "phone_e164");
  ok(
    "…and never as a cleared calling decision",
    data.decisionAtDial === "inbound",
    data.decisionAtDial,
  );
  ok("…carrying no jurisdiction, because none was evaluated", !data.jurisdictionCode);
  ok(
    "…keyed on Twilio's CallSid so a webhook retry is not a second call",
    write?.[1]?.where?.providerCallSid === "CA123" &&
      Object.keys(write?.[1]?.update || {}).length === 0,
  );
}

{
  // No CallSid is not a reason to lose the row.
  const client = stubClient();
  await recordInbound({ contactE164: CALLER, ourE164: OUR_NUMBER.e164, now: NOW, client });
  ok(
    "with no CallSid it still writes, as a plain create",
    client.calls.some((c) => c[0] === "create"),
  );
}

{
  const client = stubClient();
  const res = await recordInbound({
    contactE164: null,
    ourE164: OUR_NUMBER.e164,
    now: NOW,
    client,
  });
  const data = (client.calls.find((c) => c[0] === "create") || [])[1]?.data || {};
  ok("a withheld caller ID still produces a row", res.ok === true);
  ok(
    "…and the placeholder is NOT a plausible phone number",
    data.toE164 === WITHHELD_NUMBER && normalisePhone(data.toE164) === null,
    data.toE164,
  );
  ok("…and nothing claims it was matched", !data.matchedBy);
}

{
  const client = stubClient();
  const res = await recordInbound({ contactE164: CALLER, ourE164: null, client });
  ok("a row with no number of ours is refused", res.ok === false && res.attempt === null);
}

{
  // An inbound row may have no rep. An OUTBOUND one may not, and recordDial
  // still says so — the property the nullable column must not have loosened.
  const client = stubClient();
  const res = await recordDial({
    salesRepId: null,
    toE164: CALLER,
    readiness: { decision: "allowed" },
    client,
  });
  ok(
    "an outbound attempt with no rep is still refused",
    res.ok === false && /belong to a rep/i.test(res.error),
    res.error,
  );
  ok("…and nothing was written", !client.calls.some((c) => c[0] === "create"));
}

{
  const client = stubClient();
  await recordDial({
    salesRepId: "rep1",
    toE164: CALLER,
    readiness: { decision: "allowed" },
    now: NOW,
    client,
  });
  const data = (client.calls.find((c) => c[0] === "create") || [])[1]?.data || {};
  ok("an outbound attempt is still written as direction 'out'", data.direction === "out");
}

{
  // The cap. Three inbound calls from one contractor must not spend the three
  // outbound calls Oklahoma and Florida allow.
  const attempts = [
    { toE164: CALLER, direction: "in", dialledAt: new Date(NOW.getTime() - 1000) },
    { toE164: CALLER, direction: "in", dialledAt: new Date(NOW.getTime() - 2000) },
    { toE164: CALLER, direction: "in", dialledAt: new Date(NOW.getTime() - 3000) },
    { toE164: CALLER, direction: "out", dialledAt: new Date(NOW.getTime() - 4000) },
  ];
  const client = stubClient({ attempts });
  const n = await attemptsLast24h(CALLER, { now: NOW, client });
  ok("the 24-hour cap counts calls FieldQuo PLACED", n === 1, n);
  ok(
    "…and the query says so, rather than filtering afterwards",
    /direction: "out"/.test(fnBody("lib/sales/calls/store.js", "export async function attemptsLast24h(")),
  );
  ok("…and null is still not zero", (await attemptsLast24h("nonsense", { now: NOW, client })) === null);
}

{
  const attempts = [
    { id: "a1", toE164: CALLER, fromE164: OUR_NUMBER.e164, direction: "out", salesRepId: "rep1" },
  ];
  const client = stubClient({ attempts });
  const row = await lastOutboundBetween({
    contactE164: CALLER,
    ourE164: OUR_NUMBER.e164,
    client,
  });
  ok("the rep who rang them from this number is findable", row?.salesRepId === "rep1");
  const q = client.calls.find((c) => c[0] === "findFirst")?.[1]?.where || {};
  ok("…matched on the PAIR, not on the caller alone", q.toE164 === CALLER && q.fromE164 === OUR_NUMBER.e164);
  ok("…and only against calls we placed", q.direction === "out");
  ok(
    "an unreadable number matches nothing rather than everything",
    (await lastOutboundBetween({ contactE164: "withheld", ourE164: OUR_NUMBER.e164, client })) === null,
  );
}

{
  const client = stubClient({ numbers: [OUR_NUMBER, { ...OUR_NUMBER, e164: "+15145550111", purpose: "system" }] });
  const row = await salesVoiceNumber(OUR_NUMBER.e164, { client });
  ok("a sales_voice number resolves", row?.e164 === OUR_NUMBER.e164);
  const q = client.calls.find((c) => c[0] === "number.findFirst")?.[1]?.where || {};
  ok("…scoped to the purpose in the query", q.purpose === "sales_voice");
  ok("…and to an active number", q.active === true);
  ok(
    "a tenant-serving system number is NOT a sales voice number",
    (await salesVoiceNumber("+15145550111", { client })) === null,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. An inbound row is not a dial, and no report counts it as one");

{
  const from = new Date("2026-09-04T00:00:00Z");
  const attempts = [
    { id: "o1", direction: "out", dialledAt: NOW, toE164: CALLER, disposition: "reached_interested" },
    { id: "o2", direction: "out", dialledAt: NOW, toE164: CALLER },
    { id: "i1", direction: "in", dialledAt: NOW, toE164: CALLER },
    { id: "i2", direction: "in", dialledAt: NOW, toE164: CALLER },
    { id: "i3", direction: "in", dialledAt: NOW, toE164: CALLER },
  ];
  const stats = repCallStats({ attempts, from, to: NOW, now: NOW });
  ok("dials counts only what the rep placed", stats.dials === 2, stats.dials);
  ok("callbacks received are counted, and separately", stats.callbacksReceived === 3);
  ok(
    "the outcomes cover both directions — a logged callback is a real conversation",
    stats.dispositions.total === 5,
    stats.dispositions.total,
  );

  const campaigns = campaignCallRows({ attempts, from, to: NOW });
  ok("a campaign's dial count excludes callbacks too", campaigns[0].dials === 2, campaigns[0].dials);
  ok("…and reports them beside it", campaigns[0].callbacksReceived === 3);

  // A row written before the column had a second value carries the default.
  const legacy = repCallStats({ attempts: [{ id: "x", dialledAt: NOW }], from, to: NOW, now: NOW });
  ok("a row with no direction at all counts as a dial, not as a callback", legacy.dials === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. The match may put a card on a screen and nothing more");

{
  // inboundMatch.js already has its own executed checks. What is asserted here
  // is the one thing this feature could have quietly broken: that an ambiguous
  // match attaches the call to NOBODY rather than to a guess.
  const two = matchInboundCaller({
    fromE164: CALLER,
    prospects: [
      { id: "p1", businessName: "Tulsa Roofing" },
      { id: "p2", businessName: "Tulsa Roofing LLC" },
    ],
  });
  ok("two businesses on one number is ambiguous", two.outcome === "ambiguous");
  ok("…and attaches to neither", two.prospectId === null && two.salesRepId === null);

  const client = stubClient();
  await recordInbound({
    prospectId: two.prospectId,
    leadId: two.salesLeadId,
    contactE164: CALLER,
    ourE164: OUR_NUMBER.e164,
    matchedBy: two.matchedBy,
    now: NOW,
    client,
  });
  const data = (client.calls.find((c) => c[0] === "create") || [])[1]?.data || {};
  ok("…so the row names no business", data.prospectId === null && data.leadId === null);
  ok("…and does not claim a match was made", data.matchedBy === null);
}

{
  const body = fnBody(ROUTE, "export async function POST(");
  ok(
    "the rep who rang them wins over the claim holder",
    /repToTell\(\[lastOut\?\.salesRepId, match\.salesRepId\]\)/.test(body),
  );
  const rep = fnBody(ROUTE, "async function repToTell(");
  ok(
    "…and a rep who has left is not chosen, so the row is not filed where nobody looks",
    /canAuthenticate\(/.test(rep),
  );
  ok("…re-read fresh from the database, not carried", /db\.salesRep\s*\n?\s*\.findUnique\(/.test(rep));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. The write is read: the floor board shows what came in");

{
  const routeSrc = source("app/api/platform/sales/floor/route.js");
  ok("the floor route reads inbound calls", /inboundCalls\(/.test(routeSrc));
  ok(
    "…by direction, so a call that matched no rep is still visible",
    /direction: "in"/.test(
      fnBody("lib/sales/calls/store.js", "export async function inboundCalls("),
    ),
  );
  ok(
    "…and distinguishes 'we could not look' from 'nobody rang'",
    /inbound === undefined\s*\n?\s*\? null/.test(routeSrc),
  );

  const page = source("app/platform/sales/floor/page.js");
  ok("the page renders them", /data\.inboundCalls/.test(page));
  ok("…and renders the null case as a gap rather than a zero", /inboundCalls === null/.test(page));
  ok("…and says which rep it was filed for", /repName/.test(page));
  ok("…and prints the sales_voice state beside the agent's", /data\.salesVoice/.test(page));
}

// ═══════════════════════════════════════════════════════════════════════════
section("15. What a superadmin is told about the pool");

{
  ok(
    "no numbers held is its own state, and says where to buy one",
    (() => {
      const s = salesVoiceInboundState({ numbers: [] });
      return s.state === "none" && /Crew lines/.test(s.text);
    })(),
  );
  ok(
    "a failed lookup is NOT the same as holding none",
    salesVoiceInboundState({ numbers: [], lookupFailed: true }).state === "unknown",
  );
  ok(
    "numbers held with no transfer destination says the call is logged and nothing more",
    (() => {
      const s = salesVoiceInboundState({ numbers: [OUR_NUMBER.e164], transferConfigured: false });
      return s.state === "logged_only" && /FIELDQUO_SALES_TRANSFER_TO/.test(s.text);
    })(),
  );
  ok(
    "an empty floor is said out loud rather than shown as working",
    salesVoiceInboundState({
      numbers: [OUR_NUMBER.e164],
      transferConfigured: true,
      anyLive: false,
    }).state === "floor_empty",
  );
  ok(
    "a live floor with a destination is the only 'connects' state",
    salesVoiceInboundState({
      numbers: [OUR_NUMBER.e164],
      transferConfigured: true,
      anyLive: true,
    }).state === "connects",
  );
  ok(
    "every held state names the webhook the owner has to paste into Twilio",
    salesVoiceInboundState({
      numbers: [OUR_NUMBER.e164],
      transferConfigured: true,
      anyLive: true,
      webhookUrl: "https://app.fieldquo.com/api/rep-dial/inbound",
    }).text.includes("/api/rep-dial/inbound"),
  );
  ok(
    "…and does not print a half-built URL when the origin is unknown",
    !/undefined|null/.test(
      salesVoiceInboundState({ numbers: [OUR_NUMBER.e164], transferConfigured: true }).text,
    ),
  );
}

ok(
  "the webhook URL is built from the origin, with no doubled slash",
  inboundWebhookUrl("https://app.fieldquo.com/") === "https://app.fieldquo.com/api/rep-dial/inbound",
);
ok("no origin means no URL, rather than a relative one", inboundWebhookUrl(null) === null);

ok(
  "the rep-admin screen no longer claims nothing answers a callback",
  /the rep who last called them from that number/.test(read("lib/sales/repAdmin.js")),
);

// ═══════════════════════════════════════════════════════════════════════════
section("16. Twilio is answered with a document, never with an error");

{
  const src = source(ROUTE);
  // Twilio plays "an application error has occurred" on a non-2xx, which is
  // the worst thing a prospect can hear on a number a salesperson gave them.
  // The only non-200 in the file is the 403 for an unsigned request, which
  // Twilio itself never sees.
  const statuses = [...src.matchAll(/status:\s*(\d{3})/g)].map((m) => m[1]);
  ok(
    "every answer is a 200 except the unsigned refusal",
    statuses.every((s) => s === "200" || s === "403"),
    statuses,
  );
  ok(
    "a failure to record the call does not drop it",
    /recordInbound\([\s\S]*?\.catch\(/.test(src),
  );
  ok("…and is recorded for a human", /area: "sales_inbound"/.test(src));
  ok(
    "a call to a number we do not hold is logged, not silently dropped",
    /code: "unknown_number"/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("17. This check runs in check:all");

{
  const pkg = read("package.json");
  ok("the script is defined", /"check:sales-inbound-call":/.test(pkg));
  ok("…and is in check:all", /check:all[\s\S]*?check:sales-inbound-call/.test(pkg));
}

console.log(
  `\n${failures.length === 0 ? "PASS" : "FAIL"} — ${pass} checks passed, ${failures.length} failed.`,
);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
