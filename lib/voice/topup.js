// lib/voice/topup.js
//
// Turning a paid Stripe Checkout Session into voice credit — from EITHER of the
// two things that can tell us the payment happened.
//
// ══ Why this is a module and not a branch in one route ═════════════════════
//
// Until now there was exactly one way a top-up became credit: the browser
// coming back to /app/settings/voice?topup=<session id>, which asks the API to
// confirm that session against Stripe and add the credit. That path works — the
// two real top-ups in production were credited by it, and their rows are still
// the only evidence of either payment.
//
// What it cannot survive is the browser not coming back. Pay on a phone and
// close the tab; lose signal in a driveway somewhere between Stripe and the
// redirect; have the confirm fetch fail for any of the ordinary reasons a fetch
// fails. The card is charged, the ledger never moves, and nothing ever revisits
// the question. The contractor is out of pocket with a balance that did not
// change and no error to point at.
//
// `checkout.session.completed` exists precisely because a redirect is not a
// receipt. Voice top-ups were the one payment FieldQuo takes that no webhook
// handled on EITHER endpoint — the metadata said `kind: "voice_topup"` and
// nothing in the repository read it. AGENTS.md failure class #1, applied to
// money.
//
// ══ Which means the two can race ═══════════════════════════════════════════
//
// The redirect and the webhook fire seconds apart, in either order, and after a
// re-delivery they can both fire twice. So "credited exactly once" has to be
// something the database enforces rather than something a comment claims. See
// topupRef() in credits.js: a unique (companyId, ref) index keyed on the payment
// intent. The lookup below is a fast path in front of that index, and it is also
// what recognises the rows written before refs existed — those carry the session
// id in stripeRef and nothing in ref, and must not be credited a second time now
// that a webhook has started asking.

import { db } from "@/lib/db";
import { addCredit, balanceFor, normaliseTopup, topupRef } from "@/lib/voice/credits";
import { syncNumberAttachment } from "@/lib/voice/provision";
import { recordActivity } from "@/lib/activity/log";

/**
 * Credit a company for one paid voice top-up.
 *
 * @param session  a Stripe Checkout Session with `kind: "voice_topup"` metadata
 * @param member   the signed-in member, when a person is standing in front of
 *                 this. Absent on the webhook path, which has no actor.
 * @param deps     seams for scripts/check-voice-topup.mjs. A check that needs a
 *                 database and a Stripe secret is a check that stops being run,
 *                 and the thing most worth checking here — that two settlement
 *                 paths credit once between them — is unreadable and only
 *                 provable by execution. Production callers pass nothing.
 * @returns {{credited: boolean, alreadyCredited?: boolean, reason?: string,
 *            cents?: number, balance?: number}}
 *          `credited: true` means the credit for this payment is on the ledger
 *          — not necessarily that THIS call put it there.
 */
export async function creditVoiceTopup(session, { member = null, deps = {} } = {}) {
  const companyId = session?.metadata?.companyId || null;
  if (!companyId) return { credited: false, reason: "no_company" };

  // A delayed-notification method completes the session `unpaid` and settles
  // minutes later. Crediting then would hand out talk time against money that
  // may never arrive, and a call already made cannot be un-made.
  if (session.payment_status !== "paid") {
    return { credited: false, reason: session.payment_status || "not_paid_yet" };
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  // What Stripe actually TOOK, in preference to what we asked it for. The two
  // agree today, and the day they stop agreeing — a coupon, a currency
  // adjustment, an amount edited at the Stripe end — the honest number is the
  // one that left the contractor's card. metadata.cents stays as the fallback
  // for a session that somehow carries no total; it is server-written at
  // creation and never round-trips through a browser, so it is safe to trust,
  // but it is a statement of intent rather than of fact.
  //
  // Written without a `cents > x` comparison on purpose: this asks whether there
  // is an amount at all, and check:voice-spend rightly refuses to let any file
  // outside credits.js/spendGate.js hold an opinion about what a balance is
  // enough FOR. Crediting is not spending, but the two read identically at a
  // glance, and that resemblance is how a second affordability rule gets born.
  const cents = Math.max(
    0,
    Math.round(Number(session.amount_total) || normaliseTopup(session.metadata?.cents) || 0),
  );

  return settleTopupPayment({
    companyId,
    cents,
    paymentIntentId,
    // The SESSION id, not the intent's. Rows written before refs existed carry
    // it here, and `legacyStripeRef` below is what stops those being credited a
    // second time now that a webhook has started asking.
    stripeRef: session.id,
    legacyStripeRef: session.id,
    member,
    deps,
  });
}

/**
 * Credit an AUTOMATIC top-up — the same settlement, reached from a PaymentIntent
 * that FieldQuo confirmed off-session rather than from a Checkout Session the
 * contractor completed.
 *
 * ── Why an adapter and not a second crediting path ─────────────────────────
 *
 * Because two ways of turning a payment into credit is two things that can
 * disagree, and the one nobody looks at is the one that rots. So both doors go
 * through settleTopupPayment below, and — this is the part that matters — both
 * key on `topupRef(paymentIntentId)`. A manual top-up and an automatic one for
 * the same intent cannot both land: the unique (companyId, ref) index refuses
 * the second, whichever arrives first.
 *
 * A PaymentIntent is not a Checkout Session and is deliberately not dressed up
 * as one. `status`, not `payment_status`; `amount_received`, not
 * `amount_total`. Faking a session shape here would have put a lie in the one
 * function that has to be readable when somebody is looking at a chargeback.
 */
export async function creditVoiceAutoTopup(paymentIntent, { deps = {} } = {}) {
  const companyId = paymentIntent?.metadata?.companyId || null;
  if (!companyId) return { credited: false, reason: "no_company" };

  // `succeeded` and nothing else. A `processing` intent is money that has been
  // accepted and not yet settled, and crediting it would hand out talk time
  // against a payment that can still fail. Cards do not do this, which is
  // exactly why the auto path is cards-only — but the guard is here rather than
  // in a comment because "cards only" is a policy and this is a fact.
  if (paymentIntent.status !== "succeeded") {
    return { credited: false, reason: paymentIntent.status || "not_paid_yet" };
  }

  // What was RECEIVED, in preference to what was asked for — same rule as the
  // session path, for the same reason.
  const cents = Math.max(
    0,
    Math.round(Number(paymentIntent.amount_received) || Number(paymentIntent.amount) || 0),
  );

  return settleTopupPayment({
    companyId,
    cents,
    paymentIntentId: paymentIntent.id,
    stripeRef: paymentIntent.id,
    // No legacy key: nothing has ever written an automatic top-up any other
    // way, so there is no older shape to recognise.
    legacyStripeRef: null,
    automatic: true,
    deps,
  });
}

/**
 * The one settlement. Everything above is an adapter onto this.
 *
 * @param legacyStripeRef  an older key this same payment might already be on
 *                         the ledger under. Checked alongside `ref` so a row
 *                         written before refs existed is recognised rather than
 *                         credited again.
 * @param automatic        who initiated it, for the activity log and the note.
 *                         Not a branch in the money: an automatic top-up and a
 *                         manual one are the same credit, and the only thing
 *                         that differs is what the statement line says.
 */
async function settleTopupPayment({
  companyId,
  cents,
  paymentIntentId,
  stripeRef,
  legacyStripeRef = null,
  member = null,
  automatic = false,
  deps = {},
}) {
  const prisma = deps.db || db;
  const credit = deps.addCredit || addCredit;
  const readBalance = deps.balanceFor || balanceFor;
  const attachNumber = deps.syncNumberAttachment || syncNumberAttachment;
  const logActivity = deps.recordActivity || recordActivity;

  if (!companyId) return { credited: false, reason: "no_company" };
  if (!cents) return { credited: false, reason: "no_amount" };

  const ref = topupRef(paymentIntentId || stripeRef);

  // Both keys, for the same reason chargeCall() matches on callId as well as
  // ref: rows written before this module existed key on the session id alone.
  const existing = await prisma.voiceCreditEntry.findFirst({
    where: {
      companyId,
      OR: [{ ref }, ...(legacyStripeRef ? [{ stripeRef: legacyStripeRef }] : [])],
    },
    select: { id: true },
  });
  if (existing) {
    return { credited: true, alreadyCredited: true, cents, balance: await readBalance(companyId) };
  }

  const amount = `$${(cents / 100).toFixed(2)}`;

  await credit({
    companyId,
    cents,
    kind: "topup",
    stripeRef,
    ref,
    // The statement has to say which. "Top-up $30" against a charge nobody
    // remembers making is the line that generates the support ticket; "Automatic
    // top-up $30" is the line that answers it.
    note: automatic ? `Automatic top-up ${amount}` : `Top-up ${amount}`,
  });

  // Attributed to the person who paid when there is one, and to Stripe when the
  // webhook got here first. "Someone added $30 of credit" with no name against
  // it reads as a bug; naming the source is the difference between a log entry
  // and a mystery.
  await logActivity(member || { companyId }, {
    action: automatic ? "voice.credit_auto_added" : "voice.credit_added",
    entityType: "settings",
    actorName: member
      ? undefined
      : automatic
        ? "Automatic top-up"
        : "Stripe (payment confirmed)",
    summary: automatic
      ? `Automatically added ${amount} of phone credit`
      : `Added ${amount} of phone credit`,
    metadata: { cents, stripeRef, paymentIntentId, automatic },
  });

  // Back in credit — put the agent back on the number if the contractor still
  // has the receptionist switched on. Without this, an account that ran dry
  // stayed silent after paying, which reads as "the top-up didn't work".
  //
  // Never allowed to fail the settlement: the money is banked and the ledger is
  // written by this point, and throwing here would ask Stripe to redeliver an
  // event whose only remaining work is a provider call that will fail again.
  await attachNumber(companyId).catch(() => {});

  return { credited: true, alreadyCredited: false, cents, balance: await readBalance(companyId) };
}
