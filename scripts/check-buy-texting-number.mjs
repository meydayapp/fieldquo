// scripts/check-buy-texting-number.mjs
//
// "That was supposed to be for texting from Twilio." — the owner, 2026-11-07,
// after trying to buy a number from the AI receptionist's picker.
//
// ══ The two products this keeps apart ══════════════════════════════════════
//
// Retell is the AI receptionist. Twilio is texting. They are different
// vendors on different accounts, and the only "buy a number" screen that
// existed bought through Retell — so a contractor who wanted a local number
// to text clients from got a receptionist line, and on 2026-11-07 got nothing
// at all, because Retell's own billing had stopped and it answered 402.
//
// Meanwhile TrueFinish's Ottawa clients were being texted from a Buffalo 716,
// because Company.smsFromNumber was empty and sends fall back to the shared
// system number. That column had exactly one writer — activating a number the
// company ALREADY owned — so a company with nothing to bring in could not fix
// it at all.
//
// ══ What is executed here ══════════════════════════════════════════════════
//
// purchaseNumber() and releasePurchased() end to end against a fake Twilio
// and a fake ledger. The assertions that matter are the ones about ORDER:
// money must not move before the number is ours, the number must not stay
// ours if we cannot wire it, and smsFromNumber — which decides where every
// client text comes from — must change only when both have actually happened.
//
// Reading the code cannot show any of that. Each failure below is injected
// and the resulting state inspected.
import { purchaseNumber, releasePurchased, syncRequest, billRent } from "@/lib/businessNumber/store";
import { BROUGHT_NUMBER_MONTHLY_CENTS } from "@/lib/businessNumber/costs";

let fail = 0;
const ok = (c, m, d) => {
  console.log((c ? "  ok   " : "  FAIL ") + m + (c || d === undefined ? "" : `  — got ${JSON.stringify(d)}`));
  if (!c) fail++;
};
const section = (t) => console.log(`\n${t}\n`);

const CO = "co_truefinish";
const NUM = "+13437008994";

/* ── The world, rebuilt before every scenario ───────────────────────────── */

function world({
  balanceCents = 1000,
  smsFromNumber = null,
  row = null,
  isDemo = false,
  buyThrows = null,
  wireThrows = null,
  releaseThrows = null,
  otherCompanyHas = null,
  commitment = null,
} = {}) {
  const state = {
    row,
    company: { id: CO, country: "CA", smsFromNumber },
    debits: [],
    bought: [],
    released: [],
    wired: [],
    logs: [],
  };

  const prisma = {
    broughtNumber: {
      findUnique: async () => state.row,
      findFirst: async ({ where }) =>
        otherCompanyHas && where?.e164 === otherCompanyHas ? { id: "other" } : null,
      create: async ({ data }) => {
        state.row = { id: "bn_1", ...data };
        return state.row;
      },
      update: async ({ data }) => {
        state.row = { ...state.row, ...data };
        return state.row;
      },
    },
    company: {
      findUnique: async () => state.company,
      findFirst: async () => null,
      update: async ({ data }) => {
        state.company = { ...state.company, ...data };
        return state.company;
      },
    },
  };

  const provider = {
    twilioConfigured: () => true,
    buyNumber: async (e164) => {
      if (buyThrows) throw new Error(buyThrows);
      state.bought.push(e164);
      return { sid: "PN_bought", e164 };
    },
    releaseNumber: async (sid) => {
      if (releaseThrows) throw new Error(releaseThrows);
      state.released.push(sid);
    },
    wireNumber: async (sid, urls) => {
      if (wireThrows) throw new Error(wireThrows);
      state.wired.push({ sid, ...urls });
    },
    findOwnedNumber: async () => ({ sid: "PN_bought" }),
  };

  const deps = {
    prisma,
    provider,
    isDemo: async () => isDemo,
    balance: async () => balanceCents,
    debit: async (d) => {
      state.debits.push(d);
    },
    commitment: commitment || (async () => null),
    now: () => new Date("2026-11-08T12:00:00Z"),
    log: async (l) => {
      state.logs.push(l);
    },
  };
  return { state, deps };
}

/* ── 1. the happy path, and the one column that matters ─────────────────── */

section("1. buying a number makes it the texting line");

{
  const { state, deps } = world();
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "https://www.fieldquo.com" }, deps);

  ok(r.ok, "the purchase succeeds", r.reason);
  ok(state.bought.length === 1 && state.bought[0] === NUM, "Twilio was asked for exactly that number", state.bought);
  ok(
    state.company.smsFromNumber === NUM,
    "Company.smsFromNumber now names it — without this the texts still leave from Buffalo",
    state.company.smsFromNumber,
  );
  ok(state.row.status === "active", "the row says active", state.row.status);
  ok(state.row.path === "purchased", "and is filed as purchased, not hosted or ported", state.row.path);
  ok(state.row.country === "CA", "the country is the one the search reported, not read off +1", state.row.country);
  ok(state.row.providerNumberSid === "PN_bought", "the Twilio sid is kept — releasing later needs it", state.row.providerNumberSid);
  ok(state.debits.length === 1, "the first month is charged exactly once", state.debits.length);
  ok(state.debits[0]?.cents === BROUGHT_NUMBER_MONTHLY_CENTS, "at the one rental price", state.debits[0]?.cents);
  ok(state.released.length === 0, "and nothing was given back");
}

/* ── 2. a bought line's CALLS go somewhere ───────────────────────────────
   A hosted number's calls stay with its carrier, so wireNumber gets no
   voiceUrl for one. A number we rented outright has no other carrier: if its
   voice webhook is unset, somebody ringing the number on the van reaches
   silence. That is the dead control in its purest form. */

section("2. the number answers when it is rung");

{
  const { state, deps } = world();
  await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "https://www.fieldquo.com" }, deps);
  const w = state.wired[0] || {};
  ok(Boolean(w.smsUrl), "texts are pointed at FieldQuo", w.smsUrl);
  ok(Boolean(w.voiceUrl), "and so are calls — a rented line that rings into nothing is the dead control", w.voiceUrl);
  ok(Boolean(w.voiceStatusUrl), "with the call-status callback, so the call is logged");
}

/* ── 3. money never moves before the number is ours ──────────────────────── */

section("3. nothing is charged for a number we did not get");

{
  const { state, deps } = world({ balanceCents: 100 });
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "o" }, deps);
  ok(!r.ok && r.status === 402, "too little balance is refused", { ok: r.ok, status: r.status });
  ok(state.bought.length === 0, "and Twilio was never asked — the refusal is BEFORE the spend", state.bought);
  ok(state.debits.length === 0, "nothing charged");
  ok(state.company.smsFromNumber === null, "and the sending number is untouched");
}

{
  const { state, deps } = world({ buyThrows: "21422 unavailable" });
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "o" }, deps);
  ok(!r.ok, "a Twilio refusal fails the purchase", r.ok);
  ok(state.debits.length === 0, "with nothing charged", state.debits);
  ok(state.company.smsFromNumber === null, "and no sending number set", state.company.smsFromNumber);
  ok(/nothing has been charged/i.test(r.reason || ""), "and says so in the words the contractor reads", r.reason);
}

/* ── 4. a number we bought but could not wire goes BACK ───────────────────
   The expensive failure: Twilio has sold it, so it bills $4 a month, and it
   reaches nobody. Holding it would be a charge for a line that does nothing. */

section("4. a number we cannot connect is given straight back");

{
  const { state, deps } = world({ wireThrows: "webhook rejected" });
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "o" }, deps);
  ok(!r.ok, "the purchase fails", r.ok);
  ok(state.bought.length === 1, "Twilio did sell it");
  ok(state.released.includes("PN_bought"), "and it was released again", state.released);
  ok(state.debits.length === 0, "nothing was charged", state.debits);
  ok(state.company.smsFromNumber === null, "and it never became the sending number", state.company.smsFromNumber);
  ok(state.row.status === "failed", "the row says failed", state.row.status);
  ok(state.row.providerNumberSid === null, "and no longer claims a Twilio sid it has given up", state.row.providerNumberSid);
}

/* ── 5. refusals that must happen before the spend ───────────────────────── */

section("5. a number somebody else holds is never bought");

{
  const { state, deps } = world({ otherCompanyHas: NUM });
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "o" }, deps);
  ok(!r.ok && r.status === 409, "refused as taken", { ok: r.ok, status: r.status });
  ok(state.bought.length === 0, "before Twilio was asked", state.bought);
}

{
  const { state, deps } = world({ commitment: async () => ({ kind: "crew" }) });
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "o" }, deps);
  ok(!r.ok, "a number already committed to a crew line is refused", r.ok);
  ok(state.bought.length === 0, "and not bought", state.bought);
}

section("6. a demo company buys nothing, and texts from nothing");

{
  const { state, deps } = world({ isDemo: true });
  const r = await purchaseNumber({ companyId: CO, e164: NUM, country: "CA", origin: "o" }, deps);
  ok(!r.ok, "refused", r.ok);
  ok(state.bought.length === 0, "nothing bought", state.bought);
  ok(state.company.smsFromNumber === null, "and a fictional line never routes a real homeowner's text", state.company.smsFromNumber);
}

/* ── 7. an active rented row is left alone by the status sync ─────────────
   syncRequest exists to ask a provider where an ORDER is. A rented number
   had no order. Falling through its three path branches would write
   providerStatus: null over a good row every five minutes. */

section("7. the status sync does not touch a rented number");

{
  const { deps } = world();
  const row = { id: "bn_1", companyId: CO, path: "purchased", status: "active", providerStatus: "bought", simulated: false };
  const r = await syncRequest(row, { origin: "o" }, deps);
  ok(r.changed === false, "nothing changed", r.changed);
  ok(r.row.providerStatus === "bought", "and the row was not blanked", r.row.providerStatus);
}

/* ── 8. the rent sweep bills it like any other business number ───────────── */

section("8. the monthly rental keeps coming off");

{
  const { state, deps } = world();
  const row = {
    id: "bn_1",
    companyId: CO,
    e164: NUM,
    path: "purchased",
    status: "active",
    simulated: false,
    rentPaidThroughAt: new Date("2026-11-01T00:00:00Z"),
  };
  const r = await billRent(row, deps);
  ok(r.charged, "a due rental is charged", r);
  ok(state.debits[0]?.cents === BROUGHT_NUMBER_MONTHLY_CENTS, "at the same price as the first month", state.debits[0]?.cents);
}

/* ── 9. giving it up ─────────────────────────────────────────────────────── */

section("9. a rented number can be given up, and only with the digits typed");

const liveRow = () => ({
  id: "bn_1",
  companyId: CO,
  e164: NUM,
  path: "purchased",
  status: "active",
  simulated: false,
  providerNumberSid: "PN_bought",
});

{
  const { state, deps } = world({ row: liveRow(), smsFromNumber: NUM });
  const r = await releasePurchased({ companyId: CO, confirm: "+13435550000" }, deps);
  ok(!r.ok, "a mistyped confirmation is refused", r.ok);
  ok(state.released.length === 0, "and nothing is released", state.released);
  ok(state.company.smsFromNumber === NUM, "the line keeps working", state.company.smsFromNumber);
}

{
  const { state, deps } = world({ row: liveRow(), smsFromNumber: NUM });
  const r = await releasePurchased({ companyId: CO, confirm: "(343) 700-8994" }, deps);
  ok(r.ok, "the right number, however it is typed, releases it", r.reason);
  ok(state.released.includes("PN_bought"), "Twilio was told", state.released);
  ok(state.company.smsFromNumber === null, "the sending number is cleared", state.company.smsFromNumber);
  ok(state.row.status === "cancelled", "the row is cancelled", state.row.status);
  ok(state.row.rentPaidThroughAt === null, "and the rent sweep has nothing left to bill", state.row.rentPaidThroughAt);
}

{
  // The company moved its sending number to something else while this one was
  // still rented. Releasing the old line must not blank the new one.
  const { state, deps } = world({ row: liveRow(), smsFromNumber: "+16135550111" });
  await releasePurchased({ companyId: CO, confirm: NUM }, deps);
  ok(
    state.company.smsFromNumber === "+16135550111",
    "releasing an old line does not blank a sending number that has since moved",
    state.company.smsFromNumber,
  );
}

{
  const { state, deps } = world({ row: { ...liveRow(), path: "port" }, smsFromNumber: NUM });
  const r = await releasePurchased({ companyId: CO, confirm: NUM }, deps);
  ok(!r.ok, "a PORTED number — the company's own property — is not FieldQuo's to hand back", r.ok);
  ok(state.released.length === 0, "and is not released", state.released);
  ok(state.company.smsFromNumber === NUM, "and keeps working", state.company.smsFromNumber);
}

{
  const { state, deps } = world({ row: liveRow(), smsFromNumber: NUM, releaseThrows: "twilio down" });
  const r = await releasePurchased({ companyId: CO, confirm: NUM }, deps);
  ok(!r.ok, "a failed release is a failure, not a silent success", r.ok);
  ok(state.company.smsFromNumber === NUM, "and the number keeps working rather than being orphaned", state.company.smsFromNumber);
  ok(state.row.status === "active", "the row still says active, because it is", state.row.status);
}

console.log(fail ? `\n${fail} failed\n` : "\nAll checks passed\n");
process.exit(fail ? 1 : 0);
