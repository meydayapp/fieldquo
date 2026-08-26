// scripts/check-voice-topup.mjs
//
// A paid voice top-up becomes credit EXACTLY ONCE, from either direction.
//
//   npm run check:voice-topup
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// The top-up route wrote `metadata: { kind: "voice_topup" }` onto every Checkout
// Session it created, and a repository-wide grep for that string returned one
// hit: the line that wrote it. No webhook read it — not the Connect one, not the
// platform one, not the dispatcher that was added to fix exactly this class of
// bug for booking fees. AGENTS.md failure class #1, written and never read, on
// the one kind of field where it costs the customer money.
//
// The redirect back to /app/settings/voice?topup=<id> was doing all the work,
// and it did work: both real top-ups in production are on the ledger because of
// it. But a redirect is not a receipt. Close the tab on a phone, lose signal in
// a driveway, have one fetch fail, and the charge is real, the balance never
// moves, and nothing ever asks again.
//
// So now BOTH settle it, which is the whole reason this check has to execute
// rather than read: two paths crediting one payment is only safe if the
// once-only guarantee is real, and "it's idempotent" is a claim no reader can
// verify.
//
// Every assertion below is a sentence someone could otherwise get wrong again:
//
//   1. A voice top-up session is CLAIMED by the dispatcher, not dropped.
//   2. An unpaid session is claimed and credits nothing.
//   3. A paid session credits once, keyed on the payment intent.
//   4. The redirect and the webhook, in either order, credit once between them.
//   5. A row written the OLD way — session id in stripeRef, no ref — is not
//      credited a second time now that a webhook has started asking.
//   6. What Stripe actually took wins over what we asked it for.
//   7. No client-facing screen claims credit landed when it has not.
//
// NO DATABASE and NO STRIPE CALL. Both are injected.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { creditVoiceTopup } from "@/lib/voice/topup";
import { settleCheckoutSession } from "@/lib/stripe/settleCheckoutSession";
import { topupRef } from "@/lib/voice/credits";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

// ── A ledger, just enough of one ───────────────────────────────────────────
//
// Reproduces the ONE semantic that carries the whole guarantee: a unique
// (companyId, ref) index that refuses the second write. Modelling it as a
// read-then-write would test the fast path and quietly skip the thing that
// actually holds when two callers arrive together.
function fakeLedger(seed = []) {
  const rows = seed.map((r, i) => ({ id: `seed${i}`, ref: null, stripeRef: null, ...r }));
  let n = 0;
  const activity = [];
  const attached = [];

  return {
    rows,
    activity,
    attached,
    db: {
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
      },
    },
    // The real addCredit's stripeRef fast path plus the index behind it.
    addCredit: async ({ companyId, cents, kind, stripeRef, ref, note }) => {
      if (stripeRef && rows.some((r) => r.companyId === companyId && r.stripeRef === stripeRef)) {
        return null;
      }
      if (ref && rows.some((r) => r.companyId === companyId && r.ref === ref)) {
        return null; // P2002 — the concurrent caller won, and wrote the same row.
      }
      const row = { id: `e${++n}`, companyId, cents, kind, stripeRef, ref, note };
      rows.push(row);
      return row;
    },
    balanceFor: async (companyId) =>
      rows.filter((r) => r.companyId === companyId).reduce((s, r) => s + r.cents, 0),
    recordActivity: async (member, event) => {
      activity.push({ companyId: member?.companyId, ...event });
    },
    syncNumberAttachment: async (companyId) => {
      attached.push(companyId);
      return { ok: true };
    },
  };
}

const PI = "pi_3QtopUpAbCdEf";
const SESSION_ID = "cs_test_a1DLAF4kQyWzhcydcFitrTdEaAWg312ISbu653WkpNvgALtaxTndZsjPmS";

/** The session Stripe hands the WEBHOOK: payment_intent is a bare string. */
const webhookSession = (over = {}) => ({
  id: SESSION_ID,
  mode: "payment",
  payment_status: "paid",
  amount_total: 1000,
  currency: "usd",
  payment_intent: PI,
  metadata: { companyId: "co1", kind: "voice_topup", cents: "1000" },
  ...over,
});

/** The same payment as the REDIRECT sees it — retrieve() can expand the intent
 *  into an object. Two shapes, one payment; if the ref were read off the wrong
 *  one, the two paths would key differently and credit twice. */
const redirectSession = (over = {}) => ({
  ...webhookSession(),
  payment_intent: { id: PI, object: "payment_intent" },
  ...over,
});

console.log("The dispatcher claims a voice top-up at all");
{
  // settleCheckoutSession reaches the real db once it credits, so only the
  // ROUTING is executed here — which is exactly what was missing. Both cases
  // below return before any query.
  const unpaid = await settleCheckoutSession(webhookSession({ payment_status: "unpaid" }));
  ok("a voice top-up session is CLAIMED — it used to fall through to nothing",
    unpaid.handled === true && unpaid.kind === "voice_topup");
  ok("and an unpaid one credits nothing",
    unpaid.result?.credited === false, `(${unpaid.result?.reason})`);

  const strayed = await settleCheckoutSession({
    id: "cs_z", mode: "payment", payment_status: "paid", metadata: { kind: "voice_topup" },
  });
  ok("a top-up with no company on it is refused rather than guessed at",
    strayed.result?.credited === false && strayed.result?.reason === "no_company");

  const other = await settleCheckoutSession({
    id: "cs_y", mode: "subscription", metadata: { companyId: "co1", planId: "p1" },
  });
  ok("a subscription checkout is still NOT claimed — it belongs to billing",
    other.handled === false);
}

console.log("\nOne payment, one credit");
{
  const L = fakeLedger();
  const r = await creditVoiceTopup(webhookSession(), { deps: L });
  ok("a paid top-up credits", r.credited === true && r.alreadyCredited === false);
  ok("for what Stripe took", r.cents === 1000 && L.rows[0].cents === 1000);
  ok("keyed on the PAYMENT INTENT, not the session",
    L.rows[0].ref === topupRef(PI), L.rows[0].ref);
  ok("with the session id kept for tracing a dispute back",
    L.rows[0].stripeRef === SESSION_ID);
  ok("as a topup, not an adjustment", L.rows[0].kind === "topup");
  ok("the balance comes back with it", r.balance === 1000);
  ok("the agent is put back on the number", L.attached.includes("co1"));
  ok("and it is in the activity log, attributed to Stripe when nobody is there",
    L.activity.length === 1 && L.activity[0].actorName === "Stripe (payment confirmed)");
}

console.log("\nThe two paths, in either order, credit once between them");
{
  const L = fakeLedger();
  await creditVoiceTopup(redirectSession(), { deps: L, member: { companyId: "co1", id: "m1" } });
  const second = await creditVoiceTopup(webhookSession(), { deps: L });
  ok("redirect first, then the webhook → one entry", L.rows.length === 1);
  ok("and the webhook says so rather than claiming a fresh credit",
    second.credited === true && second.alreadyCredited === true);
  ok("no second activity row for one payment", L.activity.length === 1);
  ok("attributed to the person when a person was there",
    L.activity[0].actorName === undefined);
}
{
  const L = fakeLedger();
  await creditVoiceTopup(webhookSession(), { deps: L });
  await creditVoiceTopup(redirectSession(), { deps: L, member: { companyId: "co1", id: "m1" } });
  ok("webhook first, then the redirect → one entry", L.rows.length === 1);
  ok("balance is the one payment, not two", await L.balanceFor("co1") === 1000);
}
{
  const L = fakeLedger();
  await creditVoiceTopup(webhookSession(), { deps: L });
  await creditVoiceTopup(webhookSession(), { deps: L });
  await creditVoiceTopup(webhookSession(), { deps: L });
  ok("a webhook re-delivered twice more still credits once", L.rows.length === 1);
}

console.log("\nRows written before any of this existed");
{
  // Exactly the shape of the two real top-ups in production: the session id in
  // stripeRef, ref null, because the redirect route wrote them before refs were
  // used for top-ups. A webhook arriving for one of those must recognise it.
  const L = fakeLedger([
    { companyId: "co1", cents: 1000, kind: "topup", stripeRef: SESSION_ID, ref: null },
  ]);
  const r = await creditVoiceTopup(webhookSession(), { deps: L });
  ok("a legacy top-up row is recognised and NOT credited again",
    L.rows.length === 1 && r.alreadyCredited === true);
  ok("balance unchanged", await L.balanceFor("co1") === 1000);
}
{
  // The other company's payment must not satisfy this one's.
  const L = fakeLedger([
    { companyId: "co2", cents: 1000, kind: "topup", stripeRef: SESSION_ID, ref: null },
  ]);
  await creditVoiceTopup(webhookSession(), { deps: L });
  ok("a matching row on ANOTHER company does not block this credit",
    L.rows.length === 2 && await L.balanceFor("co1") === 1000);
}

console.log("\nThe amount is what was actually charged");
{
  const L = fakeLedger();
  // metadata says $10, Stripe took $8 — a coupon, an edited amount, anything.
  await creditVoiceTopup(webhookSession({ amount_total: 800 }), { deps: L });
  ok("Stripe's total wins over the amount we asked for", L.rows[0].cents === 800);
  ok("and the note says what the contractor was actually charged",
    L.rows[0].note === "Top-up $8.00", L.rows[0].note);
}
{
  const L = fakeLedger();
  await creditVoiceTopup(webhookSession({ amount_total: null }), { deps: L });
  ok("a session with no total falls back to the amount we asked for",
    L.rows[0].cents === 1000);
}
{
  const L = fakeLedger();
  const r = await creditVoiceTopup(webhookSession({ amount_total: 0, metadata: { companyId: "co1", kind: "voice_topup" } }), { deps: L });
  ok("and a session with no amount anywhere credits nothing rather than zero",
    r.credited === false && L.rows.length === 0, `(${r.reason})`);
}
{
  const L = fakeLedger();
  for (const status of ["unpaid", "no_payment_required", undefined]) {
    const r = await creditVoiceTopup(webhookSession({ payment_status: status }), { deps: L });
    ok(`payment_status ${String(status)} credits nothing`, r.credited === false);
  }
  ok("nothing was written by any of them", L.rows.length === 0);
}

console.log("\nWhat the route and the screen actually do");
{
  const route = read("app/api/settings/voice/topup/route.js");
  ok("the confirm route still checks the session belongs to this company",
    /session\?\.metadata\?\.companyId !== member\.companyId/.test(route));
  ok("and settles through the shared helper rather than its own copy",
    /creditVoiceTopup\(session, \{ member \}\)/.test(route) && !/addCredit\(/.test(route));
  ok("the success URL still carries Stripe's session id",
    /success_url:.*\{CHECKOUT_SESSION_ID\}/.test(route));
  ok("and the session still carries the kind the dispatcher routes on",
    /kind: "voice_topup"/.test(route));

  const page = read("app/app/settings/voice/page.js");
  // The failure this replaces: `.catch(() => {})` around the confirm, so a
  // contractor who had just been charged came back to an unchanged balance and
  // no explanation at all.
  ok("the screen no longer swallows a failed confirmation",
    !/topup\?session_id=\$\{encodeURIComponent\(topup\)\}`\)\.catch\(/.test(page));
  ok("it says credit landed only when the SERVER said it did",
    /confirmed\?\.credited\s*\n?\s*\?/.test(page));
  ok("and tells them it will land on its own otherwise",
    /app\.setVoice\.topupPending/.test(page));

  // Both keys have to exist in the catalogue or t() renders the key itself.
  const cat = read("app/i18n/appMessages.js");
  for (const k of ["app.setVoice.topupCredited", "app.setVoice.topupPending"]) {
    ok(`${k} is a real key`, cat.includes(`"${k}"`));
  }
}

console.log("\nBoth webhooks reach the dispatcher");
{
  // The bug this whole family comes from is a handler living on the one endpoint
  // that, by construction, never receives the event. Neither route may decide
  // for itself which kinds of session it is willing to place.
  for (const f of ["app/api/stripe/webhook/route.js", "app/api/platform/billing/webhook/route.js"]) {
    const src = read(f);
    ok(`${f.split("/").slice(-2)[0]} dispatches completed sessions`,
      /settleCheckoutSession\(/.test(src) && /checkout\.session\.completed/.test(src));
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
