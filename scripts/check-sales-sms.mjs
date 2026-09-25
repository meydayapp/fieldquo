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
import { readPrismaSchema } from "./prismaSchema.mjs";

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
  // The ladder's other reads (lib/sales/smsAttribution.js): the calls placed
  // FROM a line, the prospects on a number, the audit rows an attribution
  // writes. Empty by default so every earlier section sees the fake it was
  // written against.
  callAttempts: [],
  prospects: [],
  auditRows: [],
  reps: new Map(),
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
  store.callAttempts.length = 0;
  store.prospects.length = 0;
  store.auditRows.length = 0;
  store.reps.clear();
}

/** A Prisma-ish `where` for the few shapes the ladder's reads use. */
function whereHit(row, where) {
  if (!where) return true;
  for (const [k, v] of Object.entries(where)) {
    const actual = row[k];
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if ("in" in v && !v.in.includes(actual)) return false;
      if ("not" in v && (v.not === null ? actual == null : actual === v.not)) return false;
      if ("contains" in v && !String(actual || "").includes(v.contains)) return false;
      if ("gte" in v && !(new Date(actual) >= new Date(v.gte))) return false;
      if ("lte" in v && !(new Date(actual) <= new Date(v.lte))) return false;
      continue;
    }
    if (actual !== v) return false;
  }
  return true;
}
const newestFirst = (rows, field) => [...rows].sort((a, b) => new Date(b[field]) - new Date(a[field]));

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
    findMany: async ({ where }) => store.numbers.filter((n) => whereHit(n, where)),
  },

  // The ladder's reads. Each answers the one query shape the module makes.
  salesCallAttempt: {
    findMany: async ({ where, take }) =>
      newestFirst(store.callAttempts.filter((c) => whereHit(c, where)), "dialledAt")
        .slice(0, take || 999)
        .map((c) => ({ ...c, prospect: store.prospects.find((p) => p.id === c.prospectId) || null, lead: store.leads.get(c.leadId) || null })),
  },
  prospect: {
    findMany: async ({ where, take }) => store.prospects.filter((p) => whereHit(p, where)).slice(0, take || 999),
    findUnique: async ({ where }) => store.prospects.find((p) => p.id === where.id) || null,
  },
  salesRep: {
    findUnique: async ({ where }) => store.reps.get(where.id) || null,
    findMany: async ({ where }) => [...store.reps.values()].filter((r) => whereHit(r, where)),
  },
  platformAuditLog: {
    create: async ({ data }) => { const row = { id: id(), createdAt: new Date(), ...data }; store.auditRows.push(row); return row; },
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
    findMany: async ({ where, take }) =>
      newestFirst(store.smsMessages.filter((m) => whereHit(m, where)), "sentAt")
        .slice(0, take || 999)
        .map((m) => ({ ...m, lead: store.leads.get(m.leadId) || null, prospect: store.prospects.find((p) => p.id === m.prospectId) || null })),
    // The inbound path looks for the last message SENT to this number, so it
    // can file a reply against the rep who asked the question.
    findFirst: async ({ where }) =>
      store.smsMessages
        .filter(
          (m) =>
            (where.toE164 === undefined || m.toE164 === where.toE164) &&
            (where.direction === undefined || m.direction === where.direction),
        )
        .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0] || null,
    findUnique: async ({ where }) => store.smsMessages.find((m) => m.id === where.id) || null,
    update: async ({ where, data }) => { const m = store.smsMessages.find((r) => r.id === where.id); if (!m) throw new Error("no row"); Object.assign(m, data); return m; },
  },

  salesLead: {
    // Added when handleSalesInboundSms started STORING replies rather than
    // dropping every one that was not a STOP. It matches an incoming number to
    // a lead — through lib/sales/messages/business.js leadsOnNumber, which
    // narrows on the last four digits and compares normalised — so the stub
    // answers a `contains` on the phone.
    findMany: async ({ where }) =>
      [...store.leads.values()]
        .filter((l) => (where?.phone?.contains ? String(l.phone || "").includes(where.phone.contains) : true))
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)),
    findFirst: async ({ where }) =>
      [...store.leads.values()]
        .filter((l) => (where?.id ? l.id === where.id : true))
        .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null,
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
const {
  salesSmsReadiness,
  signupLinkSmsBody,
  signupGreeting,
  replySmsBody,
  SIGNUP_LINK_CLOSING_REPLY,
  SIGNUP_LINK_CLOSING_REPLY_OR_CALL,
  isNorthAmerican,
  smsSegments,
} = await import("@/lib/sales/salesSmsRules");
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
    // The moved / cancelled text to a client (2026-09-25) — every office and
    // manage-link move or cancel sends through this one function.
    ["lib/schedule/changeText.js", "textClientOfChange"],
    // Three senders that arrived after this ledger was written, each read and
    // each passing its tenant: the booking confirmation text (3bbe6781), the
    // change-order text to a client, and the Conversations reply on the
    // shared text line (40737a41).
    ["lib/booking/finalizeBooking.js", "textConfirmation"],
    ["lib/jobs/changeOrderSend.js", "sendChangeOrderToClient"],
    ["lib/messaging/ownSend.js", "sendSmsChatMessage"],
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
        // `companyId: x` or the shorthand `companyId,` — both pass the key.
        // A top-level property only: preceded by the object's "{" or a comma.
        /[{,]\s*companyId\s*[:,}]/.test(args),
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
  // The signup-link text: solicited, no address in it. Every other text is
  // purpose "reply" (the default) and keeps the address rule — asserted below.
  purpose: "signup_link",
  greetTo: "Dave",
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
  ok("…and the message names the sender", good.body.includes("this is Daniel"), good.body);
  ok("…carries the signup link", good.body.includes(READY.signupLink), good.body);
  // ── 2026-09-14: the owner's wording, no address, no STOP line ──────────
  // A one-to-one text a rep sends by hand at the prospect's request during
  // the call — solicited, so CASL GIC reg. s.3(b) exempts it from s.6.
  // salesSmsRules.js's header carries the reasoning; this pins the body.
  ok(
    "the signup text is exactly the owner's sentence",
    good.body === `Hi Dave, this is Daniel — here is the link to sign up that we talked about: ${READY.signupLink} ${SIGNUP_LINK_CLOSING_REPLY}`,
    good.body,
  );
  ok("…with NO mailing address in it", !good.body.includes(ADDRESS), good.body);
  ok("…and NO STOP line", !/STOP/.test(good.body), good.body);
  ok("…normalised to E.164", good.to === "+16135550142", good.to);
  ok("…and stays inside a couple of segments", smsSegments(good.body) <= 3, smsSegments(good.body));

  // The greeting: first name, else the business, else nobody.
  ok("greeting: the contact's first name", signupGreeting({ contactName: "Dave Hensley", businessName: "South County Electric" }) === "Dave");
  ok("…a one-word name stays whole", signupGreeting({ contactName: "  Priya " }) === "Priya");
  ok("…no contact → the business name", signupGreeting({ contactName: "", businessName: "Ring A Ling Upholstery" }) === "Ring A Ling Upholstery");
  ok("…neither → nobody, and the body opens \"Hi,\"", signupGreeting({}) === "" && signupLinkSmsBody({ repName: "Daniel", signupLink: "L", greetTo: signupGreeting({}) }).startsWith("Hi, this is Daniel —"));
  ok("…and a business greeting reads \"Hi Ring A Ling Upholstery,\"", signupLinkSmsBody({ repName: "Daniel", signupLink: "L", greetTo: "Ring A Ling Upholstery" }).startsWith("Hi Ring A Ling Upholstery, this is Daniel —"));

  // The closing sentence is chosen at send time by whether a call back
  // reaches a person (FIELDQUO_SALES_TRANSFER_TO). Both branches.
  ok("closing, callback unreachable: reply only", signupLinkSmsBody({ repName: "D", signupLink: "L" }).endsWith(` L ${SIGNUP_LINK_CLOSING_REPLY}`));
  ok("closing, callback reachable: reply or call", signupLinkSmsBody({ repName: "D", signupLink: "L", callbackReachable: true }).endsWith(` L ${SIGNUP_LINK_CLOSING_REPLY_OR_CALL}`));
  ok("…and only a literal true picks the call sentence", !signupLinkSmsBody({ repName: "D", signupLink: "L", callbackReachable: "yes" }).includes("call this number"));
  ok("the two sentences say what they say", SIGNUP_LINK_CLOSING_REPLY === "You can reply to this text if you have any questions." && SIGNUP_LINK_CLOSING_REPLY_OR_CALL === "You can reply to this text or call this number if you have any questions.");
  {
    const { salesCallbackReachable } = await import("@/lib/sales/salesSms");
    ok("salesCallbackReachable: unset → false", salesCallbackReachable({}) === false);
    ok("…a +E.164 → true", salesCallbackReachable({ FIELDQUO_SALES_TRANSFER_TO: "+16135550199" }) === true);
    ok("…a formatted NANP number normalises → true", salesCallbackReachable({ FIELDQUO_SALES_TRANSFER_TO: "(613) 555-0199" }) === true);
    ok("…anything that would not dial → false", salesCallbackReachable({ FIELDQUO_SALES_TRANSFER_TO: "sales@fieldquo.com" }) === false && salesCallbackReachable({ FIELDQUO_SALES_TRANSFER_TO: "+44 20 7946 0000" }) === false);
    const status = functionSource(read("lib/sales/salesSms.js"), "salesSmsStatus");
    ok("salesSmsStatus passes the reachability, the greeting and the purpose through", Boolean(status) && /callbackReachable: salesCallbackReachable\(\)/.test(status) && /greetTo: signupGreeting\(/.test(status) && /purpose,/.test(status));
    const deliver = functionSource(read("lib/sales/salesSms.js"), "deliverSignupLinkSms");
    ok("deliverSignupLinkSms asks readiness as the signup link", Boolean(deliver) && /purpose: "signup_link"/.test(deliver));
    const reply = functionSource(read("lib/sales/salesSms.js"), "deliverReplySms");
    ok("…and deliverReplySms does NOT — a reply keeps the address rule", Boolean(reply) && !/signup_link/.test(reply));
    const route = read("app/api/sales/sms/route.js");
    ok("the sms route's GET previews as the signup link and selects contactName for the greeting", /purpose: "signup_link"/.test(route) && /contactName: true/.test(route));
    ok("the messages and check-in readiness reads stay purpose reply", !/signup_link/.test(read("app/api/sales/messages/route.js")) && !/signup_link/.test(read("app/api/sales/checkins/route.js")));
  }

  // ── "Text a different number" (2026-09-14) ─────────────────────────────
  // The owner is often on a mobile that is not the business line. The panel
  // saves the typed number on the lead through the dialler's own numbers
  // route — no new column, a SalesContactNumber labelled "mobile (owner)" —
  // and then texts THAT row by id, so every check runs against it.
  {
    const panel = read("app/sales/leads/SignupLinkSms.js");
    ok("the panel offers \"Text a different number\"", /app\.salesLeads\.smsOtherNumber"/.test(panel) && /data-sms-other-number-form/.test(panel));
    ok("…saved through POST /api/sales/calls/numbers by leadId, as a mobile labelled \"mobile (owner)\", textable", /fetchJson\("\/api\/sales\/calls\/numbers", \{\s*method: "POST"[\s\S]{0,200}?leadId, e164: raw, kind: "mobile", label: "mobile \(owner\)", canText: true/.test(panel));
    ok("…and the saved row becomes the chosen contactNumberId, which re-reads the preview", /setNumberId\(saved\.id\)/.test(panel) && /contactNumberId=\$\{encodeURIComponent\(numberId\)\}/.test(panel));
    const numbersRoute = read("app/api/sales/calls/numbers/route.js");
    ok("the numbers route resolves a leadId to the rep's OWN lead", /if \(leadId\) \{[\s\S]{0,300}?where: \{ id: leadId, salesRepId: repId \}/.test(numbersRoute));
    // The write itself is lib/sales/contact/record.js since 2026-09-18 (the
    // text-thread opener records through the same function); the rule is
    // read where it lives.
    const recordLib = read("lib/sales/contact/record.js");
    ok("…normalises through the suppression list's own function and refuses a do-not-contact record", /await recordContactNumber\(\{/.test(numbersRoute) && /const e164 = normalisePhone\(raw\)/.test(recordLib) && /if \(owner\?\.doNotContactAt\)/.test(recordLib));
    const smsRoute = read("app/api/sales/sms/route.js");
    ok("the SMS route judges the CHOSEN number — readiness and the send both see it as the lead's phone", (smsRoute.match(/lead: chosen\.ok \? \{ \.\.\.lead, phone: chosen\.e164 \} : lead/g) || []).length >= 1 && /lead: \{ \.\.\.lead, phone: chosen\.e164 \}/.test(smsRoute));
    ok("…and the chosen row is re-read by id against this lead, never trusted from the body", /contactNumberId,\s*channel: CHANNEL_TEXT/.test(smsRoute) && /typeof body\.contactNumberId === "string" \? body\.contactNumberId\.trim\(\) : ""/.test(smsRoute));
    // The readiness itself, executed: the chosen number is what is judged.
    const other = readiness({ ...READY, leadPhone: "+16135550199" });
    ok("readiness on a different number normalises and addresses THAT number", other.to === "+16135550199", other.to);
    const overseas = readiness({ ...READY, leadPhone: "+44 20 7946 0000" });
    ok("…and a non-NANP mobile is refused the same as a non-NANP business line", overseas.canSend === false, codes(overseas));
    const stopped = readiness({ ...READY, leadPhone: "+16135550199", suppression: { suppressed: true, reason: "opted out by text" } });
    ok("…and a suppression on the mobile blocks it", codes(stopped).includes("suppressed"), codes(stopped));
  }

  // The unsolicited texts keep both. A check-in, a follow-up, a recovery
  // text all go through replySmsBody, and none of them was asked for.
  const unsolicited = replySmsBody({ text: "Hi Dave, did the setup go through?", mailingAddress: ADDRESS });
  ok("an unsolicited text still carries FieldQuo's mailing address", unsolicited.includes(ADDRESS), unsolicited);
  ok("…and still offers STOP", /Reply STOP to opt out\./.test(unsolicited), unsolicited);
  ok("…and refuses to compose without the address", (() => { try { replySmsBody({ text: "x", mailingAddress: " " }); return false; } catch { return true; } })());

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
  // The address blocker: still there for every text that carries an address
  // (purpose "reply", the default), gone for the signup link, which does not.
  const r = readiness({ ...READY, purpose: "reply", mailingAddress: "" });
  ok("a missing mailing address blocks an unsolicited text", codes(r).includes("mailing_address_unset"), codes(r));
  ok(
    "…and it is CASL that is cited",
    /CASL/.test(r.blockers.find((b) => b.code === "mailing_address_unset")?.fix || ""),
  );
  const dflt = readiness({ ...READY, purpose: undefined, mailingAddress: "" });
  ok("…and the DEFAULT purpose is the blocked side", codes(dflt).includes("mailing_address_unset"), codes(dflt));
  const signup = readiness({ ...READY, mailingAddress: "" });
  ok("the signup link goes without an address — it carries none", signup.canSend === true && !codes(signup).includes("mailing_address_unset"), codes(signup));
  ok("…and the signup body builder needs only a sender and a link", signupLinkSmsBody({ repName: "Daniel", signupLink: "https://x/y" }).includes("https://x/y"));
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
    purpose: "reply",
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
  ok("“please stop by at 3” is not an opt-out", chatter.action === "stored", chatter);
  ok("…and suppresses nothing", store.suppressions.length === 0, store.suppressions.length);
  // The bug this replaced: an ordinary reply used to be scanned for STOP and
  // then dropped on the floor. A contractor answering "sure, call me Thursday"
  // reached nobody, and the rep who texted them never learned there was an
  // answer.
  ok("…and the reply IS kept", store.smsMessages.some((m) => m.direction === "in" && /stop by at 3/.test(m.body)), store.smsMessages.length);

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
  // "stored" rather than "ignored": every inbound message is now kept, and the
  // action names what was done ABOUT it. START is still not an opt-out and
  // still lifts nothing — which is the assertion below, and the one that
  // matters.
  ok("START is not treated as an opt-out keyword here", restart.action === "stored", restart);
  ok("…and the suppression survives it", store.suppressions[0]?.removedAt == null, store.suppressions[0]?.removedAt);
}

{
  // And the STOP actually blocks the next send. This is the whole point: the
  // list is read at the moment of the send, not remembered from the screen.
  // referralToken: the opaque half of the link (lib/sales/repLink.js); the
  // link is built from it, never from `code`.
  const rep = { id: "rep1", name: "Daniel", code: "DANIEL", referralToken: "DANIEL" };
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
  // Scoped to OUTBOUND. The store now also holds the inbound replies that
  // reached this number — the STOP itself among them — and counting every row
  // would fail on messages the prospect sent us, which is the opposite of what
  // this asserts.
  ok(
    "…and nothing was filed as sent",
    store.smsMessages.filter((m) => m.direction === "out").length === 0,
    store.smsMessages.map((m) => m.direction),
  );
}

// ════════════════════════════════════════════════════════════════════════════
section("8. A demo rep cannot use this to text a stranger either, and a send that fails files nothing");

{
  resetStore();
  store.numbers.push({ e164: "+15145550111", purpose: "sales", active: true, createdAt: new Date(0) });
  process.env.SALES_MAILING_ADDRESS = ADDRESS;

  // referralToken: the opaque half of the link (lib/sales/repLink.js); the
  // link is built from it, never from `code`.
  const rep = { id: "rep1", name: "Daniel", code: "DANIEL", referralToken: "DANIEL" };
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
  // Since 2026-09-14 the signup text itself carries no STOP line (solicited
  // — see salesSmsRules.js); the unsolicited texts do, and the listener
  // behind the word is what this block is really about.
  const body = replySmsBody({ text: "Did the setup go through?", mailingAddress: ADDRESS });
  ok("an unsolicited text promises STOP", /STOP/.test(body), body);

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

section("11. The texting window's clock is the call window's clock");
//
// Amish Valley Sheds LLC, NY, straight from discovery: the call region said
// "judged in the time zone their address implies (America/New_York)" and the
// texting panel, three cards down, said "we don't know what time it is where
// this prospect is" — and never sent the link. One rule now, in
// lib/sales/leadTimeZone.js: stated beats derived, a single-zone subdivision
// derives, a split one asks with its candidates, and the area code is still
// never consulted.
{
  const { resolveLeadTimeZone } = await import("../lib/sales/leadTimeZone.js");
  const ny = resolveLeadTimeZone({ timeZone: null, country: "US", province: "NY" });
  ok("a New York lead with no stated zone derives America/New_York", ny.timeZone === "America/New_York" && ny.source === "derived");
  const viaProspect = resolveLeadTimeZone({ timeZone: null, prospect: { country: "US", province: "NY" } });
  ok("…and so does a lead whose province lives only on its linked prospect", viaProspect.timeZone === "America/New_York");
  const fl = resolveLeadTimeZone({ timeZone: null, country: "US", province: "FL" });
  ok("a split state derives nothing and names its candidates", fl.timeZone === null && fl.source === "ambiguous" && fl.candidates.length === 2);
  ok("a stated zone beats the split", resolveLeadTimeZone({ timeZone: "America/Chicago", country: "US", province: "FL" }).source === "stated");
  ok("a stated zone Intl cannot read falls through to the province", resolveLeadTimeZone({ timeZone: "Mars/Olympus", country: "US", province: "NY" }).timeZone === "America/New_York");
  ok("no province anywhere is unknown, not guessed", resolveLeadTimeZone({ timeZone: null, phone: "+17162551194" }).timeZone === null);
  ok("Quebec derives Toronto's clock", resolveLeadTimeZone({ country: "CA", province: "QC" }).timeZone === "America/Toronto");

  const r = salesSmsReadiness({ repName: "D", signupLink: "https://x/signup?sales=d", fromNumber: "+17166383616", mailingAddress: "a", twilioConfigured: true, leadPhone: "+17162551194", leadTimeZone: ny.timeZone, leadTimeZoneSource: ny.source, leadTimeZoneCandidates: ny.candidates, suppression: { suppressed: false }, now: new Date("2026-09-11T23:14:00Z") });
  ok("…so Amish Valley Sheds at 7:14 pm Eastern can be texted", r.canSend === true && r.timeZone === "America/New_York" && r.timeZoneSource === "derived");
  const rf = salesSmsReadiness({ repName: "D", signupLink: "x", fromNumber: "+17166383616", mailingAddress: "a", leadPhone: "+13055550100", leadTimeZone: fl.timeZone, leadTimeZoneSource: fl.source, leadTimeZoneCandidates: fl.candidates, suppression: { suppressed: false } });
  ok("a split state still asks, and lists the two clocks", rf.canSend === false && rf.blockers[0].code === "time_zone_unknown" && /America\/New_York or America\/Chicago/.test(rf.blockers[0].fix));

  const status = read("lib/sales/salesSms.js");
  ok("salesSmsStatus resolves the zone through the shared rule", /const zone = resolveLeadTimeZone\(lead\)/.test(status) && /leadTimeZone: zone\.timeZone/.test(status));
  const route = read("app/api/sales/sms/route.js");
  ok("…and the route loads the province it needs, from the lead and its prospect", /country: true,\s*province: true,/.test(route) && /prospect: \{ select: \{[^}]*province: true/.test(route));
  const store = read("lib/sales/checkin/store.js");
  ok("the messages thread judges its window by the same rule", /timeZone: lead \? resolveLeadTimeZone\(lead\)\.timeZone : null/.test(store));
  const panel = read("app/sales/leads/SignupLinkSms.js");
  ok("the panel prefills the derived zone and says where it came from", /next\.sms\?\.timeZone/.test(panel) && /smsZoneDerived/.test(panel));
  ok("…and writes a zone to the lead only when the rep chose a different one", /zone !== \(data\?\.sms\?\.timeZone \|\| ""\)/.test(panel));
  ok("the area code is still never consulted", !/areaCode|nanp/i.test(read("lib/sales/leadTimeZone.js")));
}

// ════════════════════════════════════════════════════════════════════════════
section("12. Whose text is it — the attribution ladder, on hostile rows");
// ════════════════════════════════════════════════════════════════════════════
//
// lib/sales/smsAttribution.js. The Advance Appliance text of 2026-09-18 —
// from a number on no record, on a line one rep had used two minutes
// earlier to ring the business the body names — was filed to nobody, and
// "nobody" was rendered as everybody. Each rung is executed here on the row
// shapes that break a naive version: two reps on one line, a body with no
// business name, an area-code match that is too old, a stale line use.

{
  const {
    attributeInboundSms, bodyNamesBusiness, nameTokens, resolveInboundSmsAttribution, attributeSmsMessage,
    smsVisibleRepIds, unownedInboundTexts, LINE_USE_WINDOW_MS, AREA_CODE_WINDOW_MS, SMS_MATCHED_BY,
  } = await import("@/lib/sales/smsAttribution");
  const { salesConversations } = await import("@/lib/sales/salesSms");

  // ── The name matcher ───────────────────────────────────────────────────
  ok("tokens drop punctuation, case and corporate noise", nameTokens("Advance Appliance, Inc.").join() === "advance,appliance", nameTokens("Advance Appliance, Inc."));
  ok("“Charlotte at Advance Appliance and I received your Voicemail” names Advance Appliance", bodyNamesBusiness("Hi, this is Charlotte at Advance Appliance and I received your Voicemail.", ["Advance Appliance"]) === true);
  ok("…and the body with only half the name does not", bodyNamesBusiness("we sell every appliance", ["Advance Appliance"]) === false);
  ok("“the best time to call is 3” does not name Best Plumbing", bodyNamesBusiness("the best time to call is 3", ["Best Plumbing"]) === false);
  ok("a one-word name needs four letters — “abc” in a body is not ABC Ltd", bodyNamesBusiness("abc, call me", ["ABC Ltd"]) === false && bodyNamesBusiness("this is Rooftopia", ["Rooftopia Inc"]) === true);
  ok("a long name matches on most of its words", bodyNamesBusiness("Hi from Smith Brothers Roofing", ["Smith Brothers Roofing and Siding"]) === true);
  ok("noise alone never matches", bodyNamesBusiness("the and of inc", ["The Company Inc"]) === false);
  ok("accents fold: “Toitures Réal” is named by “toitures real”", bodyNamesBusiness("c'est toitures real ici", ["Toitures Réal"]) === true);

  // ── Rung (a): the number itself, in order of strength ─────────────────
  const T = new Date("2026-09-18T12:27:20Z");
  const min = (n) => new Date(T.getTime() - n * 60_000);
  const nobody = attributeInboundSms({ fromE164: "+19149357510", body: "hi", now: T });
  ok("nothing known → nobody, matchedBy null, no id invented", nobody.salesRepId === null && nobody.leadId === null && nobody.prospectId === null && nobody.matchedBy === null, nobody);
  const lastText = attributeInboundSms({ fromE164: "+19149357510", body: "hi", now: T, lastOut: { salesRepId: "daniel", leadId: "L1" }, leads: [{ id: "L2", salesRepId: "rachel" }], lineUses: [{ salesRepId: "favor", at: min(2), toE164: "+18884209806" }], lineOwnerRepId: "rachel" });
  ok("the last text we sent the number beats every other rung", lastText.salesRepId === "daniel" && lastText.leadId === "L1" && lastText.matchedBy === "last_text", lastText);
  const leadPhone = attributeInboundSms({ fromE164: "+19149357510", body: "hi", now: T, leads: [{ id: "L2", salesRepId: "rachel", prospectId: "P2" }], lineUses: [{ salesRepId: "favor", at: min(2), toE164: "+18884209806" }] });
  ok("a lead carrying the number beats the line", leadPhone.salesRepId === "rachel" && leadPhone.leadId === "L2" && leadPhone.prospectId === "P2" && leadPhone.matchedBy === "lead_phone", leadPhone);
  const converted = attributeInboundSms({ fromE164: "+1", body: "", now: T, leads: [{ id: "cold", salesRepId: "a" }, { id: "won", salesRepId: "b", convertedCompanyId: "co" }] });
  ok("…a converted lead on the number wins over a cold one", converted.leadId === "won" && converted.salesRepId === "b", converted);
  const prospectPhone = attributeInboundSms({ fromE164: "+18884209806", body: "hi", now: T, prospects: [{ id: "P1", assignedRepId: "favor", businessName: "Advance Appliance" }] });
  ok("a claimed prospect carrying the number is rung (a) too", prospectPhone.salesRepId === "favor" && prospectPhone.prospectId === "P1" && prospectPhone.matchedBy === "prospect_phone", prospectPhone);
  const twoProspects = attributeInboundSms({ fromE164: "+18884209806", body: "hi", now: T, prospects: [{ id: "P1", assignedRepId: "favor" }, { id: "P1dup", assignedRepId: "favor" }], lineOwnerRepId: "rachel" });
  ok("two prospects on one number (flagged duplicates) are not picked between — the ladder falls through", twoProspects.matchedBy === "line_owner" && twoProspects.prospectId === null, twoProspects);
  const contact = attributeInboundSms({ fromE164: "+1", body: "", now: T, contactLead: { id: "L5", salesRepId: "umar", prospectId: "P5" } });
  ok("a stored contact number files to its lead", contact.salesRepId === "umar" && contact.leadId === "L5" && contact.matchedBy === "contact_number", contact);

  // ── Rung (b): the line — THE Advance Appliance case ───────────────────
  const favorUses = [
    // Favor's dials from +1 438 609 9615 that morning, newest first as the
    // read returns them; the Advance Appliance call is not the newest.
    { salesRepId: "favor", at: min(0.15), toE164: "+15165995555", prospectId: "P-other", prospect: { id: "P-other", businessName: "Long Island Plumbing" } },
    { salesRepId: "favor", at: min(2), toE164: "+18884209806", prospectId: "P-adv", prospect: { id: "P-adv", businessName: "Advance Appliance", tradingNames: [] } },
    { salesRepId: "favor", at: min(9), toE164: "+15164336302", prospectId: "P-3", prospect: { id: "P-3", businessName: "Nassau Roofing" } },
  ];
  const adv = attributeInboundSms({ fromE164: "+19149357510", body: "Hi, this is Charlotte at Advance Appliance and I received your Voicemail.", now: T, lineUses: favorUses, lineOwnerRepId: "rachel" });
  ok("ADVANCE APPLIANCE: filed to the rep who used the line, and to the business the body names — not the newest call", adv.salesRepId === "favor" && adv.prospectId === "P-adv" && adv.matchedBy === "line_business_name", adv);
  ok("…and not to the line's owner, who never rang them", adv.salesRepId !== "rachel");
  const noName = attributeInboundSms({ fromE164: "+19149357510", body: "Got your voicemail, call back tomorrow", now: T, lineUses: favorUses, lineOwnerRepId: "rachel" });
  ok("no business name and no area-code match → the rep alone, business left null rather than guessed", noName.salesRepId === "favor" && noName.prospectId === null && noName.leadId === null && noName.matchedBy === "line_recent_rep", noName);
  const areaCode = attributeInboundSms({ fromE164: "+15165550000", body: "call back tomorrow", now: T, lineUses: favorUses });
  ok("no name, but the sender's area code matches a call under two hours old → that business", areaCode.salesRepId === "favor" && areaCode.prospectId === "P-other" && areaCode.matchedBy === "line_area_code", areaCode);
  const staleArea = attributeInboundSms({ fromE164: "+15165550000", body: "call back", now: T, lineUses: [{ salesRepId: "favor", at: new Date(T.getTime() - AREA_CODE_WINDOW_MS - 60_000), toE164: "+15165995555", prospectId: "P-other", prospect: { id: "P-other", businessName: "Long Island Plumbing" } }] });
  ok("…an area-code match older than two hours names the rep only", staleArea.salesRepId === "favor" && staleArea.prospectId === null && staleArea.matchedBy === "line_recent_rep", staleArea);
  const namedBeatsArea = attributeInboundSms({ fromE164: "+15165550000", body: "Nassau Roofing here", now: T, lineUses: favorUses });
  ok("a named business beats an area-code match", namedBeatsArea.prospectId === "P-3" && namedBeatsArea.matchedBy === "line_business_name", namedBeatsArea);
  const twoReps = attributeInboundSms({
    fromE164: "+19149357510", body: "this is Advance Appliance",
    now: T,
    lineUses: [
      { salesRepId: "daniel", at: min(1), toE164: "+12125550000", prospectId: "P-d", prospect: { id: "P-d", businessName: "Manhattan Tile" } },
      { salesRepId: "favor", at: min(2), toE164: "+18884209806", prospectId: "P-adv", prospect: { id: "P-adv", businessName: "Advance Appliance" } },
    ],
  });
  ok("TWO REPS ON ONE LINE: the most recent user is the rep, and the other rep's business is never attached to them", twoReps.salesRepId === "daniel" && twoReps.prospectId === null && twoReps.matchedBy === "line_recent_rep", twoReps);
  const stale = attributeInboundSms({ fromE164: "+19149357510", body: "Advance Appliance", now: T, lineUses: [{ salesRepId: "favor", at: new Date(T.getTime() - LINE_USE_WINDOW_MS - 1000), toE164: "+18884209806", prospectId: "P-adv", prospect: { id: "P-adv", businessName: "Advance Appliance" } }], lineOwnerRepId: "rachel" });
  ok("a line use older than 24 h does not count, even when the body names the business — the owner rung answers", stale.salesRepId === "rachel" && stale.matchedBy === "line_owner", stale);
  const future = attributeInboundSms({ fromE164: "+1", body: "x", now: T, lineUses: [{ salesRepId: "favor", at: new Date(T.getTime() + 60_000), toE164: "+1" }] });
  ok("a use AFTER the text (a replay with the wrong clock) does not count", future.salesRepId === null, future);
  const textUse = attributeInboundSms({ fromE164: "+1", body: "yes please", now: T, lineUses: [{ salesRepId: "ali", at: min(30), toE164: "+15145550100", leadId: "L7", lead: { id: "L7", businessName: "Loop Inc", prospectId: "P7" } }] });
  ok("an outbound TEXT from the line counts as a use, same as a call", textUse.salesRepId === "ali" && textUse.matchedBy === "line_recent_rep", textUse);
  const textNamed = attributeInboundSms({ fromE164: "+1", body: "Loop Inc here, yes please", now: T, lineUses: [{ salesRepId: "ali", at: min(30), toE164: "+15145550100", leadId: "L7", lead: { id: "L7", businessName: "Loop Inc", prospectId: "P7" } }] });
  ok("…and names its lead, carrying the lead's prospect", textNamed.leadId === "L7" && textNamed.prospectId === "P7" && textNamed.matchedBy === "line_business_name", textNamed);

  // ── Rung (c) and (d) ──────────────────────────────────────────────────
  const owner = attributeInboundSms({ fromE164: "+1", body: "x", now: T, lineOwnerRepId: "rachel" });
  ok("a line nobody used today files to its assigned rep", owner.salesRepId === "rachel" && owner.matchedBy === "line_owner" && owner.prospectId === null, owner);
  ok("every matchedBy the ladder can return is in the published list", [lastText, leadPhone, prospectPhone, contact, adv, noName, areaCode, owner].every((r) => SMS_MATCHED_BY.includes(r.matchedBy)));

  // ── The reads, then the webhook end to end ────────────────────────────
  resetStore();
  const LINE = "+14386099615";
  store.numbers.push({ e164: LINE, purpose: "sales", active: true, voiceUrl: "https://x/api/rep-dial/inbound", assignedRepId: "rachel", createdAt: new Date(0) });
  store.prospects.push({ id: "P-adv", businessName: "Advance Appliance", phoneE164: "+18884209806", assignedRepId: "favor", mergedIntoId: null, tradingNames: [] });
  store.callAttempts.push(
    { id: "c1", direction: "out", salesRepId: "favor", fromE164: LINE, toE164: "+18884209806", prospectId: "P-adv", leadId: null, dialledAt: min(2) },
    { id: "c2", direction: "out", salesRepId: "favor", fromE164: LINE, toE164: "+15165995555", prospectId: null, leadId: null, dialledAt: min(0.15) },
  );
  const resolved = await resolveInboundSmsAttribution({ fromE164: "+19149357510", toE164: LINE, body: "Hi, this is Charlotte at Advance Appliance and I received your Voicemail.", now: T });
  ok("resolveInboundSmsAttribution reads the calls from the line and the prospect on them", resolved.salesRepId === "favor" && resolved.prospectId === "P-adv" && resolved.matchedBy === "line_business_name", resolved);
  // The webhook takes no `now` — it files against the wall clock, as it must
  // in production. So the same two dials are re-dated against the real clock
  // before it runs. Dated against T they fell outside the 24-hour line window
  // one day after this check was written (2026-09-18), and every webhook
  // assertion below quietly became a test of the line_owner rung instead.
  const W = Date.now();
  store.callAttempts.find((c) => c.id === "c1").dialledAt = new Date(W - 2 * 60_000);
  store.callAttempts.find((c) => c.id === "c2").dialledAt = new Date(W - 0.15 * 60_000);
  const stored = await handleSalesInboundSms({ to: LINE, from: "+1 (914) 935-7510", body: "Hi, this is Charlotte at Advance Appliance and I received your Voicemail." });
  const row = store.smsMessages.find((m) => m.id === stored.messageId);
  ok("…and the webhook STORES the row filed to Favor, to Advance Appliance, with the rule on it", stored.action === "stored" && row?.salesRepId === "favor" && row?.prospectId === "P-adv" && row?.leadId === null && row?.matchedBy === "line_business_name", row);
  const mystery = await handleSalesInboundSms({ to: LINE, from: "+16135550142", body: "who is this" });
  const mrow = store.smsMessages.find((m) => m.id === mystery.messageId);
  ok("a text naming nobody on a used line goes to the line's most recent user, business null", mrow?.salesRepId === "favor" && mrow?.prospectId === null && mrow?.matchedBy === "line_recent_rep", mrow);
  store.callAttempts.length = 0;
  const idle = await handleSalesInboundSms({ to: LINE, from: "+16135550143", body: "who is this" });
  const irow = store.smsMessages.find((m) => m.id === idle.messageId);
  ok("on an idle line the assigned rep gets it", irow?.salesRepId === "rachel" && irow?.matchedBy === "line_owner", irow);
  store.numbers[0].assignedRepId = null;
  const none = await handleSalesInboundSms({ to: LINE, from: "+16135550144", body: "who is this" });
  const nrow = store.smsMessages.find((m) => m.id === none.messageId);
  ok("an idle, unassigned line: stored to NOBODY, never dropped, matchedBy null", none.action === "stored" && nrow && nrow.salesRepId === null && nrow.matchedBy === null, nrow);

  // ── Nobody's is not everybody's ───────────────────────────────────────
  store.reps.set("favor", { id: "favor", kind: "rep" });
  store.reps.set("daniel", { id: "daniel", kind: "rep" });
  const daniels = await salesConversations({ salesRepId: "daniel" });
  ok("Daniel's Texts list holds NONE of these — not Favor's, not the unowned one", daniels.length === 0, daniels.map((c) => c.e164));
  const favors = await salesConversations({ salesRepId: "favor" });
  ok("Favor's holds her two, named Advance Appliance where the prospect was filed", favors.length === 2 && favors.some((c) => c.name === "Advance Appliance"), favors.map((c) => [c.e164, c.name]));
  ok("…and the unowned row is in nobody's", !favors.some((c) => c.e164 === "+16135550144"));
  const unowned = await unownedInboundTexts({});
  ok("the superadmin's list is exactly the unowned rows, naming the line", unowned.length === 1 && unowned[0].id === nrow.id && "lineHolder" in unowned[0], unowned);

  // ── The one writer ────────────────────────────────────────────────────
  const refuseRule = await attributeSmsMessage({ messageId: nrow.id, salesRepId: "favor", matchedBy: "made_up" });
  ok("attributeSmsMessage refuses a rule it does not publish", refuseRule.ok === false);
  const refuseOut = await attributeSmsMessage({ messageId: (store.smsMessages.push({ id: "out1", direction: "out", salesRepId: "favor", fromE164: LINE, toE164: "+1", body: "x", sentAt: T }), "out1"), salesRepId: "daniel", matchedBy: "manual" });
  ok("…and refuses to file an outbound row", refuseOut.ok === false);
  const filed = await attributeSmsMessage({ messageId: nrow.id, salesRepId: "favor", matchedBy: "manual", by: { platformAdminId: "owner" }, notify: false });
  ok("a manual filing writes the row: rep, rule, and the before/after", filed.ok === true && nrow.salesRepId === "favor" && nrow.matchedBy === "manual" && filed.before.salesRepId === null && filed.after.salesRepId === "favor", filed);
  ok("…and an audit row under the admin's name, in the same transaction", store.auditRows.length === 1 && store.auditRows[0].action === "sales_sms_attributed" && store.auditRows[0].platformAdminId === "owner" && store.auditRows[0].details.messageId === nrow.id, store.auditRows[0]);
  const again = await attributeSmsMessage({ messageId: nrow.id, salesRepId: "daniel", matchedBy: "manual", notify: false });
  ok("a filed row is not silently re-filed", again.ok === false && nrow.salesRepId === "favor", again);
  const replaced = await attributeSmsMessage({ messageId: nrow.id, salesRepId: "daniel", matchedBy: "manual", replace: true, by: { platformAdminId: "owner" }, notify: false });
  ok("…unless told to replace, and then the audit row carries the previous owner", replaced.ok === true && replaced.before.salesRepId === "favor" && store.auditRows[1].details.before.salesRepId === "favor", replaced);
  ok("…after which it is in Daniel's list and nobody else's", (await salesConversations({ salesRepId: "daniel" })).some((c) => c.e164 === "+16135550144") && !(await salesConversations({ salesRepId: "favor" })).some((c) => c.e164 === "+16135550144"));

  // ── An agency sees its team; nobody else sees anybody else ────────────
  store.reps.set("agency", { id: "agency", kind: "agency" });
  store.reps.set("emp", { id: "emp", kind: "rep", managerId: "agency", engagement: "agency" });
  store.reps.set("lead", { id: "lead", kind: "rep" });
  store.reps.set("report", { id: "report", kind: "rep", managerId: "lead" });
  ok("an agency's visible reps are itself and its employees", (await smsVisibleRepIds("agency")).join() === "agency,emp");
  ok("an employee sees only themself", (await smsVisibleRepIds("emp")).join() === "emp");
  ok("a team lead who is not an agency sees only themself", (await smsVisibleRepIds("lead")).join() === "lead");
  ok("an unknown rep id narrows to itself rather than widening", (await smsVisibleRepIds("ghost")).join() === "ghost");

  // ── The surfaces ──────────────────────────────────────────────────────
  const listFn = functionSource(stripComments(read("lib/sales/salesSms.js")), "salesConversations");
  ok("salesConversations never lists `salesRepId: null` rows", Boolean(listFn) && !/salesRepId: null/.test(listFn));
  const threadFn = functionSource(stripComments(read("lib/sales/salesSms.js")), "salesThread");
  ok("salesThread never reads them either", Boolean(threadFn) && !/salesRepId: null/.test(threadFn));
  const page = stripComments(read("app/platform/sales/conversations/page.js"));
  ok("the superadmin conversations page mounts the unowned list", /<UnownedTexts/.test(page));
  const panel = stripComments(read("app/components/platform/sales/UnownedTexts.js"));
  ok("…which says “nobody's — assign” and posts to the unowned route", /nobody&rsquo;s — assign/.test(panel) && /\/api\/platform\/sales\/conversations\/unowned/.test(panel) && /method: "POST"/.test(panel));
  const route = stripComments(read("app/api/platform/sales/conversations/unowned/route.js"));
  ok("the assign route is superadmin-only (chat:audit) and goes through attributeSmsMessage with matchedBy manual and the admin's id", /requireAuditor\(request, "chat:audit"\)/.test(route) && /attributeSmsMessage\(/.test(route) && /SMS_MATCHED_BY_MANUAL/.test(route) && /platformAdminId: viewer\.id/.test(route));
  ok("…and never a raw update", !/salesSmsMessage\.update/.test(route));
  const inboundFn = functionSource(stripComments(read("lib/sales/salesSms.js")), "handleSalesInboundSms");
  ok("the webhook pushes only the rep the row was filed to", Boolean(inboundFn) && /salesRepIds: \[ownerRepId\]/.test(inboundFn));
  // Not read(): its JS stripper deletes 133 of the schema's 353 models by
  // pairing a literal `/*` in a doc comment with a `*/` 8,500 lines later.
  // SalesSmsMessage happened to sit below the hole. See scripts/prismaSchema.mjs.
  const schema = readPrismaSchema();
  const smsModel = schema.slice(schema.indexOf("model SalesSmsMessage {"), schema.indexOf("model SalesSmsMessage {") + 6000);
  ok("SalesSmsMessage carries prospectId and matchedBy, and both are read", /prospectId String\?/.test(smsModel) && /matchedBy String\?/.test(smsModel) && /prospectId: true/.test(listFn) && /matchedBy/.test(stripComments(read("lib/sales/smsAttribution.js"))));
}

// ── US A2P 10DLC: the verdict, from the resources that decide it ──────────
{
  const { usTextingVerdict, US_A2P_UNREGISTERED_ERROR, CAMPAIGN_VERIFIED } = await import("@/lib/sms/usA2pStatus");
  ok("the unregistered-sender error is Twilio's 30034", US_A2P_UNREGISTERED_ERROR === 30034 && CAMPAIGN_VERIFIED === "VERIFIED");
  const numbers = [{ e164: "+17162747905", purpose: "system" }, { e164: "+17166383616", purpose: "crew" }, { e164: "+14386099615", purpose: "sales" }];
  const empty = usTextingVerdict({ numbers, services: [], brands: [] });
  ok("no brand, no service, no campaign: every number NOT registered, and the summary says 30034 and that Canada is unaffected", empty.registered === false && empty.counts.notRegistered === 3 && /no A2P 10DLC brand, no campaign and no Messaging Service/.test(empty.summary) && /30034/.test(empty.summary) && /Canadian recipients are unaffected/.test(empty.summary), empty.summary);
  ok("…and every line names the error", empty.lines.every((l) => l.state === "not_registered" && /undelivered \(error 30034\)/.test(l.text)));
  const verified = { sid: "MG1", friendlyName: "FieldQuo A2P", phoneNumbers: ["+17162747905", "+14386099615"], campaigns: [{ sid: "QE1", status: "VERIFIED", usecase: "MIXED" }] };
  const part = usTextingVerdict({ numbers, services: [verified], brands: [{ sid: "BN1", status: "APPROVED", brandType: "STANDARD" }] });
  ok("a number in a service with a VERIFIED campaign is registered; one outside the pool is not", part.lines[0].state === "registered" && part.lines[2].state === "registered" && part.lines[1].state === "not_registered" && part.registered === false && /2 of 3 numbers registered/.test(part.summary), part.summary);
  const pending = usTextingVerdict({ numbers: numbers.slice(0, 1), services: [{ ...verified, campaigns: [{ sid: "QE1", status: "IN_PROGRESS" }] }], brands: [] });
  ok("a campaign not yet VERIFIED is 'pending', which is still undelivered", pending.lines[0].state === "pending" && /IN_PROGRESS/.test(pending.lines[0].text) && pending.registered === false);
  const all = usTextingVerdict({ numbers: numbers.filter((n) => verified.phoneNumbers.includes(n.e164)), services: [verified], brands: [] });
  ok("every number in a verified pool is 'registered' overall", all.registered === true && /US texting: registered/.test(all.summary));
  const notAsked = usTextingVerdict({ numbers, asked: false });
  ok("Twilio not asked is unknown, never 'not registered'", notAsked.registered === null && notAsked.lines.every((l) => l.state === "unknown") && /was not asked/.test(notAsked.summary));
  const route = read("app/api/platform/crew-lines/route.js");
  ok("the crew-lines API reads it live and only when Twilio was asked", /readUsA2pStatus\(\{ numbers/.test(route) && /askedTwilio\s*\?\s*await readUsA2pStatus/.test(route) && /usA2p,/.test(route));
  const page = read("app/platform/crew-lines/page.js");
  ok("the page prints the per-number verdict and the registration steps, and registers nothing", /UsTextingStatus status=\{data\.usA2p\}/.test(page) && /Regulatory Compliance/.test(page) && /Sender Pool/.test(page) && /\+17162747905/.test(page) && !/brandRegistrations\.create|usAppToPerson\.create/.test(page));
  ok("the sample messages in the steps are the ones the code sends", /Reply STOP to opt out/.test(read("lib/sms/templates.js")) && /here is the link to sign up that we talked about/.test(read("lib/sales/salesSmsRules.js")) && /here is the link to sign up that we talked about/.test(page));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
