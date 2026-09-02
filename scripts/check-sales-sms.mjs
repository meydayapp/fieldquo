#!/usr/bin/env node
//
// scripts/check-sales-sms.mjs
//
//   npm run check:sales-sms
//
// Two guarantees about text messages, both of which fail silently and neither
// of which is visible in a diff.
//
// ══ 1. A demo account must never text a real person ════════════════════════
//
// This is the SMS twin of the hole check-demo-email.mjs closed for mail, and it
// was worse. Mail had accidental cover — lib/demo/seedDemo.js gives fictional
// clients @example.com addresses — and a phone number has no such convention.
// Nothing in lib/sms/twilioClient.js ever asked who was sending, so a rep
// running a walkthrough who typed a live prospect's mobile into a demo
// account's referral invite sent that stranger a real text about a company that
// does not exist and will be re-dressed as a roofer next week.
//
// ══ 2. A rep texting a prospect must be allowed to ═════════════════════════
//
// CASL treats a commercial text exactly as it treats a commercial email:
// identify the sender, carry a mailing address, offer a working unsubscribe.
// Each of those is a thing that can be present in the source and absent in
// effect — a "Reply STOP" line with no webhook behind it, a mailing address
// read from an env var nobody set, a suppression list consulted on the screen
// and not at the send. This file executes each of them.
//
// ══ Why so much of this EXECUTES rather than reads ═════════════════════════
//
// lib/db.js caches its client on `globalThis.__prisma`, so setting that before
// the first dynamic import gives every module under test a fake database and
// makes the real code paths runnable — the demo guard, the suppression read,
// the STOP handler, the whole send. AGENTS.md's "execute pure functions against
// hostile input" applies with more force to the impure ones here, because the
// bugs this file exists to catch are all bugs of ORDER and REACHABILITY, and
// reading source proves neither.
//
// The vendor is never reached, and not because it is stubbed: TWILIO_ACCOUNT_SID
// is set to a value that is truthy (so twilioConfigured() says yes, which is
// what the readiness rules need) but not a real SID (so the Twilio constructor
// throws locally, before any socket). That makes "did this reach the vendor?"
// an observable, offline, deterministic fact rather than a mock's say-so.
//
// ══ Why every string rule is scoped to ONE brace-matched function ══════════
//
// scripts/check-demo-spend.mjs's header records this the hard way and
// check-demo-email.mjs repeats it: a whole-file search passed while the guard
// it was checking had been deleted outright, because a different function's
// identical guard string satisfied the match a few hundred lines earlier. It
// has happened three times in this project. So functionSource() below matches
// BRACES rather than guessing at the next top-level declaration, and every
// ordered rule names the function it is about.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

let fail = 0;
let pass = 0;
const ok = (message, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${message}`);
  } else {
    fail++;
    console.log(`  FAIL ${message}${got === undefined ? "" : `  — got ${JSON.stringify(got)}`}`);
  }
};
const section = (title) => console.log(`\n${title}\n`);

// ── Source reading ─────────────────────────────────────────────────────────
//
// Comments in this repo explain WHY at length and several of them quote the
// very strings these rules search for — this file's own header names
// `isDemoCompany` and `Reply STOP`. A regex that reads justification prose
// passes on broken code, which two earlier check scripts in this repo did.

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
const read = (f) => stripComments(readFileSync(f, "utf8"));

/**
 * The source of ONE function, from its signature to its matching close brace.
 *
 * Real brace matching, not "up to the next declaration at column zero". The
 * heuristic version is fine until a rule needs to be sure a guard is inside the
 * function it names, and that is precisely the rule this file leans on hardest.
 *
 * String literals are skipped so a brace inside one cannot unbalance the count.
 * Regex literals are NOT parsed — distinguishing `/` as division from `/` as a
 * regex needs a real tokeniser — which is safe for the files read here because
 * every regex in them is brace-balanced (`\d{10}`, `[.!?]+$`). A future
 * unbalanced one would make this return a short slice, and a short slice fails
 * the rules rather than passing them, which is the right way round.
 *
 * `null` when the function is not there, which every caller treats as a FAILURE
 * rather than a skip: a renamed function means the rule has stopped proving
 * anything, and silently passing would make this file read as evidence while
 * checking nothing.
 */
function functionSource(src, name) {
  const sig = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = sig.exec(src);
  if (!m) return null;

  // The parameter list is matched FIRST, and it has to be. Almost every
  // function in this area destructures its arguments — `sendSms({ to, body,
  // from, companyId })` — so "the first { after the name" is the parameter
  // object, not the body. An earlier draft of this file made exactly that
  // mistake and every ordered rule quietly passed on a four-line slice.
  const paramClose = matchDelims(src, m.index + m[0].length - 1);
  if (paramClose === -1) return null;

  const open = src.indexOf("{", paramClose);
  if (open === -1) return null;
  const close = matchDelims(src, open);
  return close === -1 ? null : src.slice(m.index, close + 1);
}

/**
 * The index of the delimiter closing the one that opens at `start`.
 *
 * Nested (), {} and [] all count, so a parameter list containing an object and
 * an object containing a call both come out whole. -1 when it never closes,
 * which every caller treats as a failure.
 */
function matchDelims(src, start) {
  const closers = { "(": ")", "{": "}", "[": "]" };
  const stack = [];
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (closers[ch]) stack.push(closers[ch]);
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}

/** Every .js/.mjs under a directory, ignoring build output and worktrees. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(entry)) out.push(p.split(sep).join("/"));
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════
//  A fake database, installed before anything imports lib/db.
// ════════════════════════════════════════════════════════════════════════════
//
// Faithful to the queries the code under test actually makes, and no wider.
// A fake that answered every possible query would be a second implementation
// of Prisma to keep correct; this one is small enough to read in a minute,
// which is the property that makes its answers trustworthy.

const store = {
  companies: new Map(), // id -> { isDemo }
  activity: [],
  errors: [],
  numbers: [], // { e164, purpose, active, createdAt }
  suppressions: [], // SalesSuppression rows
  suppressionEvents: [],
  smsMessages: [],
  leads: new Map(),
};

function resetStore() {
  store.companies.clear();
  store.activity.length = 0;
  store.errors.length = 0;
  store.numbers.length = 0;
  store.suppressions.length = 0;
  store.suppressionEvents.length = 0;
  store.smsMessages.length = 0;
  store.leads.clear();
}

let nextId = 1;
const id = () => `fake_${nextId++}`;

const fakeDb = {
  $transaction: (fn) => (typeof fn === "function" ? fn(fakeDb) : Promise.all(fn)),

  company: {
    findUnique: async ({ where }) => {
      if (where.id === "COMPANY_THAT_EXPLODES") {
        // The Neon-scaling-from-zero case (P1001). A thrown read is NOT the
        // same as "no such company", and the guard has to tell them apart.
        throw new Error("P1001: Can't reach database server");
      }
      const row = store.companies.get(where.id);
      return row ? { id: where.id, ...row } : null;
    },
  },

  activityLog: { create: async ({ data }) => { store.activity.push(data); return { id: id(), ...data }; } },
  platformErrorLog: { create: async ({ data }) => { store.errors.push(data); return { id: id(), ...data }; } },

  platformSmsNumber: {
    findFirst: async ({ where }) => {
      const match = store.numbers.find(
        (n) =>
          (where.purpose === undefined || n.purpose === where.purpose) &&
          (where.active === undefined || n.active === where.active) &&
          (where.e164 === undefined || n.e164 === where.e164),
      );
      return match || null;
    },
  },

  salesSuppression: {
    findMany: async ({ where }) => {
      const keys = where?.OR || [];
      return store.suppressions.filter((r) =>
        keys.some((k) => k.kind === r.kind && k.value === r.value),
      );
    },
    findUnique: async ({ where }) => {
      const { kind, value } = where.kind_value;
      return store.suppressions.find((r) => r.kind === kind && r.value === value) || null;
    },
    upsert: async ({ where, create, update }) => {
      const { kind, value } = where.kind_value;
      const found = store.suppressions.find((r) => r.kind === kind && r.value === value);
      if (found) {
        Object.assign(found, update);
        return found;
      }
      const row = { id: id(), ...create };
      store.suppressions.push(row);
      return row;
    },
  },
  salesSuppressionEvent: {
    create: async ({ data }) => { store.suppressionEvents.push(data); return { id: id(), ...data }; },
  },

  salesSmsMessage: {
    create: async ({ data }) => {
      const row = { id: id(), sentAt: data.sentAt || new Date(), ...data };
      store.smsMessages.push(row);
      return row;
    },
    findMany: async ({ where }) =>
      store.smsMessages.filter(
        (m) => m.leadId === where.leadId && m.salesRepId === where.salesRepId,
      ),
  },

  salesLead: {
    updateMany: async ({ where, data }) => {
      const lead = store.leads.get(where.id);
      if (!lead || lead.salesRepId !== where.salesRepId) return { count: 0 };
      Object.assign(lead, data);
      return { count: 1 };
    },
  },
};

globalThis.__prisma = fakeDb;

// Truthy so twilioConfigured() says the deployment can reach Twilio — which is
// what the readiness rules need to be satisfiable — and NOT a real SID, so the
// Twilio constructor throws locally the moment anything touches the client.
// "Did this reach the vendor?" therefore has an observable, offline answer.
process.env.TWILIO_ACCOUNT_SID = "not-a-real-account-sid";
process.env.TWILIO_AUTH_TOKEN = "not-a-real-auth-token";
delete process.env.TWILIO_API_KEY_SID;
delete process.env.TWILIO_API_KEY_SECRET;
delete process.env.TWILIO_PHONE_NUMBER;

const { sendSms } = await import("@/lib/sms/twilioClient");
const { salesSmsReadiness, signupLinkSmsBody, isNorthAmerican, smsSegments } = await import(
  "@/lib/sales/salesSmsRules"
);
const { SALES_SMS_WINDOW, withinSalesSmsHours, isSalesSmsTimeZone, SALES_SMS_TIME_ZONES } =
  await import("@/lib/sales/smsWindow");
const { SALES_CALL_WINDOW } = await import("@/lib/sales/callingWindow");
const { signupLinkFor } = await import("@/lib/sales/repStats");
const { deliverSignupLinkSms, handleSalesInboundSms, salesSmsStatus, setLeadTimeZone } =
  await import("@/lib/sales/salesSms");
const { REP_SMS_WRITES } = await import("@/lib/sales/smsGate");

// A Tuesday at 14:00 in Toronto — comfortably inside every window, so a
// refusal in these tests is never the clock unless the test is about the clock.
const MIDDAY = new Date("2026-09-01T18:00:00Z");
const ADDRESS = "1 Rue Principale, Gatineau QC J8X 1A1, Canada";

// ════════════════════════════════════════════════════════════════════════════
section("1. A demo company's text is simulated, and a real one's is not");

{
  resetStore();
  store.companies.set("demo1", { isDemo: true });
  store.companies.set("real1", { isDemo: false });
  store.numbers.push({ e164: "+15145550100", purpose: "system", active: true });

  const demo = await sendSms({
    to: "613-555-0142",
    body: "Northline Refinishing: your quote is ready.",
    companyId: "demo1",
  });

  ok("a demo company's send reports success", demo.success === true, demo);
  ok("…and says it was simulated", demo.simulated === true, demo);
  ok("…with a SID a human can recognise as fake", /^demo_sms_/.test(demo.sid || ""), demo.sid);
  ok("…and the vendor was never reached (no error from the Twilio client)", !demo.error, demo.error);
  ok(
    "…and the product still recorded what a real send would have recorded",
    store.activity.length === 1 && store.activity[0].action === "sms.simulated",
    store.activity.map((a) => a.action),
  );
  ok(
    "…the record carries the recipient and the body, so a rep can be shown what would have gone out",
    store.activity[0]?.metadata?.to === "+16135550142" &&
      String(store.activity[0]?.metadata?.body || "").includes("Northline"),
    store.activity[0]?.metadata,
  );

  store.activity.length = 0;
  const real = await sendSms({
    to: "613-555-0142",
    body: "Real Co: your quote is ready.",
    companyId: "real1",
  });
  ok(
    "a real company's send DOES reach the vendor (and fails on the fake credentials)",
    real.success === false && /accountSid/i.test(real.error || ""),
    real,
  );
  ok("…and writes no simulated-send record", store.activity.length === 0, store.activity.length);

  // FieldQuo's own first-party texts have no tenant behind them at all.
  store.activity.length = 0;
  const untenanted = await sendSms({ to: "613-555-0142", body: "FieldQuo here.", from: "+15145550111" });
  ok(
    "a send with no companyId reaches the vendor — FieldQuo's own texts are not a demo's",
    untenanted.success === false && /accountSid/i.test(untenanted.error || ""),
    untenanted,
  );
  ok("…and writes no simulated-send record either", store.activity.length === 0, store.activity.length);
}

{
  // The database blip. isDemoCompany returns false for a company that is not
  // there; a THROWN read means we could not establish who is sending, and
  // carrying on is exactly the leak the guard exists to stop.
  resetStore();
  store.numbers.push({ e164: "+15145550100", purpose: "system", active: true });
  const blip = await sendSms({
    to: "613-555-0142",
    body: "anything",
    companyId: "COMPANY_THAT_EXPLODES",
  });
  ok(
    "an unreadable company row fails the send rather than sending",
    blip.success === false && /confirm the sending account/i.test(blip.error || ""),
    blip,
  );
  ok("…and does not reach the vendor", !/accountSid/i.test(blip.error || ""), blip.error);
  ok(
    "…and the refusal is recorded durably",
    store.errors.some((e) => e.code === "demo_check_failed"),
    store.errors.map((e) => e.code),
  );
}

// ════════════════════════════════════════════════════════════════════════════
section("2. The demo branch is at the seam, and ahead of the vendor call");

{
  const src = read("lib/sms/twilioClient.js");
  const body = functionSource(src, "sendSms");
  if (body === null) {
    ok(false, "lib/sms/twilioClient.js exports sendSms — renamed? this rule proves nothing now");
  } else {
    const guard = body.indexOf("isDemoCompany(companyId)");
    const substitute = body.indexOf("recordSimulatedSms(");
    const vendor = body.indexOf("client.messages.create(");
    const noNumber = body.indexOf("No SMS 'from' number");

    ok("sendSms asks isDemoCompany(companyId)", guard !== -1, guard);
    ok("sendSms substitutes recordSimulatedSms() for a demo", substitute !== -1, substitute);
    ok(
      "sendSms still reaches client.messages.create() — otherwise this ordering proves nothing",
      vendor !== -1,
      vendor,
    );
    ok(
      "the demo check runs BEFORE client.messages.create(). A guard after the send is not a guard",
      guard !== -1 && vendor !== -1 && guard < vendor,
      { guard, vendor },
    );
    ok(
      "the substitute is returned before the vendor call can be reached",
      substitute !== -1 && vendor !== -1 && substitute < vendor,
      { substitute, vendor },
    );
    // A demo has to walk the whole flow. If the "no from number" refusal came
    // first, a deployment holding no system number would fail every demo send
    // and demonstrate a broken product rather than a working one.
    ok(
      "the demo branch is ahead of the no-from-number refusal, so a demo walks the whole flow",
      guard !== -1 && noNumber !== -1 && guard < noNumber,
      { guard, noNumber },
    );
  }
}

{
  // One seam. The guard only protects anything if there is a single place a
  // message leaves — checked across the whole tree rather than at named call
  // sites, because the failure it catches is a NEW file, which by definition is
  // on no list.
  const SEAM = "lib/sms/twilioClient.js";
  const offenders = [];
  for (const file of [...walk("app"), ...walk("lib")]) {
    if (file === SEAM || file === "lib/lazyClient.js") continue;
    if (/\bmessages\.create\s*\(/.test(read(file))) offenders.push(file);
  }
  ok(
    "no file outside lib/sms/twilioClient.js sends a Twilio message",
    offenders.length === 0,
    offenders.length ? offenders : undefined,
  );
  ok(
    "…and the seam still does, so the rule above is not vacuous",
    /\bmessages\.create\s*\(/.test(read(SEAM)),
  );
}

// ════════════════════════════════════════════════════════════════════════════
section("3. Every tenant-scoped SMS path passes companyId");

{
  // A send path that forgets companyId is silently a real send — the exact
  // failure this whole guard exists for, arriving through a route somebody
  // added later. Each rule is scoped to the ONE function that sends.
  const SITES = [
    ["app/api/cron/appointment-reminders/route.js", "GET"],
    ["app/api/jobs/[id]/visits/[visitId]/route.js", "PATCH"],
    ["app/api/settings/referral/invite/route.js", "POST"],
    ["app/api/crew/inbound/route.js", "settleCrewSpend"],
    ["app/api/crew/line/route.js", "POST"],
    ["app/api/sms/inbound/route.js", "POST"],
  ];

  for (const [file, fn] of SITES) {
    const body = functionSource(read(file), fn);
    if (body === null) {
      ok(`${file}: ${fn}() was found — renamed? this rule proves nothing now`, false);
      continue;
    }
    const calls = [...body.matchAll(/sendSms\(/g)].map((m) => m.index);
    ok(`${file}: ${fn}() calls sendSms(`, calls.length > 0, calls.length);
    for (const at of calls) {
      // The call's own argument object, brace-matched from the "{" that opens
      // it — so a companyId belonging to a DIFFERENT call in the same function
      // cannot satisfy this one.
      const open = body.indexOf("{", at);
      const args = open === -1 ? "" : (functionSourceFromBrace(body, open) ?? "");
      ok(
        `${file}: the sendSms( call at ${at} passes companyId`,
        /\bcompanyId\s*:/.test(args),
        args.slice(0, 120),
      );
    }
  }

  // notify.js calls its injected `send`, not sendSms by name — the injection
  // seam a check script uses to run it. Named separately rather than skipped.
  const crewSms = functionSource(read("lib/photoComments/notify.js"), "crewSmsChannel");
  ok("lib/photoComments/notify.js: crewSmsChannel() was found", crewSms !== null);
  ok(
    "lib/photoComments/notify.js: the crew SMS send passes companyId",
    Boolean(crewSms) && /await send\(\{[^}]*companyId/.test(crewSms),
    crewSms?.match(/await send\(\{[^}]*\}\)/)?.[0],
  );

  // And nothing NEW has appeared. lib/sales/salesSms.js is the one documented
  // exemption: FieldQuo's own first-party texts have no tenant behind them, so
  // there is no company row for the guard to read. Named explicitly so the
  // allowance cannot widen by accident.
  const EXEMPT = new Set(["lib/sms/twilioClient.js", "lib/sales/salesSms.js"]);
  const known = new Set(SITES.map(([f]) => f));
  const found = [...walk("app"), ...walk("lib")].filter(
    (f) => !EXEMPT.has(f) && /sendSms\(/.test(read(f)),
  );
  ok(
    "no NEW, unaccounted-for sendSms( call site has appeared",
    found.every((f) => known.has(f)),
    found.filter((f) => !known.has(f)),
  );
}

/** The argument object starting at a known "{", whole. */
function functionSourceFromBrace(src, open) {
  const close = matchDelims(src, open);
  return close === -1 ? null : src.slice(open, close + 1);
}

// ════════════════════════════════════════════════════════════════════════════
section("4. The texting window is the TEXTING rule, not the calling one");

{
  ok(
    "the SMS window is not a copy of the voice calling window",
    SALES_SMS_WINDOW.startMinute !== SALES_CALL_WINDOW.weekday.startMinute ||
      SALES_SMS_WINDOW.endMinute !== SALES_CALL_WINDOW.weekday.endMinute,
    { sms: SALES_SMS_WINDOW, voiceWeekday: SALES_CALL_WINDOW.weekday },
  );
  ok("the SMS window opens at 08:00 (TCPA)", SALES_SMS_WINDOW.startMinute === 8 * 60);
  ok("the SMS window closes at 21:00 (TCPA)", SALES_SMS_WINDOW.endMinute === 21 * 60);

  const at = (iso) => new Date(iso);
  const tz = "America/Toronto";
  // 2026-09-01 is a Tuesday; 2026-09-05 a Saturday. UTC-4 in September.
  ok("07:59 local is refused", withinSalesSmsHours(at("2026-09-01T11:59:00Z"), tz).allowed === false);
  ok("08:00 local is allowed", withinSalesSmsHours(at("2026-09-01T12:00:00Z"), tz).allowed === true);
  ok("20:59 local is allowed", withinSalesSmsHours(at("2026-09-02T00:59:00Z"), tz).allowed === true);
  ok("21:00 local is refused", withinSalesSmsHours(at("2026-09-02T01:00:00Z"), tz).allowed === false);
  ok(
    "a refusal for the clock says it can be retried",
    withinSalesSmsHours(at("2026-09-02T01:00:00Z"), tz).retryLater === true,
  );

  // The weekend is where borrowing the voice window would have been wrong: the
  // Telemarketing Rules stop calls at 18:00 on a Saturday, and nothing stops a
  // text then.
  ok(
    "Saturday at 19:00 local is allowed for a text (the voice rule stops at 18:00)",
    withinSalesSmsHours(at("2026-09-05T23:00:00Z"), tz).allowed === true,
  );

  const noZone = withinSalesSmsHours(MIDDAY, null);
  ok("an unknown time zone REFUSES rather than assuming ours", noZone.allowed === false);
  ok("…and says waiting will not fix it", noZone.retryLater === false, noZone);
  ok(
    "a garbage time zone refuses too",
    withinSalesSmsHours(MIDDAY, "Not/AZone").allowed === false,
  );
  ok("the zone list is closed", isSalesSmsTimeZone("America/Toronto") && !isSalesSmsTimeZone("Europe/Kyiv"));
  ok("…and is not empty", SALES_SMS_TIME_ZONES.length > 0, SALES_SMS_TIME_ZONES.length);
}

// ════════════════════════════════════════════════════════════════════════════
section("5. Every reason a text must not go out, executed");

const READY = {
  repName: "Daniel",
  signupLink: "https://fieldquo.com/signup?sales=DANIEL",
  fromNumber: "+15145550111",
  mailingAddress: ADDRESS,
  twilioConfigured: true,
  leadPhone: "613-555-0142",
  leadTimeZone: "America/Toronto",
  suppression: { suppressed: false, reason: null },
  now: MIDDAY,
};

/**
 * salesSmsReadiness, with a thrown answer turned into a legible failure.
 *
 * Not defensive padding: a rule that is deleted often makes this function
 * THROW rather than return a wrong answer — remove the mailing-address blocker
 * and signupLinkSmsBody refuses to compose without one, which is the second
 * line of defence doing its job. Mutation-tested, that surfaced as a stack
 * trace instead of a named failing assertion, and a check whose output is a
 * stack trace tells the next person nothing about which guarantee broke.
 */
function readiness(input) {
  try {
    return salesSmsReadiness(input);
  } catch (err) {
    return { canSend: false, blockers: [{ code: `THREW: ${err.message}`, title: "", fix: "" }], body: null, to: null };
  }
}
const codes = (r) => r.blockers.map((b) => b.code);

{
  const good = readiness(READY);
  ok("a complete, allowed send can go", good.canSend === true, codes(good));
  ok("…and the message names the sender", good.body.includes("Daniel"), good.body);
  ok("…carries the signup link", good.body.includes(READY.signupLink), good.body);
  ok("…carries FieldQuo's mailing address", good.body.includes(ADDRESS), good.body);
  ok("…and offers a working unsubscribe", /Reply STOP to opt out/.test(good.body), good.body);
  ok("…normalised to E.164", good.to === "+16135550142", good.to);
  ok("…and stays inside a couple of segments", smsSegments(good.body) <= 3, smsSegments(good.body));

  // A blocked send never builds a message. A half-built body is how a text goes
  // out with a hole where the mailing address should be.
  const blocked = readiness({ ...READY, fromNumber: null });
  ok("a blocked send builds no message body at all", blocked.body === null, blocked.body);
}

{
  const r = readiness({ ...READY, fromNumber: null });
  ok("no sales number blocks the send", r.canSend === false && codes(r).includes("no_sales_number"), codes(r));
  ok(
    "…and the fix names the purpose to buy",
    /purpose/i.test(r.blockers.find((b) => b.code === "no_sales_number")?.fix || ""),
  );
}

{
  const r = readiness({ ...READY, mailingAddress: "" });
  ok("a missing mailing address blocks the send", codes(r).includes("mailing_address_unset"), codes(r));
  ok(
    "…and it is CASL that is cited",
    /CASL/.test(r.blockers.find((b) => b.code === "mailing_address_unset")?.fix || ""),
  );
  let threw = false;
  try {
    signupLinkSmsBody({ repName: "Daniel", signupLink: "https://x/y", mailingAddress: "  " });
  } catch {
    threw = true;
  }
  ok("…and the body builder refuses to compose one without it", threw);
}

{
  const r = readiness({ ...READY, leadPhone: "not a phone at all" });
  ok("a malformed number blocks the send", codes(r).includes("phone_unusable"), codes(r));
  ok("…and nothing is normalised out of it", r.to === null, r.to);

  const empty = readiness({ ...READY, leadPhone: "" });
  ok("a lead with no phone blocks the send, and says so differently", codes(empty).includes("lead_no_phone"), codes(empty));
}

{
  const r = readiness({ ...READY, leadPhone: "+44 20 7946 0018" });
  ok("a number outside +1 blocks the send", codes(r).includes("phone_outside_nanp"), codes(r));
  ok("isNorthAmerican refuses it", isNorthAmerican("+442079460018") === false);
  ok("…and accepts a NANP number", isNorthAmerican("+16135550142") === true);
  ok("…and refuses a NANP-shaped number of the wrong length", isNorthAmerican("+1613555014") === false);
}

{
  const r = readiness({
    ...READY,
    suppression: { suppressed: true, reason: "+16135550142 is on FieldQuo's do-not-contact list" },
  });
  ok("a suppressed phone blocks the send", codes(r).includes("suppressed"), codes(r));
  ok(
    "…and the rep is told which request binds",
    /do-not-contact/.test(r.blockers.find((b) => b.code === "suppressed")?.title || ""),
  );

  const unreadable = readiness({ ...READY, suppression: null });
  ok(
    "an unreadable do-not-contact list BLOCKS rather than being read as 'not suppressed'",
    codes(unreadable).includes("suppression_unreadable"),
    codes(unreadable),
  );
}

{
  const r = readiness({ ...READY, leadTimeZone: null });
  ok("an unknown time zone blocks the send", codes(r).includes("time_zone_unknown"), codes(r));

  const night = readiness({ ...READY, now: new Date("2026-09-02T05:00:00Z") }); // 01:00 Toronto
  ok("one in the morning where they are blocks the send", codes(night).includes("outside_sms_window"), codes(night));
}

{
  const r = readiness({ ...READY, twilioConfigured: false });
  ok("no Twilio credentials blocks the send", codes(r).includes("twilio_unconfigured"), codes(r));
}

{
  // Every blocker at once, so a rep fixing three things is told about three
  // things rather than one per attempt.
  const r = readiness({
    ...READY,
    fromNumber: null,
    mailingAddress: "",
    leadPhone: "nonsense",
    leadTimeZone: null,
  });
  ok("several problems are reported together, not one at a time", r.blockers.length >= 4, codes(r));
  ok("…and every blocker carries a fix written for whoever performs it", r.blockers.every((b) => b.fix && b.title));
}

// ════════════════════════════════════════════════════════════════════════════
section("6. The link is the rep's own, and is never rebuilt");

{
  const daniel = signupLinkFor("https://fieldquo.com", "DANIEL");
  const priya = signupLinkFor("https://fieldquo.com", "PRIYA");
  ok("signupLinkFor builds the /signup?sales= link", daniel === "https://fieldquo.com/signup?sales=DANIEL", daniel);

  const body = signupLinkSmsBody({ repName: "Daniel", signupLink: daniel, mailingAddress: ADDRESS });
  ok("a rep's text carries their own code", body.includes("sales=DANIEL"), body);
  ok("…and not another rep's", !body.includes("sales=PRIYA"), { body, priya });

  // The one place that knows the shape of the link. A second copy is how a
  // rep's texted link and their portal link drift into two URLs, one of which
  // is not attributed to them.
  for (const f of ["lib/sales/salesSms.js", "lib/sales/salesSmsRules.js", "app/api/sales/sms/route.js"]) {
    ok(`${f} does not rebuild the signup URL itself`, !/signup\?sales=/.test(read(f)));
  }
  const status = functionSource(read("lib/sales/salesSms.js"), "salesSmsStatus");
  ok("salesSmsStatus() was found", status !== null);
  ok("…and gets the link from signupLinkFor", Boolean(status) && /signupLinkFor\(/.test(status));

  const missing = readiness({ ...READY, signupLink: signupLinkFor("https://fieldquo.com", null) });
  ok("a rep with no code has no link, and is blocked rather than sent an empty one", codes(missing).includes("no_signup_link"), codes(missing));
}

// ════════════════════════════════════════════════════════════════════════════
section("7. STOP works, end to end");

{
  resetStore();
  store.numbers.push({ e164: "+15145550111", purpose: "sales", active: true, createdAt: new Date(0) });

  const stray = await handleSalesInboundSms({ to: "+15145550999", from: "+16135550142", body: "STOP" });
  ok("a text to a number that is not FieldQuo's sales number is not ours to act on", stray.handled === false, stray);
  ok("…and nothing was written", store.suppressions.length === 0, store.suppressions.length);

  const chatter = await handleSalesInboundSms({
    to: "+15145550111",
    from: "+16135550142",
    body: "please stop by at 3",
  });
  ok("“please stop by at 3” is not an opt-out", chatter.action === "ignored", chatter);
  ok("…and writes nothing", store.suppressions.length === 0, store.suppressions.length);

  const stop = await handleSalesInboundSms({ to: "+15145550111", from: "613-555-0142", body: "STOP" });
  ok("STOP is recorded", stop.handled === true && stop.action === "suppressed", stop);
  const row = store.suppressions[0];
  ok("…against the normalised phone number", row?.kind === "phone" && row?.value === "+16135550142", row);
  ok("…from the SMS channel it arrived on", row?.source === "sms", row?.source);
  ok(
    "…closing EVERY channel, because an unqualified stop is read at its widest",
    ["email", "phone", "sms"].every((c) => row?.channels?.includes(c)),
    row?.channels,
  );
  ok("…with the retention date stored on the row", row?.retainUntil instanceof Date, row?.retainUntil);
  ok("…and an event behind it, so its provenance is showable", store.suppressionEvents.length === 1);

  // START must NOT lift it. lib/sales/suppression.js has no self-service
  // removal by design — a removal is superadmin-only with a reason on the
  // record, because the row is evidence behind a three-year obligation.
  const restart = await handleSalesInboundSms({ to: "+15145550111", from: "613-555-0142", body: "START" });
  ok("START is not treated as an opt-out keyword here", restart.action === "ignored", restart);
  ok("…and the suppression survives it", store.suppressions[0]?.removedAt == null, store.suppressions[0]?.removedAt);
}

{
  // And the STOP actually blocks the next send. This is the whole point: the
  // list is read at the moment of the send, not remembered from the screen.
  const rep = { id: "rep1", name: "Daniel", code: "DANIEL" };
  const lead = { id: "lead1", phone: "+16135550142", email: null, timeZone: "America/Toronto" };
  process.env.SALES_MAILING_ADDRESS = ADDRESS;

  const after = await salesSmsStatus({ rep, lead, origin: "https://fieldquo.com", now: MIDDAY });
  ok(
    "after a STOP, the very next readiness check refuses",
    after.canSend === false && after.blockers.some((b) => b.code === "suppressed"),
    after.blockers.map((b) => b.code),
  );

  const sent = await deliverSignupLinkSms({ rep, lead, origin: "https://fieldquo.com", now: MIDDAY });
  ok("…and the send itself refuses with 409", sent.ok === false && sent.status === 409, sent);
  ok("…naming it as an opt-out", sent.suppressed === true, sent);
  ok("…and nothing was filed as sent", store.smsMessages.length === 0, store.smsMessages.length);
}

// ════════════════════════════════════════════════════════════════════════════
section("8. A demo rep cannot use this to text a stranger either, and a send that fails files nothing");

{
  resetStore();
  store.numbers.push({ e164: "+15145550111", purpose: "sales", active: true, createdAt: new Date(0) });
  process.env.SALES_MAILING_ADDRESS = ADDRESS;

  const rep = { id: "rep1", name: "Daniel", code: "DANIEL" };
  const lead = { id: "lead1", phone: "+16135550142", email: null, timeZone: "America/Toronto" };

  const result = await deliverSignupLinkSms({ rep, lead, origin: "https://fieldquo.com", now: MIDDAY });
  ok(
    "a fully-ready send DOES attempt the carrier",
    result.ok === false && result.status === 502,
    result,
  );
  ok(
    "…and when the carrier refuses, NOTHING is filed as sent",
    store.smsMessages.length === 0,
    store.smsMessages.length,
  );
  ok(
    "…and the failure is recorded durably",
    store.errors.some((e) => e.code === "send_failed"),
    store.errors.map((e) => e.code),
  );

  // No sales number at all — the state this deployment is in today. The point
  // is that it refuses honestly rather than falling back to the system number,
  // which sends on behalf of contractors.
  resetStore();
  store.numbers.push({ e164: "+15145550100", purpose: "system", active: true, createdAt: new Date(0) });
  const noNumber = await deliverSignupLinkSms({ rep, lead, origin: "https://fieldquo.com", now: MIDDAY });
  ok(
    "with no sales number, the send refuses instead of borrowing the system number",
    noNumber.ok === false && noNumber.blockers.some((b) => b.code === "no_sales_number"),
    noNumber.blockers?.map((b) => b.code),
  );
  ok("…and the system number was not used", store.smsMessages.length === 0, store.smsMessages.length);

  const bad = await setLeadTimeZone({ repId: "rep1", leadId: "lead1", timeZone: "Europe/Kyiv" });
  ok("a time zone outside the closed list is refused", bad === false);
}

// ════════════════════════════════════════════════════════════════════════════
section("9. The send is ordered, gated, and scoped");

{
  const src = read("lib/sales/salesSms.js");
  const deliver = functionSource(src, "deliverSignupLinkSms");
  if (deliver === null) {
    ok(false, "lib/sales/salesSms.js exports deliverSignupLinkSms — renamed? this rule proves nothing now");
  } else {
    const readiness = deliver.indexOf("salesSmsStatus(");
    const vendor = deliver.indexOf("sendSms(");
    const file = deliver.indexOf("db.salesSmsMessage.create(");
    const success = deliver.indexOf("result?.success");

    ok("deliverSignupLinkSms re-asks salesSmsStatus in the request that sends", readiness !== -1);
    ok("…before it calls sendSms", readiness !== -1 && vendor !== -1 && readiness < vendor, { readiness, vendor });
    ok("…and writes the copy only after the send", vendor !== -1 && file !== -1 && vendor < file, { vendor, file });
    ok("…behind the provider's own answer", success !== -1 && file !== -1 && success < file, { success, file });
    ok(
      "…and passes no companyId — FieldQuo's own texts are not a tenant's",
      !/companyId/.test(deliver.slice(vendor, file === -1 ? undefined : file)),
    );
  }

  const status = functionSource(src, "salesSmsStatus");
  ok(
    "salesSmsStatus reads the do-not-contact list itself rather than trusting a caller's verdict",
    Boolean(status) && /suppressionFor\(/.test(status),
  );

  const suppressionFor = functionSource(src, "suppressionFor");
  ok("suppressionFor() was found", suppressionFor !== null);
  ok(
    "…and asks on the sms channel specifically",
    Boolean(suppressionFor) && /channel:\s*"sms"/.test(suppressionFor),
  );
  ok(
    "…and answers null when the list cannot be read, rather than 'not suppressed'",
    Boolean(suppressionFor) && /return null/.test(suppressionFor),
  );
}

{
  const route = read("app/api/sales/sms/route.js");
  const post = functionSource(route, "POST");
  const get = functionSource(route, "GET");
  ok("the sms route exports POST", post !== null);
  ok("the sms route exports GET", get !== null);
  ok(
    "POST goes through the third named gate, requireSmsRep",
    Boolean(post) && /requireSmsRep\(request\)/.test(post),
  );
  ok(
    "GET goes through the portal's normal read gate",
    Boolean(get) && /requireSalesRep\(request\)/.test(get),
  );

  // The blanket rule is untouched. gate.js must still refuse every non-GET,
  // or this route's exception has quietly become the rule.
  const gate = functionSource(read("lib/sales/gate.js"), "requireSalesRep");
  ok("lib/sales/gate.js still refuses non-GET methods", Boolean(gate) && /isReadOnly\(request\.method\)/.test(gate));

  // And the exception is narrow. The route may write two models and no others.
  ok(
    "REP_SMS_WRITES names exactly the two models this route writes",
    Array.isArray(REP_SMS_WRITES) &&
      REP_SMS_WRITES.length === 2 &&
      REP_SMS_WRITES.includes("salesSmsMessage") &&
      REP_SMS_WRITES.includes("salesLead"),
    REP_SMS_WRITES,
  );
  ok(
    "…and SalesSuppression is NOT one of them — a rep never writes the do-not-contact list",
    !REP_SMS_WRITES.includes("salesSuppression"),
  );

  const WRITE = /\bdb\.([a-zA-Z]+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g;
  const written = new Set();
  for (const src of [route, functionSource(read("lib/sales/salesSms.js"), "deliverSignupLinkSms") || "",
                     functionSource(read("lib/sales/salesSms.js"), "setLeadTimeZone") || ""]) {
    for (const m of src.matchAll(WRITE)) written.add(m[1]);
  }
  ok(
    "the rep-triggered send path writes only the models REP_SMS_WRITES names",
    [...written].every((m) => REP_SMS_WRITES.includes(m)),
    [...written],
  );
}

{
  // The unsubscribe promise has a listener behind it. A "Reply STOP" line with
  // nothing handling STOP is the bug this repo's own SMS webhook was written to
  // close, and shipping a second one would be worse than the first.
  const body = signupLinkSmsBody({
    repName: "Daniel",
    signupLink: "https://fieldquo.com/signup?sales=DANIEL",
    mailingAddress: ADDRESS,
  });
  ok("the message promises STOP", /STOP/.test(body), body);

  const webhook = functionSource(read("app/api/sms/inbound/route.js"), "POST");
  ok("app/api/sms/inbound exports POST", webhook !== null);
  ok(
    "…and routes a text with no tenant behind it to the sales opt-out handler",
    Boolean(webhook) && /handleSalesInboundSms\(/.test(webhook),
  );
  ok(
    "…still verifying the Twilio signature first",
    Boolean(webhook) &&
      webhook.indexOf("verifyTwilioWebhook(") !== -1 &&
      webhook.indexOf("verifyTwilioWebhook(") < webhook.indexOf("handleSalesInboundSms("),
  );

  // And a sales number is bought pointing AT that webhook. A number wired to
  // the crew endpoint would drop every STOP with a silent 200.
  const buy = functionSource(read("lib/crew/platformNumber.js"), "buyPlatformNumber");
  ok("buyPlatformNumber() was found", buy !== null);
  ok("…and accepts the sales purpose", Boolean(buy) && /PLATFORM_NUMBER_PURPOSES/.test(buy));
  const webhookFor = functionSource(read("lib/crew/platformNumber.js"), "webhookUrlFor");
  ok("webhookUrlFor() was found", webhookFor !== null);
  ok(
    "…and points a sales number at /api/sms/inbound rather than the crew endpoint",
    Boolean(webhookFor) && /api\/sms\/inbound/.test(webhookFor) && /purpose === "sales"/.test(webhookFor),
  );
}

// ════════════════════════════════════════════════════════════════════════════
section("10. The screen never renders a control the server would refuse");

{
  const panel = read("app/sales/leads/SignupLinkSms.js");
  ok("the panel asks the server whether it may send", /\/api\/sales\/sms\?leadId=/.test(panel));
  ok("…and renders the form only when the server says so", /sms\.canSend/.test(panel));
  ok("…names every blocker on screen", /blockers\.map\(/.test(panel));
  ok("…including the fix", /b\.fix/.test(panel));
  ok("…and re-asks after a refusal, because an opt-out can land mid-compose", /await load\(\)/.test(panel));

  const page = read("app/sales/leads/[id]/page.js");
  ok("the lead page renders the panel", /<SignupLinkSms/.test(page));
  ok("…and the route it calls has a caller", /\/api\/sales\/sms/.test(panel));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
