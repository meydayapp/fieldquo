// scripts/check-voice-auto-topup.mjs
//
// Automatic top-up charges a card. Prove it cannot run away.
//
//   npm run check:voice-auto-topup
//
// ══ Why this file EXECUTES ═════════════════════════════════════════════════
//
// Everything else in the voice feature spends a prepaid balance. This spends a
// card, without the contractor present, on a schedule nobody watches. The
// failure mode is not "a screen says the wrong thing" — it is a real card
// charged in a loop, and the person finds out from their bank.
//
// So none of the guarantees below are asserted about source. Every one of them
// is run: the real autoTopupDecision, the real runAutoTopup, the real
// settlement out of lib/voice/topup.js, against an in-memory database that
// enforces the same unique index Postgres does and a Stripe stub that records
// every request. A comment claiming idempotency is a claim; a stub that counts
// PaymentIntents is a measurement.
//
// NO LIVE STRIPE CALL, and no database. Both are injected — which is also why
// this can run in CI with no secrets.
//
// The seven things it proves, each of which is a bug somebody could ship:
//
//   1. Crossing the threshold charges exactly ONCE.
//   2. A second crossing while one is in flight charges NOTHING.
//   3. A declined card switches the feature off, notifies, and never retries.
//   4. The daily cap holds.
//   5. An unreachable Stripe charges nobody — and the retry after it replays
//      the same idempotency key rather than starting a second payment.
//   6. A manual and an automatic top-up cannot both credit one payment.
//   7. Nothing is chargeable without a recorded consent AND a saved card.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  autoTopupDecision,
  normaliseAutoTopupThreshold,
  normaliseAutoTopupAmount,
  AUTO_TOPUP_THRESHOLDS,
  AUTO_TOPUP_MAX_PER_DAY,
  AUTO_TOPUP_MIN_GAP_MINUTES,
  AUTO_TOPUP_STALE_CLAIM_MINUTES,
  topupRef,
  TOPUP_OPTIONS,
} from "@/lib/voice/credits";
import {
  runAutoTopup,
  classifyChargeFailure,
  dailyCeilingFor,
  hasMandate,
  consentMatchesSettings,
  publicAutoTopup,
  AUTO_TOPUP_MAX_CONSECUTIVE_FAILURES,
} from "@/lib/voice/autoTopup";
import { creditVoiceTopup, creditVoiceAutoTopup } from "@/lib/voice/topup";
import { buildAutoTopupTerms } from "@/lib/voice/autoTopupConsent";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Source with the comments taken out.
 *
 * The assertions below are about what the CODE does, and this file's headers
 * discuss `transfer_data` and `application_fee_amount` at length precisely to
 * explain why neither appears. Reading the raw text would have the prose
 * failing the check it exists to justify — and the fix somebody would reach for
 * is deleting the explanation.
 */
const code = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

const MINUTE = 60_000;
const at = (base, minutes) => new Date(new Date(base).getTime() + minutes * MINUTE);

/* ═══════════════════════════════════════════════════════════════════════════
   A world: a ledger with the real unique index, a config row, a Stripe stub
   ═══════════════════════════════════════════════════════════════════════════

   The ledger reproduces the one semantic that carries the whole guarantee —
   @@unique([companyId, ref]) refusing the second write. Modelling it as a
   read-then-write would exercise the fast path and quietly skip the thing that
   actually holds when two callers arrive together.

   The config row reproduces the OTHER one: updateMany with a `where` on the
   value we read, which is how "one charge in flight" is enforced. */

function makeWorld({ config = {}, entries = [] } = {}) {
  const rows = entries.map((r, i) => ({ id: `seed${i}`, ref: null, stripeRef: null, ...r }));
  let n = 0;

  const row = {
    companyId: "co1",
    enabled: true,
    thresholdCents: 1000,
    amountCents: 3000,
    stripeCustomerId: "cus_1",
    stripeSetupIntentId: "seti_1",
    stripePaymentMethodId: "pm_1",
    stripeMandateId: null,
    paymentMethodType: "card",
    paymentMethodBrand: "visa",
    paymentMethodLast4: "4242",
    acceptedAt: new Date("2026-08-01T00:00:00Z"),
    termsText: "…",
    termsLanguage: "en",
    authorisedAmountCents: 3000,
    authorisedDailyCents: 9000,
    chargeInFlightAt: null,
    chargeAttemptToken: null,
    dayKey: null,
    chargesToday: 0,
    spentTodayCents: 0,
    lastChargeAt: null,
    consecutiveFailures: 0,
    lastFailureAt: null,
    lastFailureCode: null,
    lastFailureMessage: null,
    disabledAt: null,
    disabledReason: null,
    ...config,
  };

  const activity = [];
  const attached = [];
  const notices = [];
  const errors = [];
  const stripeCalls = [];

  const db = {
    voiceCreditEntry: {
      findFirst: async ({ where }) => {
        const match = (r) => {
          if (r.companyId !== where.companyId) return false;
          if (where.OR) {
            return where.OR.some((c) =>
              Object.entries(c).every(([k, v]) => v != null && r[k] === v),
            );
          }
          return Object.entries(where)
            .filter(([k]) => k !== "companyId")
            .every(([k, v]) => r[k] === v);
        };
        return rows.find(match) || null;
      },
      aggregate: async ({ where }) => ({
        _sum: {
          cents: rows
            .filter((r) => r.companyId === where.companyId)
            .reduce((s, r) => s + r.cents, 0),
        },
      }),
    },
    voiceAutoTopup: {
      findUnique: async ({ where }) => (where.companyId === row.companyId ? { ...row } : null),
      update: async ({ data }) => {
        Object.assign(row, data);
        return { ...row };
      },
      // The compare-and-set. `where` names the value the caller read; if
      // anything changed it underneath, this matches nothing and returns 0.
      updateMany: async ({ where, data }) => {
        const wanted = where.chargeInFlightAt ?? null;
        const actual = row.chargeInFlightAt ?? null;
        const same =
          wanted === null
            ? actual === null
            : actual !== null && new Date(actual).getTime() === new Date(wanted).getTime();
        if (!same) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };

  // The real addCredit's stripeRef fast path plus the index behind it.
  const addCredit = async ({ companyId, cents, kind, stripeRef, ref, note }) => {
    if (stripeRef && rows.some((r) => r.companyId === companyId && r.stripeRef === stripeRef)) {
      return null;
    }
    if (ref && rows.some((r) => r.companyId === companyId && r.ref === ref)) {
      return null; // P2002 — a concurrent caller wrote the same row.
    }
    const created = { id: `e${++n}`, companyId, cents, kind, stripeRef, ref, note };
    rows.push(created);
    return created;
  };

  const balanceFor = async (companyId) =>
    rows.filter((r) => r.companyId === companyId).reduce((s, r) => s + r.cents, 0);

  const topupDeps = {
    db,
    addCredit,
    balanceFor,
    recordActivity: async (m, e) => activity.push({ companyId: m?.companyId, ...e }),
    syncNumberAttachment: async (companyId) => {
      attached.push(companyId);
      return { ok: true };
    },
  };

  /** A Stripe that behaves. `behaviour` decides what each create does. */
  function makeStripe(behaviour = () => ({ status: "succeeded" })) {
    let intents = 0;
    // Real Stripe idempotency: the same key returns the SAME object without
    // creating a second one. Reproducing that is the entire point of the
    // "unreachable Stripe" case below.
    const byKey = new Map();
    return {
      paymentIntents: {
        create: async (params, options) => {
          stripeCalls.push({ params, options });
          const key = options?.idempotencyKey;
          if (key && byKey.has(key)) return byKey.get(key);
          const outcome = behaviour(params, options, ++intents);
          if (outcome instanceof Error) throw outcome;
          const intent = {
            id: outcome.id || `pi_${intents}`,
            status: outcome.status,
            amount: params.amount,
            amount_received: outcome.status === "succeeded" ? params.amount : 0,
            metadata: params.metadata,
            last_payment_error: outcome.last_payment_error || null,
          };
          if (key) byKey.set(key, intent);
          return intent;
        },
      },
    };
  }

  const deps = (stripeStub) => ({
    db,
    stripe: stripeStub,
    balanceFor,
    creditVoiceAutoTopup: (intent) => creditVoiceAutoTopup(intent, { deps: topupDeps }),
    notifyAutoTopupStopped: async (companyId, verdict) => {
      notices.push({ companyId, verdict });
      return true;
    },
    recordActivity: async (m, e) => activity.push({ companyId: m?.companyId, ...e }),
    recordError: async (e) => errors.push(e),
  });

  return {
    row,
    rows,
    activity,
    notices,
    errors,
    stripeCalls,
    balanceFor,
    addCredit,
    topupDeps,
    makeStripe,
    deps,
  };
}

const succeeds = () => ({ status: "succeeded" });
const declines = () => {
  const err = new Error("Your card was declined.");
  err.type = "StripeCardError";
  err.code = "card_declined";
  err.statusCode = 402;
  return err;
};
const unreachable = () => {
  const err = new Error("An error occurred with our connection to Stripe.");
  err.type = "StripeConnectionError";
  return err;
};

/* ═══════════════════════════════════════════════════════════════════════════ */

console.log("\nAutomatic voice credit top-up\n");

console.log("── Nothing is armed by accident ───────────────────────────────────\n");

ok(
  "a company with no row is not chargeable",
  autoTopupDecision({ config: null, balanceCents: 0 }).reason === "not_configured",
);
ok(
  "a row that has never been switched on is not chargeable",
  autoTopupDecision({ config: { enabled: false }, balanceCents: 0 }).reason === "disabled",
);
ok(
  "an enabled row with NO threshold chosen is not chargeable — absence is not a default",
  autoTopupDecision({
    config: { enabled: true, thresholdCents: null, amountCents: 3000 },
    balanceCents: 0,
  }).reason === "no_threshold",
);
ok(
  "…nor with no amount chosen",
  autoTopupDecision({
    config: { enabled: true, thresholdCents: 1000, amountCents: null },
    balanceCents: 0,
  }).reason === "no_amount",
);

{
  const w = makeWorld({ config: { acceptedAt: null, termsText: null } });
  ok(
    "a saved card with NO recorded consent is refused — a card is not a mandate",
    autoTopupDecision({ config: w.row, balanceCents: 0 }).reason === "no_consent",
  );
}
{
  const w = makeWorld({ config: { stripePaymentMethodId: null } });
  ok(
    "recorded consent with NO saved card is refused — agreed, never finished",
    autoTopupDecision({ config: w.row, balanceCents: 0 }).reason === "no_mandate",
  );
  ok("…and hasMandate() agrees", hasMandate(w.row) === false);
}
{
  // The amount edited past what the terms actually named.
  const w = makeWorld({ config: { amountCents: 10000, authorisedAmountCents: 3000 } });
  ok(
    "an amount above what the recorded terms authorised is refused, not charged",
    autoTopupDecision({ config: w.row, balanceCents: 0 }).reason === "over_authorised",
  );
  ok("…and the screen can say so", consentMatchesSettings(w.row) === false);
}

ok(
  "only the three offered thresholds are accepted",
  normaliseAutoTopupThreshold(500) === 500 &&
    normaliseAutoTopupThreshold(1000) === 1000 &&
    normaliseAutoTopupThreshold(2000) === 2000 &&
    AUTO_TOPUP_THRESHOLDS.length === 3,
);
{
  let clean = true;
  for (const hostile of [null, undefined, NaN, "", "abc", -1, 0, 1, 300, 1500, 200000, Infinity, {}, []]) {
    if (normaliseAutoTopupThreshold(hostile) !== null) clean = false;
    if (normaliseAutoTopupAmount(hostile) !== null) clean = false;
  }
  ok("hostile threshold and amount input is refused outright, never clamped", clean);
}
ok(
  "…while a real offered amount passes",
  TOPUP_OPTIONS.every((o) => normaliseAutoTopupAmount(o.cents) === o.cents),
);

console.log("\n── Crossing the threshold charges exactly ONCE ─────────────────────\n");

{
  const w = makeWorld();
  await w.addCredit({ companyId: "co1", cents: 900, kind: "topup", ref: "seed" });

  const now = new Date("2026-08-26T10:00:00Z");
  const first = await runAutoTopup("co1", { now, deps: w.deps(w.makeStripe(succeeds)) });

  ok("a balance under the threshold charges", first.charged === true, `→ ${first.reason}`);
  ok("…for exactly the amount chosen", first.cents === 3000);
  ok("…once at Stripe", w.stripeCalls.length === 1);
  ok("…and the credit lands on the ledger", (await w.balanceFor("co1")) === 3900);
  ok(
    "…keyed on the payment intent, so nothing else can credit it again",
    w.rows.some((r) => r.ref === topupRef("pi_1")),
  );
  ok(
    "…and the statement line says it was automatic",
    w.rows.some((r) => /Automatic top-up/.test(r.note || "")),
  );
  ok("…the claim is released", w.row.chargeInFlightAt === null);
  ok("…and the spent token is not reusable", w.row.chargeAttemptToken === null);

  // Now above the threshold. Nothing more should happen, ever.
  const second = await runAutoTopup("co1", {
    now: at(now, AUTO_TOPUP_MIN_GAP_MINUTES + 1),
    deps: w.deps(w.makeStripe(succeeds)),
  });
  ok(
    "a balance back above the threshold charges nothing",
    second.charged === false && second.reason === "above_threshold",
  );
  ok("…and Stripe was not called a second time", w.stripeCalls.length === 1);
}

{
  const w = makeWorld({ config: { thresholdCents: 1000 } });
  await w.addCredit({ companyId: "co1", cents: 1000, kind: "topup", ref: "seed" });
  const d = autoTopupDecision({ config: w.row, balanceCents: 1000 });
  ok(
    "a balance sitting exactly ON the threshold is not below it, and is not charged",
    d.charge === false && d.reason === "above_threshold",
  );
}

console.log("\n── A second crossing while one is in flight charges NOTHING ────────\n");

{
  const now = new Date("2026-08-26T10:00:00Z");
  const w = makeWorld();
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });

  // Two invocations that both read the row before either claimed it — the
  // serverless case this whole mechanism exists for. The stub's updateMany
  // enforces the same compare-and-set Postgres does.
  let release;
  const gate = new Promise((r) => {
    release = r;
  });
  const slowStripe = w.makeStripe(succeeds);
  const realCreate = slowStripe.paymentIntents.create;
  slowStripe.paymentIntents.create = async (...args) => {
    await gate;
    return realCreate(...args);
  };

  const a = runAutoTopup("co1", { now, deps: w.deps(slowStripe) });
  // Give the first one time to claim, then race a second at it.
  await new Promise((r) => setTimeout(r, 5));
  const b = await runAutoTopup("co1", { now, deps: w.deps(w.makeStripe(succeeds)) });
  release();
  const first = await a;

  ok("the first invocation charges", first.charged === true);
  ok(
    "the overlapping one is refused as in flight",
    b.charged === false && b.reason === "in_flight",
    `→ ${b.reason}`,
  );
  ok("exactly one PaymentIntent was created between them", w.stripeCalls.length === 1);
  ok("…and the balance moved exactly once", (await w.balanceFor("co1")) === 3100);
}

{
  // A claim from a crashed invocation must not wedge the feature for ever...
  const claimedAt = new Date("2026-08-26T10:00:00Z");
  const w = makeWorld({
    config: { chargeInFlightAt: claimedAt, chargeAttemptToken: "tok-abandoned" },
  });
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });

  const tooSoon = autoTopupDecision({
    config: w.row,
    balanceCents: 100,
    now: at(claimedAt, AUTO_TOPUP_STALE_CLAIM_MINUTES - 1),
  });
  ok("a fresh claim blocks a second attempt", tooSoon.reason === "in_flight");

  const result = await runAutoTopup("co1", {
    now: at(claimedAt, AUTO_TOPUP_STALE_CLAIM_MINUTES + 1),
    deps: w.deps(w.makeStripe(succeeds)),
  });
  ok("…and a stale one is reclaimed rather than wedging it for ever", result.charged === true);
  ok(
    "…REUSING the abandoned token, so a payment that did go through is replayed, not repeated",
    w.stripeCalls[0].options.idempotencyKey === "voice_auto_topup:co1:tok-abandoned",
    w.stripeCalls[0].options.idempotencyKey,
  );
}

console.log("\n── A declined card stops, tells them, and never retries ────────────\n");

{
  const now = new Date("2026-08-26T10:00:00Z");
  const w = makeWorld();
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });

  const result = await runAutoTopup("co1", { now, deps: w.deps(w.makeStripe(declines)) });

  ok("a decline does not charge", result.charged === false && result.reason === "declined");
  ok("nothing was credited", (await w.balanceFor("co1")) === 100);
  ok("automatic top-up is switched OFF", w.row.enabled === false);
  ok("…and the row says why, so the screen can too", w.row.disabledReason === "declined");
  ok("the company is told", w.notices.length === 1 && w.notices[0].verdict.definite === true);
  ok("…and the claim is released", w.row.chargeInFlightAt === null);
  ok(
    "…the token is spent — a declined payment is settled, not unknown",
    w.row.chargeAttemptToken === null,
  );

  // The critical one: no retry, ever, without a human.
  const again = await runAutoTopup("co1", {
    now: at(now, 60 * 24),
    deps: w.deps(w.makeStripe(succeeds)),
  });
  ok(
    "a day later it STILL does not retry — retrying a declined card is how a card gets blocked",
    again.charged === false && again.reason === "disabled",
  );
  ok("…and Stripe was called exactly once in total", w.stripeCalls.length === 1);
}

{
  // `requires_action` is a decline for our purposes: the bank wants the
  // cardholder and the cardholder is not here.
  const w = makeWorld();
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });
  const result = await runAutoTopup("co1", {
    now: new Date("2026-08-26T10:00:00Z"),
    deps: w.deps(w.makeStripe(() => ({ status: "requires_action" }))),
  });
  ok(
    "an intent that comes back needing the cardholder is treated as a stop, not a retry",
    result.reason === "declined" && w.row.enabled === false,
  );
  ok("…and nothing was credited", (await w.balanceFor("co1")) === 100);
}

ok(
  "classifyChargeFailure calls a card error definite",
  classifyChargeFailure(declines()).definite === true,
);
ok(
  "…and a connection error UNKNOWN, not a decline",
  classifyChargeFailure(unreachable()).definite === false,
);

console.log("\n── An unreachable Stripe charges nobody ────────────────────────────\n");

{
  const now = new Date("2026-08-26T10:00:00Z");
  const w = makeWorld();
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });

  const first = await runAutoTopup("co1", { now, deps: w.deps(w.makeStripe(unreachable)) });
  ok("nobody is charged", first.charged === false && first.reason === "stripe_unreachable");
  ok("nothing is credited", (await w.balanceFor("co1")) === 100);
  ok("it is NOT switched off on one blip", w.row.enabled === true);
  ok("…but it is counted", w.row.consecutiveFailures === 1);
  ok(
    "…and the token is KEPT, because the money may have moved",
    typeof w.row.chargeAttemptToken === "string" && w.row.chargeAttemptToken.length > 0,
  );

  const kept = w.row.chargeAttemptToken;

  // Immediately afterwards it must not hammer.
  const hammer = await runAutoTopup("co1", {
    now: at(now, 1),
    deps: w.deps(w.makeStripe(unreachable)),
  });
  ok(
    "a retry inside the gap is refused, so a busy afternoon is not a request every second",
    hammer.charged === false && hammer.reason === "too_soon",
  );

  // ── The one that matters: the first attempt DID go through, we just never
  //    heard. The replay must be the same payment, not a second one.
  const sameIntent = w.makeStripe(succeeds);
  const replay = await runAutoTopup("co1", {
    now: at(now, AUTO_TOPUP_MIN_GAP_MINUTES + 1),
    deps: w.deps(sameIntent),
  });
  ok("the retry after the gap goes through", replay.charged === true);
  ok(
    "…replaying the SAME idempotency key, so Stripe returns the original payment",
    w.stripeCalls.at(-1).options.idempotencyKey === `voice_auto_topup:co1:${kept}`,
  );
  ok("…and the credit lands exactly once", (await w.balanceFor("co1")) === 3100);
  ok("…the failure counter is cleared by success", w.row.consecutiveFailures === 0);
}

{
  // Three in a row, and it stops.
  const now = new Date("2026-08-26T10:00:00Z");
  const w = makeWorld();
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });

  for (let i = 0; i < AUTO_TOPUP_MAX_CONSECUTIVE_FAILURES; i++) {
    await runAutoTopup("co1", {
      now: at(now, i * (AUTO_TOPUP_MIN_GAP_MINUTES + 1)),
      deps: w.deps(w.makeStripe(unreachable)),
    });
  }
  ok(
    `${AUTO_TOPUP_MAX_CONSECUTIVE_FAILURES} unreachable attempts in a row switch it off`,
    w.row.enabled === false && w.row.disabledReason === "stripe_unreachable",
  );
  ok("…and the company is told once, not three times", w.notices.length === 1);
  ok("…and still nothing was ever credited", (await w.balanceFor("co1")) === 100);
}

console.log("\n── The daily cap holds ─────────────────────────────────────────────\n");

{
  const day = new Date("2026-08-26T10:00:00Z");
  const w = makeWorld();
  // Credit that is spent again between each charge, so the balance keeps
  // falling back under the threshold — the runaway shape this cap is for.
  await w.addCredit({ companyId: "co1", cents: 100, kind: "topup", ref: "seed" });

  let charges = 0;
  for (let i = 0; i < 10; i++) {
    const now = at(day, i * (AUTO_TOPUP_MIN_GAP_MINUTES + 1));
    const r = await runAutoTopup("co1", { now, deps: w.deps(w.makeStripe(succeeds)) });
    if (r.charged) {
      charges++;
      // Something eats the credit straight back down.
      await w.addCredit({
        companyId: "co1",
        cents: -3000,
        kind: "call",
        ref: `burn:${i}`,
      });
    }
  }

  ok(
    `ten crossings in one day produce at most ${AUTO_TOPUP_MAX_PER_DAY} charges`,
    charges === AUTO_TOPUP_MAX_PER_DAY,
    `got ${charges}`,
  );
  ok("…and Stripe saw exactly that many", w.stripeCalls.length === AUTO_TOPUP_MAX_PER_DAY);
  ok(
    "…the eleventh is refused on the cap, by name",
    autoTopupDecision({
      config: w.row,
      balanceCents: 0,
      now: at(day, 11 * (AUTO_TOPUP_MIN_GAP_MINUTES + 1)),
    }).reason === "daily_cap",
  );

  // The next UTC day starts clean.
  const tomorrow = at(day, 60 * 24);
  ok(
    "a new day resets the counter — the cap is a day, not a life sentence",
    autoTopupDecision({ config: w.row, balanceCents: 0, now: tomorrow }).charge === true,
  );
}

{
  // The money ceiling holds even if the count somehow does not.
  const w = makeWorld({
    config: {
      dayKey: "2026-08-26",
      chargesToday: 0,
      spentTodayCents: 9000,
      authorisedDailyCents: 9000,
    },
  });
  ok(
    "the frozen daily MONEY ceiling refuses a charge that would exceed what was agreed",
    autoTopupDecision({
      config: w.row,
      balanceCents: 0,
      now: new Date("2026-08-26T23:00:00Z"),
    }).reason === "daily_amount_cap",
  );
}

ok(
  "a row with no authorised daily figure at all cannot be charged",
  autoTopupDecision({
    config: { ...makeWorld().row, authorisedDailyCents: null },
    balanceCents: 0,
  }).reason === "daily_amount_cap",
);
ok(
  "dailyCeilingFor states the ceiling the terms name",
  dailyCeilingFor(3000) === 3000 * AUTO_TOPUP_MAX_PER_DAY,
);

console.log("\n── One payment cannot be credited twice ────────────────────────────\n");

{
  // The same payment intent reaching BOTH settlement doors — the manual
  // Checkout path and the automatic PaymentIntent path. Whichever is second
  // must find the row already there.
  const w = makeWorld();
  const PI = "pi_shared_1";

  const auto = await creditVoiceAutoTopup(
    {
      id: PI,
      status: "succeeded",
      amount: 3000,
      amount_received: 3000,
      metadata: { companyId: "co1", kind: "voice_topup", auto: "true" },
    },
    { deps: w.topupDeps },
  );
  const manual = await creditVoiceTopup(
    {
      id: "cs_shared_1",
      mode: "payment",
      payment_status: "paid",
      amount_total: 3000,
      payment_intent: PI,
      metadata: { companyId: "co1", kind: "voice_topup", cents: "3000" },
    },
    { deps: w.topupDeps },
  );

  ok("the automatic settlement credits", auto.credited && !auto.alreadyCredited);
  ok("the manual one recognises the same payment", manual.credited && manual.alreadyCredited);
  ok("…and the balance moved once", (await w.balanceFor("co1")) === 3000);
  ok(
    "…both keyed on the payment intent, not the session",
    w.rows.filter((r) => r.ref === topupRef(PI)).length === 1,
  );
}

{
  // And the other way round, because the two race in either order.
  const w = makeWorld();
  const PI = "pi_shared_2";
  const manual = await creditVoiceTopup(
    {
      id: "cs_shared_2",
      mode: "payment",
      payment_status: "paid",
      amount_total: 1000,
      payment_intent: PI,
      metadata: { companyId: "co1", kind: "voice_topup", cents: "1000" },
    },
    { deps: w.topupDeps },
  );
  const auto = await creditVoiceAutoTopup(
    { id: PI, status: "succeeded", amount: 1000, amount_received: 1000, metadata: { companyId: "co1" } },
    { deps: w.topupDeps },
  );
  ok("manual first, then automatic — still one credit", manual.credited && auto.alreadyCredited);
  ok("…and the balance moved once", (await w.balanceFor("co1")) === 1000);
}

{
  const w = makeWorld();
  const r = await creditVoiceAutoTopup(
    { id: "pi_x", status: "processing", amount: 3000, metadata: { companyId: "co1" } },
    { deps: w.topupDeps },
  );
  ok(
    "an intent that has not SUCCEEDED credits nothing — accepted is not settled",
    r.credited === false && (await w.balanceFor("co1")) === 0,
  );
}

console.log("\n── The consent record ──────────────────────────────────────────────\n");

{
  const terms = buildAutoTopupTerms({
    thresholdCents: 1000,
    amountCents: 3000,
    maxPerDay: AUTO_TOPUP_MAX_PER_DAY,
    dailyCents: 9000,
    currency: "USD",
    companyName: "Big Painter Inc",
    language: "en",
  });

  // The four things Stripe requires a merchant to STATE and to KEEP.
  ok("the terms state that a SERIES of payments is authorised", /series of payments/i.test(terms.text));
  ok("…the timing and frequency, including the ceiling", /whenever your phone credit falls below/i.test(terms.text) && /At most 3 payments in a day/i.test(terms.text));
  ok("…how the amount is decided", /Each payment is \$30\.00 USD/.test(terms.text));
  ok("…and how to cancel", /switch automatic top-up off at any time/i.test(terms.text));
  ok("the decline behaviour is stated up front, not just emailed after", /switches off straight away/i.test(terms.text) && /do not retry/i.test(terms.text));
  ok("the currency is named — every company here bills in CAD and Stripe takes USD", /USD/.test(terms.text));
  ok("the consent label is a first-person statement, not a button label", /I have read the above/i.test(terms.consentLabel));
  ok("the flat snapshot contains every line that was on screen", terms.bullets.every((b) => terms.text.includes(b)));

  const fr = buildAutoTopupTerms({
    thresholdCents: 500,
    amountCents: 1000,
    maxPerDay: 3,
    dailyCents: 3000,
    currency: "USD",
    companyName: "Peintres Inc",
    language: "fr",
  });
  ok("French terms exist and are not the English ones", fr.language === "fr" && fr.text !== terms.text);
  ok("…with all four items present", fr.bullets.length === terms.bullets.length);

  const es = buildAutoTopupTerms({
    thresholdCents: 500,
    amountCents: 1000,
    maxPerDay: 3,
    dailyCents: 3000,
    currency: "USD",
    language: "es",
  });
  ok(
    "a language nobody has reviewed falls back to English rather than being machine-drafted",
    es.language === "en",
  );
}

console.log("\n── What the browser is allowed to see ──────────────────────────────\n");

{
  const w = makeWorld();
  const shown = publicAutoTopup(w.row);
  const serialised = JSON.stringify(shown);
  ok("no Stripe customer id reaches the browser", !/cus_/.test(serialised));
  ok("no payment method id reaches the browser", !/pm_/.test(serialised));
  ok("no setup intent id reaches the browser", !/seti_/.test(serialised));
  ok("…but the last four do, because that is how a person recognises their card", shown.cardLast4 === "4242");
  ok("a company with no row at all renders as null, not as an off switch", publicAutoTopup(null) === null);
}

console.log("\n── The wiring, where there is no single call site ───────────────────\n");

{
  const webhook = read("app/api/voice/webhook/route.js");
  ok(
    "the call webhook tries a top-up after billing",
    /maybeAutoTopup\(\s*number\.companyId\s*\)/.test(webhook),
  );
  ok(
    "…BEFORE it decides whether to stop answering, or the phone goes quiet first",
    webhook.indexOf("maybeAutoTopup(") < webhook.indexOf("const after = await canTakeCall("),
  );

  const dispatcher = read("lib/stripe/settleCheckoutSession.js");
  ok(
    "a saved-card setup session is claimed by the dispatcher, so a closed tab still arms it",
    /kind === "voice_auto_topup"/.test(dispatcher) && /recordAutoTopupMandate/.test(dispatcher),
  );

  const crons = JSON.parse(read("vercel.json")).crons.map((c) => c.path);
  ok(
    "…and a cron sweeps the balances no call webhook will ever revisit",
    crons.includes("/api/cron/voice-auto-topup"),
  );

  const route = read("app/api/settings/voice/auto-topup/route.js");
  ok(
    "the settings route refuses without an explicit tick — consent is never inferred",
    /body\.acceptTerms !== true/.test(route),
  );
  ok(
    "…and records the consent BEFORE opening Stripe",
    route.indexOf("recordAutoTopupConsent") < route.indexOf("createAutoTopupSetupSession"),
  );

  const lib = read("lib/voice/autoTopup.js");
  ok(
    "the off-session setup is spelled out rather than left to a default",
    /usage: "off_session"/.test(lib),
  );
  ok(
    "cards only — a five-day debit is not a top-up",
    /payment_method_types: \["card"\]/.test(lib),
  );
  const libCode = code(lib);
  ok(
    "the charge is a PLATFORM billing charge, with no Connect transfer anywhere near it",
    !/transfer_data/.test(libCode) && !/application_fee/.test(libCode),
  );
  ok(
    "…and it never builds its own Stripe client",
    !/new Stripe\(/.test(lib),
  );
  ok(
    "the settlement is the shared one, not a second crediting path",
    /creditVoiceAutoTopup/.test(lib) && !/voiceCreditEntry\.create/.test(lib),
  );

  // The claim is a compare-and-set, not a read-then-write. This is the single
  // line that stops two invocations both charging, and it is easy to "tidy"
  // into an ordinary update.
  ok(
    "the in-flight claim is conditional on the row state that was read",
    /updateMany\(\{\s*where:\s*\{\s*companyId,\s*chargeInFlightAt:\s*config\.chargeInFlightAt/.test(lib),
  );
  ok(
    "…and a claim that matched nothing refuses rather than carrying on",
    /claim\.count !== 1/.test(lib),
  );
}

console.log(
  `\n${failures ? "FAILED" : "PASSED"} — ${checks - failures}/${checks} checks\n`,
);
process.exit(failures ? 1 : 0);
